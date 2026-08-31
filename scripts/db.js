// ============================================================
// scripts/db.js — IndexedDB Wrapper (Promise-based)
// KelolaRacun Phase 2: Local State & CRUD
// ============================================================

const DB_NAME = 'kelola_racun_db';
const DB_VERSION = 1;

let dbInstance = null;

// ---- Schema Definition ----
const SCHEMA = {
  guilds:        { keyPath: 'id', indexes: [] },
  members:       { keyPath: 'id', indexes: ['guildId', 'role'] },
  pouches:       { keyPath: 'id', indexes: ['guildId', 'type'] },
  transactions:  { keyPath: 'id', indexes: ['pouchId', 'date', 'type', 'category'] },
  bills:         { keyPath: 'id', indexes: ['dueDate', 'status'] }
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
      Object.entries(SCHEMA).forEach(([storeName, cfg]) => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: cfg.keyPath });
          cfg.indexes.forEach((idx) => {
            store.createIndex(idx, idx, { unique: false });
          });
        }
      });
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
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
    req.onsuccess = () => res(record);
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
    req.onsuccess = () => res(record);
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
    req.onsuccess = () => res(true);
    req.onerror = (e) => rej(e.target.error);
  });
}
