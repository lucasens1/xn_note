# xn — notes

A tiny, offline, dev-oriented markdown notebook. Personal-use PWA — no server, no
account. Notes live in your browser's IndexedDB and work fully offline.

## Features

- ✍️ Markdown with live preview (Edit / Split / Preview)
- 🎨 GFM: tables, task lists, syntax-highlighted code
- 📁 Folders + full-text search
- 💾 Autosave to IndexedDB (offline-first, via Dexie)
- 📱 Installable PWA — "Add to Home screen" on Android

## Develop

```bash
npm install
npm run dev            # open the printed http://localhost:5173
```

## Put it on your Android phone

The service worker (offline) only activates in a **production** build served over
HTTPS (or `localhost`). Two easy options:

**A. Test over your local network**

```bash
npm run build
npm run preview -- --host   # note the Network URL it prints
```

On the phone (same Wi-Fi), open that `http://<your-mac-ip>:4173` URL in Chrome →
menu → **Add to Home screen**. (Service worker install requires HTTPS; over plain
LAN HTTP the app still runs, but for guaranteed offline use option B.)

**B. Free HTTPS host (recommended, fully offline afterwards)**

```bash
npm run build           # outputs ./dist
```

Drag-and-drop the `dist/` folder onto Netlify Drop (app.netlify.com/drop), or
`npx vercel deploy dist`. Open the HTTPS URL on your phone once → **Add to Home
screen**. After the first load it works with no network.

## Icons

App icons are generated with zero dependencies:

```bash
python3 scripts/gen_icons.py
```

## Stack

Vite · React · Dexie (IndexedDB) · react-markdown + remark-gfm + rehype-highlight ·
vite-plugin-pwa
