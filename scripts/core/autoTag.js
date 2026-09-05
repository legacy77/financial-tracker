// ============================================================
// scripts/core/autoTag.js — Smart Category & Auto-Tagging Engine
// KelolaRacun Advanced Features
// ============================================================

// Rule-based mapping: keyword → category (case-insensitive)
export const AUTO_TAG_RULES = [
  // Belanja Online
  { category: 'Belanja Online', color: 'purple', keywords: ['shopee', 'tokopedia', 'lazada', 'blibli', 'bukalapak', 'e-commerce', 'onlineshop', 'marketplace'] },
  // Makanan & Minuman (pastikan spesifik food)
  { category: 'Makanan', color: 'expense', keywords: ['gofood', 'grabfood', 'shopeefood', 'go food', 'grab food', 'indomaret', 'alfamart', 'supermarket', 'grocery', 'restoran', 'makan', 'minum', 'coffee', 'kopi', 'sate', 'nasi', 'kfc', 'mcdonald', 'mcd', 'pizza hut', 'burger', 'ayam', 'sop', 'teh', 'susu'] },
  // Transport
  { category: 'Transport', color: 'blue', keywords: ['gojek', 'grab', 'maxim', 'transjakarta', 'tiki', 'jne', 'jnt', 'sicepat', 'parkir', 'bensin', 'pertamina', 'shell', 'taxi', 'blue bird', 'trip', 'transport', 'ojol', 'gocar', 'goride'] },
  // Utilitas & Tagihan
  { category: 'Utilitas', color: 'warning', keywords: ['gopay', 'ovo', 'dana', 'qris', 'pln', 'token', 'listrik', 'pdam', 'air', 'telepon', 'internet', 'wifi', 'indihome', 'first media', 'pulsa', 'xl', 'telkomsel', 'indosat', 'tagihan', 'bpjs', 'pajak'] },
  // Investasi & Keuangan
  { category: 'Investasi', color: 'gold', keywords: ['dividen', 'deposito', 'obligasi', 'reksadana', 'saham', 'crypto', 'bitcoin', 'gold', 'emas', 'trading', 'invest'] },
  // Gaji & Pemasukan
  { category: 'Gaji', color: 'income', keywords: ['gaji', 'salary', 'upah', 'honor', 'fee', 'bonus', 'transfer masuk', 'refund', 'cashback'] },
  // Hiburan
  { category: 'Hiburan', color: 'purple', keywords: ['netflix', 'spotify', 'youtube', 'disney', 'game', 'steam', 'playstore', 'appstore', 'bioskop', 'konser'] }
];

export function autoTag(description) {
  const text = String(description || '').toLowerCase();
  if (!text) return { category: 'Pengeluaran Umum', color: 'expense' };

  for (const rule of AUTO_TAG_RULES) {
    if (rule.keywords.some(k => text.includes(k))) {
      return { category: rule.category, color: rule.color };
    }
  }
  return { category: 'Pengeluaran Umum', color: 'expense' };
}

export function getFinalCategory(desc, fallbackCategory) {
  const auto = autoTag(desc);
  // If fallback explicitly provided, respect it; else use auto
  if (fallbackCategory && fallbackCategory !== 'Pengeluaran Umum' && fallbackCategory !== '') {
    return fallbackCategory;
  }
  return auto.category;
}