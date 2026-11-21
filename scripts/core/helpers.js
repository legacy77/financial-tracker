// ============================================================
// scripts/core/helpers.js — Utility helpers: format, validate, modal
// KelolaRacun Phase 3 — Dynamic Screens
// ============================================================

export function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(Number(amount) || 0);
}

export function formatDate(dateStr, opts = {}) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', ...opts
  }).format(date);
}

export function relativeDate(dateStr) {
  if (!dateStr) return '';
  const diff = new Date() - new Date(dateStr);
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'Hari ini';
  if (days === 1) return 'Kemarin';
  return `${days} hari lalu`;
}

export function validateTransactionForm(data) {
  const errors = {};
  if (!data.pouchId) errors.pouchId = 'Pilih pouch dulu';
  if (!data.type) errors.type = 'Tipe transaksi wajib diisi';
  if (!data.amount || Number(data.amount) <= 0) errors.amount = 'Nominal harus lebih dari 0';
  if (!data.category) errors.category = 'Kategori wajib diisi';
  if (data.date && isNaN(new Date(data.date))) errors.date = 'Tanggal tidak valid';
  if (data.type === 'Transfer') {
    if (!data.toPouchId) errors.toPouchId = 'Pilih pouch tujuan';
    else if (data.toPouchId === data.pouchId) errors.toPouchId = 'Pouch tujuan harus berbeda';
  }
  return errors;
}

const modalOpeners = new WeakMap();
const modalFocusable = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"]';

function getModalFocusable(modal) {
  return [...modal.querySelectorAll(modalFocusable)].filter((el) =>
    !el.matches(':disabled') && el.tabIndex >= 0 &&
    !el.closest('[hidden], [inert]') && el.getClientRects().length > 0 &&
    getComputedStyle(el).visibility !== 'hidden'
  );
}

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  if (!modal.classList.contains('modal--open')) modalOpeners.set(modal, document.activeElement);
  modal.classList.add('modal--open');
  document.body.classList.add('modal-open');
  const focusable = getModalFocusable(modal);
  const firstField = focusable.find((el) => el.matches('input:not([type="hidden"]), select, textarea'));
  (firstField || focusable.find((el) => el.matches('.modal__close')))?.focus();
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('modal--open');
  document.body.classList.remove('modal-open');
  const opener = modalOpeners.get(modal);
  modalOpeners.delete(modal);
  if (opener?.isConnected) opener.focus();
}

export function setupModalClose() {
  document.addEventListener('click', (e) => {
    const modal = e.target.closest('.modal');
    if (!modal) return;
    if (e.target.classList.contains('modal__backdrop') || e.target.closest('.modal__close')) {
      closeModal(modal.id);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal--open').forEach((m) => closeModal(m.id));
    }
    if (e.key === 'Tab') {
      const modal = document.activeElement?.closest('.modal--open');
      if (!modal) return;
      const focusable = getModalFocusable(modal);
      const index = focusable.indexOf(document.activeElement);
      if (!focusable.length || index === -1 ||
          (e.shiftKey ? index === 0 : index === focusable.length - 1)) {
        e.preventDefault();
        focusable[e.shiftKey ? focusable.length - 1 : 0]?.focus();
      }
    }
  });
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

export const TYPE_META = {
  Income: { icon: '💰', label: 'Pemasukan', badge: 'success', cls: 'list__amount--success', sign: '+' },
  Expense: { icon: '💸', label: 'Pengeluaran', badge: 'danger', cls: 'list__amount--danger', sign: '-' },
  Transfer: { icon: '🔄', label: 'Transfer', badge: 'info', cls: 'list__amount--info', sign: '' }
};

export const POUCH_TYPE_META = {
  Cash: { icon: '💰', label: 'Cash' },
  Bank: { icon: '🏦', label: 'Bank' },
  Investment: { icon: '🔮', label: 'Investasi' },
  'E-Wallet': { icon: '📱', label: 'E-Wallet' }
};

export function getSimpleOn() {
  try {
    const pref = JSON.parse(localStorage.getItem('ffh-prefs') || '{}');
    return pref.simple !== 'off';
  } catch { return true; }
}

export function setSimpleOn(on) {
  try {
    const pref = JSON.parse(localStorage.getItem('ffh-prefs') || '{}');
    localStorage.setItem('ffh-prefs', JSON.stringify({ ...pref, simple: on ? 'on' : 'off' }));
  } catch {}
}

export function applySimpleLang() {
  if (!getSimpleOn()) return;
  document.querySelectorAll('[data-simple]').forEach((el) => {
    if (!el.dataset.guild) el.dataset.guild = el.textContent;
    el.textContent = el.dataset.simple;
  });
  const dict = [
    [/Loot/g, 'Uang Masuk'],
    [/Pouch/g, 'Dompet'],
    [/Monthly Quest/g, 'Target Bulanan'],
    [/\bQuest\b/g, 'Target'],
    [/\bHall\b/g, 'Analisa']
  ];
  try {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('script,style')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      let v = n.nodeValue;
      dict.forEach(([re, rep]) => { v = v.replace(re, rep); });
      n.nodeValue = v;
    });
    document.querySelectorAll('[placeholder]').forEach((el) => {
      let p = el.getAttribute('placeholder') || '';
      dict.forEach(([re, rep]) => { p = p.replace(re, rep); });
      el.setAttribute('placeholder', p);
    });
  } catch (err) { console.warn('Penerapan bahasa gagal:', err); }
}