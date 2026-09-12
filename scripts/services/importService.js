import { add, getAll } from '../db.js';
import { publish } from '../core/eventBus.js';

const STORE = 'imports';

export async function logImport({ fileName, count, income, expense, pouchId }) {
  const rec = {
    id: 'imp-' + Date.now(),
    fileName: fileName || 'Import',
    count: count || 0,
    income: income || 0,
    expense: expense || 0,
    pouchId: pouchId || null,
    createdAt: new Date().toISOString()
  };
  const saved = await add(STORE, rec);
  publish('kelola-racun:updated', { type: 'import' });
  return saved;
}

export async function getImports() {
  const all = await getAll(STORE);
  return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
