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
  const pouch = {
    id: 'pouch-' + Date.now(),
    guildId: data.guildId || 'guild-1',
    name: data.name,
    type: data.type || 'Cash',
    balance: Number(data.balance) || 0
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
