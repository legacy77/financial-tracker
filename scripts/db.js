// ============================================================
// scripts/db.js — IndexedDB Wrapper (Promise-based)
// KelolaRacun Phase 2: Local State & CRUD
// ============================================================

const DB_NAME = 'kelola_racun_db';
const DB_VERSION = 6;

let dbInstance = null;
let onMutation = null;

export function setMutationCallback(fn) {
  onMutation = fn;
}

function notifyMutation() {
  if (typeof onMutation === 'function') {
    try { onMutation(); } catch {}
  }
}

// ---- Schema Definition ----
const SCHEMA = {
  guilds:        { keyPath: 'id', indexes: [] },
  members:       { keyPath: 'id', indexes: ['guildId', 'role'] },
  pouches:       { keyPath: 'id', indexes: ['guildId', 'type'] },
  transactions:  { keyPath: 'id', indexes: ['pouchId', 'date', 'type', 'category'] },
  bills:         { keyPath: 'id', indexes: ['dueDate', 'status'] },
  gamification:  { keyPath: 'id', indexes: [] },
  categories:    { keyPath: 'id', indexes: ['name'] },
  imports:       { keyPath: 'id', indexes: ['createdAt'] },
  budgets:       { keyPath: 'id', indexes: ['categoryId', 'month'] }
};

/**
 * Open or return existing IndexedDB connection.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      const upgradeTx = e.target.transaction;

      Object.entries(SCHEMA).forEach(([storeName, cfg]) => {
        const store = db.objectStoreNames.contains(storeName)
          ? upgradeTx.objectStore(storeName)
          : db.createObjectStore(storeName, { keyPath: cfg.keyPath });

        cfg.indexes.forEach((idx) => {
          if (!store.indexNames.contains(idx)) {
            store.createIndex(idx, idx, { unique: false });
          }
        });
      });
    };

    request.onblocked = () => {
      console.warn('⏳ IndexedDB upgrade blocked — tutup tab lain yang membuka KelolaRacun lalu muat ulang halaman ini.');
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      dbInstance.onversionchange = () => {
        try { dbInstance.close(); } catch {}
        console.warn('⏳ Database diperbarui di tab lain — muat ulang halaman ini.');
      };
      resolve(dbInstance);
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

// ---- Generic CRUD helpers ----

/**
 * Get a read/write object store by name.
 */
async function getStore(storeName, mode = 'readonly') {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  return { store: tx.objectStore(storeName), tx };
}

/**
 * Add a record to a store.
 */
export async function add(storeName, record) {
  const { store, tx } = await getStore(storeName, 'readwrite');
  return new Promise((res, rej) => {
    const req = store.add(record);
    req.onsuccess = () => {
      notifyMutation();
      res(record);
    };
    req.onerror = (e) => rej(e.target.error);
  });
}

/**
 * Get all records from a store.
 */
export async function getAll(storeName) {
  const { store } = await getStore(storeName);
  return new Promise((res, rej) => {
    const req = store.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = (e) => rej(e.target.error);
  });
}

/**
 * Get a single record by primary key.
 */
export async function getById(storeName, id) {
  const { store } = await getStore(storeName);
  return new Promise((res, rej) => {
    const req = store.get(id);
    req.onsuccess = () => res(req.result);
    req.onerror = (e) => rej(e.target.error);
  });
}

/**
 * Update a record by primary key.
 */
export async function put(storeName, record) {
  const { store } = await getStore(storeName, 'readwrite');
  return new Promise((res, rej) => {
    const req = store.put(record);
    req.onsuccess = () => {
      notifyMutation();
      res(record);
    };
    req.onerror = (e) => rej(e.target.error);
  });
}

/**
 * Delete a record by primary key.
 */
export async function remove(storeName, id) {
  const { store } = await getStore(storeName, 'readwrite');
  return new Promise((res, rej) => {
    const req = store.delete(id);
    req.onsuccess = () => {
      notifyMutation();
      res(true);
    };
    req.onerror = (e) => rej(e.target.error);
  });
}
