// ============================================================
// scripts/services/budgetService.js — Budget bulanan per kategori + carry
// Store: budgets { id, categoryId, categoryName, month YYYY-MM, base, carryIn, amount }
// amount = base + carryIn (kompatibel record lama: amount saja = base).
// ============================================================

import { add, getAll, getById, put, remove } from '../db.js';
import { publish } from '../core/eventBus.js';
import { getTransactions } from './transactionService.js';

const STORE = 'budgets';

export function monthKey(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) throw new Error('Bulan tidak valid');
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month, delta) {
  const m = /^(\d{4})-(\d{2})$/.exec(month || '');
  if (!m) throw new Error('Format bulan harus YYYY-MM');
  const d = new Date(+m[1], +m[2] - 1 + delta, 1);
  return monthKey(d);
}

function budgetId(categoryId, month) {
  return `bud-${categoryId}-${month}`;
}

function normalize(rec) {
  if (!rec) return null;
  const base = Number.isFinite(Number(rec.base)) ? Number(rec.base) : (Number.isFinite(Number(rec.amount)) ? Number(rec.amount) : 0);
  const carryIn = Number.isFinite(Number(rec.carryIn)) ? Number(rec.carryIn) : 0;
  return { ...rec, base, carryIn, amount: base + carryIn };
}

export async function getBudgets(month) {
  const all = await getAll(STORE);
  const list = month ? all.filter((b) => b.month === month) : all;
  return list.map(normalize);
}

export async function getBudget(categoryId, month) {
  if (!categoryId || !month) return null;
  try {
    return normalize(await getById(STORE, budgetId(categoryId, month))) || null;
  } catch {
    return null;
  }
}

export async function setBudgetBase(categoryId, month, base, categoryName) {
  if (!categoryId || !month) throw new Error('Kategori dan bulan wajib diisi');
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Format bulan harus YYYY-MM');
  const id = budgetId(categoryId, month);
  const existing = await getBudget(categoryId, month);
  const rec = {
    id,
    categoryId,
    categoryName: categoryName || existing?.categoryName || '',
    month,
    base: Number(base) || 0,
    carryIn: existing ? existing.carryIn : 0,
    amount: (Number(base) || 0) + (existing ? existing.carryIn : 0),
    updatedAt: new Date().toISOString()
  };
  const saved = existing ? await put(STORE, rec) : await add(STORE, rec);
  publish('kelola-racun:updated', { type: 'budget' });
  return normalize(saved);
}

export async function setBudget(categoryId, month, amount, categoryName) {
  return setBudgetBase(categoryId, month, amount, categoryName);
}

export async function deleteBudget(categoryId, month) {
  if (!categoryId || !month) return false;
  const res = await remove(STORE, budgetId(categoryId, month));
  publish('kelola-racun:updated', { type: 'budget' });
  return res;
}

export async function copyMonth(fromMonth, toMonth) {
  if (!fromMonth || !toMonth || fromMonth === toMonth) throw new Error('Bulan asal dan tujuan harus berbeda');
  const src = await getBudgets(fromMonth);
  let copied = 0;
  for (const b of src) {
    if (!b.base || b.base <= 0) continue;
    const existing = await getBudget(b.categoryId, toMonth);
    if (existing && existing.base > 0) continue;
    await setBudgetBase(b.categoryId, toMonth, b.base, b.categoryName);
    copied++;
  }
  return copied;
}

export async function applyCarry(fromMonth, toMonth) {
  if (!fromMonth || !toMonth || fromMonth === toMonth) throw new Error('Bulan asal dan tujuan harus berbeda');
  const txs = await getTransactions();
  const spent = await monthSpending(txs, fromMonth);
  const src = await getBudgets(fromMonth);
  let applied = 0;
  for (const b of src) {
    const effective = b.amount || 0;
    if (effective <= 0) continue;
    const used = spent[b.categoryName] || 0;
    const leftover = Math.max(0, effective - used);
    if (leftover <= 0) continue;
    const existing = await getBudget(b.categoryId, toMonth);
    const id = budgetId(b.categoryId, toMonth);
    const rec = {
      id,
      categoryId: b.categoryId,
      categoryName: b.categoryName || existing?.categoryName || '',
      month: toMonth,
      base: existing ? (existing.base || 0) : 0,
      carryIn: leftover,
      amount: (existing ? (existing.base || 0) : 0) + leftover,
      updatedAt: new Date().toISOString()
    };
    if (existing) await put(STORE, rec);
    else await add(STORE, rec);
    applied++;
  }
  if (applied) publish('kelola-racun:updated', { type: 'budget' });
  return applied;
}

export async function getMonthView(month, transactions) {
  const txs = transactions || await getTransactions();
  const spent = await monthSpending(txs, month);
  const budgets = await getBudgets(month);
  return budgets.map((b) => ({
    ...b,
    used: spent[b.categoryName] || 0
  }));
}

export async function monthTotal(month) {
  const budgets = await getBudgets(month);
  return budgets.reduce((s, b) => s + (b.amount || 0), 0);
}

export async function monthSpending(transactions, month) {
  const out = {};
  (transactions || []).forEach((t) => {
    if (t.type !== 'Expense') return;
    let key;
    try {
      key = monthKey(t.date);
    } catch {
      return;
    }
    if (key !== month) return;
    out[t.category] = (out[t.category] || 0) + t.amount;
  });
  return out;
}

export async function pruneOrphans(validNames) {
  const all = await getAll(STORE);
  const set = new Set(validNames || []);
  let removed = 0;
  for (const b of all) {
    if (b.categoryName && !set.has(b.categoryName)) {
      await remove(STORE, b.id);
      removed++;
    }
  }
  if (removed) publish('kelola-racun:updated', { type: 'budget' });
  return removed;
}
