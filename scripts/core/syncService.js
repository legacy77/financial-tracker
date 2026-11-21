// ============================================================
// scripts/core/syncService.js — Multi-device Sync via server.js
// KelolaRacun
// ============================================================

import { openDB, getAll, setMutationCallback } from '../db.js';

import { isMemberRole } from '../services/memberService.js';

const STORES = ['guilds', 'members', 'pouches', 'transactions', 'bills', 'gamification', 'categories', 'imports', 'budgets'];

let pushTimer = null;
let isSyncing = false;

setMutationCallback(queuePushToServer);

function prepareRecords(store, records) {
  if (!STORES.includes(store) || !Array.isArray(records)) throw new Error('Store snapshot tidak didukung.');
  const ids = new Set();
  return records.map(record => {
    const id = record?.id;
    if (typeof id !== 'string' || !id || ids.has(id)) throw new Error(`ID tidak valid atau duplikat di ${store}.`);
    ids.add(id);
    if (store !== 'members') return record;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id) || !isMemberRole(record.role)) throw new Error('ID atau role anggota tidak didukung.');
    const { pinHash, pinSalt, ...member } = record;
    return member;
  });
}

export async function exportLocalData() {
  const data = { app: 'KelolaRacun', version: 3, updatedAt: new Date().toISOString(), stores: {} };
  for (const store of STORES) data.stores[store] = prepareRecords(store, await getAll(store));
  return data;
}

export async function importServerData(storesData) {
  if (!storesData || typeof storesData !== 'object' || Array.isArray(storesData)) throw new Error('Snapshot tidak valid.');
  const entries = Object.entries(storesData).map(([name, records]) => [name, prepareRecords(name, records)]);
  if (!entries.length) return;
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(entries.map(([name]) => name), 'readwrite');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || new Error('Impor dibatalkan.'));
    try {
      for (const [name, records] of entries) {
        const os = tx.objectStore(name);
        os.clear();
        for (const rec of records) os.put(rec);
      }
    } catch (err) {
      tx.abort();
      reject(err);
    }
  });
}

let rejectedSize = Infinity;

export async function pushToServer() {
  if (isSyncing) return { synced: false };
  const body = JSON.stringify(await exportLocalData());
  const size = new Blob([body]).size;
  const tooLarge = 'Belum tersinkron: snapshot terlalu besar (HTTP 413). Kurangi ukuran data.';
  if (size >= rejectedSize) throw new Error(tooLarge);
  let response;
  try {
    response = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
  } catch (err) {
    console.warn('[sync] push ke server gagal / offline:', err);
    return { synced: false, reason: err.message };
  }
  if (!response.ok) {
    if (response.status === 413) {
      rejectedSize = Math.min(rejectedSize, size);
      throw new Error(tooLarge);
    }
    throw new Error(`Belum tersinkron: snapshot ditolak (HTTP ${response.status}).`);
  }
  rejectedSize = Infinity;
  return { synced: true };
}

export function queuePushToServer(delay = 400) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushToServer().catch(err => console.warn('[sync]', err.message));
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
        const result = await pushToServer();
        return result.synced ? { synced: true, initialized: true } : result;
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
    return { synced: false, reason: err.message };
  }
}
