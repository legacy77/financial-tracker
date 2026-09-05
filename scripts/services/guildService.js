// ============================================================
// scripts/services/guildService.js — Guild & Seed Data
// KelolaRacun Phase 2
// ============================================================

import { add, getAll, put } from '../db.js';
import { publish } from '../core/eventBus.js';

const GUILD_STORE = 'guilds';
const POUCH_STORE = 'pouches';

/**
 * Initialize default seed data if none exists.
 */
export async function initSeedData() {
  const guilds = await getAll(GUILD_STORE);
  if (guilds.length === 0) {
    const defaultGuild = {
      id: 'guild-1',
      familyName: 'Keluarga Rajawali',
      guildLevel: 5,
      totalGold: 14500000,
      monthlyTargetIncome: 5000000,
      monthlyTargetExpense: 3000000,
      created_at: new Date().toISOString()
    };
    await add(GUILD_STORE, defaultGuild);

    const defaultPouches = [
      { id: 'pouch-1', guildId: 'guild-1', name: 'Gold Pouch (Cash)', type: 'Cash', balance: 2500000 },
      { id: 'pouch-2', guildId: 'guild-1', name: 'Bank Vault (BCA)', type: 'Bank', balance: 10000000 },
      { id: 'pouch-3', guildId: 'guild-1', name: 'Magic Satchel (Crypto/Gold)', type: 'Investment', balance: 2000000 }
    ];

    for (const p of defaultPouches) {
      await add(POUCH_STORE, p);
    }
  }
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
