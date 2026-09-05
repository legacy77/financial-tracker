# 📌 Changelog
## 💜 KelolaRacun — Family Finance Hub

> Riwayat rilis per fitur besar, berdasar `git log`.

---

## v0.3.0 — Advanced Features (latest) · commit `6f83e76`
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