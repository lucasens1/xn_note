import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { db, createNote, updateNote, deleteNote } from './db'
import { parseReminder, reminderLabel, countReminders } from './reminders'
import rehypeReminders from './rehypeReminders'
import {
  exportAllJson,
  exportAllMarkdown,
  exportNoteMd,
  importFiles,
  shareNote,
} from './io'
import CommandPalette from './CommandPalette'
import DriveModal from './DriveModal'
import SlashMenu from './SlashMenu'
import { filterSlash } from './slashCommands'
import { getCaretCoordinates } from './caret'
import {
  PencilSquareIcon,
  ViewColumnsIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  ShareIcon,
  Bars3Icon,
  EllipsisHorizontalIcon,
  XMarkIcon,
  FolderPlusIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline'
import './App.css'

const VIEWS = ['edit', 'split', 'preview']
const VIEW_ICONS = {
  edit: PencilSquareIcon,
  split: ViewColumnsIcon,
  preview: EyeIcon,
}

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
  const [slash, setSlash] = useState(null) // { query, start, index, coords }
  const [driveOpen, setDriveOpen] = useState(false)
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('xn_theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia?.('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark'
  })
  const [tip, setTip] = useState(null) // custom tooltip: { text, x, y, below }
  const reminderTimers = useRef([])
  // Folders the user created explicitly — kept even while they contain no notes
  // yet (notes-derived folders alone can't represent an empty folder).
  const [customFolders, setCustomFolders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('xn_folders') || '[]')
    } catch {
      return []
    }
  })
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const saveTimer = useRef(null)
  const toastTimer = useRef(null)
  const searchRef = useRef(null)
  const fileRef = useRef(null)
  const editorRef = useRef(null)

  function flash(msg) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  const folders = useMemo(() => {
    const set = new Set()
    notes.forEach((n) => n.folder && set.add(n.folder))
    customFolders.forEach((f) => f && set.add(f))
    return ['All', ...Array.from(set).sort()]
  }, [notes, customFolders])

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
  const draftReminder = selected
    ? parseReminder(`${draft.title}\n${draft.content}`)
    : null

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
        const rem = parseReminder(`${next.title}\n${next.content}`)
        const remindAt = rem?.remindAt ?? null
        const prev = notes.find((n) => n.id === id)?.remindAt ?? null
        const changes = {
          title: next.title.trim() || 'Untitled',
          content: next.content,
          folder: next.folder.trim(),
          tags: next.tags,
          remindAt,
        }
        if (remindAt !== prev) changes.remindedAt = null // new time can fire
        updateNote(id, changes)
        // Ask for notification permission the first time a reminder is set.
        if (
          remindAt &&
          !prev &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'default'
        ) {
          Notification.requestPermission().then((p) => {
            if (p === 'granted') flash('Reminders on ⏰')
          })
        }
      }
    }, 300)
  }

  // ---- Notion-style "/" block menu -------------------------------------
  function updateSlash(ta) {
    const pos = ta.selectionStart
    const before = ta.value.slice(0, pos)
    const m = before.match(/(^|\s)\/(\w*)$/)
    if (!m) {
      setSlash(null)
      return
    }
    const query = m[2]
    if (filterSlash(query).length === 0) {
      setSlash(null)
      return
    }
    const start = pos - query.length - 1
    // Anchor the menu to the caret row on every device (desktop + mobile).
    // Use the visual viewport so the on-screen keyboard is accounted for.
    const vw = window.visualViewport?.width ?? window.innerWidth
    const vh = window.visualViewport?.height ?? window.innerHeight
    const menuW = Math.min(300, vw - 16)
    const c = getCaretCoordinates(ta, start)
    const rect = ta.getBoundingClientRect()
    let top = rect.top + c.top - ta.scrollTop + c.height + 6
    let left = rect.left + c.left - ta.scrollLeft
    if (left + menuW > vw - 8) left = vw - menuW - 8
    // Flip above the caret line if it would overflow the visible viewport.
    if (top + 300 > vh) top = rect.top + c.top - ta.scrollTop - 300
    const coords = { top: Math.max(8, top), left: Math.max(8, left), width: menuW }
    setSlash({ query, start, index: 0, coords })
  }

  function selectSlash(cmd) {
    const ta = editorRef.current
    if (!ta || !slash) return
    const start = slash.start
    const end = ta.selectionStart
    const content = draft.content
    const next = content.slice(0, start) + cmd.insert + content.slice(end)
    edit({ content: next })
    setSlash(null)
    const caretPos = start + cmd.caret
    const selEnd = caretPos + (cmd.selLen || 0)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(caretPos, selEnd)
    })
  }

  function onEditorKeyDown(e) {
    if (!slash) return
    const items = filterSlash(slash.query)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSlash((s) => ({ ...s, index: (s.index + 1) % items.length }))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSlash((s) => ({ ...s, index: (s.index - 1 + items.length) % items.length }))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      selectSlash(items[Math.min(slash.index, items.length - 1)])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setSlash(null)
    }
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

  function addFolder(raw) {
    const name = (raw || '').trim()
    setNewFolderName('')
    setNewFolderOpen(false)
    if (!name || name === 'All') return
    if (!customFolders.includes(name) && !folders.includes(name)) {
      const next = [...customFolders, name]
      setCustomFolders(next)
      localStorage.setItem('xn_folders', JSON.stringify(next))
    }
    setFolderFilter(name) // select it so the next new note lands here
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

  async function handleShare(note) {
    if (!note) return
    if (!online) {
      flash('Offline — connect to share')
      return
    }
    const r = await shareNote(note)
    if (r === 'shared') flash('Shared ✓')
    else if (r === 'downloaded') flash('Saved .md → send it with Blip')
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

  // Apply + persist the theme.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('xn_theme', theme)
  }, [theme])

  // Custom tooltip via event delegation — works for dynamically-rendered
  // elements (e.g. preview tokens) and isn't clipped by scroll containers.
  useEffect(() => {
    function onOver(e) {
      const el = e.target.closest?.('[data-tip]')
      if (!el) return
      const r = el.getBoundingClientRect()
      const below = r.top < 56
      setTip({
        text: el.getAttribute('data-tip'),
        x: r.left + r.width / 2,
        y: below ? r.bottom : r.top,
        below,
      })
    }
    function onOut(e) {
      if (e.target.closest?.('[data-tip]')) setTip(null)
    }
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    return () => {
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
    }
  }, [])

  // ---- Reminders (fire while the app is open; surface due ones on reopen) ----
  async function fireReminder(id) {
    const n = await db.notes.get(id)
    if (!n || !n.remindAt) return
    if (n.remindedAt && n.remindedAt >= n.remindAt) return // already fired
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const body = snippet(n.content) || 'Reminder'
      try {
        const reg = await navigator.serviceWorker?.ready
        if (reg?.showNotification) {
          await reg.showNotification('⏰ ' + (n.title || 'Reminder'), {
            body,
            tag: 'rem-' + id,
            renotify: true,
          })
        } else {
          new Notification('⏰ ' + (n.title || 'Reminder'), { body })
        }
      } catch {
        /* notification failed — still mark as handled below */
      }
    }
    await db.notes.update(id, { remindedAt: Date.now() }) // no updatedAt bump
  }

  useEffect(() => {
    reminderTimers.current.forEach(clearTimeout)
    reminderTimers.current = []
    const now = Date.now()
    notes.forEach((n) => {
      if (!n.remindAt) return
      if (n.remindedAt && n.remindedAt >= n.remindAt) return
      if (n.remindAt <= now) {
        fireReminder(n.id) // due (or missed while closed) → fire on open
      } else if (n.remindAt - now <= 24 * 60 * 60 * 1000) {
        reminderTimers.current.push(
          setTimeout(() => fireReminder(n.id), n.remindAt - now),
        )
      }
    })
    return () => {
      reminderTimers.current.forEach(clearTimeout)
      reminderTimers.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes])

  // Track connectivity so we can gate online-only actions (Share, Drive).
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

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
      label: 'New folder…',
      run: () => {
        setSidebarOpen(true)
        setNewFolderOpen(true)
      },
    },
    {
      label: 'Import file (.md / .json)…',
      run: () => fileRef.current?.click(),
    },
    {
      label: 'Google Drive — back up / restore…',
      run: () => setDriveOpen(true),
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
            label: 'Share note (Blip / share sheet)',
            run: () => handleShare(selected),
          },
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
            <span className="logo">✳</span>
            <span className="brand-name">tty</span>
            <span className="brand-sub">notes</span>
            <span className="brand-cursor" />
          </div>
          <div className="brand-actions">
            {installEvt && (
              <button className="install-btn" onClick={triggerInstall}>
                <ArrowDownTrayIcon className="ic" />
                Install
              </button>
            )}
            <button
              className="icon-btn theme-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? (
                <SunIcon className="ic" />
              ) : (
                <MoonIcon className="ic" />
              )}
            </button>
            <button
              className="sidebar-close"
              onClick={() => setSidebarOpen(false)}
              title="Close"
            >
              <XMarkIcon className="ic" />
            </button>
          </div>
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

        <div className="section">
          <div className="section-head">
            <span className="section-label">Folders</span>
            <button
              className="section-add"
              onClick={() => setNewFolderOpen(true)}
              title="New folder"
            >
              <FolderPlusIcon className="fic" />
            </button>
          </div>
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
            {newFolderOpen && (
              <input
                className="folder-new-input"
                autoFocus
                placeholder="folder name…"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addFolder(newFolderName)
                  else if (e.key === 'Escape') {
                    setNewFolderOpen(false)
                    setNewFolderName('')
                  }
                }}
                onBlur={() =>
                  newFolderName.trim()
                    ? addFolder(newFolderName)
                    : setNewFolderOpen(false)
                }
              />
            )}
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="section">
            <div className="section-head">
              <span className="section-label">Tags</span>
            </div>
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
                  <button
                    key={t}
                    className={'tag hash' + (activeTags.includes(t) ? ' on' : '')}
                    title={`Filter by #${t}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleTagFilter(t)
                    }}
                  >
                    #{t}
                  </button>
                ))}
                {n.remindAt && (!n.remindedAt || n.remindedAt < n.remindAt) && (
                  <span
                    className="rem-chip"
                    data-tip={`Reminder at ${reminderLabel(n.remindAt)} (your timezone)`}
                  >
                    ⏰ {reminderLabel(n.remindAt)}
                  </span>
                )}
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
                <Bars3Icon className="ic" />
              </button>
              <input
                className="title-input"
                value={draft.title}
                placeholder="Untitled"
                onChange={(e) => edit({ title: e.target.value })}
              />
              <div className="view-switch">
                {VIEWS.map((v) => {
                  const Icon = VIEW_ICONS[v]
                  return (
                    <button
                      key={v}
                      className={view === v ? 'active' : ''}
                      onClick={() => setView(v)}
                      title={v}
                    >
                      <Icon className="vs-ic" />
                      <span className="vs-label">{v}</span>
                    </button>
                  )
                })}
              </div>
              {!online && (
                <span className="offline-pill" title="No connection">
                  ⦿ offline
                </span>
              )}
              <button
                className="icon-btn share-btn"
                onClick={() => handleShare(selected)}
                disabled={!online}
                title={
                  online
                    ? 'Share / Send with Blip'
                    : 'Offline — connect to share'
                }
              >
                <ShareIcon className="ic" />
              </button>
              <div className="menu-wrap">
                <button
                  className="icon-btn"
                  onClick={() => setMenuOpen((v) => !v)}
                  title="More"
                >
                  <EllipsisHorizontalIcon className="ic" />
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
                        disabled={!online}
                        onClick={() => {
                          setMenuOpen(false)
                          handleShare(selected)
                        }}
                      >
                        Share / send with Blip…
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          setDriveOpen(true)
                        }}
                      >
                        Google Drive — back up / restore…
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
              {draftReminder &&
                (() => {
                  const extra =
                    countReminders(`${draft.title}\n${draft.content}`) - 1
                  return (
                    <span
                      className="rem-chip meta"
                      data-tip={
                        `Notifies at ${draftReminder.label} in your timezone, while the app is open.` +
                        (extra > 0
                          ? ` Only this first @time is used — ${extra} other${
                              extra > 1 ? 's' : ''
                            } ignored.`
                          : ' Type @time in the note to set it.')
                      }
                    >
                      ⏰ {draftReminder.label}
                      {extra > 0 && (
                        <span className="rem-extra"> · +{extra} ignored</span>
                      )}
                    </span>
                  )
                })()}
            </div>

            <section className={'editor view-' + view}>
              {view !== 'preview' && (
                <textarea
                  ref={editorRef}
                  className="md-input"
                  value={draft.content}
                  placeholder="Write markdown…   /  blocks  ·  @8:30pm  reminder"
                  spellCheck={false}
                  onChange={(e) => {
                    edit({ content: e.target.value })
                    updateSlash(e.target)
                  }}
                  onKeyDown={onEditorKeyDown}
                  onClick={(e) => updateSlash(e.target)}
                  onBlur={() => setTimeout(() => setSlash(null), 150)}
                />
              )}
              {view !== 'edit' && (
                <div className="md-preview markdown-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight, rehypeReminders]}
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
              <Bars3Icon className="ic" />
            </button>
            <div className="ph-inner">
              <div className="ph-logo">✳</div>
              <h1>tty — notes</h1>
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

      {slash && (
        <SlashMenu
          items={filterSlash(slash.query)}
          index={slash.index}
          coords={slash.coords}
          onHover={(i) => setSlash((s) => ({ ...s, index: i }))}
          onSelect={selectSlash}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        notes={notes}
        actions={paletteActions}
        onOpenNote={openNote}
      />

      <DriveModal
        open={driveOpen}
        onClose={() => setDriveOpen(false)}
        notes={notes}
        online={online}
        flash={flash}
        onRestored={() => {}}
      />

      {toast && <div className="toast">{toast}</div>}

      {tip && (
        <div
          className={'tooltip' + (tip.below ? ' below' : '')}
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.text}
        </div>
      )}
    </div>
  )
}
