// ============================================================
// scripts/screens/loginController.js — Login member via PIN
// KelolaRacun
// ============================================================

import { initApp, showToast } from '../app.js';
import { getMembers } from '../services/memberService.js';
import { verifyPin } from '../core/crypto.js';

let selected = null;
let attempts = 0;
const MAX_ATTEMPTS = 5;
let lockout = 0;

// ---- Render member list ----
async function renderMembers() {
  const list = document.getElementById('memberList');
  try {
    const members = await getMembers(true); // only active
    if (!members.length) {
      list.innerHTML = '<p class="text-tertiary text-sm p-4 text-center">Belum ada anggota.</p>';
      return;
    }
    list.innerHTML = members.map(m => `
      <button class="card p-3 member-card" data-id="${m.id}" style="cursor: pointer; text-align: center; border: 2px solid transparent; transition: border-color 0.2s;">
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

  // highlight
  document.querySelectorAll('.member-card').forEach(c => {
    c.style.borderColor = c.dataset.id === id ? 'var(--color-gold-500)' : 'transparent';
  });

  document.getElementById('memberList').style.display = 'none';
  document.getElementById('pinSection').style.display = 'block';
  document.getElementById('selectedMemberName').textContent = selected.name;
  document.getElementById('pinInput').value = '';
  document.getElementById('pinInput').focus();
}

document.getElementById('backToMembers').addEventListener('click', () => {
  selected = null;
  document.getElementById('memberList').style.display = 'grid';
  document.getElementById('pinSection').style.display = 'none';
});

document.getElementById('clearPin').addEventListener('click', () => {
  document.getElementById('pinInput').value = '';
});

// PIN input: angka saja
document.getElementById('pinInput').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
});

// ---- Lockout ----
function showLockout(seconds) {
  lockout = seconds;
  const overlay = document.getElementById('lockoutOverlay');
  overlay.style.display = 'flex';
  const timerEl = document.getElementById('lockoutTimer');
  const iv = setInterval(() => {
    lockout--;
    timerEl.textContent = lockout;
    if (lockout <= 0) {
      clearInterval(iv);
      overlay.style.display = 'none';
      attempts = 0;
    }
  }, 1000);
}

document.getElementById('lockoutRetry').addEventListener('click', () => {
  if (lockout <= 0) document.getElementById('lockoutOverlay').style.display = 'none';
});

// ---- Submit login ----
document.getElementById('pinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selected) {
    showToast('Pilih anggota dulu', 'danger');
    return;
  }
  const pin = document.getElementById('pinInput').value;
  if (!/^\d{6}$/.test(pin)) {
    showToast('PIN harus 6 digit', 'danger');
    return;
  }

  try {
    const ok = await verifyPin(pin, selected.pinSalt, selected.pinHash);
    if (ok) {
      const session = {
        memberId: selected.id,
        guildId: selected.guildId,
        role: selected.role,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
      };
      localStorage.setItem('session', JSON.stringify(session));
      showToast(`Selamat datang, ${selected.name}! 🎉`, 'success');
      setTimeout(() => { window.location.href = '02-guild-hall.html'; }, 500);
    } else {
      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        showLockout(60);
        showToast('Terlalu banyak percobaan. Terkunci 60 detik.', 'danger');
      } else {
        showToast(`PIN salah. Sisa percobaan: ${MAX_ATTEMPTS - attempts}`, 'danger');
      }
      document.getElementById('pinInput').value = '';
    }
  } catch (err) {
    console.error('Login error:', err);
    showToast('Gagal: ' + err.message, 'danger');
  }
});

// ---- Init ----
(async function init() {
  try {
    await initApp();
    // Kalau sudah ada session valid → langsung ke guild hall
    const session = JSON.parse(localStorage.getItem('session') || 'null');
    if (session && session.expiresAt > Date.now() && session.memberId) {
      window.location.href = '02-guild-hall.html';
      return;
    }
    await renderMembers();
  } catch (err) {
    console.error('Init failed:', err);
  }
})();