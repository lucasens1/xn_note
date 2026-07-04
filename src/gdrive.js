// Client-side Google Drive sync — no backend. Uses Google Identity Services for
// an in-browser OAuth access token, then calls the Drive REST API with fetch.
//
// Scope: drive.file (non-sensitive) — the app can only see/manage files it
// created, so no Google app-verification is required for personal use.
//
// Layout in Drive (folder "tty notes"):
//   tty-notes-backup.json  full notebook, overwritten each backup (used to Restore)
//   <slug>.md              one readable Markdown file per note (push-only mirror)
import { noteToMarkdown } from './io'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const FOLDER = 'tty notes'
const BACKUP = 'tty-notes-backup.json'
const MAP_KEY = 'xn_gdrive_filemap'
const LAST_KEY = 'xn_gdrive_last_backup'
const ID_KEY = 'xn_gdrive_client_id'

let accessToken = null
let tokenExpiry = 0

// ---- config ----
export function getClientId() {
  return (
    localStorage.getItem(ID_KEY) ||
    import.meta.env.VITE_GDRIVE_CLIENT_ID ||
    ''
  )
}
export function setClientId(id) {
  localStorage.setItem(ID_KEY, (id || '').trim())
  accessToken = null // force re-auth against the new client
}
export function isConfigured() {
  return !!getClientId()
}
export function isConnected() {
  return !!accessToken && Date.now() < tokenExpiry - 60000
}
export function getLastBackup() {
  return localStorage.getItem(LAST_KEY)
}

// ---- auth ----
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.defer = true
    s.onload = resolve
    s.onerror = () => reject(new Error('Failed to load Google script'))
    document.head.appendChild(s)
  })
}

export async function connect({ interactive = true } = {}) {
  const clientId = getClientId()
  if (!clientId) throw new Error('Add your Google OAuth Client ID first.')
  if (isConnected()) return accessToken
  await loadScript(GIS_SRC)
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error))
        accessToken = resp.access_token
        tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000
        resolve(accessToken)
      },
      error_callback: (err) =>
        reject(new Error(err?.message || 'Authorization was cancelled.')),
    })
    client.requestAccessToken({ prompt: interactive ? '' : 'none' })
  })
}

async function token() {
  if (isConnected()) return accessToken
  return connect({ interactive: true })
}

// ---- REST helpers ----
async function api(path, { method = 'GET', headers = {}, body, upload = false, query } = {}) {
  const t = await token()
  const base = upload
    ? 'https://www.googleapis.com/upload/drive/v3'
    : 'https://www.googleapis.com/drive/v3'
  let url = base + path
  if (query) url += '?' + new URLSearchParams(query).toString()
  const res = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + t, ...headers },
    body,
  })
  if (!res.ok) {
    throw new Error(`Drive API ${res.status}: ${await res.text()}`)
  }
  return res.status === 204 ? null : res.json()
}

const escapeQ = (s) => String(s).replace(/'/g, "\\'")

async function findFolder(name) {
  const r = await api('/files', {
    query: {
      q: `name='${escapeQ(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
    },
  })
  return r.files[0]?.id || null
}

async function ensureFolder(name) {
  const existing = await findFolder(name)
  if (existing) return existing
  const r = await api('/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
  })
  return r.id
}

async function findFile(name, parentId) {
  const q =
    `name='${escapeQ(name)}' and trashed=false` +
    (parentId ? ` and '${parentId}' in parents` : '')
  const r = await api('/files', {
    query: { q, fields: 'files(id,name,modifiedTime)', spaces: 'drive' },
  })
  return r.files[0] || null
}

async function uploadFile({ id, name, parents, mimeType, content }) {
  const metadata = {}
  if (name) metadata.name = name
  if (parents && !id) metadata.parents = parents
  const boundary = 'xn' + Math.random().toString(36).slice(2)
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n` +
    content +
    `\r\n--${boundary}--`
  return api(id ? `/files/${id}` : '/files', {
    method: id ? 'PATCH' : 'POST',
    upload: true,
    query: { uploadType: 'multipart', fields: 'id,name,modifiedTime' },
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
}

const loadMap = () => {
  try {
    return JSON.parse(localStorage.getItem(MAP_KEY) || '{}')
  } catch {
    return {}
  }
}
const saveMap = (m) => localStorage.setItem(MAP_KEY, JSON.stringify(m))

function slug(s) {
  return (
    (s || 'untitled')
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'untitled'
  )
}

// ---- public: backup + restore ----
export async function backupToDrive(notes, onProgress) {
  const folderId = await ensureFolder(FOLDER)

  // 1) JSON backup (single file, overwritten)
  const payload = JSON.stringify(
    { app: 'xn-notes', version: 2, exportedAt: new Date().toISOString(), notes },
    null,
    2,
  )
  const existingJson = await findFile(BACKUP, folderId)
  await uploadFile({
    id: existingJson?.id,
    name: BACKUP,
    parents: [folderId],
    mimeType: 'application/json',
    content: payload,
  })

  // 2) one .md per note, tracked by id -> driveFileId so we update (and rename)
  //    instead of duplicating
  const map = loadMap()
  const seen = new Set()
  let i = 0
  for (const n of notes) {
    const key = String(n.id)
    seen.add(key)
    const existingId = map[key]
    const r = await uploadFile({
      id: existingId,
      name: `${slug(n.title)}.md`,
      parents: existingId ? undefined : [folderId],
      mimeType: 'text/markdown',
      content: noteToMarkdown(n),
    })
    map[key] = r.id
    onProgress?.(++i, notes.length)
  }

  // 3) delete .md files for notes that no longer exist locally
  for (const key of Object.keys(map)) {
    if (!seen.has(key)) {
      try {
        await api(`/files/${map[key]}`, { method: 'DELETE' })
      } catch {
        /* already gone */
      }
      delete map[key]
    }
  }
  saveMap(map)

  const when = new Date().toISOString()
  localStorage.setItem(LAST_KEY, when)
  return { count: notes.length, when }
}

// Reads the JSON backup and returns the notes array (authoritative for restore).
export async function restoreFromDrive() {
  const folderId = await findFolder(FOLDER)
  if (!folderId) throw new Error('No "tty notes" folder found in Drive yet.')
  const jsonFile = await findFile(BACKUP, folderId)
  if (!jsonFile) throw new Error('No backup file found in Drive yet.')
  const t = await token()
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${jsonFile.id}?alt=media`,
    { headers: { Authorization: 'Bearer ' + t } },
  )
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  const data = await res.json()
  return Array.isArray(data) ? data : data.notes || []
}
