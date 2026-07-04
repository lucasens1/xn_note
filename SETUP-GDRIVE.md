# Google Drive backup — one-time setup

The app talks to Drive directly from your browser (no server). You need a free
Google OAuth **Client ID**. Takes ~5–10 minutes, once.

## 1. Create a Google Cloud project
1. Go to <https://console.cloud.google.com/> and create a project (any name).

## 2. Enable the Drive API
1. **APIs & Services → Library** → search **Google Drive API** → **Enable**.

## 3. Configure the consent screen
1. **APIs & Services → OAuth consent screen**.
2. User type **External** → Create.
3. Fill App name + your email. Save through the steps.
4. **Scopes**: you don't need to add any manually — the app requests only
   `.../auth/drive.file`, which is **non-sensitive** (no Google verification
   needed, no "unverified app" review).
5. **Test users**: add your own Google account (optional but avoids friction).
6. Publishing status: you can leave it in **Testing**, or **Publish** — because
   `drive.file` is non-sensitive, publishing needs no verification and your
   access token won't expire early.

## 4. Create the OAuth Client ID
1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type **Web application**.
3. **Authorized JavaScript origins** — add every origin you open the app from:
   - `http://localhost:5173` (dev)
   - `http://localhost:4173` (vite preview)
   - your deployed URL, e.g. `https://your-app.netlify.app`
   (No redirect URI is needed — the token model uses origins only.)
4. Create → copy the **Client ID** (looks like `1234-abc.apps.googleusercontent.com`).

## 5. Paste it into the app
1. Open the app → **⋯ menu → Google Drive** (or ⌘K → "Google Drive").
2. Paste the Client ID → **Save**.
3. Click **Back up to Drive** → a Google popup asks you to sign in / allow → done.

The Client ID is stored only in your browser (localStorage). If you deploy to a
new URL, add that origin in step 4 and it keeps working.

## What it does
- **Back up to Drive**: writes `xn-notes-backup.json` (full notebook) **and** one
  readable `.md` file per note into a **“xn notes”** folder in your Drive.
  Runs again = updates the same files (renames/removes to match your notes).
- **Restore (merge)**: reads `xn-notes-backup.json` and adds those notes back
  into the app. It **merges** (adds) — it never deletes your local notes.

## Notes & limits
- Sync is **push-only** (app → Drive). Editing a `.md` in Drive won't sync back;
  the JSON backup is the source of truth for Restore.
- Needs a connection (the button is disabled offline). Your notes still live
  offline in the browser — Drive is just a backup/mirror.
- Optional: instead of pasting the ID each browser, set it at build time with a
  `.env` file: `VITE_GDRIVE_CLIENT_ID=...apps.googleusercontent.com`.
