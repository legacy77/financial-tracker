// ============================================================
// scripts/core/autoTag.js — Smart Category & Auto-Tagging Engine
// KelolaRacun Advanced Features
// ============================================================

// Rule-based mapping: keyword → category (case-insensitive)
export const AUTO_TAG_RULES = [
  // Transport
  { category: 'Transport', color: 'blue', keywords: ['go-pay', 'gojek', 'grab', 'grabpay', 'maxim', 'transjakarta', 'tiki', 'jne', 'jnt', 'sicepat', 'overtime', 'parkir', 'bensin', 'pertamina', 'shell', 'shell', 'taxi', 'blue bird', 'trip', 'transport', 'ojol', 'gocar', 'goride'] },
  // Belanja Online
  { category: 'Belanja Online', color: 'purple', keywords: ['shopeesay', 'shoppe', 'tokopedia', 'lazada', 'blibli', 'bukalapak', 'e-commerce', 'onlineshop', 'marketplace'] },
  // Makanan & Minuman
  { category: 'Makanan', color: 'expense', keywords: ['indomaret', 'alfamart', 'walmart', 'supermarket', 'grocery', 'restoran', 'makan', 'minum', 'coffee', 'kopi', 'sate', 'nasi', 'kfc', 'mcdonald', 'mcd', 'pizza hut', 'burger', 'ayam', 'sop', 'teh', 'susu', 'nestle', 'go-foods'] },
  // Utilitas & Tagihan
  { category: 'Utilitas', color: 'warning', keywords: ['pln', 'token', 'listrik', 'pdam', 'air', 'telepon', 'internet', 'wifi', 'indihome', 'first media', 'gopay', 'pulsa', 'xl', 'telkomsel', 'indosat', 'tagihan', 'bpjs', 'pajak'] },
  // Investasi & Keuangan
  { category: 'Investasi', color: 'gold', keywords: ['dividen', 'deposito', 'obligasi', 'reksadana', 'saham', 'crypto', 'bitcoin', 'emetic', 'gold', 'emas', 'dinas', 'trading', 'invest'] },
  // Gaji & Pemasukan
  { category: 'Gaji', color: 'income', keywords: ['gaji', 'salary', 'upah', 'honor', 'fee', 'bonus', 'transfer masuk', 'refund', 'cashback'] },
  // Hiburan
  { category: 'Hiburan', color: 'purple', keywords: ['netflix', 'spotify', 'youtube', 'disney', 'game', 'steam', 'playstore', 'appstore', 'voucher game', 'bioskop', 'konser'] }
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