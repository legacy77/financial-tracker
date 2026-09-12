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
    id: 'pouch-' + Date.now(),
    guildId: data.guildId || 'guild-1',
    name: data.name,
    type: data.type || 'Cash',
    balance: opening,
    openingBalance: opening
  };
  const saved = await add(STORE, pouch);
  publish('kelola-racun:updated', { type: 'pouch' });
  return saved;
}

export async function updatePouchBalance(pouchId, amountChange) {
  const pouch = await getPouch(pouchId);
  if (!pouch) throw new Error('Pouch not found');
  pouch.balance += Number(amountChange);
  const saved = await put(STORE, pouch);
  publish('kelola-racun:updated', { type: 'pouch' });
  return saved;
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
