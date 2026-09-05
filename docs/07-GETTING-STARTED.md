# 🚀 Getting Started — Cara Menjalankan Aplikasi
## 💜 KelolaRacun — Family Finance Hub

> Aplikasi ini **tanpa build step**. Cukup serve statis via HTTP (ES Modules & Service Worker tidak bisa berjalan via `file://`).

---

## Step 1 — Clone Repository

```bash
git clone https://github.com/legacy77/financial-tracker.git
cd financial-tracker
git checkout development
```

## Step 2 — Jalankan Local Server

Pilih salah satu:

**Pilihan A — Python**
```bash
python -m http.server 8000
```
Buka `http://localhost:8000`.

**Pilihan B — Node.js (`npx serve`)**
```bash
npx serve .
```

**Pilihan C — VS Code Live Server**
1. Install ekstensi "Live Server".
2. Klik kanan `index.html` → "Open with Live Server".

## Step 3 — Explore Aplikasi

1. **Landing** → klik **"🏰 Jelajahi Guild Hall"** (skip login simulation).
2. **Guild Hall** → lihat Health Score, Monthly Quest, chart, transaksi, tagihan.
3. **Aksi** → tombol **➕ Tambah Loot / 💸 Catat Pengeluaran** → modal form → simpan.
4. **Inventory** → kelola pouch, klik pouch utk lihat aktivitas.
5. **Baca Scroll** → upload file **CSV** → preview → import.
6. **🎯 Atur Target / 🏅 Achievement / 🏷️ Kelola Kategori / 💾 Backup / 📄 Export PDF** via tombol di Guild Hall.

## Step 4 — Verifikasi Berhasil

- [ ] Data tampil & tersimpan setelah refresh (IndexedDB).
- [ ] Chart cashflow & doughnut muncul.
- [ ] XP & level naik setelah menambah transaksi.
- [ ] Toast muncul di tiap aksi.
- [ ] (Opsional) Install PWA dari address bar, coba offline.

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Console error `Cannot use import statement outside a module` | Pastikan diakses via HTTP, bukan `file://` |
| Menu/modul tidak muncul | Hard refresh (`Ctrl+Shift+R`) utk ambil SW baru |
| Data test ganda/aneh | DevTools → Application → IndexedDB → hapus `kelola_racun_db` → reload (auto seed ulang) |
| Notifikasi tidak muncul | Izinkan permission saat prompt; hanya jalan di tab aktif/hidden-benar |