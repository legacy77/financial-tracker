// ============================================================
// scripts/core/backupService.js — JSON Backup & Restore
// KelolaRacun Advanced Features
// ============================================================

import { getAll, put, openDB } from '../db.js';

export async function exportBackup() {
  const stores = ['guilds', 'members', 'pouches', 'transactions', 'bills', 'gamification', 'categories'];
  const data = { app: 'KelolaRacun', version: 1, exportedAt: new Date().toISOString(), stores: {} };

  for (const store of stores) {
    try {
      data.stores[store] = await getAll(store);
    } catch (err) {
      data.stores[store] = [];
    }
  }
  return data;
}

export function downloadBackup(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kelolaracun-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function count(store) {
  const db = await openDB();
  return new Promise((res) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).count();
    req.onsuccess = () => res(req.result);
    req.onerror = () => res(0);
  });
}

export async function restoreBackup(data) {
  if (!data || !data.stores) throw new Error('Format backup tidak valid');
  const stores = Object.keys(data.stores);

  // Overwrite data atomically per store
  for (const store of stores) {
    const existingCount = await count(store);
    if (existingCount > 0) {
      throw new Error(`Saat ini database sudah berisi data (${store}). Kosongkan dulu lewat reset.`);
    }
    for (const record of data.stores[store]) {
      await put(store, record);
    }
  }
  return stores.length;
}

export async function resetAllData() {
  const stores = ['guilds', 'members', 'pouches', 'transactions', 'bills', 'gamification', 'categories'];
  const db = await openDB();
  const names = stores.filter(s => db.objectStoreNames.contains(s));
  await new Promise((res, rej) => {
    const tx = db.transaction(names, 'readwrite');
    for (const storeName of names) {
      tx.objectStore(storeName).clear();
    }
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
  return true;
}