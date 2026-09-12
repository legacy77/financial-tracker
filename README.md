# 💜 KelolaRacun: Family Finance Hub

> _"Kelola racun-mu, raih goal-mu! Karena ngatur duit keluarga tuh seru, bukan beban."_ 😎

Aplikasi manajemen keuangan keluarga berbasis web dengan perpaduan **RPG Fantasy Guild**, **Clean SaaS modern**, dan **GenZ ID vibe**. Ubah pencatatan kas kaku menjadi petualangan guild: kumpulkan **Gold**, selesaikan **Monthly Quest**, naikkan **Guild Level**, jaga **Daily Streak**, dan evaluasi ketahanan finansial lewat **Dynamic Health Score**.

Dibangun dengan prinsip **Local-First**, **Zero External Dependency**, dan **Zero Build Step** — langsung jalan di browser, dapat diinstall sebagai PWA offline, serta mendukung sinkronisasi lokal multi-device. 🚀

---

## 💎 Kenapa KelolaRacun Berbeda?

Fintech pada umumnya seringkali kaku, rumit, dan terasa seperti tugas akuntansi yang membebani. **KelolaRacun** hadir dengan pendekatan berbeda:

1. **Gamifikasi Keuangan Riil**: Bukan sekadar visual kosmetik — XP, level guild, dan skor kesehatan dihitung dari rasio tabungan, ketepatan bayar tagihan, dan disiplin budget nyata.
2. **Privasi & Local-First**: Data finansial keluarga Anda adalah rahasia dapur Anda. Seluruh catatan tersimpan aman di browser (IndexedDB lokal), bukan di cloud pihak ketiga.
3. **Kolaborasi Keluarga Sehat (RBAC)**: Libatkan seluruh anggota keluarga sesuai perannya — Ayah/Ibu (*Admin* & *Co-Manager*) memegang kendali alokasi, Anak/Anggota (*Viewer*) belajar transparansi keuangan tanpa risiko merusak data.
4. **Ringan & Bebas Repot**: Tidak perlu `npm install`, webpack, atau build tools rumit. Clone dan langsung jalankan.

---

## ✨ Keunggulan Fitur

| 🎯 Fitur | 📖 Keunggulan & Cara Kerja |
|---|---|
| **🏠 Daily Home Hub** | Dashboard harian aksi cepat: saldo total gold keluarga, mutasi hari ini, pengingat tagihan mendesak (H-3), dan mini quest tracker. |
| **🏰 Guild Hall & Analytics** | Pusat analitik keuangan: skor kesehatan (0-100), Chart.js lokal (Cashflow bulanan & Alokasi pengeluaran), leveling, dan badge achievement. |
| **🩺 Dynamic Health Score** | Penilaian otomatis kesehatan finansial 0-100 berdasarkan 4 pilar: *Savings Ratio*, *Emergency Fund*, *Debt Service Ratio*, dan *Budget Discipline*. |
| **📊 Smart Category Budgets** | Anggaran bulanan per kategori dengan fitur **Carry-In / Rollover** sisa saldo bulan lalu, salin alokasi otomatis, serta notifikasi peringatan over-budget (80% & 100%). |
| **💸 Partial Bill Payment** | Fleksibilitas pembayaran tagihan (lunas atau bertahap), pilih pouch sumber dana, integrasi otomatis ke mutasi kas, auto-rollback transaksi jika gagal, serta dukungan void/unpay. |
| **🎒 Multi-Pouch Inventory** | Kelola dompet tunai, rekening bank, hingga pos tabungan terpisah. Dilengkapi mesin rekonsiliasi saldo otomatis untuk mencegah *balance drift*. |
| **📜 SeaBank & Statement Parser** | Ekstraksi mutasi rekening otomatis dari file PDF atau teks OCR dengan algoritma pendeteksi transaksi duplikat berbasis hash baris (`markDuplicates`). |
| **🔒 Keamanan PIN & Role RBAC** | Proteksi akses tiap anggota dengan enkripsi PIN standar industri (PBKDF2 100.000 iterasi + cryptographic salt). Kontrol akses berjenjang: *Admin*, *Co-Manager*, dan *Viewer*. |
| **🔄 Multi-Device Local Sync** | Sinkronisasi data antar perangkat di jaringan lokal via server Node.js ringan bawaan (`server.js`) dengan resolusi konflik *last-write-wins*. |
| **📱 PWA & Offline-First** | Dapat diinstall di Android, iOS, Windows, dan macOS. Tetap berfungsi penuh tanpa koneksi internet via Service Worker. |

---

## 🛠️ Tech Stack

- **Core Frontend**: Semantic HTML5, Vanilla CSS3 (Custom CSS Properties, Responsive Tokens, Zero Inline Styles)
- **Scripting**: Modern JavaScript (ES Modules, Vanilla Native, Zero Dependencies)
- **State & Storage**: **IndexedDB v6** (Promise-based CRUD engine) + LocalStorage (Theme & Auth Session)
- **Security**: Web Crypto API (PBKDF2 SHA-256 with 100.000 iterations & random hex salt)
- **Reactivity**: Micro Event Bus (`scripts/core/eventBus.js`) — pub/sub terpusat antar service dan UI controller
- **Visualisasi**: Chart.js v4 (offline vendor bundle di `./vendor/chart.umd.js`)
- **PWA & Offline**: Web App Manifest (`manifest.json`) + Service Worker Cache-First (`sw.js`)
- **Local Sync Server**: Node.js stdlib (`http`, `fs`, `path`, `crypto`) — tanpa modul npm eksternal

---

## 🗂️ Struktur Proyek

```
├── index.html                     # 🏠 Home Hub (Dashboard harian aksi cepat)
├── CHANGELOG.md                   # 📌 Riwayat rilis & changelog utama
├── manifest.json                  # 📱 Web App Manifest (PWA)
├── sw.js                          # ⚡ Service Worker v9 (Offline cache)
├── server.js                      # 🔄 Local Sync Server & Static Host (Node.js stdlib)
├── screens/                       # 📱 View Screens
│   ├── 00-register.html           # 🚪 Legacy register router (redirect ke entrance)
│   ├── 01-guild-entrance.html     # 🔑 Entrance (Login PIN & Onboarding Wizard)
│   ├── 02-guild-hall.html         # 🏰 Guild Hall, Analitik, & Settings RBAC
│   ├── 03-inventory.html          # 🎒 Pouch & Vaults management
│   └── 04-scroll-reading.html     # 📜 Statement importer & smart parser
├── styles/                        # 🎨 Styling & Design Tokens
│   ├── modern-theme.css           # Token warna (light/dark), tipografi, spacing
│   ├── components.css             # Komponen: card, modal, badge, button, table
│   └── print.css                  # Stylesheet print-to-PDF dokumen keuangan A4
├── vendor/                        # 📦 Dependensi lokal offline
│   └── chart.umd.js               # Chart.js bundle
└── scripts/                       # ⚡ Logika Aplikasi
    ├── app.js                     # Inisialisasi aplikasi & global bindings
    ├── db.js                      # IndexedDB schema v6 & generic CRUD wrapper
    ├── ui.js                      # UI handler bersama (tema, modal backdrop, logout)
    ├── core/                      # Utilitas & Engine Inti
    │   ├── authService.js         # Session auth & role verification
    │   ├── backupService.js       # Backup, restore JSON, & reset database
    │   ├── crypto.js              # Enkripsi PIN PBKDF2 100k + salt
    │   ├── eventBus.js            # Reactive pub/sub bus
    │   ├── gamification.js        # XP, guild leveling, streak, & badge logic
    │   ├── healthScore.js         # Algoritma kalkulasi skor kesehatan keuangan
    │   ├── helpers.js             # Formatter Rupiah, tanggal, & generator ID
    │   ├── payBill.js             # Shared Pay Bill modal workflow
    │   ├── seabankParser.js       # Parser PDF/OCR statement & deduplikasi
    │   └── syncService.js         # Client-side sync engine ke server.js
    ├── services/                  # Business Logic & CRUD Store
    │   ├── billService.js         # Tagihan & pembayaran bertahap
    │   ├── budgetService.js       # Budget bulanan per kategori & carry-over
    │   ├── guildService.js        # Data profil guild & target bulanan
    │   ├── importService.js       # Riwayat audit log import mutasi
    │   ├── memberService.js       # Manajemen anggota keluarga & RBAC
    │   ├── pouchService.js        # Pouch balance & rekonsiliasi saldo
    │   └── transactionService.js  # Transaksi kas & update saldo otomatis
    └── screens/                   # Controller Per Layar
        ├── homeController.js          # Controller Home Hub
        ├── loginController.js         # Controller Entrance & Auth
        ├── registerController.js      # Controller Onboarding Baru
        ├── guildHallController.js     # Controller Guild Hall & Settings
        ├── inventoryController.js     # Controller Inventory Pouch
        └── scrollReadingController.js # Controller Statement Importer
```

---

## 🚀 Cara Menjalankan

Karena menggunakan **ES Modules** dan **Service Worker**, aplikasi harus dijalankan melalui web server lokal (bukan protokol `file://`).

### Pilihan 1 — Menggunakan Local Sync Server Bawaan (Disarankan)
Jalankan server Node.js native bawaan. Server ini menyediakan file statis sekaligus endpoint sinkronisasi multi-device (`/api/sync`):

```bash
node server.js
```
Buka browser di `http://localhost:8000`.

### Pilihan 2 — Python HTTP Server (Khusus Mode Standalone)
```bash
python -m http.server 8000
```

### Pilihan 3 — Static Hosting (Production)
Aplikasi siap dideploy tanpa build step ke platform hosting statis manapun:
- **GitHub Pages**
- **Vercel**
- **Netlify**
- **Cloudflare Pages**

---

## 📱 PWA & Akses Offline

1. Buka aplikasi via browser di ponsel atau desktop (`Chrome`, `Edge`, `Safari`).
2. Klik tombol **Install** atau menu browser **"Tambahkan ke Layar Utama" / "Add to Home Screen"**.
3. Aplikasi siap dibuka kapan saja secara offline tanpa jaringan internet.

---

## 📌 Riwayat Rilis & Changelog

Detail catatan rilis per versi tercatat pada [`CHANGELOG.md`](CHANGELOG.md) dan [`docs/09-CHANGELOG.md`](docs/09-CHANGELOG.md).

### Ringkasan Rilis Terbaru
- **v0.4.0 (Latest)**: Peluncuran Daily Home Hub, Category Budgeting dengan carry-over saldo sisa, SeaBank PDF/OCR parser, alur pembayaran tagihan parsial, dan server sinkronisasi multi-device lokal.
- **v0.3.1**: Sistem keamanan PIN berbasis PBKDF2 (100k iterasi), family RBAC (*Admin, Co-Manager, Viewer*), dan suite dokumentasi teknis lengkap.
- **v0.3.0**: Dynamic Financial Health Score (0-100), kustomisasi kategori pengeluaran/pemasukan, dan Monthly Quest dinamis.
- **v0.2.0**: Gamification engine (XP, level, streak, badge), Chart.js visualisasi, backup/restore JSON, dan print-to-PDF.
- **v0.1.0 - v0.1.3**: Inisialisasi Family Finance Hub, PWA support, dan arsitektur IndexedDB.

---

## 📚 Dokumentasi Lengkap

Seluruh spesifikasi teknis dan panduan operasional tersedia di folder [`docs/`](docs/):

| Dokumen | Deskripsi |
|---|---|
| [`docs/01-PRD.md`](docs/01-PRD.md) | Product Requirements Document (Visi produk, persona, modul fitur) |
| [`docs/02-URS.md`](docs/02-URS.md) | User Requirements Specification (User stories & acceptance criteria) |
| [`docs/03-SFD.md`](docs/03-SFD.md) | Software Functional Description (Spesifikasi fungsional per alur) |
| [`docs/04-TSD.md`](docs/04-TSD.md) | Technical Specification Document (Arsitektur sistem, skema IndexedDB) |
| [`docs/05-UI-DESIGN.md`](docs/05-UI-DESIGN.md) | Desain UI, token warna, responsivitas, dan layout hierarki |
| [`docs/06-TEST-PLAN.md`](docs/06-TEST-PLAN.md) | Rencana pengujian komprehensif & QA checklist |
| [`docs/07-GETTING-STARTED.md`](docs/07-GETTING-STARTED.md) | Panduan langkah demi langkah memulai aplikasi |
| [`docs/08-DEPLOYMENT.md`](docs/08-DEPLOYMENT.md) | Panduan deployment production & audit Lighthouse PWA |
| [`docs/09-CHANGELOG.md`](docs/09-CHANGELOG.md) | Catatan rilis historis |

---

## 🔒 Privasi & Keamanan Data

- **Local-First Storage**: Seluruh data tersimpan secara lokal di browser Anda via IndexedDB.
- **Tanpa Pihak Ketiga**: Tidak ada tracker, analytics eksternal, atau transmisi data ke server periklanan.
- **Sinkronisasi Terkendali**: Opsi sinkronisasi multi-device hanya berkomunikasi dengan instance `server.js` lokal yang Anda kontrol sendiri.
- **Enkripsi Kredensial**: PIN diverifikasi menggunakan hashing PBKDF2 SHA-256 dengan cryptographic salt acak.

---

© 2026 **KelolaRacun** — Kelola racun-mu, raih goal-mu! 💜
