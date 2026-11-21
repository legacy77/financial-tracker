// ============================================================
// scripts/services/pouchService.js — Pouch & Vault CRUD
// KelolaRacun Phase 2
// ============================================================

import { add, getAll, getById, put, remove } from '../db.js';
import { publish } from '../core/eventBus.js';

const STORE = 'pouches';

export async function getPouches() {
  return await getAll(STORE);
}

export async function getPouch(id) {
  return await getById(STORE, id);
}

export async function createPouch(data) {
  const opening = Number(data.balance) || 0;
  const pouch = {
    id: 'pouch-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    guildId: data.guildId || 'guild-1',
    name: data.name,
    type: data.type || 'Cash',
    balance: opening,
    openingBalance: opening,
    target: Number(data.target) > 0 ? Number(data.target) : null,
    deadline: data.deadline || null
  };
  const saved = await add(STORE, pouch);
  publish('kelola-racun:updated', { type: 'pouch' });
  return saved;
}

export async function ensureDefaultPouches(guildId) {
  const existing = await getPouches();
  if (existing.length) return existing;
  const gid = guildId || 'guild-1';
  await createPouch({ guildId: gid, name: 'Tunai', type: 'Cash', balance: 0 });
  await createPouch({ guildId: gid, name: 'Bank', type: 'Bank', balance: 0 });
  return getPouches();
}

export async function updatePouchBalance(pouchId, amountChange) {
  const pouch = await getPouch(pouchId);
  if (!pouch) throw new Error('Pouch not found');
  pouch.balance += Number(amountChange);
  const saved = await put(STORE, pouch);
  publish('kelola-racun:updated', { type: 'pouch' });
  return saved;
}

export async function setSavingsGoal(pouchId, { target, deadline } = {}) {
  const pouch = await getPouch(pouchId);
  if (!pouch) throw new Error('Pouch not found');
  if (pouch.type !== 'Savings') throw new Error('Goal hanya untuk pouch Savings');
  const nextTarget = Number(target);
  if (!Number.isFinite(nextTarget) || nextTarget <= 0) throw new Error('Target harus lebih dari 0');
  if (!deadline || Number.isNaN(new Date(deadline).getTime())) throw new Error('Deadline tidak valid');
  const saved = await put(STORE, { ...pouch, target: nextTarget, deadline });
  publish('kelola-racun:updated', { type: 'pouch' });
  return saved;
}

export function getSavingsProgress(pouch, now = new Date()) {
  const target = Number(pouch?.target) || 0;
  const current = Number(pouch?.balance) || 0;
  const deadlineTime = pouch?.deadline ? new Date(pouch.deadline).getTime() : NaN;
  const remaining = Math.max(0, target - current);
  const monthsLeft = Number.isFinite(deadlineTime)
    ? Math.max(0, (deadlineTime - now.getTime()) / (365.2425 / 12 * 86400000))
    : 0;
  return {
    current,
    target,
    progress: target ? Math.min(1, current / target) : 0,
    remaining,
    monthsLeft,
    monthlyContribution: monthsLeft > 0 ? remaining / monthsLeft : remaining,
    overdue: Number.isFinite(deadlineTime) && deadlineTime < now.getTime()
  };
}

/**
 * Recalculate pouch balance from all its transactions.
 * Income adds, Expense deducts. Guarantees balance matches transaction reality.
 */
export async function reconcilePouchBalance(pouchId) {
  const pouch0 = await getPouch(pouchId);
  const allTx = await getAll('transactions');
  let total = Number(pouch0?.openingBalance) || 0;
  allTx.forEach(t => {
    if (t.pouchId === pouchId) {
      if (t.type === 'Income') total += t.amount;
      if (t.type === 'Expense') total -= t.amount;
      if (t.type === 'Transfer') total -= t.amount;
    }
    if (t.type === 'Transfer' && t.toPouchId === pouchId) total += t.amount;
  });
  const pouch = await getPouch(pouchId);
  if (pouch && pouch.balance !== total) {
    pouch.balance = total;
    await put(STORE, pouch);
    publish('kelola-racun:updated', { type: 'pouch' });
  }
  return total;
}

/**
 * Recalculate balances for ALL pouches.
 * Safe to run on init to fix any drift.
 */
export async function reconcileAllPouches() {
  const pouches = await getPouches();
  for (const p of pouches) {
    if (p.openingBalance === undefined) {
      const allTx = await getAll('transactions');
      const mine = allTx.filter(t => t.pouchId === p.id);
      if (!mine.length) {
        await put(STORE, { ...p, openingBalance: Number(p.balance) || 0 });
      } else {
        await put(STORE, { ...p, openingBalance: 0 });
      }
    }
    await reconcilePouchBalance(p.id);
  }
}
