// ============================================================
// scripts/services/guildService.js — Guild CRUD
// KelolaRacun
// ============================================================

import { add, getAll, put } from '../db.js';
import { publish } from '../core/eventBus.js';

const GUILD_STORE = 'guilds';
const POUCH_STORE = 'pouches';

export async function initSeedData() {
  // No longer auto-seed — guild created on first register
}

export async function createGuild(familyName) {
  const existing = await getAll(GUILD_STORE);
  if (existing.length > 0) return existing[0];

  const guild = {
    id: 'guild-1',
    familyName,
    guildLevel: 1,
    totalGold: 0,
    monthlyTargetIncome: 5000000,
    monthlyTargetExpense: 3000000,
    created_at: new Date().toISOString()
  };
  await add(GUILD_STORE, guild);
  return guild;
}

export async function getGuild() {
  const guilds = await getAll(GUILD_STORE);
  return guilds[0] || null;
}

export async function updateGuild(changes) {
  const guild = await getGuild();
  if (!guild) throw new Error('Guild not found');
  const merged = { ...guild, ...changes };
  const saved = await put(GUILD_STORE, merged);
  publish('kelola-racun:updated', { type: 'guild' });
  return saved;
}
