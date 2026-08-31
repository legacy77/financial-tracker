# 📄 Product Requirements Document (PRD)
## 🏰 Family Finance Hub (FFH)

> **Status**: Draft / Mockup Validated  
> **Target Platform**: Web (Static Site / PWA ready)  
> **Tech Stack**: HTML5, Vanilla CSS (Design Tokens, Custom Properties), JavaScript (ES6+), Google Fonts (Poppins, Nunito, JetBrains Mono)

---

## 1. 🎯 Overview & Tujuan Produk

**Family Finance Hub (FFH)** adalah aplikasi manajemen keuangan keluarga yang menggabungkan elemen gamifikasi RPG (Role-Playing Game) dengan estetika SaaS modern (mengadopsi estetika bersih ala Saweria & KOL.id). 

Tujuannya adalah menghilangkan kesan "membosankan" dan "menakutkan" dalam mengelola keuangan rumah tangga, menjadikannya pengalaman yang interaktif, menyenangkan, dan transparan bagi seluruh anggota keluarga.

---

## 2. 👤 Target Pengguna & Persona

- **Kepala Keluarga / Pengambil Keputusan Utama**: Ingin visibilitas penuh terhadap kesehatan finansial, dana darurat, dan cicilan bulanan tanpa ribet.
- **Pasangan / Co-Manager**: Ingin cara praktis mencatat pengeluaran harian dan melihat pencapaian target keuangan bersama (Monthly Quest).
- **Anak/Remaja (Opsional)**: Mengerti literasi keuangan lewat konsep gamifikasi (pouch, loot, quest).

---

## 3. 🗺️ Struktur & Alur Fitur (User Flow)

### 3.1. Landing / Welcome (`index.html`)
- **Fungsi**: Pintu masuk utama yang memperkenalkan konsep aplikasi.
- **Komponen**: Hero banner dengan branding RPG+SaaS, card ringkasan fitur utama, tombol cepat ke Login ("Masuk Guild") atau langsung eksplorasi ("Jelajahi Guild Hall").

### 3.2. Guild Entrance / Auth (`screens/01-guild-entrance.html`)
- **Fungsi**: Simulasi autentikasi pengguna (Login/Register).
- **Komponen**: Form email/password bertema guild, validasi input, toast notification sukses/gagal, tombol aksi cepat.

### 3.3. Guild Hall / Dashboard (`screens/02-guild-hall.html`)
- **Fungsi**: Pusat komando keuangan utama.
- **Komponen**:
  - **Upgraded Guild Banner**: Avatar profil, nama keluarga (e.g., *Keluarga Rajawali*), level guild (Lv. 5), dan saldo total (Gold).
  - **Analisa Kesehatan Keuangan (Financial Health Score)**: Kartu grid 4 metrik (Savings Ratio, Dana Darurat, Rasio Utang, Disiplin Budget) dengan skor keseluruhan (e.g., 82/100 🟢 Sangat Sehat).
  - **Monthly Quest**: Progress ring visual untuk target Pendapatan vs Pengeluaran bulanan.
  - **Transaksi Terbaru**: Daftar mutasi terakhir dengan ikon kategori dan badge status.
  - **Aksi Cepat (Quick Actions)**: Tombol shortcut (Tambah Loot, Catat Pengeluaran, Transfer Gold, Baca Scroll).
  - **Tagihan Mendatang (Upcoming Tributes)**: List tagihan/cicilan beserta tanggal jatuh tempo.
  - **Sticky Bottom Navigation**: Navigasi bawah konsisten dengan dukungan `safe-area-inset-bottom` untuk mobile notch.

### 3.4. Inventory Pouch (`screens/03-inventory.html`)
- **Fungsi**: Pengelolaan dompet, rekening bank, dan aset investasi.
- **Komponen**:
  - Tombol tambah pouch baru.
  - List pouch/vault aktif (Gold Pouch, Bank Vault, Magic Satchel) beserta saldo dan kategori badge.
  - Detail pouch terpilih & tabel aktivitas khusus pouch tersebut.

### 3.5. Baca Scroll / Import (`screens/04-scroll-reading.html`)
- **Fungsi**: Import data transaksi dari bank statement (CSV/Excel).
- **Komponen**:
  - Drag-and-drop / file picker upload zone.
  - Pratinjau data (preview table) sebelum diimport permanen ke Inventory.
  - Riwayat file statement yang pernah diimport.

---

## 4. 🎨 Design System & Token

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

## 5. 🚀 Rencana Pengembangan Selanjutnya (Future Roadmap)

| Fase | Fokus | Fitur Utama |
|------|-------|-------------|
| **Phase 1 (Done)** | Mockup & Static UI | Struktur HTML/CSS, responsive, dark mode, navigasi interaktif. |
| **Phase 2 (Next)** | Local State & Logic | Integrasi JavaScript state management lokal (IndexedDB / LocalStorage) untuk CRUD transaksi dan pouch nyata. |
| **Phase 3** | Backend & Sync | Integrasi Supabase / Firebase untuk multi-user / kolaborasi antar anggota keluarga. |
| **Phase 4** | Advanced Features | Ekspor laporan PDF, grafik tren bulanan interaktif (Chart.js), integrasi API bank (jika memungkinkan). |

---

## 6. 📝 Catatan Revisi & Feedback
> *Bagian ini disiapkan untuk dicatat sebelum masuk ke pengembangan fungsional lebih lanjut.*
- [ ] *[Tulis revisi atau catatan tambahan di sini...]*
