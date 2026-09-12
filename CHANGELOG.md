# 📌 Changelog
## 💜 KelolaRacun — Family Finance Hub

> Riwayat rilis per fitur besar, berdasar `git log`. Dokumentasi teknis lengkap tersedia di folder `docs/`.

---

## v0.4.0 — Home Hub, Category Budgets, Statement Parser & Multi-Device Sync (latest)
- **Home Hub (`index.html`, `homeController.js`)**: Layar dashboard ringkasan harian, aksi cepat catat transaksi, bayar tagihan mendesak (H-3), dan mini quest progres bulanan.
- **Category Budget Engine (`budgetService.js`)**: Alokasi anggaran bulanan per kategori dengan carry-in/rollover saldo sisa, salin alokasi bulan lalu, pelacakan real-time, dan notifikasi peringatan over-budget (80% & 100%).
- **Workflow Pembayaran Tagihan Terpadu (`payBill.js`, `billService.js`)**: Modal pembayaran tagihan dengan dukungan pembayaran bertahap (partial payment), pemilihan sumber pouch, auto-rollback transaksi jika gagal, dan fitur void.
- **SeaBank & Statement Parser (`seabankParser.js`, `importService.js`)**: Parser mutasi rekening (PDF & OCR), deteksi duplikasi transaksi cerdas berbasis hash baris (`markDuplicates`), dan audit log riwayat import.
- **Multi-Device Sync (`server.js`, `syncService.js`)**: Sinkronisasi lokal multi-perangkat via endpoint `/api/sync` dengan resolusi konflik *last-write-wins* berbasis timestamp, health check, serta hardening path traversal.
- **Arsitektur UI Terpadu (`ui.js`, `modern-theme.css`, `components.css`)**: Header 3-zona standar di semua layar, toggle tema gelap/terang terpusat, penutupan modal pada backdrop click, dan layout desktop responsif 2-kolom tanpa inline styles.
- **Integritas Data & Rekonsiliasi Saldo**: Skema IndexedDB v6 (`budgets`, `imports`), auto-reconcile saldo pouch (`reconcileAllPouches`), pencegahan saldo drift saat edit/hapus transaksi, dan pembaruan Service Worker cache v9.

## v0.3.1 — Member Management & Auth Security Suite · commit `cf0abb0` / `643ac92` / `75bb5d7`
- Sistem autentikasi berbasis PIN dengan hashing PBKDF2 (100.000 iterasi) dan salt kriptografis acak per anggota (`crypto.js`, `authService.js`).
- Manajemen anggota keluarga lengkap dengan kontrol akses berbasis peran / RBAC (`Admin`, `Co-Manager`, `Viewer`).
- Strict auth-first routing & entrance view terpadu (login PIN & onboarding wizard).
- Dokumentasi teknis lengkap di direktori `docs/` (PRD, URS, SFD, TSD, UI Design, Test Plan, Deployment, dsb).

## v0.3.0 — Advanced Features · commit `6f83e76`
**0-9** — Dynamic health score, editable monthly quest, custom categories
- Health score 0-100 dihitung dari data riil (`healthScore.js`)
- Monthly Quest month-to-date vs target configurable (modal atur target)
- Custom category maker (store `categories`, modal kelola, dropdown form transaksi)
- Rafinasi rule auto-tag (fix collision food/transport/shopping)

## v0.2.0 — Gamification & Analytics · commit `89d7047`
- Gamification engine: XP, guild level, streak, achievement badges
- Chart.js lokal: cashflow line & expense doughnut
- Smart auto-tag engine utk CSV import
- Backup/restore/reset JSON + modal UI
- Print-to-PDF stylesheet & tombol export
- Notifikasi tagihan H-3 + toast achievement/level-up
- IndexedDB schema v2 (store `gamification`), SW v2

## v0.1.3 — PWA & Docs · commit `79e1cd0` / `a07237a`
- PWA: manifest, service worker, offline cache v1
- Screen controllers dinamis (guild hall, inventory, scroll reading)
- Event bus reaktivitas UI, modal CRUD transaksi/pouch/bill
- `scripts/core` (helpers, eventBus) + screen controllers
- README update dinamis & PWA-ready

## v0.1.2 — Phase 2 Local DB · commit `db8582a`
- IndexedDB wrapper + CRUD services (guild, pouch, transaction, bill)

## v0.1.1 — Rebrand · commit `3527c5a` `c2023fb`
- Rebrand ke KelolaRacun (RPG + SaaS + GenZ ID vibe)
- PRD + 5 core missing features

## v0.1.0 — Initial Mockup · commit `f5ed7da` `f595a34`
- Family Finance Hub mockup: landing, 4 screens, themes, responsive
- PRD awal & README GenZ

---

## Catatan
- Format versi `SemVer` informal.
- Merge PR commits (`2695e11`, `c587d4c`, `d85057a`, `1c91ea4`) dikelompokkan ke dalam versi fitur terkait di atas.
