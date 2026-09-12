// ============================================================
// scripts/screens/loginController.js — Login member via PIN
// KelolaRacun
// ============================================================

import { openDB } from '../db.js';
import { initApp, showToast } from '../app.js';
import { getGuild, createGuild } from '../services/guildService.js';
import { getMembers, createMember } from '../services/memberService.js';
import { verifyPin, hashPin, generateSalt } from '../core/crypto.js';
import { saveSession, getSession, isAuthenticated } from '../core/authService.js';
import { syncWithServer, pushToServer } from '../core/syncService.js';

const $ = (id) => document.getElementById(id);

let selected = null;
let attempts = 0;
const MAX_ATTEMPTS = 5;
let lockout = 0;

// ---- State machine ----
function showView(name) {
  $('viewOnboarding').hidden = name !== 'onboarding';
  $('viewLogin').hidden = name !== 'login';
}

function showStep(name) {
  $('stepPick').hidden = name !== 'pick';
  $('stepPin').hidden = name !== 'pin';
  $('loginSubtitle').textContent = name === 'pin'
    ? 'Langkah 2 dari 2 — masukkan PIN'
    : 'Langkah 1 dari 2 — pilih anggota';
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
}

// ---- Render member list ----
async function renderMembers() {
  const list = $('memberList');
  try {
    const members = await getMembers(true);
    if (!members.length) {
      list.innerHTML = '<p class="text-tertiary text-sm p-4 text-center">Belum ada anggota.</p>';
      return;
    }
    list.innerHTML = members.map(m => `
      <button class="card p-3 member-card" data-id="${m.id}">
        <div class="text-3xl mb-1">${roleIcon(m.role)}</div>
        <div class="font-bold text-sm">${escapeHtml(m.name)}</div>
        <div class="text-xs text-tertiary">${m.role}</div>
      </button>
    `).join('');
    list.querySelectorAll('.member-card').forEach(card => {
      card.addEventListener('click', () => selectMember(card.dataset.id, members));
    });
  } catch (err) {
    console.error('Load members failed:', err);
    showToast('Gagal memuat anggota', 'danger');
  }
}

function roleIcon(role) {
  return role === 'Admin' ? '👑' : role === 'Co-Manager' ? '🧙' : '👀';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function selectMember(id, members) {
  selected = members.find(m => m.id === id);
  if (!selected) return;
  document.querySelectorAll('.member-card').forEach(c => {
    c.classList.toggle('member-card--selected', c.dataset.id === id);
  });
  $('selectedMemberName').textContent = selected.name;
  showStep('pin');
  resetOtp();
  $('pinSubmit').disabled = false;
}

// ---- OTP helpers ----
function otpBoxes() {
  return Array.from(document.querySelectorAll('[data-otp]'));
}

function resetOtp() {
  otpBoxes().forEach(box => { box.value = ''; box.disabled = false; });
  otpBoxes()[0]?.focus();
}

function otpValue() {
  return otpBoxes().map(box => box.value).join('');
}

// ---- Onboarding (first run) ----
$('onboardForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();
  const guildName = $('obGuildName').value.trim();
  const adminName = $('obAdminName').value.trim();
  const pin = $('obPin').value;
  const pin2 = $('obPin2').value;
  let valid = true;
  if (!guildName) { $('errObGuildName').textContent = 'Nama Guild wajib diisi'; valid = false; }
  if (!adminName) { $('errObAdminName').textContent = 'Nama Admin wajib diisi'; valid = false; }
  if (!/^\d{6}$/.test(pin)) { $('errObPin').textContent = 'PIN harus 6 digit angka'; valid = false; }
  if (pin !== pin2) { $('errObPin2').textContent = 'PIN tidak cocok'; valid = false; }
  if (!valid) return;

  const submitBtn = $('obSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Memproses...';
  try {
    const existing = await getGuild();
    if (existing) { showToast('Guild sudah ada. Silakan masuk.', 'info'); showView('login'); await renderMembers(); return; }
    await initApp();
    const salt = generateSalt();
    const hash = await hashPin(pin, salt);
    const guild = await createGuild(guildName);
    const member = await createMember({ name: adminName, pinSalt: salt, pinHash: hash, role: 'Admin', guildId: guild.id, active: true });
    const session = { memberId: member.id, guildId: guild.id, role: 'Admin', expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 };
    saveSession(session);
    try { await pushToServer(); } catch {}
    showToast('Guild dibuat! Selamat datang! 🎉', 'success');
    setTimeout(() => { window.location.replace('../index.html'); }, 800);
  } catch (err) {
    console.error('Onboarding error:', err);
    showToast('Gagal: ' + err.message, 'danger');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '🚀 Buat Guild & Masuk';
  }
});

// ---- PIN visibility ----
$('toggleObPin').addEventListener('click', () => {
  const input = $('obPin');
  input.type = input.type === 'password' ? 'text' : 'password';
});

$('togglePinShow').addEventListener('click', () => {
  const show = otpBoxes().every(box => box.type === 'password');
  otpBoxes().forEach(box => box.type = show ? 'text' : 'password');
  $('togglePinShow').textContent = show ? '🙈 Sembunyi' : '👁️ Tampil';
});

// ---- OTP input behaviour ----
otpBoxes().forEach((box, index) => {
  box.addEventListener('input', () => {
    box.value = box.value.replace(/\D/g, '').slice(0, 1);
    if (box.value && index < otpBoxes().length - 1) otpBoxes()[index + 1].focus();
    if (otpBoxes().every(b => b.value)) $('pinSubmit').disabled = false;
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !box.value && index > 0) {
      e.preventDefault();
      otpBoxes()[index - 1].value = '';
      otpBoxes()[index - 1].focus();
    }
  });
  box.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    otpBoxes().forEach((b, i) => b.value = text[i] || '');
    otpBoxes()[Math.min(text.length, otpBoxes().length - 1)].focus();
    if (text.length === 6) $('pinSubmit').disabled = false;
  });
});

// ---- Login submit ----
$('pinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();
  const pin = otpValue();
  if (!selected) { $('errPick').textContent = 'Pilih anggota dulu'; return; }
  if (!/^\d{6}$/.test(pin)) { $('errPin').textContent = 'PIN harus 6 digit'; return; }

  const submitBtn = $('pinSubmit');
  submitBtn.disabled = true;
  try {
    const ok = await verifyPin(pin, selected.pinSalt, selected.pinHash);
    if (ok) {
      const session = {
        memberId: selected.id,
        guildId: selected.guildId,
        role: selected.role,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
      };
      saveSession(session);
      showToast(`Selamat datang, ${selected.name}! 🎉`, 'success');
      setTimeout(() => { window.location.replace('../index.html'); }, 500);
    } else {
      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        showLockout(60);
        showToast('Terlalu banyak percobaan. Terkunci 60 detik.', 'danger');
      } else {
        $('errPin').textContent = `PIN salah. Sisa percobaan: ${MAX_ATTEMPTS - attempts}`;
      }
      resetOtp();
    }
  } catch (err) {
    console.error('Login error:', err);
    $('errPin').textContent = 'Gagal: ' + err.message;
  } finally {
    submitBtn.disabled = false;
  }
});

// ---- Back to members ----
$('backToMembers').addEventListener('click', () => {
  selected = null;
  resetOtp();
  showStep('pick');
});

// ---- Lockout ----
let lockoutTimerId = null;

function hideLockout() {
  if (lockoutTimerId) {
    clearInterval(lockoutTimerId);
    lockoutTimerId = null;
  }
  lockout = 0;
  const el = $('lockoutOverlay');
  if (el) {
    el.hidden = true;
    el.classList.remove('is-active');
  }
}

function showLockout(seconds) {
  lockout = seconds;
  const el = $('lockoutOverlay');
  if (el) {
    el.hidden = false;
    el.classList.add('is-active');
  }
  const timerEl = $('lockoutTimer');
  if (timerEl) timerEl.textContent = lockout;
  if (lockoutTimerId) clearInterval(lockoutTimerId);
  lockoutTimerId = setInterval(() => {
    lockout--;
    if (timerEl) timerEl.textContent = Math.max(0, lockout);
    if (lockout <= 0) {
      hideLockout();
      attempts = 0;
      resetOtp();
    }
  }, 1000);
}

$('lockoutRetry').addEventListener('click', () => {
  if (lockout <= 0) {
    hideLockout();
    attempts = 0;
    resetOtp();
  }
});

// ---- Init ----
(async function init() {
  hideLockout();
  attempts = 0;
  selected = null;
  clearErrors();
  try {
    await openDB();
    await syncWithServer();
    if (isAuthenticated()) {
      window.location.replace('../index.html');
      return;
    }
    const members = await getMembers(true);
    showView(members.length ? 'login' : 'onboarding');
    if (members.length) {
      showStep('pick');
      await renderMembers();
    }
  } catch (err) {
    console.error('Init failed:', err);
    showView('onboarding');
  }
})();
