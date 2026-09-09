# 🧪 Test Plan & QA Checklist
## 💜 KelolaRacun — Family Finance Hub

---

## 1. Prerequisites
- Serve via HTTP (`python -m http.server 8000` atau `npx serve`).
- Browser modern (Chrome/Edge disarankan untuk penuh PWA).
- Pastikan IndexedDB bersih untuk first-run (DevTools → Application → IndexedDB).

---

## 2. Smoke Test — Inisialisasi
- [ ] Buka `http://localhost:8000` → landing tampil, SW terdaftar (console).
- [ ] Buka Guild Hall → data seed muncul (Keluarga Rajawali, 3 pouch).
- [ ] Tidak ada error di console.

## 3. CRUD Transaksi
- [ ] Tambah Income (loot) → toast sukses, saldo pouch naik, kartu transaksi ter-update.
- [ ] Tambah Expense → saldo turun.
- [ ] Validasi: nominal ≤ 0 / tanpa pouch → toast error.

## 4. CRUD Pouch
- [ ] Tambah pouch (Cash/Bank/Investment/E-Wallet) → muncul di list.
- [ ] Klik pouch → detail & saldo benar.

## 5. CRUD Tagihan
- [ ] Tambah tagihan w/ dueDate → muncul di daftar.
- [ ] Tandai lunas → hilang dari pending.
- [ ] Tagihan ≤ 3 hari → ada indikator ⚠️.

## 6. Health Score & Quest
- [ ] Skor berubah setelah tambah transaksi (health score recompute).
- [ ] Monthly Quest progress & ring update.
- [ ] Edit target via modal → tersimpan & dipakai ulang.

## 7. Gamification
- [ ] XP bertambah di tiap transaksi (income 15 / expense 10).
- [ ] Level naik saat melewati threshold → toast level-up.
- [ ] Achievement terbuka (contoh First Loot) → toast + galeri terkunci/terkuci status.
- [ ] Streak bertambah saat catat harian berturut-turut.

## 8. Analytics (Chart.js)
- [ ] Cashflow line & doughnut ter-render (canvas kosong tanpa error).
- [ ] Data ter-update setelah transaksi baru.

## 9. Import CSV
- [ ] Upload CSV → preview table.
- [ ] Deskripsi ter-auto-tag (contoh: "PLN TOKEN" → Utilitas).
- [ ] Konfirmasi impor → transaksi masuk + saldo ter-update.
- [ ] Batal → preview bersih.

## 10. Kategori Custom
- [ ] Tambah kategori (nama, icon, tipe) → muncul di list & dropdown form.
- [ ] Hapus kategori → hilang dari list.

## 11. Backup / Restore / Reset
- [ ] Download backup JSON → file sesuai format `{ app, version, stores }`.
- [ ] Reset semua data → konfirmasi → reload → seed ulang.
- [ ] Restore backup ke DB kosong → data kembali.

## 12. Print PDF
- [ ] Klik Export → dialog print; header/nav/button tersembunyi; table rapi.

## 13. PWA & Offline
- [ ] Install prompt tersedia (devtools → Application → manifest valid).
- [ ] Setelah first visit, matikan internet → reload → app tetap tampil.

## 14. Responsive & Dark Mode
- [ ] Layout adaptif di mobile viewport (≤ 375px).
- [ ] Toggle dark → warna & chart kontras tetap terbaca.