import { autoTag } from '../core/autoTag.js';

/** Suggest category locally from text, transaction type, and amount. */
export function categorizeTransaction(description, amount = 0, type = 'Expense', existingCategories = []) {
  try {
    const income = type === 'Income';
    const tagged = autoTag(description);
    const categories = Array.isArray(existingCategories) ? existingCategories : [];
    const fallback = income ? 'Gaji' : 'Pengeluaran Umum';
    const text = String(description || '').toLowerCase();
    let name = tagged.category;
    let confidence = text ? (/\b(shopee|tokopedia|gofood|grabfood|pln|netflix|spotify|gaji|salary)\b/.test(text) ? 0.76 : 0.6) : 0.35;
    let reasoning = text ? `Keyword cocok dengan kategori ${name}` : 'Deskripsi kosong, gunakan kategori default';
    if (income && !['Gaji', 'Investasi'].includes(name)) {
      name = Number(amount) >= 5000000 ? 'Gaji' : fallback;
      confidence = text ? 0.68 : 0.55;
      reasoning = Number(amount) >= 5000000 ? 'Pemasukan besar diprioritaskan ke Gaji' : 'Pemasukan tanpa keyword spesifik';
    }
    if (!income && Number(amount) > 0 && Number(amount) < 100000 && name === 'Pengeluaran Umum') {
      reasoning = 'Nominal kecil, gunakan Pengeluaran Umum';
      confidence = 0.55;
    }
    const match = categories.find(c => c.name === name) || categories.find(c => c.name === fallback);
    return { categoryId: match?.id || null, applicable: !!match?.id, categoryName: match?.name || name, confidence: Math.min(1, confidence), reasoning };
  } catch {
    return { categoryId: null, applicable: false, categoryName: type === 'Income' ? 'Gaji' : 'Pengeluaran Umum', confidence: 0, reasoning: 'AI categorization gagal' };
  }
}
