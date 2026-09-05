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
  return errors;
}

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('modal--open');
  document.body.classList.add('modal-open');
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('modal--open');
  document.body.classList.remove('modal-open');
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