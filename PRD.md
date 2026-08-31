# 📄 Product Requirements Document (PRD)
## 💜 KelolaRacun — Family Finance Hub (Rebrand)

> **Status**: Draft / Enhanced & Validated  
> **Target Platform**: Web (Static Site / PWA ready)  
> **Tech Stack**: HTML5, Vanilla CSS (Design Tokens, Custom Properties), JavaScript (ES6+), Google Fonts (Poppins, Nunito, JetBrains Mono)

---

## 1. 🎯 Overview & Tujuan Produk

**KelolaRacun** adalah aplikasi manajemen keuangan keluarga yang menggabungkan elemen gamifikasi RPG (Role-Playing Game) dengan estetika SaaS modern (mengadopsi estetika bersih ala Saweria & KOL.id). 

Tujuannya adalah menghilangkan kesan "membosankan" dan "menakutkan" dalam mengelola keuangan rumah tangga, menjadikannya pengalaman yang interaktif, menyenangkan, dan transparan bagi seluruh anggota keluarga. Nama *KelolaRacun* merepresentasikan analogi "racun" sebagai pengeluaran konsumtif, dengan misi seru: "kelola racun-mu, raih goal-mu!".

---

## 2. 👤 Target Pengguna & Persona

- **Kepala Keluarga / Pengambil Keputusan Utama**: Ingin visibilitas penuh terhadap kesehatan finansial, dana darurat, dan cicilan bulanan tanpa ribet.
- **Pasangan / Co-Manager**: Ingin cara praktis mencatat pengeluaran harian dan melihat pencapaian target keuangan bersama (Monthly Quest).
- **Anak/Remaja (Opsional)**: Mengerti literasi keuangan lewat konsep gamifikasi (pouch, loot, quest).

---

## 3. ⚔️ Competitive Analysis (Analisis Kompetitor)

| Fitur / Aspek | Tradisional Apps (Money Manager, Spendee) | YNAB (You Need A Budget) | 💜 KelolaRacun |
|---|---|---|---|
| **Fokus Utama** | Tracking mutasi rekening & ledger | Zero-based budgeting ketat | Kolaborasi keluarga + gamifikasi RPG |
| **Vibe & UI** | Form-heavy, kaku, korporat | Fungsional, text-heavy, agak kompleks | Clean SaaS pastel + GenZ slang (Indonesia) + RPG fantasy theme |
| **Kesehatan Finansial** | Grafik standar / pie chart | Net worth tracking | **Financial Health Score** (Skor 0-100 dengan 4 metrik spesifik) |
| **Onboarding Pengguna** | Cenderung melelahkan bagi pemula | Kurva belajar tinggi | Cepat, instan, tanpa registrasi awal (mockup/PWA ready) |

---

## 4. 🧱 Data Model / Entity Relationship (ERD)

Untuk persiapan implementasi *Phase 2 (Local State / CRUD)*, berikut adalah entitas data utama yang digunakan:

1. **User / Member**
   - `id` (UUID)
   - `name` (String)
   - `role` (Enum: `Admin`, `Co-Manager`, `Viewer`)
   - `avatarUrl` (String)

2. **Guild (Family Unit)**
   - `id` (UUID)
   - `familyName` (String) — e.g. *Keluarga Rajawali*
   - `guildLevel` (Integer)
   - `totalGold` (Decimal)

3. **Pouch / Vault (Dompet & Rekening)**
   - `id` (UUID)
   - `guildId` (Foreign Key)
   - `name` (String) — e.g. *Gold Pouch*, *Bank Vault*
   - `type` (Enum: `Cash`, `Bank`, `Investment`, `E-Wallet`)
   - `balance` (Decimal)

4. **Transaction (Loot & Expense)**
   - `id` (UUID)
   - `pouchId` (Foreign Key)
   - `type` (Enum: `Income`, `Expense`, `Transfer`)
   - `amount` (Decimal)
   - `category` (String) — e.g. *Food*, *Utilities*, *Salary*
   - `date` (Timestamp)
   - `notes` (String)

5. **Bill / Tribute (Tagihan Cicilan)**
   - `id` (UUID)
   - `title` (String)
   - `amount` (Decimal)
   - `dueDate` (Date)
   - `status` (Enum: `Paid`, `Pending`, `Overdue`)

---

## 5. 📖 User Stories & Acceptance Criteria (AC)

### Epic 1: Financial Health Score Dashboard
- **US-01**: Sebagai Kepala Keluarga, saya ingin melihat skor kesehatan keuangan secara instan agar saya tahu kondisi finansial keluarga saat ini.
  - **AC-01.1**: Skor ditampilkan dalam rentang 0-100 dengan badge status (e.g., *82/100, Sangat Sehat*).
  - **AC-01.2**: Terdapat rincian 4 metrik utama (Savings Ratio, Dana Darurat, Rasio Utang, Disiplin Budget).

### Epic 2: Pouch & Wallet Management
- **US-02**: Sebagai Co-Manager, saya ingin mengelola berbagai dompet dan rekening terpisah agar alokasi dana terpantau rapi.
  - **AC-02.1**: Pengguna dapat melihat daftar seluruh pouch dengan total saldo masing-masing.
  - **AC-02.2**: Pengguna dapat menambah pouch baru dengan tipe dan saldo awal.

### Epic 3: Bank Statement Import (Scroll Reading)
- **US-03**: Sebagai pengguna, saya ingin mengimport file CSV/Excel mutasi bank agar pencatatan transaksi tidak perlu manual satu per satu.
  - **AC-03.1**: Sistem menyediakan area drag-and-drop file statement.
  - **AC-03.2**: Sistem menampilkan tabel pratinjau (preview) sebelum data disimpan ke pouch.

---

## 6. 🗺️ Struktur & Alur Fitur (User Flow)

### 6.1. Landing / Welcome (`index.html`)
- **Fungsi**: Pintu masuk utama yang memperkenalkan konsep aplikasi.
- **Komponen**: Hero banner dengan branding RPG+SaaS, card ringkasan fitur utama, tombol cepat ke Login ("Masuk Guild") atau langsung eksplorasi ("Jelajahi Guild Hall").

### 6.2. Guild Entrance / Auth (`screens/01-guild-entrance.html`)
- **Fungsi**: Simulasi autentikasi pengguna (Login/Register).
- **Komponen**: Form email/password bertema guild, validasi input, toast notification sukses/gagal, tombol aksi cepat.

### 6.3. Guild Hall / Dashboard (`screens/02-guild-hall.html`)
- **Fungsi**: Pusat komando keuangan utama.
- **Komponen**:
  - **Upgraded Guild Banner**: Avatar profil, nama keluarga (e.g., *Keluarga Rajawali*), level guild (Lv. 5), dan saldo total (Gold).
  - **Analisa Kesehatan Keuangan (Financial Health Score)**: Kartu grid 4 metrik (Savings Ratio, Dana Darurat, Rasio Utang, Disiplin Budget) dengan skor keseluruhan (e.g., 82/100 🟢 Sangat Sehat).
  - **Monthly Quest**: Progress ring visual untuk target Pendapatan vs Pengeluaran bulanan.
  - **Transaksi Terbaru**: Daftar mutasi terakhir dengan ikon kategori dan badge status.
  - **Aksi Cepat (Quick Actions)**: Tombol shortcut (Tambah Loot, Catat Pengeluaran, Transfer Gold, Baca Scroll).
  - **Tagihan Mendatang (Upcoming Tributes)**: List tagihan/cicilan beserta tanggal jatuh tempo.
  - **Sticky Bottom Navigation**: Navigasi bawah konsisten dengan dukungan `safe-area-inset-bottom` untuk mobile notch.

### 6.4. Inventory Pouch (`screens/03-inventory.html`)
- **Fungsi**: Pengelolaan dompet, rekening bank, dan aset investasi.
- **Komponen**:
  - Tombol tambah pouch baru.
  - List pouch/vault aktif (Gold Pouch, Bank Vault, Magic Satchel) beserta saldo dan kategori badge.
  - Detail pouch terpilih & tabel aktivitas khusus pouch tersebut.

### 6.5. Baca Scroll / Import (`screens/04-scroll-reading.html`)
- **Fungsi**: Import data transaksi dari bank statement (CSV/Excel).
- **Komponen**:
  - Drag-and-drop / file picker upload zone.
  - Pratinjau data (preview table) sebelum diimport permanen ke Inventory.
  - Riwayat file statement yang pernah diimport.

---

## 7. 🎨 Design System & Token

- **Typography**: 
  - Heading: *Poppins* (Bold, modern)
  - Body: *Nunito* (Rounded, bersahabat)
  - Monospace: *JetBrains Mono* (Untuk angka/nominal uang)
- **Palette Warna**:
  - Neutral Grays: Clean SaaS background (`#fafafa` / `#1a1a1a` di Dark Mode).
  - Pemasukan (Income): Pastel Mint (`--color-income-500`).
  - Pengeluaran (Expense): Pastel Coral/Danger (`--color-expense-500`).
  - Aset/Gold: Gold/Yellow (`--color-gold-500`).
- **Dark Mode**: Otomatis mendeteksi sistem / manual toggle (tersimpan di `localStorage`).

---

## 8. 🚀 Rencana Pengembangan Selanjutnya (Future Roadmap)

| Fase | Fokus | Fitur Utama |
|------|-------|-------------|
| **Phase 1 (Done)** | Mockup & Static UI | Struktur HTML/CSS, responsive, dark mode, navigasi interaktif. |
| **Phase 2 (Next)** | Local State & Logic | Integrasi JavaScript state management lokal (IndexedDB / LocalStorage) untuk CRUD transaksi dan pouch nyata. |
| **Phase 3** | Backend & Sync | Integrasi Supabase / Firebase untuk multi-user / kolaborasi antar anggota keluarga. |
| **Phase 4** | Advanced Features | Ekspor laporan PDF, grafik tren bulanan interaktif (Chart.js), integrasi API bank (jika memungkinkan). |

---

## 9. 🔧 Core Missing Features & Module Specification

### 9.1 Smart Category & Auto-Tagging Engine

- **Auto-Rule Mapping**: Sistem membaca deskripsi mutasi dari import bank (Scroll Reading) lalu otomatis mendeteksi kategori (contoh: deskripsi `GO-PAY` / `GRAB` → otomatis masuk kategori *Transport*).
- **Custom Category Maker**: Kemampuan keluarga membuat kategori custom dengan ikon dan warna sendiri (misal: kategori khusus *Skincare* atau *Ngopi*).

### 9.2 Family Role-Based Access Control (RBAC) & Shared Vault

- **Multi-Role Permissions**:
  - *Admin (Kepala Keluarga)*: Full akses, edit semua pouch, lihat laporan keseluruhan & skor kesehatan finansial.
  - *Co-Manager (Pasangan)*: Bisa input mutasi & bayar tagihan (*Tribute*), tapi tidak bisa mengubah konfigurasi utama Guild.
  - *Viewer (Anak/Remaja)*: Hanya bisa melihat sisa *Gold Pouch* tertentu atau progress *Monthly Quest* mereka sendiri.
- **Shared vs Private Pouch**: Pilihan apakah suatu rekening/dompet bisa dilihat oleh seluruh anggota keluarga atau disembunyikan (privat).

### 9.3 Financial Analytics & Monthly Trend Reports

- **Cashflow Trend Chart**: Grafik garis/batang bulanan (perbandingan total pemasukan vs pengeluaran dari bulan ke bulan).
- **Expense Breakdown Pie/Donut Chart**: Visualisasi kategori pengeluaran terbanyak (misal: 40% buat cicilan, 30% buat makan).
- **Export Report**: Fitur cetak laporan bulanan ke format PDF/CSV untuk arsip keluarga atau audit pribadi.

### 9.4 Smart Notification & Reminder System

- **Bill / Tribute Reminder**: Notifikasi otomatis menjelang tanggal jatuh tempo tagihan (cicilan rumah, listrik, internet) agar tidak terkena denda.
- **Budget Alert**: Peringatan proaktif jika pengeluaran di suatu kategori sudah mencapai 80% atau 100% dari batas bulanan.
- **Quest Milestone Alert**: Notifikasi saat target *Monthly Quest* atau level *Guild* naik.

### 9.5 Gamification Reward & Penalty Loop (Retention Engine)

- **XP & Guild Level Progression**: Setiap transaksi disiplin atau target tercatat, Guild mendapat XP yang membuat level naik dari Lv. 1 ke Lv. 10.
- **Achievement Badges**: Badge khusus yang terbuka saat mencapai milestone tertentu (contoh: Badge *"Anti Bokek"* saat dana darurat tembus 6 bulan).
- **Streak & Penalty Warning**: Indikator *Streak* harian mencatat keuangan; jika bolos lama, ada badge/status peringatan seru ala game.

---

## 10. 📝 Catatan Revisi & Feedback
> *Bagian ini disiapkan untuk dicatat sebelum masuk ke pengembangan fungsional lebih lanjut.*
- [ ] *[Tulis revisi atau catatan tambahan di sini...]*

## 10. 📝 Catatan Revisi & Feedback
> *Bagian ini disiapkan untuk dicatat sebelum masuk ke pengembangan fungsional lebih lanjut.*
- [ ] *[Tulis revisi atau catatan tambahan di sini...]*
