# 💜 KelolaRacun — Family Finance Tracker

> _"Kelola racun-mu, raih goal-mu! Karena ngatur duit keluarga tuh seru juga, bukan cuma buat orang tua."_ 😎

Manajemen keuangan keluarga **ala RPG fantasy** — ngatur gold, ngejar target Monthly Quest, nge-track pengeluaran, semua dalam satu dashboard **SaaS modern** yang clean & pastel. No build step, no dependency yang ribet, tinggal buka langsung atau scale up untuk production. 🚀

---

## 🛠️ Tech Stack (Production Ready & Phase 2 Implemented)

- **Core Frontend**: HTML5, Vanilla CSS (Design Tokens, Custom CSS Properties)
- **Scripting**: Modern JavaScript (ES6+ Modular, DOM Manipulation, ES Modules)
- **State & Storage**: **IndexedDB** (Native Promise-based wrapper) + LocalStorage
- **Typography**: Google Fonts (*Poppins* for headers, *Nunito* for body, *JetBrains Mono* for numbers/gold)
- **Theme Engine**: Dynamic Dark/Light Mode with CSS Variables & `localStorage` sync
- **Hosting / Deploy**: Static Site Hosting (GitHub Pages, Netlify, Vercel)

---

## ✨ Fitur Utama

| 🎯 Fitur | 📖 Ceritanya |
|---------|--------------|
| **🏰 Guild Hall** | Dashboard ringkasan + **Analisa Kesehatan Keuangan** (skor 0-100, 4 metrik: Savings Ratio, Dana Darurat, Rasio Utang, Disiplin Budget) |
| **🎒 Inventory Pouch** | Kelola dompet, rekening bank, & investasi. Pantau saldo tiap pouch secara real-time. |
| **📜 Baca Scroll** | Import transaksi dari bank statement (CSV/Excel) dengan preview table sebelum masuk |
| **🌙 Dark Mode** | Otomatis menyesuaikan OS / manual toggle, tersimpan di `localStorage` |
| **🔔 Toast Notif** | Feedback visual halus di setiap aksi (tambah loot, bayar tagihan) |
| **📱 Responsive** | Bottom nav sticky + `safe-area-inset` aman untuk device ber-notch |

---

## 🗂️ Struktur Folder (Aktif & Modular)

Struktur direktori proyek yang sudah diimplementasikan hingga **Phase 2 (IndexedDB CRUD)**:

```
├── index.html                     # 🌐 Landing page / Welcome screen
├── PRD.md                         # 📄 Product Requirements Document (KelolaRacun)
├── screens/                       # 📱 View screens (Multi-page static architecture)
│   ├── 01-guild-entrance.html     # 🔑 Login / Auth simulation
│   ├── 02-guild-hall.html         # 🏰 Dashboard & Financial Health Score
│   ├── 03-inventory.html          # 🎒 Pouch & Vaults management
│   └── 04-scroll-reading.html     # 📜 CSV/Excel statement importer
├── styles/                        # 🎨 Styling & Design System
│   ├── modern-theme.css           # Design tokens (light/dark colors & variables)
│   └── components.css             # Reusable UI components (cards, badges, buttons)
└── scripts/                       # ⚡ Phase 2: State Management & IndexedDB Services
    ├── db.js                      # IndexedDB Wrapper (Promise-based stores & generic CRUD)
    ├── app.js                     # Main Entry Point & window.KelolaRacun API exposure
    └── services/                  # Thin CRUD Service Layer
        ├── guildService.js        # Guild data & initial seed data (Keluarga Rajawali)
        ├── pouchService.js        # Pouch CRUD & balance sync operations
        ├── transactionService.js  # Transaction CRUD with auto-balance updates
        └── billService.js         # Bill & Tribute management (Paid/Pending toggle)
```

---

## 🚀 Cara Menjalankan & Deploy

### Development Lokal
```bash
# Pilihan 1 — Python HTTP Server
python -m http.server 8000
# Buka http://localhost:8000 di browser

# Pilihan 2 — Node.js (npx serve)
npx serve .
```

### Deploy Production
Tanpa build step yang berat. Cukup push folder root ke static hosting pilihan Anda:
```bash
git init
git add .
git commit -m "feat: release KelolaRacun with Phase 2 IndexedDB persistence"
git branch -M development
git remote add origin https://github.com/legacy77/financial-tracker.git
git push -u origin development
```

---

## 💬 Kenapa Dibuat?

Biar ngatur keuangan keluarga nggak kerasa kaya "kerjaan rumah" yang bikin males — tapi kayak **main game.** Ngumpulin gold, nge-stack quest, naikin guild level. Finance jadi fun. 🎮

---

© 2026 KelolaRacun — semua data contoh, tidak terhubung ke bank beneran ya. 😉
