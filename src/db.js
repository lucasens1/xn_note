import Dexie from 'dexie'

export const db = new Dexie('xn-notes')

// v1: original schema
db.version(1).stores({
  notes: '++id, title, folder, updatedAt, createdAt',
})

// v2: add tags (multiEntry index so we can query notes by tag)
db.version(2)
  .stores({
    notes: '++id, title, folder, updatedAt, createdAt, *tags',
  })
  .upgrade((tx) =>
    tx
      .table('notes')
      .toCollection()
      .modify((n) => {
        if (!Array.isArray(n.tags)) n.tags = []
      }),
  )

// Seed a welcome note the very first time the DB is created.
db.on('populate', () => {
  const now = Date.now()
  db.notes.add({
    title: 'Welcome to tty',
    folder: 'Getting started',
    tags: ['welcome', 'markdown'],
    createdAt: now,
    updatedAt: now,
    content: [
      '# Welcome to tty 👋',
      '',
      'A tiny **offline** markdown notebook. Everything lives in your browser',
      '(IndexedDB) — no server, no account, works in airplane mode.',
      '',
      '## Shortcuts',
      '- **⌘/Ctrl + K** — command palette (search + actions)',
      '- **⌘/Ctrl + N** — new note',
      '- **⌘/Ctrl + E** — cycle Edit / Split / Preview',
      '- **⌘/Ctrl + F** — focus search',
      '',
      '## Try it',
      '- [x] Write in **Markdown**',
      '- [ ] Add #tags and organize into folders',
      '- [ ] Export a backup, then re-import it',
      '',
      '```js',
      'const notes = await db.notes.toArray()',
      'console.log(notes.length)',
      '```',
      '',
      '| Feature | Status |',
      '| ------- | ------ |',
      '| Offline | ✅ |',
      '| Tags & folders | ✅ |',
      '| Export / import | ✅ |',
      '',
      '> Tip: on Android, tap **Install** (top-left) or Chrome menu → Add to Home screen.',
    ].join('\n'),
  })
})

export async function createNote({ folder = '', tags = [] } = {}) {
  const now = Date.now()
  return db.notes.add({
    title: 'Untitled',
    content: '',
    folder,
    tags,
    createdAt: now,
    updatedAt: now,
  })
}

export function updateNote(id, changes) {
  return db.notes.update(id, { ...changes, updatedAt: Date.now() })
}

export function deleteNote(id) {
  return db.notes.delete(id)
}
