// ============================================================
// scripts/services/memberService.js — CRUD members
// KelolaRacun
// ============================================================

import { add, getAll, getById, put, remove } from '../db.js';

import { canManageMembers, getCurrentMember } from '../core/authService.js';

const STORE = 'members';

const defaultRoles = new Map([['zara', 'Admin'], ['dhika', 'Member']]);

export function defaultRole(id) {
  return defaultRoles.get(id) || null;
}

export function isMemberRole(role) {
  return ['Admin', 'Member', 'Co-Manager', 'Viewer'].includes(role);
}

export function isAllowedMemberId(id) {
  return defaultRoles.has(id);
}

export async function ensureDefaultMembers(guildId) {
  for (const [id, role] of defaultRoles) {
    const member = await getMember(id);
    if (member) {
      if (member.role !== role || member.active !== true || member.guildId !== guildId) {
        await put(STORE, { ...member, guildId, role, active: true });
      }
    } else {
      await put(STORE, { id, name: id, role, guildId, active: true, createdAt: new Date().toISOString() });
    }
  }
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

export async function createMember(data) {
  requireManager(data.guildId);
  if (!isMemberRole(data.role ?? 'Viewer')) throw new Error('Role tidak valid');
  const member = {
    id: 'mem-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    name: data.name,
    role: data.role || 'Viewer',
    guildId: data.guildId,
    active: true,
    createdAt: new Date().toISOString()
  };
  return await add(STORE, member);
}

function requireManager(guildId) {
  if (!canManageMembers() || getCurrentMember()?.guildId !== guildId) throw new Error('Hanya Admin guild.');
}

async function guardChange(member, losesAdmin) {
  requireManager(member.guildId);
  if (isAllowedMemberId(member.id) || member.id === getCurrentMember()?.memberId) throw new Error('Profil dilindungi');
  if (losesAdmin && member.active && member.role === 'Admin') {
    const active = await getMembersByGuild(member.guildId);
    if (!active.some(m => m.id !== member.id && m.role === 'Admin')) throw new Error('Minimal 1 Admin aktif harus tersisa');
  }
  requireManager(member.guildId);
}

export async function updateMember(id, changes) {
  const member = await getById(STORE, id);
  if (!member) throw new Error('Anggota tidak ditemukan');
  const keys = Object.keys(changes);
  const self = getCurrentMember();
  if (!(keys.length === 1 && keys[0] === 'name' && self?.memberId === id && self.guildId === member.guildId)) {
    if (keys.some(k => !['name', 'role', 'active'].includes(k)) ||
        ('role' in changes && !isMemberRole(changes.role)) ||
        ('active' in changes && typeof changes.active !== 'boolean')) throw new Error('Perubahan tidak valid');
    await guardChange(member, changes.active === false || ('role' in changes && changes.role !== 'Admin'));
  }
  const updated = { ...member, ...changes };
  return await put(STORE, updated);
}

export async function deleteMember(id) {
  const member = await getMember(id);
  if (!member) throw new Error('Anggota tidak ditemukan');
  await guardChange(member, true);
  return await remove(STORE, id);
}

export async function getMembersByGuild(guildId, activeOnly = true) {
  const all = await getAll(STORE);
  return all.filter(m => m.guildId === guildId && (!activeOnly || m.active));
}