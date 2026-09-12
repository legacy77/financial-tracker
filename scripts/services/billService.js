// ============================================================
// scripts/services/billService.js — Bill & Tribute CRUD
// KelolaRacun Phase 2
// ============================================================

import { add, getAll, getById, put, remove } from '../db.js';
import { publish } from '../core/eventBus.js';
import { onBillPaid, onBillAdded } from '../core/gamification.js';
import { addTransaction, deleteTransaction } from './transactionService.js';
import { getPouch } from './pouchService.js';

const STORE = 'bills';

export async function getBills() {
  return await getAll(STORE);
}

export async function getPendingBills() {
  const all = await getAll(STORE);
  return all.filter((b) => b.status === 'Pending');
}

export async function addBill(billData) {
  if (!billData.title || !billData.title.trim()) throw new Error('Judul tagihan wajib diisi');
  if (!Number.isFinite(Number(billData.amount)) || Number(billData.amount) <= 0) throw new Error('Nominal tagihan harus lebih dari 0');
  if (!billData.dueDate || isNaN(new Date(billData.dueDate))) throw new Error('Tanggal jatuh tempo tidak valid');
  if (!billData.category || !billData.category.trim()) throw new Error('Kategori tagihan wajib diisi');
  const bill = {
    id: 'bill-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    title: billData.title.trim(),
    amount: Number(billData.amount),
    category: billData.category.trim(),
    dueDate: billData.dueDate,
    status: 'Pending',
    paidAmount: 0,
    paidAt: null,
    paidPouchId: null,
    txIds: []
  };
  const saved = await add(STORE, bill);
  publish('kelola-racun:updated', { type: 'bill' });
  try { await onBillAdded(); } catch (err) { console.warn('Gamification update gagal:', err); }
  return saved;
}

export async function deleteBill(billId) {
  const res = await remove(STORE, billId);
  publish('kelola-racun:updated', { type: 'bill' });
  return res;
}

export async function payBill(billId, { pouchId, amount, date, category } = {}) {
  const bill = await getById(STORE, billId);
  if (!bill) throw new Error('Tagihan tidak ditemukan');
  if (bill.status === 'Paid') throw new Error('Tagihan sudah lunas');
  const total = Number(bill.amount) || 0;
  const already = Number(bill.paidAmount) || 0;
  const remaining = total - already;
  const payAmount = Number(amount);
  if (!pouchId) throw new Error('Pilih pouch untuk membayar');
  if (!Number.isFinite(payAmount) || payAmount <= 0) throw new Error('Jumlah bayar harus lebih dari 0');
  if (payAmount > remaining) throw new Error(`Melebihi sisa tagihan (${remaining})`);
  const pouch = await getPouch(pouchId);
  if (!pouch) throw new Error('Pouch tidak ditemukan');
  const insufficient = (Number(pouch.balance) || 0) < payAmount;

  const tx = await addTransaction({
    pouchId,
    type: 'Expense',
    amount: payAmount,
    category: (category || bill.category || 'Pengeluaran Umum').trim(),
    notes: bill.title,
    date: date || new Date().toISOString(),
    billId: bill.id
  });

  try {
    const newPaid = already + payAmount;
    const updated = {
      ...bill,
      paidAmount: newPaid,
      status: newPaid >= total ? 'Paid' : 'Partial',
      paidAt: new Date().toISOString(),
      paidPouchId: pouchId,
      txIds: [...(bill.txIds || []), tx.id]
    };
    const saved = await put(STORE, updated);
    publish('kelola-racun:updated', { type: 'bill' });
    try { await onBillPaid(); } catch (err) { console.warn('Gamification update gagal:', err); }
    return { bill: saved, tx, insufficient, remaining: total - newPaid };
  } catch (err) {
    try { await deleteTransaction(tx.id, { skipBillGuard: true }); } catch {}
    throw err;
  }
}

export async function voidBillPayment(billId) {
  const bill = await getById(STORE, billId);
  if (!bill) throw new Error('Tagihan tidak ditemukan');
  for (const txId of bill.txIds || []) {
    try { await deleteTransaction(txId, { skipBillGuard: true }); } catch {}
  }
  const reset = {
    ...bill,
    paidAmount: 0,
    status: 'Pending',
    paidAt: null,
    paidPouchId: null,
    txIds: []
  };
  const saved = await put(STORE, reset);
  publish('kelola-racun:updated', { type: 'bill' });
  return saved;
}

export async function togglePaid(billId) {
  const bill = await getById(STORE, billId);
  if (!bill) throw new Error('Bill not found');
  if (bill.status === 'Paid') return voidBillPayment(billId);
  throw new Error('Gunakan dialog Bayar untuk melunasi tagihan');
}
