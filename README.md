# 💜 KelolaRacun — Family Finance Tracker

> _"Kelola racun-mu, raih goal-mu! Karena ngatur duit keluarga tuh seru juga, bukan cuma buat orang tua."_ 😎

Manajemen keuangan keluarga **ala RPG fantasy** — ngatur gold, ngejar target Monthly Quest, nge-track pengeluaran, semua dalam satu dashboard **SaaS modern** yang clean & pastel. **Zero dependency, zero build step** — langsung buka di browser, atau install sebagai PWA untuk mode offline. 🚀

---

## 🛠️ Tech Stack

- **Core Frontend**: HTML5, Vanilla CSS (Design Tokens, Custom CSS Properties)
- **Scripting**: Modern JavaScript (ES6+ Modular, DOM Manipulation, ES Modules)
- **State & Storage**: **IndexedDB** (Promise-based wrapper) + LocalStorage (theme & UI state)
- **Reactivity**: Tiny custom **Event Bus** (`scripts/core/eventBus.js`) — pub/sub antar service & UI
- **Typography**: Google Fonts (*Poppins* untuk header, *Nunito* untuk body, *JetBrains Mono* untuk angka/gold)
- **Theme Engine**: Dynamic Dark/Light Mode via CSS Variables & `localStorage` sync
- **PWA**: `manifest.json` (installable) + `sw.js` Service Worker (offline cache & network-first strategy)
- **Hosting / Deploy**: Static Site Hosting (GitHub Pages, Netlify, Vercel, Cloudflare Pages)

---

## ✨ Fitur Utama

| 🎯 Fitur | 📖 Ceritanya |
|---------|--------------|
| **🏰 Guild Hall** | Dashboard ringkasan + **Analisa Kesehatan Keuangan** (skor 0-100, 4 metrik: Savings Ratio, Dana Darurat, Rasio Utang, Disiplin Budget) |
| **🎒 Inventory Pouch** | Kelola dompet, rekening bank, & investasi. Pantau saldo tiap pouch secara real-time, switch & lihat aktivitas per pouch. |
| **📜 Baca Scroll** | Import transaksi dari bank statement (CSV/Excel) dengan preview table sebelum masuk ke IndexedDB |
| **⚡ Live Reactivity** | Event-driven pub/sub: tambah/hapus transaksi di satu layar, otomatis update semua view yang sedang terbuka |
| **📝 Form Modal Interaktif** | Tambah transaksi, pouch baru, & tagihan via modal popup — bukan halaman terpisah |
| **📱 PWA Offline** | Installable ke homescreen, bekerja tanpa internet setelah kunjungan pertama (Service Worker cache) |
| **🌙 Dark Mode** | Otomatis menyesuaikan OS / manual toggle, tersimpan di `localStorage` |
| **🔔 Toast Notif** | Feedback visual halus di setiap aksi (tambah loot, bayar tagihan, sukses/gagal) |
| **📱 Responsive** | Bottom nav sticky + `safe-area-inset` aman untuk device ber-notch |

---

## 🗂️ Struktur Folder

```
├── index.html                     # 🌐 Landing page / Welcome screen
├── manifest.json                  # 📱 PWA Web App Manifest
├── sw.js                          # ⚡ Service Worker (offline cache & PWA)
├── PRD.md                         # 📄 Product Requirements Document (KelolaRacun)
├── screens/                       # 📱 View screens (multi-page dengan dynamic controller)
│   ├── 01-guild-entrance.html     # 🔑 Login / Auth simulation
│   ├── 02-guild-hall.html         # 🏰 Dashboard dinamis + Financial Health Score
│   ├── 03-inventory.html          # 🎒 Pouch & Vaults management (interaktif)
│   └── 04-scroll-reading.html     # 📜 CSV/Excel statement importer
├── styles/                        # 🎨 Styling & Design System
│   ├── modern-theme.css           # Design tokens (light/dark colors & variables)
│   └── components.css             # Reusable UI: cards, badges, buttons, modal
└── scripts/                       # ⚡ Application logic
    ├── db.js                      # IndexedDB wrapper (Promise-based, generic CRUD)
    ├── app.js                     # Main entry & window.KelolaRacun API exposure
    ├── core/                      # Core utilities & event bus
    │   ├── helpers.js             # formatRupiah, validator, modal helpers, type meta
    │   └── eventBus.js            # Tiny pub/sub untuk UI reactivity
    ├── services/                  # CRUD service layer (auto-publish ke eventBus)
    │   ├── guildService.js        # Guild data & seed (Keluarga Rajawali)
    │   ├── pouchService.js        # Pouch CRUD & balance sync
    │   ├── transactionService.js  # Transaction CRUD + auto balance update
    │   └── billService.js         # Bill & Tribute management (Paid/Pending toggle)
    └── screens/                   # View controllers (render data + bind form)
        ├── guildHallController.js     # Guild Hall rendering, modal CRUD
        ├── inventoryController.js     # Pouch switcher & activity table
        └── scrollReadingController.js # CSV parser & batch import
```

---

## 🚀 Cara Menjalankan & Deploy

### Development Lokal
Karena menggunakan **ES Modules** dan **Service Worker**, file harus diakses via HTTP (bukan `file://`).

```bash
# Pilihan 1 — Python HTTP Server
python -m http.server 8000
# Buka http://localhost:8000

# Pilihan 2 — Node.js (npx serve)
npx serve .

# Pilihan 3 — VS Code Live Server extension
Klik kanan index.html → "Open with Live Server"
```

### Install sebagai PWA
1. Buka aplikasi di browser (Chrome/Edge/Safari).
2. Klik ikon install di address bar (atau tambahkan ke homescreen di mobile).
3. Aplikasi dapat dijalankan standalone, **offline-capable** setelah kunjungan pertama.

### Deploy Production
Tanpa build step. Cukup push folder root ke static hosting pilihan:

```bash
git init
git add .
git commit -m "feat: release KelolaRacun with dynamic screens, reactivity & PWA"
git branch -M development
git remote add origin https://github.com/legacy77/financial-tracker.git
git push -u origin development
```

Platform yang didukung: **GitHub Pages**, **Netlify**, **Vercel**, **Cloudflare Pages**, **Surge.sh**.

### Konfigurasi untuk SPA Fallback (opsional)
Jika deploy di host yang butuh fallback ke `index.html` (untuk deep-linking di masa depan), tambahkan `404.html` yang redirect ke `index.html`. Saat ini semua navigasi internal menggunakan file statis.

---

## 💬 Kenapa Dibuat?

Biar ngatur keuangan keluarga nggak kerasa kaya "kerjaan rumah" yang bikin males — tapi kayak **main game.** Ngumpulin gold, nge-stack quest, naikin guild level. Finance jadi fun. 🎮

---

## 📌 Catatan Penting

- **Data tersimpan lokal** di IndexedDB browser. Belum ada backend / sync.
- **Tidak terhubung ke bank beneran** — semua contoh & input manual.
- **Sample data** (Keluarga Rajawali, 3 pouch default) di-seed otomatis saat first run.
- Untuk reset total, buka DevTools → Application → IndexedDB → hapus `kelola_racun_db`.

---

© 2026 KelolaRacun — dibuat dengan niat ngatur racun yang sehat. 😉