# 🔧 Technical Specification & Architecture (TSD)
## 💜 KelolaRacun — Family Finance Hub

> **Status**: Production Ready

---

## 1. Arsitektur

- **Paradigma**: Multi-page statis + controller ES Modules, tanpa build step.
- **Pola**: Service layer (IndexedDB) → event bus → controller render DOM.
- **Browser Support**: Modern Chromium/Firefox/Safari/Edge. Wajib served via HTTP (ES modules & SW).

```
index.html
└── screens/*.html  → load controller module
        └── scripts/screens/*Controller.js
                └── core modules + services
                          └── db.js (IndexedDB wrapper)
```

## 2. Struktur Modul

| Path | Tanggung Jawab |
|------|----------------|
| `scripts/db.js` | Promise wrapper IndexedDB (open, add, getAll, getById, put, remove) |
| `scripts/app.js` | Init DB + seed, `window.KelolaRacun` API, showToast |
| `scripts/core/eventBus.js` | pub/sub (`subscribe`, `publish`, `unsubscribe`) |
| `scripts/core/helpers.js` | formatRupiah, formatDate, relativeDate, validasi form, modal helper, TYPE_META |
| `scripts/core/gamification.js` | XP, level, streak, achievement |
| `scripts/core/healthScore.js` | 4 metrik + skor |
| `scripts/core/autoTag.js` | rule-based kategori |
| `scripts/core/backupService.js` | export/restore/reset JSON |
| `scripts/services/*.js` | CRUD per store (guild, pouch, transaction, bill, category) + publish event |
| `scripts/screens/*Controller.js` | render DOM per halaman |
| `vendor/chart.umd.js` | Chart.js lokal |
| `sw.js` | Service Worker PWA |
| `manifest.json` | Web App Manifest |

## 3. IndexedDB Schema (v3)

| Store | keyPath | Indexes |
|-------|---------|---------|
| guilds | `id` | - |
| members | `id` | `guildId`, `role` |
| pouches | `id` | `guildId`, `type` |
| transactions | `id` | `pouchId`, `date`, `type`, `category` |
| bills | `id` | `dueDate`, `status` |
| gamification | `id` | - |
| categories | `id` | `name` |

## 4. Event Bus Contract

| Event | Detail | Subtribers |
|-------|--------|-----------|
| `kelola-racun:updated` | `{ type: 'transaction'\|'pouch'\|'bill'\|'guild'\|'category' }` | Semua controller |
| `kelola-racun:inventory-switch` | `{ pouchId }` | inventoryController |
| `gamification:achievement-unlocked` | `{ achievements: [...] }` | guildHallController |
| `gamification:level-up` | `{ level }` | guildHallController |

## 5. Service Worker Strategy

- `CACHE_NAME = kelolaracun-v3`; pre-cache daftar aset statis (CSS, JS core, screens, vendor, manifest).
- Fetch: **cache-first** dengan background revalidate; fallback `index.html` untuk navigasi saat offline.
- Bump cache name saat daftar aset berubah agar konten baru terambil.

## 6. Command APIs (window.KelolaRacun)

```js
getGuild, updateGuild,
getPouches, createPouch, getPouch,
getTransactions, getTransactionsByPouch, addTransaction,
getBills, getPendingBills, addBill, togglePaid,
getCategories, createCategory, deleteCategory,
showToast
```