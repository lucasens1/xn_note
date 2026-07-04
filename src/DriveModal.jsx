import { useState } from 'react'
import {
  getClientId,
  setClientId,
  isConfigured,
  getLastBackup,
  connect,
  backupToDrive,
  restoreFromDrive,
} from './gdrive'
import { importNotes } from './io'

function ago(iso) {
  if (!iso) return 'never'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function DriveModal({ open, onClose, notes, online, flash, onRestored }) {
  const [clientId, setId] = useState(getClientId())
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [last, setLast] = useState(getLastBackup())

  if (!open) return null

  const configured = isConfigured()

  function saveId() {
    setClientId(clientId)
    setError('')
    flash('Client ID saved')
  }

  async function run(kind) {
    if (!online) {
      setError('You are offline — Drive needs a connection.')
      return
    }
    setError('')
    setBusy(kind)
    setProgress(null)
    try {
      if (kind === 'backup') {
        await connect()
        const r = await backupToDrive(notes, (done, total) =>
          setProgress(`${done}/${total}`),
        )
        setLast(r.when)
        flash(`Backed up ${r.count} notes to Drive ✓`)
      } else if (kind === 'restore') {
        await connect()
        const arr = await restoreFromDrive()
        const n = await importNotes(arr)
        onRestored?.(n)
        flash(`Restored ${n} notes from Drive ✓`)
      } else if (kind === 'connect') {
        await connect()
        flash('Connected to Google Drive ✓')
      }
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setBusy('')
      setProgress(null)
    }
  }

  return (
    <div className="palette-scrim" onMouseDown={onClose}>
      <div className="drive-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drive-head">
          <span>☁ Google Drive</span>
          <button className="drive-x" onClick={onClose}>
            ✕
          </button>
        </div>

        {!online && (
          <div className="drive-banner">Offline — connect to use Drive.</div>
        )}

        <div className="drive-body">
          <label className="drive-label">OAuth Client ID</label>
          <div className="drive-row">
            <input
              className="drive-input"
              placeholder="xxxxx.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setId(e.target.value)}
              spellCheck={false}
            />
            <button className="drive-btn" onClick={saveId}>
              Save
            </button>
          </div>
          <div className="drive-hint">
            One-time setup — see SETUP-GDRIVE.md. Stored only in this browser.
          </div>

          <div className="drive-divider" />

          <div className="drive-actions">
            <button
              className="drive-btn primary"
              disabled={!configured || !online || !!busy}
              onClick={() => run('backup')}
            >
              {busy === 'backup'
                ? `Backing up… ${progress || ''}`
                : '⬆ Back up to Drive'}
            </button>
            <button
              className="drive-btn"
              disabled={!configured || !online || !!busy}
              onClick={() => run('restore')}
            >
              {busy === 'restore' ? 'Restoring…' : '⬇ Restore (merge)'}
            </button>
          </div>

          <div className="drive-status">
            Last backup: <b>{ago(last)}</b>
            {' · '}
            Stores <code>tty-notes-backup.json</code> + one <code>.md</code> per note
            in a <b>“tty notes”</b> folder.
          </div>

          {error && <div className="drive-error">{error}</div>}
        </div>
      </div>
    </div>
  )
}
