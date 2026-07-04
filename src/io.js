import { db } from './db'

export function download(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function slug(s) {
  return (
    (s || 'untitled')
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'untitled'
  )
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
    d.getHours(),
  )}${p(d.getMinutes())}`
}

// --- Export ---------------------------------------------------------------

export function noteToMarkdown(note) {
  const fm = []
  if (note.folder) fm.push(`folder: ${note.folder}`)
  if (note.tags && note.tags.length) fm.push(`tags: [${note.tags.join(', ')}]`)
  const front = fm.length ? `---\n${fm.join('\n')}\n---\n\n` : ''
  return front + (note.content || '')
}

export function exportNoteMd(note) {
  download(`${slug(note.title)}.md`, noteToMarkdown(note), 'text/markdown')
}

export async function exportAllJson() {
  const notes = await db.notes.toArray()
  const payload = {
    app: 'xn-notes',
    version: 2,
    exportedAt: new Date().toISOString(),
    notes,
  }
  download(
    `xn-notes-backup-${stamp()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  )
  return notes.length
}

export async function exportAllMarkdown() {
  const notes = await db.notes.orderBy('updatedAt').reverse().toArray()
  const body = notes
    .map((n) => noteToMarkdown({ ...n, content: `# ${n.title || 'Untitled'}\n\n${n.content || ''}` }))
    .join('\n\n---\n\n')
  download(`xn-notes-${stamp()}.md`, body, 'text/markdown')
  return notes.length
}

// --- Import ---------------------------------------------------------------

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return { meta: {}, body: text }
  const meta = {}
  m[1].split('\n').forEach((line) => {
    const i = line.indexOf(':')
    if (i === -1) return
    const key = line.slice(0, i).trim()
    let val = line.slice(i + 1).trim()
    if (key === 'tags') {
      val = val.replace(/^\[|\]$/g, '')
      meta.tags = val
        ? val.split(',').map((s) => s.trim()).filter(Boolean)
        : []
    } else {
      meta[key] = val
    }
  })
  return { meta, body: text.slice(m[0].length) }
}

// Accepts .json backups (full metadata) and .md/.markdown/.txt files (one note
// each). Imported notes are ADDED, never overwrite existing ones.
export async function importFiles(fileList) {
  let count = 0
  for (const file of fileList) {
    const text = await file.text()
    const now = Date.now()
    if (file.name.toLowerCase().endsWith('.json')) {
      try {
        const data = JSON.parse(text)
        const notes = Array.isArray(data) ? data : data.notes || []
        for (const n of notes) {
          await db.notes.add({
            title: n.title || 'Untitled',
            content: n.content || '',
            folder: n.folder || '',
            tags: Array.isArray(n.tags) ? n.tags : [],
            createdAt: n.createdAt || now,
            updatedAt: n.updatedAt || now,
          })
          count++
        }
      } catch (e) {
        console.error('Skipping invalid JSON:', file.name, e)
      }
    } else {
      const { meta, body } = parseFrontmatter(text)
      const heading = body.match(/^#\s+(.+)$/m)?.[1]
      const title = (
        heading || file.name.replace(/\.(md|markdown|txt)$/i, '')
      ).trim()
      await db.notes.add({
        title,
        content: body,
        folder: meta.folder || '',
        tags: meta.tags || [],
        createdAt: now,
        updatedAt: now,
      })
      count++
    }
  }
  return count
}
