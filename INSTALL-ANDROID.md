# Get xn on your Android phone

The app is a PWA. It works offline once installed. Pick the path that suits you.

---

## ⭐ Path A — Host it once, install with one tap (recommended)

This gives you real HTTPS, so offline + the in-app **Install** button both work.

1. Build (already done for you — `dist/` and `xn-note-dist.zip` exist):
   ```bash
   npm run build
   ```
2. Go to **https://app.netlify.com/drop** on your computer (no account needed for a
   temporary site; free account to keep it).
3. Drag the **`xn-note-dist.zip`** file (or the `dist/` folder) onto the page.
4. Netlify gives you an HTTPS URL like `https://random-name.netlify.app`.
5. Open that URL in **Chrome on your Android phone**.
6. Tap the **⬇ Install** button (top-left of the app), or Chrome menu (⋮) →
   **Install app / Add to Home screen**.

Done — it now launches fullscreen from your home screen and works with no network.

> Any static host works the same way: Vercel (`npx vercel deploy dist --prod`),
> Cloudflare Pages, GitHub Pages, Firebase Hosting, etc.

---

## Path B — Make an actual installable APK (no Android Studio)

Want a real `.apk` file to sideload? Use **PWABuilder** (a website — no local Android
tooling required). You must host it first (Path A) so PWABuilder has a URL.

1. Do Path A to get your `https://…` URL.
2. Go to **https://www.pwabuilder.com**, paste the URL, click **Start**.
3. Choose **Android** → **Generate Package**. It builds a signed APK/AAB in the cloud.
4. Download the `.apk`, transfer it to your phone, and open it to install
   (enable "Install unknown apps" for your file manager/browser when prompted).

---

## Path C — Quick test over your Wi-Fi (no hosting)

Fastest way to just *see it* on the phone. Note: over plain LAN HTTP the service
worker won't register, so it runs but isn't installable/offline — use A for that.

```bash
npm run build
npm run preview        # prints a Network URL, e.g. http://192.168.1.20:4173
```

Open that Network URL in your phone's browser (same Wi-Fi).

### Verify offline works (on your computer)

The service worker now runs in dev too. At `http://localhost:5173`:

1. Load the app once.
2. Open DevTools → **Network** tab → set throttling to **Offline** (or
   Application → Service Workers → check "Offline").
3. Reload — the app still loads and all your notes are there. That's full offline.

---

## Backing up / moving your notes

Notes live in the browser's IndexedDB (per-device). To move them or keep a backup:

- In-app menu (**⋯**) or command palette (**⌘/Ctrl + K**) → **Export all (JSON
  backup)**. Save the `.json` file.
- On the new device, open the app → **Import file** → pick that `.json`.

You can also export a single note (or everything) as Markdown.
