// ============================================================
// scripts/services/billService.js — Bill & Tribute CRUD
// KelolaRacun Phase 2
// ============================================================

import { add, getAll, getById, put, remove } from '../db.js';
import { publish } from '../core/eventBus.js';
import { onBillPaid, onBillAdded } from '../core/gamification.js';

const STORE = 'bills';

export async function getBills() {
  return await getAll(STORE);
}

export async function getPendingBills() {
  const all = await getAll(STORE);
  return all.filter((b) => b.status === 'Pending');
}

export async function addBill(billData) {
  const bill = {
    id: 'bill-' + Date.now(),
    title: billData.title,
    amount: Number(billData.amount),
    dueDate: billData.dueDate,
    status: 'Pending'
  };
  const saved = await add(STORE, bill);
  publish('kelola-racun:updated', { type: 'bill' });
  try { await onBillAdded(); } catch (err) { console.warn('Gamification update gagal:', err); }
  return saved;
}

export async function togglePaid(billId) {
  const bill = await getById(STORE, billId);
  if (!bill) throw new Error('Bill not found');
  bill.status = bill.status === 'Paid' ? 'Pending' : 'Paid';
  const saved = await put(STORE, bill);
  publish('kelola-racun:updated', { type: 'bill' });
  if (bill.status === 'Paid') {
    try { await onBillPaid(); } catch (err) { console.warn('Gamification update gagal:', err); }
  }
  return saved;
}
