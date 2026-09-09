// ============================================================
// scripts/core/authService.js — Session & RBAC
// KelolaRacun
// ============================================================

import { publish } from './eventBus.js';

const SESSION_KEY = 'session';

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function isAuthenticated() {
  const s = getSession();
  return !!(s && s.expiresAt > Date.now() && s.memberId);
}

export function getCurrentMemberId() {
  const s = getSession();
  return s && s.expiresAt > Date.now() ? s.memberId : null;
}

export function getCurrentRole() {
  const s = getSession();
  return s && s.expiresAt > Date.now() ? s.role : null;
}

export function getCurrentGuildId() {
  const s = getSession();
  return s && s.expiresAt > Date.now() ? s.guildId : null;
}

export function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '01-guild-entrance.html';
    throw new Error('Unauthorized'); // hentikan eksekusi
  }
}

export function getCurrentMember() {
  const s = getSession();
  if (!s || s.expiresAt <= Date.now()) return null;
  return {
    memberId: s.memberId,
    guildId: s.guildId,
    role: s.role
  };
}

export function canEdit() {
  const role = getCurrentRole();
  return role === 'Admin' || role === 'Co-Manager';
}

export function canManageGuild() {
  return getCurrentRole() === 'Admin';
}

export function canManageCategories() {
  return getCurrentRole() === 'Admin';
}

export function canManageMembers() {
  return getCurrentRole() === 'Admin';
}

export function canBackup() {
  return getCurrentRole() === 'Admin';
}

export function canViewReports() {
  return ['Admin', 'Co-Manager'].includes(getCurrentRole());
}

export function logout() {
  clearSession();
  publish('kelola-racun:logout', {});
  window.location.href = '01-guild-entrance.html';
}