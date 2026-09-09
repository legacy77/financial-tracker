// ============================================================
// scripts/screens/registerController.js — Register Admin (first run)
// KelolaRacun
// ============================================================

import { initApp, showToast } from '../app.js';
import { getGuild, createGuild } from '../services/guildService.js';
import { createMember } from '../services/memberService.js';
import { hashPin, generateSalt } from '../core/crypto.js';

const form = document.getElementById('registerForm');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const guildName = document.getElementById('guildName').value.trim();
  const adminName = document.getElementById('adminName').value.trim();
  const pin = document.getElementById('pin').value;
  const confirmPin = document.getElementById('confirmPin').value;

  // Validasi
  if (!guildName) {
    showToast('Nama Guild wajib diisi', 'danger');
    return;
  }
  if (!adminName) {
    showToast('Nama Admin wajib diisi', 'danger');
    return;
  }
  if (!/^\d{6}$/.test(pin)) {
    showToast('PIN harus 6 digit angka', 'danger');
    return;
  }
  if (pin !== confirmPin) {
    showToast('Konfirmasi PIN tidak cocok', 'danger');
    return;
  }

  // Disable button saat proses
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Memproses...';

  try {
    // Inisialisasi DB dulu
    await initApp();

    // Hash PIN
    const salt = generateSalt();
    const hash = await hashPin(pin, salt);

    // Buat guild
    const guild = await createGuild(guildName);

    // Buat member Admin
    const member = await createMember({
      name: adminName,
      pinSalt: salt,
      pinHash: hash,
      role: 'Admin',
      guildId: guild.id,
      active: true
    });

    // Buat session
    const session = {
      memberId: member.id,
      guildId: guild.id,
      role: 'Admin',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 hari
    };
    localStorage.setItem('session', JSON.stringify(session));

    showToast('Guild dibuat! Selamat datang! 🎉', 'success');
    setTimeout(() => {
      window.location.href = '02-guild-hall.html';
    }, 800);

  } catch (err) {
    console.error('Register error:', err);
    showToast('Gagal: ' + err.message, 'danger');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '🚀 Buat Guild & Mulai';
  }
});