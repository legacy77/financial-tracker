# 📦 Software Functional Description (SFD)
## 💜 KelolaRacun — Family Finance Hub

> **Status**: Production Ready / Implemented

---

## 1. Modul Guild Hall
- Menampilkan guild banner (nama, level, total gold dari semua pouch).
- **Financial Health Score**: kalkulasi `healthScore.js` dari data riil.
- **Monthly Quest**: aggregasi month-to-date income/expense vs target.
- **Guild Progress**: XP bar, level, streak (`gamification.js`).
- **Analitik**: Chart.js line & doughnut.
- **Aksi cepat**: modal tambah transaksi/pouch/tagihan, kelola kategori, export PDF, backup/restore, achievement gallery.

## 2. Modul Inventory Pouch
- List pouch interaktif; klik untuk memilih → detail + riwayat transaksi per pouch.
- Tambah pouch (Cash/Bank/Investment/E-Wallet) via modal.
- Tambah transaksi ke pouch aktif via modal.

## 3. Modul Baca Scroll (Import)
- Upload CSV (accept `.csv,.xlsx,.xls`).
- Parse baris → preview tabel.
- **Auto-tag**: `autoTag.js` memetakan deskripsi ke kategori via keyword rules.
- Confirm → batch `addTransaction` (update saldo per baris + XP per transaksi).
- Tombol Batal reset.

## 4. Engine Gamification
- **XP rules**: income soalnya 15 XP, expense 10 XP, tagihan added 20 XP, bill paid 50 XP.
- **Leveling**: ambang level pada `LEVEL_THRESHOLDS` array; progressive.
- **Streak**: hitung berbasis tanggal (`checkStreak`); bonus +30 XP jika streak ≥ 3.
- **Achievements**: 10 definisi badge (first_loot, recorder, gold_hoarder, rich_guild, disciplined, tribute_master, streak_3, streak_7, level_5, level_10).
- **Publish event**: `gamification:achievement-unlocked`, `gamification:level-up`.

## 5. Engine Health Score
- Metrik & bobot skor parsial (masing-masing dinormalisasi 0-100):
  1. Savings Ratio (target ≥ 30%)
  2. Dana Darurat (target ≥ 6 bulan pengeluaran rata-rata)
  3. Rasio Utang (aman < 35%)
  4. Disiplin Budget (vs target expense bulanan)
- Overall = rata-rata 4 skor → status badge.

## 6. Smart Auto-Tagging
- Rule-based keyword matching (case-insensitive).
- Prioritas kategori: Belanja Online → Makanan → Transport → Utilitas → Investasi → Gaji → Hiburan.
- Fallback: `Pengeluaran Umum`.

## 7. Backup, Restore & Reset
- `exportBackup()`: kumpulkan 7 store ke JSON.
- `downloadBackup()`: Blob download.
- `restoreBackup(data)`: validasi format; tolak jika store sudah berisi data (cegah duplikat); lalu bulk insert dan reload.
- `resetAllData()`: clear 7 store, lalu `location.reload()`.

## 8. Notifikasi Browser
- Permintaan izin saat inisialisasi.
- Cek tagihan dengan dueDate ≤ 3 hari dari hari ini → `new Notification(...)` jika tab hidden.
- Tandai visual ⚠️ pada daftar tagihan mendekati tempo.

## 9. Print-to-PDF
- Tombol `window.print()`.
- `print.css` media print menyembunyikan header, bottom-nav, tombol, modal, toast; merapikan card & table.