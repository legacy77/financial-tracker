# 🎨 UI Design System & UX Flow
## 💜 KelolaRacun — Family Finance Hub

---

## 1. Design Tokens

**Font** (subset hemat, hemat CLS)
| Peran | Font |
|-------|------|
| Heading | Poppins (600/700) |
| Body | Nunito (400/600/700) |
| Numerik/money | JetBrains Mono (500/700) |

**Palette — RPG terang, hierarki tegas**
| Makna | Token | Aturan pakai |
|-------|-------|--------------|
| Primary / Income (emerald) | `--color-income-500 #14b8a6` | CTA utama, nav aktif, link, progress income |
| Expense (coral) | `--color-expense-500 #e11d48` | Danger, pengeluaran, error |
| Gold (aksen XP) | `--color-gold-700 #92400e` teks / `--color-gold-200` border | Hanya badge Lv, XP bar, avatar, banner border — bukan background luas |
| Purple / Blue | badge/info saja | Dilarang sebagai background section |
| Teks | `#1a1a1a / #525252 / #6b7280` | Tertiary `#6b7280` lolos WCAG AA di atas putih |

Banner: gradient terang `#ecfdf5 → #fffbeb` + `border-bottom: --color-gold-200`.

**Mode**: Light default (`#fafafa`) & Dark (`#0a0a0a`).
Aktif via `html.dark` (manual override, kerja tanpa tergantung OS) +
`@media (prefers-color-scheme: dark)` untuk `:root:not(.light)` (auto).

## 2. Komponen

- `.card` (+ varian inset/hover) — container utama.
- `.btn` varian: `--primary`, `--secondary`, `--ghost`, `--danger`.
- `.badge` varian: `--success`, `--danger`, `--warning`, `--info`, `--gold`.
- `.modal` + `modal__content/header/body/footer` — overlay dengan backdrop blur; buka/tutup via `data-open-modal`, tombol ✕, backdrop, atau Esc.
- `.list` / `.list__item` — daftar transaksi, bill, pouch.
- `.table` — riwayat aktivitas pouch & preview CSV.
- `.toast` dalam `.toast-container` — feedback 3 detik.
- `.progress` SVG ring + progress bar — Monthly Quest & XP bar.

## 3. UX Flow

### Home (index.html) — harian
```
Buka → auth guard → fetch(guild, pouch, tx, bill)
     → sapaan + total gold + aksi cepat + aktivitas hari ini + tagihan H-3 + mini quest
     → catat tx via modal, lunasi bill, re-render via event bus
```

### Budget Kategori Bulanan (+ carry)
```
Store budgets { id bud-{catId}-YYYY-MM, categoryId, categoryName, month, base, carryIn, amount=base+carryIn }, DB v6, backup v3, SW v9
→ catModal: input base opsional + edit inline per baris + progres terpakai/batas (ikut bulan aktif)
→ Kartu Hall: picker < > (lalu read-only, kini edit, depan draf) + total vs target global (warning saja)
  + tombol Salin bulan lalu + Terapkan sisa bulan lalu (carryIn, base manual utuh)
  + bar per kategori: terpakai/efektif, badge carry, base
→ Over-budget = warning toast saja (80% 🔔 + 100% ⚠️), transaksi tetap tersimpan (Home/Hall/Inventory/Import)
→ Hapus kategori diblokir bila dipakai transaksi; konfirmasi bila budget aktif; yatim diprune
→ RBAC: tambah kategori + isi/ubah/hapus nilai budget + salin/carry = semua anggota login (requireMember);
   hapus kategori = Admin-only (requireAdmin); lihat progres semua role
```

### Bayar Tagihan (partial, best practice)
```
Buat tagihan wajib kategori Expense → Klik Bayar (Home H-3 / Hall)
→ payBillModal: sisa + pouch (default prefs) + jumlah default sisa + tanggal
→ payBill: cek Pending/Partial + sisa, warning saldo kurang tapi lanjut,
   addTransaction Expense billId → updatePouch → bill Partial/Paid + txIds
→ Gagal tengah = rollback tx; sukses = XP + event updated (budget+health ikut)
→ Void: hapus txIds + reset Pending; unpay manual via void; hapus tx bayar ditolak
```

### Guild Hall — analitik
```
Buka → initApp (seed) → fetchAll (guild, pouches, tx, bills)
     → render banner, arsip 10 tx, semua pending bills, health score, quest detail, charts
     → Aksi: modal tambah tx/pouch/bill/kategori, achievement, print, backup
     → Link balik "Home Harian" untuk aksi cepat hari ini
     → ⚙️ Settings (5 tab): Guild (nama/avatar/moto) · Quest (target) ·
        Anggota (tambah/role/aktif/PIN/hapus + guard Admin terakhir) ·
        Profil Saya (nama + PIN via verify) · Umum (tema/notif/pouch default/backup)
     → RBAC hide total: non-Admin hanya lihat Profil + Umum (tanpa backup);
        tab/pane Guild/Quest/Members + section backup hidden via atribut + guard submit
```

### Inventory
```
Buka → fetch pouches → render list
     → klik pouch → detail + tx per pouch
     → aksi: tambah pouch, tambah tx
```

### Scroll Reading
```
Pilih file CSV → parse → auto-tag kategori → preview table
     → Konfirmasi → batch insert + update saldo → reset
```

## 4. Header & Navigasi (standar 4 layar)

Header 3 zona (`banner-brand` / `desktop-nav` / `banner-actions`):
kiri avatar + nama guild dinamis + `.guild-level` + subtitle;
tengah `.desktop-nav` (desktop saja, `aria-current` per file);
kanan pill gold dinamis + pill XP (hall) + `#themeToggle` + `[data-logout]`.
Entrance tanpa aksi auth. Bottom-nav mobile identik 02/03/04:
HOME · HALL · INVENTORY · IMPORT · LOGOUT (`data-logout`).
Logic terpusat `scripts/ui.js`: `initTheme`, `wireLogout`, `wireModalBackdrop`
(klik backdrop tutup), `applyChartTheme`; di-load tiap layar + `sw.js` v5.

## 5. Responsivitas (mobile-first, RPG terang)

Breakpoints: `480px` (quick actions 2 kolom), `640px` (container padding, modal form multi-kolom, OTP membesar), `1024px` (layout desktop 2 kolom, top-nav).

- Mobile (<640px): semua form modal 1 kolom; `.btn/.input` min-height `44px`; OTP `44×52px`; bottom-nav item min `48px` + `safe-area-inset-bottom`; chart `180px`; tabel via `.table-scroll`.
- Desktop (≥1024px): `.hall-grid` 2 kolom (`1.4fr 1fr`, max `1120px`); `.quick-actions` 3 kolom; `.chart-box` `260px`; `.bottom-nav` disembunyikan, diganti `.desktop-nav` pill di header.
- Zero-inline-style policy: tidak ada `style=` di markup (kecuali `width:0%` dinamis via JS untuk progress bar); semua lewat token/utility di `modern-theme.css` + `components.css`.

## 6. Printing

- `styles/print.css` menyembunyikan header, nav, button, modal, toast.
- Card & table diformat untuk dokumen A4 (border, no shadow, page-break-inside avoid).