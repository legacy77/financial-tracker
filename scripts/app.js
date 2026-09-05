// ============================================================
// scripts/app.js — Main Entry Point & Initialization
// KelolaRacun Phase 2: Local State & CRUD
// ============================================================

import { openDB } from './db.js';
import { initSeedData, getGuild, updateGuild } from './services/guildService.js';
import { getPouches, createPouch, getPouch } from './services/pouchService.js';
import { getTransactions, addTransaction, getTransactionsByPouch } from './services/transactionService.js';
import { getBills, getPendingBills, addBill, togglePaid } from './services/billService.js';
import { initCategorySeed, getCategories, createCategory, deleteCategory } from './services/categoryService.js';

// ---- Initialize Database ----
export async function initApp() {
  try {
    await openDB();
    await initSeedData();
    await initCategorySeed();
    console.log('🏰 KelolaRacun DB initialized & seeded');
  } catch (err) {
    console.error('❌ Failed to init KelolaRacun DB:', err);
    showToast('Gagal inisialisasi database: ' + err.message, 'error');
  }
}

// ---- Toast Feedback ----
export function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast--${type === 'error' ? 'danger' : type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast--show'));
  setTimeout(() => {
    toast.classList.remove('toast--show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---- Expose Service API ----
window.KelolaRacun = {
  getGuild,
  updateGuild,
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
  getCategories,
  createCategory,
  deleteCategory,
  showToast
};

// ---- Auto-init on DOM ready ----
document.addEventListener('DOMContentLoaded', initApp);
