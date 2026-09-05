// ============================================================
// scripts/services/categoryService.js — Custom Categories CRUD & Seed
// KelolaRacun
// ============================================================

import { add, getAll, getById, put, remove } from '../db.js';
import { publish } from '../core/eventBus.js';

const STORE = 'categories';

const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: 'Gaji', icon: '💰', color: 'income', type: 'Income' },
  { id: 'cat-2', name: 'Makanan', icon: '🍔', color: 'expense', type: 'Expense' },
  { id: 'cat-3', name: 'Transport', icon: '⛽', color: 'blue', type: 'Expense' },
  { id: 'cat-4', name: 'Belanja Online', icon: '🛒', color: 'purple', type: 'Expense' },
  { id: 'cat-5', name: 'Utilitas', icon: '💡', color: 'warning', type: 'Expense' },
  { id: 'cat-6', name: 'Investasi', icon: '🔮', color: 'gold', type: 'Income' },
  { id: 'cat-7', name: 'Hiburan', icon: '🎮', color: 'purple', type: 'Expense' },
  { id: 'cat-8', name: 'Pengeluaran Umum', icon: '📦', color: 'expense', type: 'Expense' }
];

export async function initCategorySeed() {
  const cats = await getAll(STORE);
  if (cats.length === 0) {
    for (const c of DEFAULT_CATEGORIES) {
      await add(STORE, c);
    }
  }
}

export async function getCategories() {
  const cats = await getAll(STORE);
  if (cats.length === 0) return DEFAULT_CATEGORIES;
  return cats;
}

export async function createCategory(data) {
  const cat = {
    id: 'cat-' + Date.now(),
    name: data.name,
    icon: data.icon || '🏷️',
    color: data.color || 'expense',
    type: data.type || 'Expense'
  };
  const saved = await add(STORE, cat);
  publish('kelola-racun:updated', { type: 'category' });
  return saved;
}

export async function deleteCategory(id) {
  const res = await remove(STORE, id);
  publish('kelola-racun:updated', { type: 'category' });
  return res;
}