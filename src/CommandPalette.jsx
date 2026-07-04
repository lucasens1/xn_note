import { useEffect, useMemo, useRef, useState } from 'react'

export default function CommandPalette({ open, onClose, notes, actions, onOpenNote }) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setIdx(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const items = useMemo(() => {
    const query = q.trim().toLowerCase()
    const acts = actions
      .filter((a) => !query || a.label.toLowerCase().includes(query))
      .map((a) => ({ type: 'action', id: 'act-' + a.label, ...a }))
    const ns = notes
      .filter(
        (n) =>
          !query ||
          (n.title || '').toLowerCase().includes(query) ||
          (n.content || '').toLowerCase().includes(query),
      )
      .slice(0, 8)
      .map((n) => ({
        type: 'note',
        id: 'note-' + n.id,
        label: n.title || 'Untitled',
        hint: n.folder || '',
        note: n,
      }))
    return [...acts, ...ns]
  }, [q, actions, notes])

  useEffect(() => {
    if (idx >= items.length) setIdx(0)
  }, [items.length, idx])

  if (!open) return null

  function run(item) {
    onClose()
    if (item.type === 'action') item.run()
    else onOpenNote(item.note.id)
  }

  function onKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIdx((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[idx]) run(items[idx])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="palette-scrim" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Search notes or run a command…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setIdx(0)
          }}
          onKeyDown={onKey}
        />
        <div className="palette-list">
          {items.length === 0 && <div className="palette-empty">No results</div>}
          {items.map((it, i) => (
            <div
              key={it.id}
              className={'palette-item' + (i === idx ? ' active' : '')}
              onMouseEnter={() => setIdx(i)}
              onClick={() => run(it)}
            >
              <span className="pi-icon">{it.type === 'action' ? '⚡' : '📄'}</span>
              <span className="pi-label">{it.label}</span>
              {it.hint && <span className="pi-hint">{it.hint}</span>}
              {it.shortcut && <span className="pi-kbd">{it.shortcut}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
