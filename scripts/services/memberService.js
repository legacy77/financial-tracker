// ============================================================
// scripts/services/memberService.js — CRUD members
// KelolaRacun
// ============================================================

import { add, getAll, getById, put, remove } from '../db.js';

const STORE = 'members';

export async function initMemberSeed() {
  // Hanya untuk inisialisasi, tidak otomatis create
}

export async function getMembers(activeOnly = true) {
  const all = await getAll(STORE);
  return activeOnly ? all.filter(m => m.active) : all;
}

export async function getMember(id) {
  return getById(STORE, id);
}

export async function getMemberByEmail(email) {
  const all = await getAll(STORE);
  return all.find(m => m.email?.toLowerCase() === email.toLowerCase());
}

export async function getMemberByPin(pin, members) {
  // Not efficient for large sets, but fine for small family
  for (const m of members) {
    // Verification handled by crypto.verifyPin
  }
  return null;
}

export async function createMember(data) {
  const member = {
    id: 'mem-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    name: data.name,
    pinSalt: data.pinSalt,
    pinHash: data.pinHash,
    role: data.role || 'Viewer',
    guildId: data.guildId,
    active: true,
    createdAt: new Date().toISOString()
  };
  return await add(STORE, member);
}

export async function updateMember(id, changes) {
  const member = await getById(STORE, id);
  if (!member) throw new Error('Anggota tidak ditemukan');
  const updated = { ...member, ...changes };
  return await put(STORE, updated);
}

export async function deleteMember(id) {
  return await remove(STORE, id);
}

export async function getMembersByGuild(guildId, activeOnly = true) {
  const all = await getAll(STORE);
  return all.filter(m => m.guildId === guildId && (!activeOnly || m.active));
}