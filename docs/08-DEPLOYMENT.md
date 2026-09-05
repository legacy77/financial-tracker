# 🚢 Deployment Guide
## 💜 KelolaRacun — Family Finance Hub

> Static PWA, tanpa build step. Push root folder ke hosting statis mana pun.

---

## 1. Requisite Struktur
Repo root = langsung deploy-able:
- `index.html`, `manifest.json`, `sw.js`
- `screens/`, `styles/`, `scripts/`, `vendor/`, `docs/`

## 2. GitHub Pages

**Via UI**
1. Repo → Settings → Pages.
2. Source: `Deploy from a branch`.
3. Branch: `development` → `/ (root)` → Save.

**Via GitHub Actions (disarankan)**
```yaml
# .github/workflows/pages.yml
name: Deploy
on:
  push:
    branches: [development]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - uses: actions/deploy-pages@v4
```

## 3. Vercel
1. Import repo `legacy77/financial-tracker`.
2. Framework Preset: **Other**.
3. Build Command: *(kosong)*; Output: *(kosong / default)*.

## 4. Netlify
1. "Add new site" → Import from Git.
2. Build command: *(kosong)*; Publish directory: `.` (root).

## 5. Cloudflare Pages
1. Create project → Connect Git repo.
2. Build: *(kosong)*; Output dir: root.

---

## 6. Konfigurasi PWA
- `manifest.json` sudah ada (name, short_name, start_url `./index.html`, `standalone`, theme `#14b8a6`).
- `sw.js` pre-cache daftar aset; **bump `CACHE_NAME`** (misal `v3` → `v4`) setiap ada update kode agar cache diperbarui.
- Icons SVG inline valid untuk Chrome/Edge; untuk support penuh iOS gunakan PNG `apple-touch-icon` bila perlu.

## 7. Verifikasi After Deploy
- [ ] Buka URL → halaman & semua screen berfungsi (console bersih).
- [ ] DevTools → Application → Manifest valid & SW aktif.
- [ ] Test offline: reload setelah online sekali.
- [ ] Lighthouse PWA ≥ 90 (audit jalan via DevTools/PageSpeed).