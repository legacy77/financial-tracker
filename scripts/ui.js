import { logout } from './core/authService.js';
import { applySimpleLang } from './core/helpers.js';

export function wireLogout() {
  document.querySelectorAll('[data-logout]').forEach((el) => {
    if (el.dataset.wired) return;
    el.dataset.wired = '1';
    el.addEventListener('click', () => logout());
  });
}

export function applyChartTheme() {
  if (!window.Chart) return;
  const tick = '#5d5d5d';
  const grid = 'rgba(15,23,42,0.08)';
  window.Chart.defaults.color = tick;
  window.Chart.defaults.borderColor = grid;
  Object.values(window.Chart.instances || {}).forEach((c) => {
    try { c.update(); } catch {}
  });
}

export function wireModalBackdrop() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-close-modal]');
    if (el) document.getElementById(el.dataset.closeModal)?.classList.remove('modal--open');
  });
  document.querySelectorAll('.modal').forEach((m) => {
    if (m.dataset.backdropWired) return;
    m.dataset.backdropWired = '1';
    m.addEventListener('click', (e) => {
      if (e.target === m || e.target.classList.contains('modal__backdrop')) m.classList.remove('modal--open');
    });
  });
}

const actions = [
  { id: 'new-transaction', label: 'Transaksi baru', shortcut: 'N', run: () => document.querySelector('[data-open-modal="txModal"], [data-open-modal="quickTxModal"]')?.click() },
  { id: 'home', label: 'Buka Home', run: () => { location.href = location.pathname.includes('/screens/') ? '../index.html' : 'index.html'; } },
  { id: 'shortcut-help', label: 'Bantuan shortcut', shortcut: '?', run: () => showShortcutHelp() },
  { id: 'hall', label: 'Buka Hall', run: () => { location.href = location.pathname.includes('/screens/') ? '02-guild-hall.html' : 'screens/02-guild-hall.html'; } },
  { id: 'inventory', label: 'Buka Inventory', run: () => { location.href = location.pathname.includes('/screens/') ? '03-inventory.html' : 'screens/03-inventory.html'; } },
  { id: 'summary', label: 'Buka Summary', run: () => { location.href = location.pathname.includes('/screens/') ? '05-summary.html' : 'screens/05-summary.html'; } }
];

function isTypingTarget(target) {
  return target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
}

function closeOverlays() {
  document.querySelectorAll('.modal--open').forEach((el) => el.classList.remove('modal--open'));
}

function showShortcutHelp() {
  let help = document.querySelector('.shortcut-help');
  if (!help) {
    help = document.createElement('div');
    help.className = 'shortcut-help modal modal--open';
    help.innerHTML = '<div class="modal__backdrop"></div><div class="modal__content"><div class="modal__header"><h3 class="modal__title">Shortcut keyboard</h3><button class="modal__close" aria-label="Tutup">&times;</button></div><div class="modal__body"><div class="stack-col"><p><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> — Command palette</p><p><kbd>N</kbd> — Form transaksi baru</p><p><kbd>?</kbd> — Bantuan shortcut ini</p><p><kbd>Esc</kbd> — Tutup overlay</p></div><p class="text-tertiary text-sm mt-4">Shortcut nonaktif saat Anda mengetik di kolom input.</p></div></div>';
    document.body.appendChild(help);
    help.querySelector('.modal__backdrop').addEventListener('click', closeOverlays);
    help.querySelector('.modal__close').addEventListener('click', closeOverlays);
  } else help.classList.add('modal--open');
}

function showCommandPalette() {
  let palette = document.querySelector('.command-palette');
  if (!palette) {
    palette = document.createElement('div');
    palette.className = 'command-palette modal modal--open';
    palette.innerHTML = `<div class="modal__backdrop"></div><div class="modal__content"><div class="modal__header"><h3 class="modal__title">Command palette</h3><button class="modal__close" aria-label="Tutup">&times;</button></div><div class="modal__body"><input class="modal__input" id="commandInput" placeholder="Cari aksi..."><div class="stack-col mt-4" id="commandList"></div></div></div>`;
    document.body.appendChild(palette);
    palette.querySelector('.modal__backdrop').addEventListener('click', closeOverlays);
    palette.querySelector('.modal__close').addEventListener('click', closeOverlays);
    palette.querySelector('#commandInput').addEventListener('input', (event) => renderCommands(event.target.value));
  } else palette.classList.add('modal--open');
  renderCommands('');
  palette.querySelector('#commandInput').focus();
}

// Daftar aksi di halaman berjalan + navigasi antar halaman (bukan router SPA)
function renderCommands(query = '') {
  const list = document.querySelector('#commandList');
  if (!list) return;
  const keyword = query.trim().toLowerCase();
  const visible = actions.filter((action) => action.label.toLowerCase().includes(keyword));
  list.innerHTML = visible.length
    ? visible.map((action) => `<button class="btn btn--ghost" data-command="${action.id}" style="justify-content:space-between;text-align:left">${action.label}${action.shortcut ? ` <kbd>${action.shortcut}</kbd>` : ''}</button>`).join('')
    : '<p class="text-tertiary text-sm">Aksi tidak ditemukan.</p>';
  list.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('click', () => {
    closeOverlays();
    actions.find((action) => action.id === button.dataset.command)?.run();
  }));
}

function wireShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') return closeOverlays();
    if (isTypingTarget(event.target)) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      showCommandPalette();
    } else if (event.key.toLowerCase() === 'n') {
      document.querySelector('[data-open-modal="txModal"], [data-open-modal="quickTxModal"]')?.click();
    } else if (event.key === '?') showShortcutHelp();
  });
}

export function initSharedUI() {
  wireLogout();
  wireModalBackdrop();
  wireShortcuts();
  applyChartTheme();
  applySimpleLang();
}

document.addEventListener('DOMContentLoaded', initSharedUI);
