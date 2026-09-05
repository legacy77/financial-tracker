// ============================================================
// scripts/core/healthScore.js — Financial Health Score Engine
// Khitungan 4 metrik dari data IndexedDB riil, skor 0-100.
// ============================================================

import { getPouches } from '../services/pouchService.js';
import { getTransactions } from '../services/transactionService.js';
import { getBills } from '../services/billService.js';

export function isCurrentMonth(t) {
  const d = new Date(t.date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function monthlyExpenseAverage(transactions, months = 6) {
  const totals = [];
  const now = new Date();
  for (let i = 1; i <= months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    let sum = 0;
    transactions.forEach(t => {
      const td = new Date(t.date);
      if (td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && (t.type === 'Expense' || t.type === 'Transfer')) {
        sum += t.amount;
      }
    });
    totals.push(sum);
  }
  const avg = totals.reduce((a, b) => a + b, 0) / months;
  return avg || 0;
}

export async function computeHealthScore({ guild, transactions, pouches, bills } = {}) {
  if (!transactions) transactions = await getTransactions();
  if (!pouches) pouches = await getPouches();
  if (!bills) bills = await getBills();

  const totalBalance = pouches.reduce((s, p) => s + (p.balance || 0), 0);
  const totalBills = bills.filter(b => b.status === 'Pending').reduce((s, b) => s + (b.amount || 0), 0);

  // ---- Metric 1: Savings Ratio (bulan ini) ----
  let monthIncome = 0, monthExpense = 0;
  transactions.filter(isCurrentMonth).forEach(t => {
    if (t.type === 'Income') monthIncome += t.amount;
    if (t.type === 'Expense' || t.type === 'Transfer') monthExpense += t.amount;
  });
  const savingsRatio = monthIncome > 0 ? Math.max(0, ((monthIncome - monthExpense) / monthIncome) * 100) : 0;

  // ---- Metric 2: Dana Darurat (bulan pengeluaran) ----
  const avgMonthly = monthlyExpenseAverage(transactions);
  const emergencyFundMonths = avgMonthly > 0 ? totalBalance / avgMonthly : 0;

  // ---- Metric 3: Rasio Utang ----
  const debtRatio = totalBalance > 0 ? (totalBills / totalBalance) * 100 : 0;

  // ---- Metric 4: Disiplin Budget ----
  const expenseTarget = guild?.monthlyTargetExpense || 3000000;
  const budgetDiscipline = expenseTarget > 0 ? Math.min(100, (1 - Math.max(0, (monthExpense - expenseTarget)) / expenseTarget) * 100) : 0;
  const budgetDisciplineClamped = Math.max(0, budgetDiscipline);

  // ---- Partial scores (0-100) ----
  const scoreSavings = Math.min(100, Math.max(0, (savingsRatio / 30) * 100));          // target >= 30%
  const scoreEmergency = Math.min(100, Math.max(0, (emergencyFundMonths / 6) * 100)); // target >= 6 bulan
  const scoreDebt = Math.min(100, Math.max(0, 100 - (debtRatio / 35) * 100));          // aman < 35%
  const scoreBudget = budgetDisciplineClamped;

  // ---- Overall 0-100 ----
  const overall = Math.round((scoreSavings + scoreEmergency + scoreDebt + scoreBudget) / 4);

  const status = overall >= 75 ? { label: 'Sangat Sehat', icon: '🟢', badge: 'success' }
    : overall >= 50 ? { label: 'Cukup Sehat', icon: '🟡', badge: 'warning' }
    : { label: 'Perlu Perhatian', icon: '🔴', badge: 'danger' };

  return {
    overall,
    status,
    savingsRatio: Math.round(savingsRatio),
    emergencyFundMonths: Math.round(emergencyFundMonths * 10) / 10,
    debtRatio: Math.round(debtRatio),
    budgetDiscipline: Math.round(budgetDisciplineClamped),
    monthIncome, monthExpense
  };
}