// ============================================================
// scripts/core/authService.js — Session & RBAC
// KelolaRacun
// ============================================================

import { publish } from './eventBus.js';
import { getMember } from '../services/memberService.js';
import { showToast } from '../app.js';

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

const CANON_ROLES = ['Admin', 'Co-Manager', 'Viewer'];
function canonRole(r) {
  if (r == null) return r;
  const found = CANON_ROLES.find((c) => c.toLowerCase() === String(r).trim().toLowerCase());
  return found || r;
}

export function getCurrentRole() {
  const s = getSession();
  return s && s.expiresAt > Date.now() ? canonRole(s.role) : null;
}

export function getCurrentGuildId() {
  const s = getSession();
  return s && s.expiresAt > Date.now() ? s.guildId : null;
}

export function entranceUrl() {
  const p = window.location.pathname;
  if (p.includes('/screens/')) return './01-guild-entrance.html';
  const base = p.endsWith('/') ? p : p.slice(0, p.lastIndexOf('/') + 1);
  return `${base}screens/01-guild-entrance.html`;
}

export function requireAuth() {
  if (!isAuthenticated()) {
    window.location.replace(entranceUrl());
    throw new Error('Unauthorized'); // hentikan eksekusi
  }
}

// Tangkal back-forward cache browser: re-evaluasi sesi saat halaman direstore dari cache
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', (e) => {
    const isEntrance = window.location.pathname.includes('01-guild-entrance.html');
    if (!isEntrance && e.persisted && !isAuthenticated()) {
      window.location.replace(entranceUrl());
    }
  });
}

// Sinkronkan role sesi dari DB. Atasi sesi basi setelah role diubah
// (mis. Zara dipromosikan jadi Admin tapi localStorage masih Viewer).
// Return false bila sesi tak valid lagi (member dihapus/dinonaktifkan).
export async function syncSessionRole() {
  const s = getSession();
  if (!s || s.expiresAt <= Date.now() || !s.memberId) return false;
  try {
    const m = await getMember(s.memberId);
    if (!m || m.active === false) {
      logout();
      return false;
    }
    const fresh = canonRole(m.role);
    if (fresh && fresh !== s.role) {
      saveSession({ ...s, role: fresh });
      publish('kelola-racun:session', { role: fresh });
      try { showToast(`Peran diperbarui: ${s.role || '?'} → ${fresh}`, 'success'); } catch {}
    }
    return true;
  } catch (err) {
    console.warn('[auth] syncSessionRole gagal, pakai role sesi:', err);
    try { showToast('Gagal sinkron role — muat ulang bila akses terasa aneh', 'warning'); } catch {}
    return true;
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

// Guard terpusat aksi Admin: segarkan role dari DB dulu, tolak + toast bila bukan Admin.
export async function requireAdmin(action = 'mengelola kategori') {
  try { await syncSessionRole(); } catch {}
  if (canonRole(getCurrentRole()) !== 'Admin') {
    showToast(`Hanya Admin yang dapat ${action}.`, 'danger');
    return false;
  }
  return true;
}

// Guard tambah kategori: semua anggota guild yang login boleh.
// ponytail: create terbuka, ubah/hapus/salin/carry tetap requireAdmin.
export async function requireMember() {
  try { await syncSessionRole(); } catch {}
  if (!isAuthenticated() || !getCurrentMember()) {
    showToast('Silakan login dulu.', 'danger');
    return false;
  }
  return true;
}

export function logout() {
  clearSession();
  publish('kelola-racun:logout', {});
  window.location.replace(entranceUrl());
}