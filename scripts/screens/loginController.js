import { openDB } from '../db.js';
import { showToast, notifySyncFailure } from '../app.js';
import { getGuild, createGuild } from '../services/guildService.js';
import { ensureDefaultMembers, getMember, isAllowedMemberId } from '../services/memberService.js';
import { saveSession, isAuthenticated } from '../core/authService.js';
import { ensureDefaultPouches } from '../services/pouchService.js';
import { syncWithServer, pushToServer } from '../core/syncService.js';

const $ = (id) => document.getElementById(id);
let guild;

async function enter(id) {
  if (!isAllowedMemberId(id)) throw new Error('Profil tidak diizinkan');
  const member = await getMember(id);
  if (!member?.active || member.guildId !== guild.id) throw new Error('Profil tidak tersedia');
  saveSession({ memberId: id, guildId: guild.id, role: member.role, expiresAt: Date.now() + 7 * 86400000 });
  window.location.replace('../index.html');
}

async function init() {
  await openDB();
  await notifySyncFailure(syncWithServer());
  guild = await getGuild();
  if (guild) {
    await ensureDefaultMembers(guild.id);
    await ensureDefaultPouches(guild.id);
    if (isAuthenticated()) return window.location.replace('../index.html');
  }
  $('viewOnboarding').hidden = !!guild;
  $('viewLogin').hidden = !guild;
  $('stepPick').hidden = false;
  $('memberList').querySelectorAll('.guard-card[data-id]').forEach(card => {
    card.addEventListener('click', () => enter(card.dataset.id).catch(err => showToast(err.message, 'danger')));
  });
  $('obGuildName').form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = $('obGuildName').value.trim();
    if (!name) return showToast('Nama guild wajib diisi', 'danger');
    $('obSubmit').disabled = true;
    try {
      guild = await createGuild(name);
      await ensureDefaultPouches(guild.id);
      await ensureDefaultMembers(guild.id);
      await notifySyncFailure(pushToServer());
      $('viewOnboarding').hidden = true;
      $('viewLogin').hidden = false;
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      $('obSubmit').disabled = false;
    }
  });
}

init().catch(err => showToast('Gagal memuat guild: ' + err.message, 'danger'));
