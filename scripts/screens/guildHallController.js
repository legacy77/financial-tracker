// ============================================================
// scripts/screens/guildHallController.js — Dynamic rendering
// KelolaRacun Phase 3: Data-driven Guild Hall
// ============================================================

import { initApp, showToast } from '../app.js';
import {
  getGuild, initSeedData
} from '../services/guildService.js';
import {
  getPouches, createPouch, getPouch
} from '../services/pouchService.js';
import {
  getTransactions, addTransaction
} from '../services/transactionService.js';
import { getBills, getPendingBills, addBill, togglePaid } from '../services/billService.js';

import { subscribe } from '../core/eventBus.js';
import {
  formatRupiah, relativeDate, validateTransactionForm,
  openModal, closeModal, setupModalClose, escapeHtml, TYPE_META, POUCH_TYPE_META
} from '../core/helpers.js';

// ---- Init & Data Fetch ----
async function fetchAll() {
  const [guild, pouches, transactions, bills] = await Promise.all([
    getGuild(),
    getPouches(),
    getTransactions(),
    getPendingBills()
  ]);
  return { guild, pouches, transactions, bills };
}

// ---- Render Helpers ----
function renderGuildBanner({ guild, pouches }) {
  const totalGold = pouches.reduce((sum, p) => sum + (p.balance || 0), 0);
  document.querySelectorAll('.guild-banner__gold').forEach(el => {
    el.textContent = formatRupiah(totalGold);
  });
  const nameEl = document.querySelector('.guild-banner__title');
  if (nameEl && guild) nameEl.textContent = `${guild.familyName || 'Guild'}`;

  const levelEls = document.querySelectorAll('.badge--gold');
  levelEls.forEach(el => {
    if (el.textContent.startsWith('Lv.')) el.textContent = `Lv. ${guild?.guildLevel || 1}`;
  });
}

function renderRecentTransactions(transactions) {
  const container = document.querySelector('.list.transactions-list');
  if (!container) return;

  if (!transactions.length) {
    container.innerHTML = '<p class="text-tertiary text-sm p-4">Belum ada transaksi. Tambah loot pertama gemu!</p>';
    return;
  }

  const recent = transactions.slice(-5).reverse();
  container.innerHTML = recent.map(t => {
    const meta = TYPE_META[t.type] || TYPE_META.Expense;
    const amt = formatRupiah(t.amount);
    const sign = meta.sign || (t.type === 'Expense' ? '-' : '+');
    return `
      <div class="list__item card--interactive p-2 rounded-lg">
        <div class="list__icon">${meta.icon}</div>
        <div class="list__content">
          <div class="list__title">${escapeHtml(t.category)}</div>
          <div class="list__subtitle">${escapeHtml(t.notes || meta.label)}</div>
        </div>
        <div class="list__meta flex-col items-end">
          <span class="list__amount ${meta.cls} font-bold">${sign}${amt}</span>
          <span class="list__date">${relativeDate(t.date)}</span>
        </div>
      </div>`;
  }).join('');
}

function renderBills(bills) {
  const container = document.querySelector('.list.bills-list');
  if (!container) return;

  if (!bills.length) {
    container.innerHTML = '<p class="text-tertiary text-sm p-4">Tidak ada tagihan pending. Mantap!</p>';
    return;
  }

  const badge = document.querySelector('.bills-count');
  if (badge) {
    badge.textContent = `${bills.length} tagihan`;
  }

  container.innerHTML = bills.map(b => {
    const due = new Date(b.dueDate);
    const daysLeft = Math.ceil((due - new Date()) / 86400000);
    const dueText = daysLeft <= 0 ? 'Jatuh tempo hari ini!' : `Jatuh tempo ${daysLeft} hari`;
    return `
      <div class="list__item">
        <div class="list__icon">🧾</div>
        <div class="list__content">
          <div class="list__title">${escapeHtml(b.title)}</div>
          <div class="list__subtitle">${dueText}</div>
        </div>
        <div class="list__meta flex-col items-end">
          <span class="list__amount list__amount--danger font-bold">${formatRupiah(b.amount)}</span>
          <button class="btn btn--ghost pill-bill-paid" data-bill="${b.id}" style="padding: 2px 8px; font-size: 10px;">✓ Tandai Lunas</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.pill-bill-paid').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await togglePaid(btn.dataset.bill);
        showToast('Tagihan ditandai lunas! 🎉');
      } catch (err) {
        showToast('Gagal update tagihan: ' + err.message, 'error');
      }
    });
  });
}

// ---- Modal Forms ----
function populatePouchSelect(selectEl, pouches, selectedId) {
  if (!selectEl) return;
  selectEl.innerHTML = pouches.map(p => {
    const meta = POUCH_TYPE_META[p.type] || { icon: '💰' };
    const sel = p.id === selectedId ? ' selected' : '';
    return `<option value="${p.id}"${sel}>${meta.icon} ${escapeHtml(p.name)} — ${formatRupiah(p.balance)}</option>`;
  }).join('');
}

function setupTransactionModalForm(showToastFn) {
  const form = document.getElementById('txModalForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      pouchId: form.pouchId.value,
      type: form.txType.value,
      amount: Number(form.amount.value),
      category: form.category.value,
      notes: form.notes.value,
      date: form.date.value || new Date().toISOString()
    };

    const errors = validateTransactionForm(data);
    if (Object.keys(errors).length) {
      showToastFn(Object.values(errors)[0], 'danger');
      return;
    }

    try {
      await addTransaction(data);
      showToastFn(data.type === 'Income' ? 'Loot ditambahkan! 💰' : 'Pengeluaran dicatat! 💸', 'success');
      closeModal('txModal');
      form.reset();
    } catch (err) {
      showToastFn('Gagal: ' + err.message, 'danger');
    }
  });
}

function setupPouchModalForm(showToastFn) {
  const form = document.getElementById('pouchModalForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: form.pouchName.value,
      type: form.pouchType.value,
      balance: Number(form.pouchBalance.value || 0)
    };
    if (!data.name) {
      showToastFn('Nama pouch wajib diisi', 'danger');
      return;
    }
    try {
      await createPouch(data);
      showToastFn('Pouch baru dibuat! 🎒', 'success');
      closeModal('pouchModal');
      form.reset();
    } catch (err) {
      showToastFn('Gagal: ' + err.message, 'danger');
    }
  });
}

function setupBillModalForm(showToastFn) {
  const form = document.getElementById('billModalForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      title: form.billTitle.value,
      amount: Number(form.billAmount.value),
      dueDate: form.billDueDate.value || new Date().toISOString()
    };
    if (!data.title || data.amount <= 0) {
      showToastFn('Judul dan nominal wajib valid', 'danger');
      return;
    }
    try {
      await addBill(data);
      showToastFn('Tagihan baru ditambahkan! 🧾', 'success');
      closeModal('billModal');
      form.reset();
    } catch (err) {
      showToastFn('Gagal: ' + err.message, 'danger');
    }
  });
}

// ---- Main Entry ----
(async function init() {
  setupModalClose();

  const { guild, pouches, transactions, bills } = await fetchAll();

  renderGuildBanner({ guild, pouches });
  renderRecentTransactions(transactions);
  renderBills(bills);

  // Populate pouch selects in modal forms
  const txModalForm = document.getElementById('txModalForm');
  if (txModalForm) populatePouchSelect(txModalForm.pouchId, pouches);
  const txModalFormExpense = document.getElementById('txModalFormExpense');
  if (txModalFormExpense) populatePouchSelect(txModalFormExpense.pouchId, pouches);

  // Wire action buttons to open modals & set types
  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.openModal;
      const type = btn.dataset.type;
      if (type) {
        const typeInput = document.getElementById('txTypeInput');
        if (typeInput) typeInput.value = type;
        const titleEl = document.getElementById('txModalTitle');
        if (titleEl) titleEl.textContent = type === 'Income' ? '➕ Tambah Loot (Pemasukan)' : '💸 Catat Pengeluaran';
      }
      openModal(modalId);
    });
  });

  // Wire modal forms
  setupTransactionModalForm(showToast);
  setupPouchModalForm(showToast);
  setupBillModalForm(showToast);

  // Reactivity: re-render on data updates
  subscribe('kelola-racun:updated', async () => {
    const fresh = await fetchAll();
    renderGuildBanner(fresh);
    renderRecentTransactions(fresh.transactions);
    renderBills(fresh.bills);
  });

  // Init DB & seed on first visit
  try {
    await initApp();
  } catch (err) {
    console.error('Init DB gagal:', err);
  }
})();