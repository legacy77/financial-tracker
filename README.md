# 🏰 Family Finance Hub — Financial Tracker

Manajemen keuangan keluarga dengan sentuhan RPG 🌟 — mockup interaktif siap deploy (static site, no build step).

## ✨ Fitur

- **Guild Hall** — Dashboard ringkasan + analisa kesehatan keuangan (skor 0-100, 4 metrik: savings ratio, dana darurat, rasio utang, disiplin budget)
- **Inventory Pouch** — Kelola dompet, tabungan, dan investasi
- **Baca Scroll** — Import transaksi dari bank statement (CSV/Excel)
- **Dark Mode** otomatis/manual (disimpan di `localStorage`)
- **Toast notifications** & navigasi bawah sticky (aman untuk device dengan notch via `safe-area-inset`)

## 🚀 Cara Menjalankan

Static site murni — cukup buka `index.html` di browser, atau jalankan server lokal:

```bash
# Python
python -m http.server 8000
# lalu buka http://localhost:8000

# atau Node (npx)
npx serve .
```

## 🌿 Deploy ke GitHub Pages / Netlify / Vercel

Cukup push repository ini, lalu aktifkan static hosting pada folder root. Tanpa build step, tanpa dependency.

```bash
git init
git add .
git commit -m "init: family finance hub"
git branch -M main
git remote add origin https://github.com/USERNAME/financial-tracker.git
git push -u origin main
```

## 📁 Struktur

```
├── index.html                # Landing page
├── screens/
│   ├── 01-guild-entrance.html  # Login/Auth
│   ├── 02-guild-hall.html      # Dashboard + Health Score
│   ├── 03-inventory.html       # Pouch & Vaults
│   └── 04-scroll-reading.html  # CSV/Excel Import
└── styles/
    ├── modern-theme.css        # Design tokens (light/dark)
    └── components.css          # Komponen UI
```

## 🎨 Desain

- Font: Poppins / Nunito / JetBrains Mono (Google Fonts CDN)
- Palette pastel: mint (pemasukan), coral (pengeluaran)
- Hybrid: istilah RPG (Guild, Pouch, Loot, Scroll) + estetika SaaS modern

---

© 2026 Family Finance Hub — semua data contoh, tidak terhubung ke bank.
