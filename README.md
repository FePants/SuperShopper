# Shopping List

A shared shopping-list PWA. Set up each store's section order once, then shop from a list sorted to match how you walk that store. Synced in real time between devices via Firestore, and installs to your home screen for full-screen, offline use.

## Files

```
index.html            App (loads the runtime + design component)
support.js            Design-component runtime
manifest.webmanifest  PWA manifest
sw.js                 Service worker (offline cache)
icons/                App icons (192, 512, maskable)
```

## Run locally

Service workers need a real origin (not `file://`). Serve the folder over HTTP:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Open the printed URL. In DevTools → Application you can inspect the manifest, service worker, and cache.

## Deploy to GitHub Pages

1. Create a repo and push these files to `main`.
2. Repo **Settings → Pages** → Source: **Deploy from a branch**, Branch: **main**, Folder: **/ (root)**.
3. Your app goes live at `https://<user>.github.io/<repo>/`.

All paths are relative (`./`), so it works from the `/repo/` subpath Pages serves from. On your phone, open that URL and choose **Add to Home Screen** for the full-screen, offline app.

## Data sync (Firestore)

List/store/section data lives in a single Firestore document (`lists/shared`) instead of `localStorage`, so every device that opens the app sees the same list in real time. The Firebase project config is inlined in `index.html` (Firebase web API keys aren't secret — access is controlled by Firestore security rules, not by hiding the key).

**Firestore setup** (one-time, in the Firebase console):
1. **Build/Databases → Firestore Database → Create database.**
2. **Firestore Database → Rules**, set:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /lists/{listId} {
         allow read, write: if listId == 'shared';
       }
     }
   }
   ```
   This scopes read/write to exactly the one document the app uses — not real authentication (anyone who finds the repo could still edit that document), just enough to keep the rest of the project locked down.
3. **Project settings → General → Your apps → Add app → Web**, copy the `firebaseConfig` snippet into the `<script>` block near the top of `index.html`.

To point the app at a different Firebase project, swap the `firebaseConfig` values in `index.html` and republish the rules above.

## Notes

- First load must be online (it caches React/ReactDOM, fonts, and the Firebase SDK); after that it runs fully offline, backed by Firestore's own offline cache.
- Bump `CACHE` in `sw.js` when you change assets to force clients to refresh. Because of how service worker updates activate, a device may need to relaunch the installed app **twice** to pick up a new version.
- Categories (sections like "Produce") are shared across stores by ID — the Store Editor's **New** button creates one just for that store, **Existing** attaches an already-defined category (and its items) to another store's walk order.
