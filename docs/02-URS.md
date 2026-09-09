# 📋 User Requirements Specification (URS)
## 💜 KelolaRacun — Family Finance Hub

> **Status**: Production Ready / Implemented

---

## 1. 👤 Persona

| Persona | Deskripsi | Kebutuhan |
|---------|-----------|-----------|
| **Kepala Keluarga** | Admin utama, mengambil keputusan finansial | Visualisasi kesehatan finansial, tagihan, dana darurat |
| **Pasangan / Co-Manager** | Mencatat pengeluaran rutin | Input transaksi cepat, pantau Monthly Quest |
| **Anggota Lain (Viewer)** | Pantau progres & literasi | Lihat saldo pouch, streak, achievement |

---

## 2. 📖 Epic & User Stories (dengan Acceptance Criteria)

### Epic E1 — Guild Hall & Health Score

- **US-01**: Sebagai Kepala Keluarga, saya ingin melihat skor kesehatan keuangan secara instan.
  - **AC-01.1**: Skor ditampilkan 0-100 dengan badge status (Sangat Sehat / Cukup Sehat / Perlu Perhatian).
  - **AC-01.2**: Empat metrik (Savings Ratio, Dana Darurat, Rasio Utang, Disiplin Budget) tampil sebagai kartu.
  - **AC-01.3**: Angka dihitung dari data transaksi riil, bukan hardcode.
  - **AC-01.4**: Skor ter-update otomatis saat data berubah (event bus).

- **US-02**: Sebagai pengguna, saya ingin melihat progres Monthly Quest.
  - **AC-02.1**: Pendapatan & pengeluaran month-to-date vs target tampil sebagai ring & progress bar.
  - **AC-02.2**: Target bisa diedit via modal (default income 5jt, expense 3jt).

### Epic E2 — Pouch & Inventory

- **US-03**: Sebagai Co-Manager, saya ingin mengelola banyak pouch.
  - **AC-03.1**: List pouch dengan saldo per jenis (Cash/Bank/Investment/E-Wallet).
  - **AC-03.2**: Bisa menambah pouch baru via modal.
  - **AC-03.3**: Klik pouch menampilkan detail aktivitas transaksinya.

- **US-04**: Sebagai pengguna, saya mencatat transaksi income/expense ke pouch.
  - **AC-04.1**: Saldo pouch otomatis berubah (income +, expense −).
  - **AC-04.2**: Kategori dipilih dari daftar kategori custom.

### Epic E3 — Baca Scroll (CSV Import)

- **US-05**: Sebagai pengguna, saya import bank statement CSV.
  - **AC-05.1**: Preview tabel muncul sebelum disimpan.
  - **AC-05.2**: Deskripsi otomatis dikategorikan via auto-tag (mix/merch/gaji dll).
  - **AC-05.3**: Transaksi batch tersimpan ke pouch & memicu update saldo + XP.

### Epic E4 — Gamification

- **US-06**: Sebagai pengguna, saya ingin mendapat reward atas disiplin keuangan.
  - **AC-06.1**: XP bertambah di tiap transaksi (income 15, expense 10) dan tagihan lunas (50).
  - **AC-06.2**: Guild level naik saat ambang XP tercapai.
  - **AC-06.3**: Achievement terbuka saat milestone (streak, saldo, level, jumlah transaksi).
  - **AC-06.4**: Streak harian tercatat dan tampil di Guild Progress.

### Epic E5 — Data Safety & Export

- **US-07**: Sebagai pengguna, saya ingin melindungi & mencetak data.
  - **AC-07.1**: Backup JSON dapat diunduh & direstore.
  - **AC-07.2**: Reset semua data tersedia dengan konfirmasi.
  - **AC-07.3**: Laporan dapat dicetak ke PDF (print stylesheet menyembunyikan UI non-esensial).

### Epic E6 — Notification

- **US-08**: Sebagai pengguna, saya mendapat pengingat tagihan mendatang.
  - **AC-08.1**: Notifikasi browser muncul untuk tagihan jatuh tempo H-3.
  - **AC-08.2**: Tagihan yang ≤ 3 hari ditandai ⚠️ di daftar.