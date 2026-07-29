# Shopping List

A personal/shared shopping-list PWA. Set up each store's section order once, then shop from a list sorted to match how you walk that store. Works offline and installs to your home screen.

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

## Notes

- First load must be online (it caches React/ReactDOM and fonts); after that it runs fully offline.
- Bump `CACHE` in `sw.js` when you change assets to force clients to refresh.
- Data (lists, stores, section orders) persists in `localStorage`, per browser/device.
