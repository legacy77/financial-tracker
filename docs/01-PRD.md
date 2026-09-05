# 📄 Product Requirements Document (PRD)
## 💜 KelolaRacun — Family Finance Hub

> **Status**: Production Ready / Implemented  
> **Target Platform**: Web (Static PWA)  
> **Tech Stack**: HTML5, Vanilla CSS, Modern JavaScript (ES6+), IndexedDB, Chart.js  

---

## 1. 🎯 Overview & Tujuan Produk

**KelolaRacun** adalah aplikasi manajemen keuangan keluarga yang menggabungkan elemen gamifikasi RPG (Role-Playing Game) dengan estetika SaaS modern. Tujuannya adalah menghilangkan kesan "membosankan" dalam mengelola keuangan rumah tangga, menjadikannya pengalaman yang interaktif dan menyenangkan bagi seluruh anggota keluarga.

Misi: *"Kelola racun-mu, raih goal-mu!"*

---

## 2. 👤 Target Pengguna & Persona

- **Kepala Keluarga / Pengambil Keputusan**: Visibilitas penuh terhadap kesehatan finansial, dana darurat, dan cicilan bulanan.
- **Pasangan / Co-Manager**: Praktis mencatat pengeluaran harian dan memantau Monthly Quest bersama.
- **Anggota Keluarga**: Literasi keuangan lewat gamifikasi (pouch, loot, XP, badge).

---

## 3. ✨ Fitur Utama (Implemented)

1. **🏰 Guild Hall & Health Score**: Dashboard utama dengan kalkulasi 0-100 skor kesehatan keuangan (Savings Ratio, Dana Darurat, Rasio Utang, Disiplin Budget) dari data riil.
2. **🎒 Inventory Pouch**: Manajemen multi-pouch (Cash, Bank, Investment, E-Wallet) dengan sinkronisasi saldo otomatis.
3. **📜 Baca Scroll (CSV Import)**: Import bank statement dengan engine smart auto-tagging kategori.
4. **🎮 Gamification Engine**: Sistem XP, Guild Level (Lv. 1-10+), achievement badges, dan streak harian.
5. **📊 Smart Analytics**: Grafik cashflow 6 bulan & expense breakdown kategori interaktif (Chart.js lokal).
6. **📝 Custom Category Maker**: Pengelolaan kategori custom dengan ikon dan tipe tersendiri.
7. **💾 Backup, Restore & Print**: Ekspor/impor data JSON lokal serta cetak laporan bersih (Print-to-PDF).
8. **📱 PWA & Offline Support**: Installable PWA dengan caching Service Worker dan notifikasi tagihan H-3.

---

## 4. 🧱 Data Model (IndexedDB Schema v3)

- **guilds**: `id`, `familyName`, `guildLevel`, `totalGold`, `monthlyTargetIncome`, `monthlyTargetExpense`
- **pouches**: `id`, `guildId`, `name`, `type`, `balance`
- **transactions**: `id`, `pouchId`, `type`, `amount`, `category`, `date`, `notes`
- **bills**: `id`, `title`, `amount`, `dueDate`, `status`
- **gamification**: `id`, `xp`, `level`, `unlockedAchievements`, `currentStreak`, `longestStreak`
- **categories**: `id`, `name`, `icon`, `color`, `type`
