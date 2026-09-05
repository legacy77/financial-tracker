# 🎨 UI Design System & UX Flow
## 💜 KelolaRacun — Family Finance Hub

---

## 1. Design Tokens

**Font**
| Peran | Font |
|-------|------|
| Heading | Poppins (600/700/800) |
| Body | Nunito (400-800) |
| Numerik/money | JetBrains Mono |

**Palette**
| Makna | Warna |
|-------|-------|
| Income (mint) | `--color-income-500 #14b8a6` |
| Expense (coral) | `--color-expense-500 #e11d48` |
| Gold (accent/CTA) | `--color-gold-500 #d97706` |
| Purple (premium) | `--color-purple-500 #9333ea` |
| Blue (info/link) | `--color-blue-500 #2563eb` |

**Mode**: Light (default, `#fafafa` bg) & Dark (`#0a0a0a`) via `.dark` class + media query.

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

### Guild Hall
```
Buka → initApp (seed) → fetchAll (guild, pouches, tx, bills)
     → render banner, tx terbaru, bills, health score, quest, charts
     → Aksi: modal tambah tx/pouch/bill/kategori, achievement, print, backup
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

## 4. Responsivitas

- Container fluid `max-width: 1280px`; card grid `repeat(auto-fit, minmax(140px,1fr))`.
- Bottom nav sticky dengan `safe-area-inset-bottom` (notch-friendly).
- Tabel scroll horizontal (`overflow-x: auto`) di layar kecil.

## 5. Printing

- `styles/print.css` menyembunyikan header, nav, button, modal, toast.
- Card & table diformat untuk dokumen A4 (border, no shadow, page-break-inside avoid).