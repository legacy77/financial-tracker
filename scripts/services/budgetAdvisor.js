function monthKey(date) { const d = new Date(date); if (!Number.isFinite(d.getTime())) return null; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function monthsBetween(month, back) { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isFinite(back)) return null; const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 - back, 1); return monthKey(d); }

/** Analyze local expense history by category. */
export function analyzeSpendingPatterns(transactions = [], monthsBack = 6) {
  try {
    const count = Math.max(1, Number(monthsBack) || 6);
    if (!Number.isFinite(count)) return [];
    const now = monthKey(new Date()); const months = Array.from({ length: count }, (_, i) => monthsBetween(now, i));
    const groups = new Map();
    transactions.filter(t => t.type === 'Expense' && monthKey(t.date) !== null).forEach(t => { const n = t.category || 'Pengeluaran Umum'; if (!groups.has(n)) groups.set(n, []); groups.get(n).push(t); });
    return [...groups].map(([categoryName, txs]) => {
      const values = months.map(m => txs.filter(t => monthKey(t.date) === m).reduce((s, t) => s + Number(t.amount || 0), 0));
      const avgMonthly = values.reduce((s, v) => s + v, 0) / count;
      const first = values[values.length - 1]; const last = values[0];
      const trend = last > first * 1.1 ? 'up' : last < first * 0.9 ? 'down' : 'stable';
      const volatility = avgMonthly ? Math.sqrt(values.reduce((s, v) => s + (v - avgMonthly) ** 2, 0) / count) / avgMonthly : 0;
      const recommendedBudget = Math.ceil(avgMonthly * (trend === 'up' ? 1.2 : 1.1));
      return { categoryName, avgMonthly, trend, volatility, recommendedBudget, reasoning: `Rata-rata ${count} bulan, tren ${trend}` };
    });
  } catch { return []; }
}

export function generateBudgetSuggestions(month, transactions = [], existingBudgets = [], categories = []) {
  try {
    const patterns = analyzeSpendingPatterns(transactions);
    return patterns.map(p => { const b = existingBudgets.find(x => x.categoryName === p.categoryName); const currentBudget = Number(b?.amount || 0); const suggestedBudget = currentBudget ? Math.ceil(currentBudget * (p.trend === 'up' ? 1.15 : p.trend === 'down' ? 0.9 : 1)) : p.recommendedBudget; const categoryId = b?.categoryId || categories.find(c => c.name === p.categoryName)?.id || null; return { categoryId, applicable: !!categoryId, categoryName: p.categoryName, currentBudget, suggestedBudget, confidence: Math.max(0.5, Math.min(0.95, 1 - p.volatility / 2)), reasoning: categoryId ? p.reasoning : `${p.reasoning}; kategori belum tersedia` }; });
  } catch { return []; }
}
