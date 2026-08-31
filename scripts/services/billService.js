// ============================================================
// scripts/services/billService.js — Bill & Tribute CRUD
// KelolaRacun Phase 2
// ============================================================

import { add, getAll, getById, put, remove } from '../db.js';

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
  return await add(STORE, bill);
}

export async function togglePaid(billId) {
  const bill = await getById(STORE, billId);
  if (!bill) throw new Error('Bill not found');
  bill.status = bill.status === 'Paid' ? 'Pending' : 'Paid';
  return await put(STORE, bill);
}
