// ============================================================
// scripts/app.js — Main Entry Point & Initialization
// KelolaRacun Phase 2: Local State & CRUD
// ============================================================

import { openDB } from './db.js';
import { initSeedData, getGuild } from './services/guildService.js';
import { getPouches, createPouch, getPouch } from './services/pouchService.js';
import { getTransactions, addTransaction, getTransactionsByPouch } from './services/transactionService.js';
import { getBills, getPendingBills, addBill, togglePaid } from './services/billService.js';

// ---- Initialize Database ----
export async function initApp() {
  try {
    await openDB();
    await initSeedData();
    console.log('🏰 KelolaRacun DB initialized & seeded');
  } catch (err) {
    console.error('❌ Failed to init KelolaRacun DB:', err);
    showToast('Gagal inisialisasi database: ' + err.message, 'error');
  }
}

// ---- Toast Feedback ----
export function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ---- Expose Service API ----
window.KelolaRacun = {
  getGuild,
  getPouches,
  createPouch,
  getPouch,
  getTransactions,
  getTransactionsByPouch,
  addTransaction,
  getBills,
  getPendingBills,
  addBill,
  togglePaid,
  showToast
};

// ---- Auto-init on DOM ready ----
document.addEventListener('DOMContentLoaded', initApp);
