// ============================================================
// scripts/services/transactionService.js — Transaction CRUD
// KelolaRacun Phase 2
// ============================================================

import { add, getAll, getById, put, remove } from '../db.js';
import { updatePouchBalance } from './pouchService.js';
import { publish } from '../core/eventBus.js';
import { onTransactionAdded } from '../core/gamification.js';

const STORE = 'transactions';

export async function getTransactions() {
  return await getAll(STORE);
}

export async function getTransactionsByPouch(pouchId) {
  const all = await getAll(STORE);
  return all.filter((t) => t.pouchId === pouchId);
}

export async function addTransaction(txData) {
  if (txData.type === 'Transfer') {
    if (!txData.pouchId || !txData.toPouchId) throw new Error('Pouch asal dan tujuan wajib diisi');
    if (txData.pouchId === txData.toPouchId) throw new Error('Pouch asal dan tujuan harus berbeda');
  }
  const tx = {
    id: 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    pouchId: txData.pouchId,
    toPouchId: txData.toPouchId || null,
    billId: txData.billId || null,
    type: txData.type,
    amount: Number(txData.amount),
    category: txData.category,
    date: txData.date || new Date().toISOString(),
    notes: txData.notes || ''
  };
  const saved = await add(STORE, tx);
  try {
    if (tx.type === 'Income') {
      await updatePouchBalance(tx.pouchId, tx.amount);
    } else if (tx.type === 'Expense') {
      await updatePouchBalance(tx.pouchId, -tx.amount);
    } else if (tx.type === 'Transfer') {
      await updatePouchBalance(tx.pouchId, -tx.amount);
      await updatePouchBalance(tx.toPouchId, tx.amount);
    }
  } catch (err) {
    try { await remove(STORE, tx.id); } catch {}
    throw err;
  }
  publish('kelola-racun:updated', { type: 'transaction' });
  try {
    await onTransactionAdded(tx.type);
  } catch (err) {
    console.warn('Gamification update gagal:', err);
  }
  return saved;
}

function deltasFor(tx) {
  if (tx.type === 'Income') return [{ pouchId: tx.pouchId, delta: tx.amount }];
  if (tx.type === 'Expense') return [{ pouchId: tx.pouchId, delta: -tx.amount }];
  if (tx.type === 'Transfer') {
    return [
      { pouchId: tx.pouchId, delta: -tx.amount },
      ...(tx.toPouchId ? [{ pouchId: tx.toPouchId, delta: tx.amount }] : [])
    ];
  }
  return [];
}

export async function updateTransaction(id, changes) {
  const oldTx = await getById(STORE, id);
  if (!oldTx) throw new Error('Transaction not found');

  const newTx = { ...oldTx, ...changes, id };
  if (newTx.type === 'Transfer' && newTx.pouchId === newTx.toPouchId) {
    throw new Error('Pouch asal dan tujuan harus berbeda');
  }

  await put(STORE, newTx);

  for (const d of deltasFor(oldTx)) {
    await updatePouchBalance(d.pouchId, -d.delta);
  }
  for (const d of deltasFor(newTx)) {
    await updatePouchBalance(d.pouchId, d.delta);
  }

  publish('kelola-racun:updated', { type: 'transaction' });
  return newTx;
}

export async function deleteTransaction(id, opts = {}) {
  const tx = await getById(STORE, id);
  if (tx && tx.billId && !opts.skipBillGuard) {
    throw new Error('Transaksi pembayaran tagihan — batalkan lewat Void tagihan');
  }
  const result = await remove(STORE, id);
  if (tx) {
    for (const d of deltasFor(tx)) {
      await updatePouchBalance(d.pouchId, -d.delta);
    }
  }
  publish('kelola-racun:updated', { type: 'transaction' });
  return result;
}
