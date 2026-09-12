import { logout } from './core/authService.js';

export function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  const stored = localStorage.getItem('ffh-theme');
  if (stored === 'dark') root.classList.add('dark');
  if (stored === 'light') root.classList.add('light');
  if (btn) {
    if (root.classList.contains('dark')) btn.textContent = '☀️';
    btn.addEventListener('click', () => {
      const isDark = root.classList.toggle('dark');
      root.classList.remove(isDark ? 'light' : 'dark');
      localStorage.setItem('ffh-theme', isDark ? 'dark' : 'light');
      btn.textContent = isDark ? '☀️' : '🌙';
      applyChartTheme();
    });
  }
}

export function wireLogout() {
  document.querySelectorAll('[data-logout]').forEach((el) => {
    if (el.dataset.wired) return;
    el.dataset.wired = '1';
    el.addEventListener('click', () => logout());
  });
}

export function applyChartTheme() {
  if (!window.Chart) return;
  const dark = document.documentElement.classList.contains('dark');
  const tick = dark ? '#d0d0d0' : '#5d5d5d';
  const grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  window.Chart.defaults.color = tick;
  window.Chart.defaults.borderColor = grid;
  Object.values(window.Chart.instances || {}).forEach((c) => {
    try { c.update(); } catch {}
  });
}

export function wireModalBackdrop() {
  document.querySelectorAll('.modal').forEach((m) => {
    if (m.dataset.backdropWired) return;
    m.dataset.backdropWired = '1';
    m.addEventListener('click', (e) => {
      if (e.target === m || e.target.classList.contains('modal__backdrop')) m.classList.remove('modal--open');
    });
  });
}

export function initSharedUI() {
  initTheme();
  wireLogout();
  wireModalBackdrop();
  applyChartTheme();
}

document.addEventListener('DOMContentLoaded', initSharedUI);
