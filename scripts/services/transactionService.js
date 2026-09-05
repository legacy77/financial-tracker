// ============================================================
// scripts/services/transactionService.js — Transaction CRUD
// KelolaRacun Phase 2
// ============================================================

import { add, getAll, getById, put, remove } from '../db.js';
import { updatePouchBalance } from './pouchService.js';
import { publish } from '../core/eventBus.js';

const STORE = 'transactions';

export async function getTransactions() {
  return await getAll(STORE);
}

export async function getTransactionsByPouch(pouchId) {
  const all = await getAll(STORE);
  return all.filter((t) => t.pouchId === pouchId);
}

export async function addTransaction(txData) {
  const tx = {
    id: 'tx-' + Date.now(),
    pouchId: txData.pouchId,
    type: txData.type, // 'Income' | 'Expense' | 'Transfer'
    amount: Number(txData.amount),
    category: txData.category,
    date: txData.date || new Date().toISOString(),
    notes: txData.notes || ''
  };
// Sync pouch balance: Income adds, Expense deducts
  const amountChange = tx.type === 'Income' ? tx.amount : -tx.amount;
  await updatePouchBalance(tx.pouchId, amountChange);
  const saved = await add(STORE, tx);
  publish('kelola-racun:updated', { type: 'transaction' });
  return saved;
}

export async function updateTransaction(id, changes) {
  const saved = await put(STORE, { ...changes, id });
  publish('kelola-racun:updated', { type: 'transaction' });
  return saved;
}

export async function deleteTransaction(id) {
  const result = await remove(STORE, id);
  publish('kelola-racun:updated', { type: 'transaction' });
  return result;
}
