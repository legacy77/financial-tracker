# 📋 TODO — KelolaRacun Production Readiness

Status audit: **IN PROGRESS — core UI + flow selesai, tersisa test manual**.
Route: `/`, screens, favicon 204 verified 200. Syntax JS: semua `node --check` OK.

## 🔴 High Priority — Blocker Produksi

### P0 — Core App Must Work
- [x] **Fix import hilang**: `index.html` import sudah verified, file ada di `scripts/services/memberService.js`
- [x] **Fix Service Worker cache**: tambahkan `./vendor/chart.umd.js`, `./scripts/core/crypto.js`, `./scripts/services/memberService.js`, `./screens/00-register.html`
- [x] **Fix saldo drift**: `addTransaction` insert dulu, reconcile dari all transactions via `reconcileAllPouches()` di `initApp()`
- [x] **Fix DB migration**: `db.js` idempotent upgrade via `upgradeTx.objectStore` + per-index check (aman v0-v4+)
- [x] **Fix transaction update/delete saldo sync**: transfer balance saat pindah pouch, revert saat delete
- [x] **Fix register double-guild**: guild dibuat hanya sekali per DB
- [x] **Fix scroll import pouch guard**: require at least one pouch before import
- [x] **Fix healthScore Transfer**: exclude Transfer dari savings ratio
- [x] **Fix streak local date**: pakai local date dibandingkan ISO UTC
- [x] **Fix register guard**: redirect jika guild sudah ada
- [x] **Fix login init**: replace `initApp()` dengan `openDB()` (login tidak butuh seeding)
- [x] **Fix login/index redirect**: path `screens/` konsisten di `index.html`
- [x] **Unified login page**: 2-view entrance (onboarding vs login), OTP PIN, inline errors
- [x] **Admin-only member mgmt**: tambah + reset PIN + cek duplikat di Hall modal
- [x] **Legacy register redirect**: `00-register.html` redirect ke entrance
- [x] **Entrance clarify**: tombol kembali guild→login wired, empty state jelas
- [ ] **Smoke test**: landing, Guild Hall seed, console bersih (docs/06-TEST-PLAN.md §2)
- [ ] **CRUD Transaksi**: add income/expense, validasi nominal ≤ 0 / tanpa pouch (docs/06-TEST-PLAN.md §3)
- [ ] **CRUD Pouch**: add pouch, detail & saldo benar (docs/06-TEST-PLAN.md §4)
- [ ] **CRUD Tagihan**: add bill, tandai lunas, indikator H-3 (docs/06-TEST-PLAN.md §5)
- [ ] **Health Score & Quest**: recompute skor, progress ring, edit target (docs/06-TEST-PLAN.md §6)
- [ ] **Gamification**: XP 15/10, level-up toast, achievement terbuka, streak (docs/06-TEST-PLAN.md §7)
- [ ] **Analytics**: chart cashflow & doughnut render tanpa error (docs/06-TEST-PLAN.md §8)

### P1 — Data Integrity & Security
- [x] **Transaction atomicity**: insert-first flow + app-level reconcile
- [x] **Pouch balance reconciliation**: `reconcilePouchBalance()` & `reconcileAllPouches()` implemented
- [x] **Auth**: PIN hashing PBKDF2 100k ✓ (verified); cek login flow menggunakan `getMemberByEmail`/`getMemberByPin` di `registerController` & `loginController`
- [x] **Role gating**: viewer tidak bisa edit (sudah ada, cek manual)
- [ ] **Backup/Restore**: restore ke DB kosong saja; format `{ app, version, stores }` (docs/06-TEST-PLAN.md §11)
- [ ] **Reset**: konfirmasi + reload + seed ulang (docs/06-TEST-PLAN.md §11)

### P2 — PWA & Deploy
- [ ] **Manifest icon**: ganti data-URI SVG ke PNG 192/512 (Lighthouse PWA)
- [ ] **Service Worker**: cache-first hanya GET/static; POST tidak di-cache
- [ ] **Offline test**: first visit online → reload offline → app tetap tampil (docs/06-TEST-PLAN.md §13)
- [ ] **Deploy smoke**: URL → semua screen berfungsi, console bersih (docs/08-DEPLOYMENT.md §1)
- [ ] **Lighthouse PWA ≥ 90** (docs/08-DEPLOYMENT.md §4)

## 🟡 Medium Priority — Hardening
- [ ] **Normalize server route**: `server.js` jangan terima `.`/`..` path traversal
- [ ] **Health score**: exclude `Transfer` dari savings ratio (transfer bukan pengeluaran)
- [ ] **Streak date**: pakai local date, bukan ISO UTC (cross-timezone bug)
- [ ] **Event bus**: unsubscribe otomatis saat page unload (duplikat listener antar screen)
- [ ] **Toast**: limit max 4 toast, auto-remove (avoid DOM bloat)

## 🟢 Low Priority — Polish
- [ ] **README**: update catatan "data lokal only, belum ada backend/sync" di homepage
- [ ] **404 fallback**: tambah `404.html` redirect ke `index.html` jika deep-linking (opsional)
- [ ] **Changelog**: update setelah release v1.0
- [ ] **Print PDF**: export header/nav/button hidden (docs/06-TEST-PLAN.md §12)
- [ ] **Responsive**: mobile ≤ 375px (docs/06-TEST-PLAN.md §14)

## ✅ Definition of Done — Production
- [ ] Semua High Priority selesai
- [ ] `docs/06-TEST-PLAN.md`, `07-GETTING-STARTED.md`, `08-DEPLOYMENT.md` checklist dicentang
- [ ] Offline test berhasil
- [ ] Lighthouse PWA ≥ 90
- [ ] Console bersih di semua screen
- [ ] Backup/restore/reset terverifikasi
- [ ] Data migration dari versi lama aman

## 📌 Catatan Audit
- 31 item checklist lama tersebar di docs/06, 07, 08 — masih `[ ]` semua.
- Tidak ada lint/typecheck command di package.json (project static, zero dependency).
- `server.js` hanya untuk dev; production pakai static host (GitHub Pages/Netlify/Vercel).
