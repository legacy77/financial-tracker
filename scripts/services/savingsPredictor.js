function finiteNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function average(transactions, type, months = 6) {
  const count = Math.max(1, finiteNumber(months)); const now = new Date(); const totals = Array(count).fill(0);
  transactions.filter(t => t.type === type).forEach(t => { const d = new Date(t.date); const amount = Number(t.amount); if (!Number.isFinite(amount) || !Number.isFinite(d.getTime())) return; const age = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth(); if (age >= 0 && age < count) totals[age] += amount; });
  return Math.max(0, totals.reduce((a, b) => a + b, 0) / count);
}
export function predictGoalAchievability(pouch = {}, transactions = [], pouches = []) {
  try {
    const target = Math.max(0, finiteNumber(pouch.target || pouch.goalAmount || pouch.targetAmount)); const current = Math.max(0, finiteNumber(pouch.balance || pouch.currentAmount));
    const disposableIncome = Math.max(0, finiteNumber(average(transactions, 'Income') - average(transactions, 'Expense')));
    const rates = { optimistic: disposableIncome * 0.8, realistic: disposableIncome * 0.5, pessimistic: disposableIncome * 0.2 }; const suggestedMonthly = Math.max(0, rates.realistic); const remaining = Math.max(0, target - current); const months = suggestedMonthly ? Math.ceil(remaining / suggestedMonthly) : Infinity;
    const date = new Date(); if (Number.isFinite(months)) date.setMonth(date.getMonth() + months); const projectedDate = Number.isFinite(months) ? date.toISOString().slice(0, 10) : null;
    return { achievable: disposableIncome > 0 && Number.isFinite(months), confidence: disposableIncome > 0 ? 0.75 : 0.2, projectedDate, suggestedMonthly, scenarios: rates, reasoning: disposableIncome <= 0 ? 'Pengeluaran melebihi pendapatan' : `Target realistis dalam ${months} bulan` };
  } catch { return { achievable: false, confidence: 0, projectedDate: null, suggestedMonthly: 0, scenarios: { optimistic: 0, realistic: 0, pessimistic: 0 }, reasoning: 'Prediksi gagal' }; }
}
