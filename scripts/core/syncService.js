// ============================================================
// scripts/core/syncService.js — Multi-device Sync via server.js
// KelolaRacun
// ============================================================

import { openDB, getAll, setMutationCallback } from '../db.js';

const STORES = ['guilds', 'members', 'pouches', 'transactions', 'bills', 'gamification', 'categories', 'imports', 'budgets'];

let pushTimer = null;
let isSyncing = false;

setMutationCallback(queuePushToServer);

export async function exportLocalData() {
  const data = { app: 'KelolaRacun', version: 3, updatedAt: new Date().toISOString(), stores: {} };
  for (const store of STORES) {
    try {
      data.stores[store] = await getAll(store);
    } catch {
      data.stores[store] = [];
    }
  }
  return data;
}

export async function importServerData(storesData) {
  if (!storesData) return;
  const db = await openDB();
  const validStores = Object.keys(storesData).filter(s => db.objectStoreNames.contains(s));
  if (!validStores.length) return;

  await new Promise((resolve, reject) => {
    const tx = db.transaction(validStores, 'readwrite');
    for (const name of validStores) {
      const os = tx.objectStore(name);
      os.clear();
      const records = storesData[name] || [];
      for (const rec of records) {
        os.put(rec);
      }
    }
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function pushToServer() {
  if (isSyncing) return;
  try {
    const payload = await exportLocalData();
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('[sync] push ke server gagal / offline:', err);
  }
}

export function queuePushToServer(delay = 400) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushToServer();
  }, delay);
}

export async function syncWithServer() {
  try {
    const res = await fetch('/api/data', { cache: 'no-store' });
    if (!res.ok) return { synced: false };
    const remote = await res.json();

    if (!remote || remote.exists === false || !remote.stores) {
      const localGuilds = await getAll('guilds');
      if (localGuilds.length > 0) {
        await pushToServer();
        return { synced: true, initialized: true };
      }
      return { synced: true, hasData: false };
    }

    const remoteMembers = remote.stores.members || [];
    const remoteGuilds = remote.stores.guilds || [];
    if (remoteMembers.length > 0 || remoteGuilds.length > 0) {
      isSyncing = true;
      try {
        await importServerData(remote.stores);
      } finally {
        isSyncing = false;
      }
      return { synced: true, hasData: true };
    }

    return { synced: true, hasData: false };
  } catch (err) {
    console.warn('[sync] syncWithServer gagal / offline:', err);
    return { synced: false };
  }
}
