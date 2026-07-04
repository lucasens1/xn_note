import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { db, createNote, updateNote, deleteNote } from './db'
import {
  exportAllJson,
  exportAllMarkdown,
  exportNoteMd,
  importFiles,
} from './io'
import CommandPalette from './CommandPalette'
import './App.css'

const VIEWS = ['edit', 'split', 'preview']

function snippet(md) {
  return (md || '')
    .replace(/[#>*_`~\-\[\]!]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function App() {
  const notes =
    useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray(), []) || []

  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [folderFilter, setFolderFilter] = useState('All')
  const [activeTags, setActiveTags] = useState([])
  const [view, setView] = useState('split')
  const [draft, setDraft] = useState({ title: '', content: '', folder: '', tags: [] })
  const [tagInput, setTagInput] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [installEvt, setInstallEvt] = useState(null)

  const saveTimer = useRef(null)
  const toastTimer = useRef(null)
  const searchRef = useRef(null)
  const fileRef = useRef(null)

  function flash(msg) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  const folders = useMemo(() => {
    const set = new Set()
    notes.forEach((n) => n.folder && set.add(n.folder))
    return ['All', ...Array.from(set).sort()]
  }, [notes])

  const allTags = useMemo(() => {
    const set = new Set()
    notes.forEach((n) => (n.tags || []).forEach((t) => set.add(t)))
    return Array.from(set).sort()
  }, [notes])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return notes.filter((n) => {
      if (folderFilter !== 'All' && (n.folder || '') !== folderFilter) return false
      if (activeTags.length && !activeTags.every((t) => (n.tags || []).includes(t)))
        return false
      if (!q) return true
      return (
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q)
      )
    })
  }, [notes, search, folderFilter, activeTags])

  const selected = notes.find((n) => n.id === selectedId) || null

  useEffect(() => {
    if (selected) {
      setDraft({
        title: selected.title || '',
        content: selected.content || '',
        folder: selected.folder || '',
        tags: selected.tags || [],
      })
      setTagInput('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // Debounced autosave — selectedId captured per call so switching notes still
  // flushes the previous note's last edit.
  function edit(patch) {
    const next = { ...draft, ...patch }
    setDraft(next)
    const id = selectedId
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (id != null) {
        updateNote(id, {
          title: next.title.trim() || 'Untitled',
          content: next.content,
          folder: next.folder.trim(),
          tags: next.tags,
        })
      }
    }, 300)
  }

  function addTag(raw) {
    const t = raw.trim().replace(/^#/, '')
    if (!t) return
    if (!draft.tags.includes(t)) edit({ tags: [...draft.tags, t] })
    setTagInput('')
  }
  function removeTag(t) {
    edit({ tags: draft.tags.filter((x) => x !== t) })
  }

  function toggleTagFilter(t) {
    setActiveTags((cur) =>
      cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t],
    )
  }

  async function handleNew() {
    const id = await createNote({
      folder: folderFilter !== 'All' ? folderFilter : '',
      tags: activeTags,
    })
    setSelectedId(id)
    setView('split')
    setSidebarOpen(false)
  }

  async function handleDelete(id, e) {
    e?.stopPropagation()
    if (!confirm('Delete this note?')) return
    await deleteNote(id)
    if (selectedId === id) setSelectedId(null)
  }

  function openNote(id) {
    setSelectedId(id)
    setSidebarOpen(false)
  }

  function cycleView() {
    setView((v) => VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length])
  }

  async function doImport(e) {
    const files = e.target.files
    if (files?.length) {
      const n = await importFiles(files)
      flash(`Imported ${n} note${n === 1 ? '' : 's'}`)
    }
    e.target.value = ''
  }

  async function triggerInstall() {
    if (!installEvt) return
    installEvt.prompt()
    await installEvt.userChoice
    setInstallEvt(null)
  }

  // Capture the Android/Chrome install prompt for a one-tap Install button.
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  // Global keyboard shortcuts.
  useEffect(() => {
    function onKey(e) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      } else if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        handleNew()
      } else if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        cycleView()
      } else if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSidebarOpen(true)
        setTimeout(() => searchRef.current?.focus(), 0)
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        flash('Saved ✓')
      } else if (e.key === 'Escape') {
        setMenuOpen(false)
        setSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, selectedId, folderFilter, activeTags])

  const paletteActions = [
    { label: 'New note', shortcut: '⌘N', run: handleNew },
    {
      label: 'Import file (.md / .json)…',
      run: () => fileRef.current?.click(),
    },
    {
      label: 'Export all — JSON backup',
      run: async () => flash(`Exported ${await exportAllJson()} notes`),
    },
    {
      label: 'Export all — single .md',
      run: async () => flash(`Exported ${await exportAllMarkdown()} notes`),
    },
    ...(selected
      ? [
          {
            label: 'Export this note — .md',
            run: () => exportNoteMd(selected),
          },
        ]
      : []),
    { label: 'Cycle view (edit/split/preview)', shortcut: '⌘E', run: cycleView },
  ]

  return (
    <div className="app">
      <input
        ref={fileRef}
        type="file"
        accept=".md,.markdown,.txt,.json"
        multiple
        hidden
        onChange={doImport}
      />

      <aside className={'sidebar' + (sidebarOpen ? ' open' : '')}>
        <div className="brand-row">
          <div className="brand">
            <span className="logo">✳</span> xn
          </div>
          {installEvt && (
            <button className="install-btn" onClick={triggerInstall}>
              ⬇ Install
            </button>
          )}
        </div>

        <button className="new-btn" onClick={handleNew}>
          + New note <span className="kbd">⌘N</span>
        </button>

        <input
          ref={searchRef}
          className="search"
          placeholder="Search…  (⌘K)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="folders">
          {folders.map((f) => (
            <button
              key={f}
              className={'folder' + (folderFilter === f ? ' active' : '')}
              onClick={() => setFolderFilter(f)}
            >
              {f === 'All' ? '🗂 All' : '📁 ' + f}
            </button>
          ))}
        </div>

        {allTags.length > 0 && (
          <div className="tag-filters">
            {allTags.map((t) => (
              <button
                key={t}
                className={'tagchip' + (activeTags.includes(t) ? ' active' : '')}
                onClick={() => toggleTagFilter(t)}
              >
                #{t}
              </button>
            ))}
          </div>
        )}

        <div className="list">
          {filtered.length === 0 && <div className="empty-list">No notes</div>}
          {filtered.map((n) => (
            <div
              key={n.id}
              className={'item' + (n.id === selectedId ? ' active' : '')}
              onClick={() => openNote(n.id)}
            >
              <div className="item-head">
                <span className="item-title">{n.title || 'Untitled'}</span>
                <button
                  className="del"
                  title="Delete"
                  onClick={(e) => handleDelete(n.id, e)}
                >
                  ✕
                </button>
              </div>
              <div className="item-snip">{snippet(n.content) || 'Empty note'}</div>
              <div className="item-meta">
                {n.folder && <span className="tag">{n.folder}</span>}
                {(n.tags || []).slice(0, 3).map((t) => (
                  <span key={t} className="tag hash">
                    #{t}
                  </span>
                ))}
                <span className="ago">{timeAgo(n.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="main">
        {selected ? (
          <>
            <header className="toolbar">
              <button
                className="hamburger"
                onClick={() => setSidebarOpen((v) => !v)}
                title="Notes"
              >
                ☰
              </button>
              <input
                className="title-input"
                value={draft.title}
                placeholder="Untitled"
                onChange={(e) => edit({ title: e.target.value })}
              />
              <div className="view-switch">
                {VIEWS.map((v) => (
                  <button
                    key={v}
                    className={view === v ? 'active' : ''}
                    onClick={() => setView(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="menu-wrap">
                <button
                  className="icon-btn"
                  onClick={() => setMenuOpen((v) => !v)}
                  title="More"
                >
                  ⋯
                </button>
                {menuOpen && (
                  <>
                    <div className="menu-scrim" onClick={() => setMenuOpen(false)} />
                    <div className="menu">
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          setPaletteOpen(true)
                        }}
                      >
                        Command palette <span className="kbd">⌘K</span>
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          exportNoteMd(selected)
                        }}
                      >
                        Export this note (.md)
                      </button>
                      <button
                        onClick={async () => {
                          setMenuOpen(false)
                          flash(`Exported ${await exportAllJson()} notes`)
                        }}
                      >
                        Export all (JSON backup)
                      </button>
                      <button
                        onClick={async () => {
                          setMenuOpen(false)
                          flash(`Exported ${await exportAllMarkdown()} notes`)
                        }}
                      >
                        Export all (single .md)
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          fileRef.current?.click()
                        }}
                      >
                        Import file (.md / .json)…
                      </button>
                    </div>
                  </>
                )}
              </div>
            </header>

            <div className="metabar">
              <input
                className="folder-input"
                list="folder-options"
                value={draft.folder}
                placeholder="📁 folder"
                onChange={(e) => edit({ folder: e.target.value })}
              />
              <datalist id="folder-options">
                {folders
                  .filter((f) => f !== 'All')
                  .map((f) => (
                    <option key={f} value={f} />
                  ))}
              </datalist>
              <div className="tags-edit">
                {draft.tags.map((t) => (
                  <span key={t} className="tagchip solid">
                    #{t}
                    <button onClick={() => removeTag(t)}>✕</button>
                  </span>
                ))}
                <input
                  className="tag-input"
                  list="tag-options"
                  value={tagInput}
                  placeholder="+ tag"
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addTag(tagInput)
                    } else if (e.key === 'Backspace' && !tagInput && draft.tags.length) {
                      removeTag(draft.tags[draft.tags.length - 1])
                    }
                  }}
                  onBlur={() => tagInput && addTag(tagInput)}
                />
                <datalist id="tag-options">
                  {allTags.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </div>

            <section className={'editor view-' + view}>
              {view !== 'preview' && (
                <textarea
                  className="md-input"
                  value={draft.content}
                  placeholder="Write markdown…"
                  spellCheck={false}
                  onChange={(e) => edit({ content: e.target.value })}
                />
              )}
              {view !== 'edit' && (
                <div className="md-preview markdown-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {draft.content || '*Nothing to preview yet.*'}
                  </ReactMarkdown>
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="placeholder">
            <button
              className="hamburger floating"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              ☰
            </button>
            <div className="ph-inner">
              <div className="ph-logo">✳</div>
              <h1>xn — notes</h1>
              <p>
                Select a note, or press <span className="kbd">⌘K</span> to search.
              </p>
              <button className="new-btn big" onClick={handleNew}>
                + New note
              </button>
            </div>
          </div>
        )}
      </main>

      {sidebarOpen && (
        <div className="scrim" onClick={() => setSidebarOpen(false)} />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        notes={notes}
        actions={paletteActions}
        onOpenNote={openNote}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
