# 💜 KelolaRacun: Family Finance Hub

> **Kelola racun-mu, raih goal-mu!**

Catat uang keluarga dalam Rupiah, bagi akses antaranggota, dan jadikan kebiasaan finansial lebih seru lewat sentuhan RPG Fantasy. Antarmuka berbahasa Indonesia.

**Tanpa dependency npm · Tanpa build · Offline-first**

Bukan layanan yang meminta akun atau koneksi bank: data tersimpan di browser Anda. KelolaRacun menggabungkan pencatatan keluarga, role anggota, quest, dan Health Score dalam aplikasi web yang bisa di-host statis. Tidak ada backend produksi yang wajib dijalankan.

## Yang bisa dilakukan

- **Catat & atur uang.** Income, Expense, transfer antardompet, quick-add nominal, edit/hapus transaksi dengan rekonsiliasi saldo. Dompet Cash, Bank, Investment, dan E-Wallet mendukung saldo awal; tipe Investment **bukan** pelacak portofolio.
- **Rencanakan bulan ini.** Budget per kategori dengan rollover sisa bulan sebelumnya dan peringatan 80%/100%. Tagihan punya jatuh tempo, indikator H-3/terlambat, pembayaran sebagian, dan void pembayaran.
- **Lihat kondisi keluarga.** Health Score 0–100 dari Savings Ratio, Emergency Fund, Debt Service Ratio, dan Budget Discipline. Laporan memuat cash flow enam bulan, rincian pengeluaran, serta kepatuhan budget.
- **Review yang terlupakan.** Tiap transaksi punya `reviewedAt`; laporan *aging* menampilkan transaksi yang belum direview lebih dari 30 hari, urut dari yang paling lama, dan bisa ditandai review sekaligus (bulk).
- **Kejar goal tabungan.** Pouch bertipe `Savings` menerima target dan deadline; progres menampilkan sisa dan saran sisihan per bulan. Deadline yang terlewat hanya memunculkan peringatan, tidak mereset apa pun — kontribusi tetap lewat transfer biasa.
- **Jaga kebiasaan.** XP, level, streak harian, achievement badge, dan Monthly Quest. **Simple Mode** mengganti istilah RPG dengan istilah sehari-hari; **Mode Tenang** menyembunyikan elemen gamification.
- **Bawa data sendiri.** Import CSV/Excel dengan preview, deteksi duplikat, dan auto-tag kategori berbasis keyword; tersedia template, export CSV, serta print-to-PDF. Backup/restore JSON dan auto-backup mingguan; bagikan file backup lewat menu share perangkat (termasuk WhatsApp bila tersedia), atau unduh untuk dikirim manual.
- **Pakai bersama.** Pilih kartu profil keluarga untuk masuk. Tampilan Light/Dark/System, navigasi bawah di ponsel, dan PWA yang dapat diinstal untuk penggunaan offline. Keyboard shortcut: `Ctrl`/`⌘`+`K` untuk command palette, `N` transaksi baru, `?` bantuan, `Esc` menutup overlay — nonaktif saat mengetik di kolom input.

<!-- TODO: Tambahkan screenshot aplikasi nyata di sini. Folder screens/ berisi halaman HTML, bukan gambar screenshot. -->

## Mulai dalam kurang dari semenit

1. Clone repo dan masuk ke folder proyek.
2. Pilih **salah satu** server lokal (tidak perlu `npm install` atau build):

   ```bash
   python -m http.server 8000
   # atau, untuk sinkronisasi perangkat di jaringan lokal:
   node server.js
   ```

3. Buka `http://localhost:8000/screens/01-guild-entrance.html`. Saat onboarding, buat guild. Aplikasi otomatis menyiapkan profil `zara` (Admin) dan `dhika` (Member). Pilih salah satu kartu untuk langsung masuk tanpa PIN.

> Jalankan via HTTP, bukan `file://`: ES Modules, Web Crypto, dan Service Worker memerlukan konteks browser yang sesuai. `localhost` memenuhi kebutuhan ini. Server Python hanya menyajikan file; `node server.js` juga menyediakan sinkronisasi lokal opsional. Agar perangkat lain ikut sinkron, akses server Node yang sama lewat alamat jaringan lokalnya. Jangan buka server ini ke internet: endpoint data lokal tidak menyediakan autentikasi server.

## Privasi & cara kerja

- Semua data utama berada di **IndexedDB browser** (9 object store); tidak ada akun, server wajib, atau telemetri. Menghapus data situs/browser dapat menghapus data tersebut: simpan backup JSON secara berkala.
- Pemilihan profil berbasis client-side, bukan autentikasi identitas. Siapa pun yang dapat membuka aplikasi bisa memilih kartu Admin. Gunakan perangkat dan jaringan tepercaya.
- Vanilla JavaScript ES Modules menghubungkan service layer dan event bus. Chart.js serta parser Excel disimpan di `vendor/`; tidak ada framework, dependency npm, atau build step. Service Worker menyimpan aset untuk penggunaan offline setelah kunjungan awal.
- Hosting statis menjalankan aplikasi tanpa layanan sinkronisasi. `server.js` memakai Node.js stdlib (`http`, `fs`, `path`, `crypto`) untuk development dan sinkronisasi opsional. Bila dipakai, salinan **data asli** tersimpan di `data/db.json`, yang diabaikan oleh `.gitignore`; lindungi file dan jaringan lokal Anda.
- Server lokal **sudah diperkuat**, bukan diautentikasi: path sensitif (`data/`, `.git/`, konfigurasi, `server.js`) dibalas 403; request dari origin yang tidak dikenal ditolak. Tetap **tidak ada autentikasi maupun enkripsi** — siapa pun yang bisa menjangkau port 8000 di jaringan Anda masih bisa menulis database lewat sinkronisasi. LAN memang dibuka secara sengaja agar multi-device sync berjalan, jadi pastikan jaringan Anda tepercaya.

## Struktur proyek

| Lokasi | Isi |
| --- | --- |
| `index.html`, `screens/` | Halaman utama dan layar aplikasi |
| `scripts/core/`, `scripts/services/` | Auth, event bus, logika bisnis, dan penyimpanan |
| `styles/`, `vendor/` | Gaya dan library browser yang tersedia offline |
| `manifest.json`, `sw.js` | Instalasi PWA dan cache offline |
| `server.js`, `docs/` | Server lokal opsional dan dokumentasi |

## Dokumentasi

[Spesifikasi produk](docs/01-PRD.md) · [Panduan mulai](docs/07-GETTING-STARTED.md) · [Deployment](docs/08-DEPLOYMENT.md) · [Rencana pengujian](docs/06-TEST-PLAN.md)

## Status & kontribusi

Fitur inti sudah tersedia, termasuk Batch 2 terbaru: laporan aging transaksi belum direview (dengan bulk review), savings goal untuk pouch Savings, dan keyboard shortcut. Koreksi terbaru: Health Score tidak lagi menghitung transfer sebagai pengeluaran, dan penghitung `totalTransactions` turun saat transaksi dihapus. Penguatan server lokal (blokir path sensitif dan filter origin) juga sudah masuk.

Yang masih direncanakan: hardening lanjutan server lokal, aset ikon PWA, dan verifikasi manual UI untuk alur utama, offline/PWA, serta tampilan ponsel. Belum ada jadwal rilis untuk pekerjaan tersebut.

Kontribusi diterima lewat issue atau pull request. Mulai dari [rencana pengujian](docs/06-TEST-PLAN.md) dan panduan mulai di atas; jelaskan langkah uji manual untuk perubahan Anda. **Belum ada automated test maupun CI** — keduanya area kontribusi yang dibutuhkan.

## Monitoring dan operasional

Probe status server:

```text
GET http://localhost:8000/health
```

Response memuat `status`, `online`, `uptimeSeconds`, `timestamp`, `port`, `pid`, dan `memory.rssBytes`. Contoh PowerShell:

```powershell
Invoke-RestMethod http://localhost:8000/health
Invoke-WebRequest http://localhost:8000/health | Select-Object StatusCode, Headers, Content
```

Server default bind ke `127.0.0.1` agar hanya bisa diakses lokal. Set `HOST=0.0.0.0` bila perlu akses LAN; ini membuka port ke jaringan, jadi gunakan jaringan tepercaya.

`/v1/models` bukan endpoint server ini. Jangan tambah stub; perbaiki `baseURL` caller eksternal agar menunjuk service yang benar.

`POST /api/data` memvalidasi `version`, `stores`, store wajib, dan `id` setiap record sebelum database ditimpa. Field member `pinSalt` dan `pinHash` dibuang server. Host request harus `localhost`, `127.0.0.1`, atau nilai `HOST` yang dikonfigurasi. Saat `HOST=0.0.0.0`, gunakan firewall/reverse proxy terautentikasi; API ini tetap tanpa otorisasi bawaan.

## Lisensi

**Belum ditentukan.** Repo ini belum memiliki file `LICENSE`; jangan mengasumsikan izin penggunaan ulang atau distribusi sebelum lisensi ditambahkan oleh pemilik repo.
