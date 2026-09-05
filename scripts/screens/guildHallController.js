// ============================================================
// scripts/screens/guildHallController.js — Dynamic rendering + Analytics + Gamification
// KelolaRacun
// ============================================================

import { initApp, showToast } from '../app.js';
import { getGuild } from '../services/guildService.js';
import { getPouches, createPouch } from '../services/pouchService.js';
import { getTransactions, addTransaction } from '../services/transactionService.js';
import { getBills, getPendingBills, addBill, togglePaid } from '../services/billService.js';

import { subscribe } from '../core/eventBus.js';
import {
  formatRupiah, relativeDate, validateTransactionForm,
  openModal, closeModal, setupModalClose, escapeHtml, TYPE_META, POUCH_TYPE_META
} from '../core/helpers.js';
import {
  getState, getLevelInfo, getAchievements
} from '../core/gamification.js';
import { exportBackup, downloadBackup, restoreBackup, resetAllData } from '../core/backupService.js';

let chartInstances = {};

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

function renderGamification(state) {
  const levelInfo = getLevelInfo(state);
  const lvLabel = document.getElementById('levelLabel');
  const xpBar = document.getElementById('xpBar');
  const xpCount = document.getElementById('xpCount');
  const xpDisplay = document.getElementById('xpDisplay');
  const streak = document.getElementById('streakCount');
  const longest = document.getElementById('longestStreak');

  if (lvLabel) lvLabel.textContent = `Lv. ${levelInfo.level}`;
  if (xpBar) xpBar.style.width = `${levelInfo.progress}%`;
  if (xpCount) xpCount.textContent = `${state.xp} / ${levelInfo.xpNeeded} XP`;
  if (xpDisplay) xpDisplay.textContent = `Lv.${levelInfo.level} ⚡${state.xp}XP`;
  if (streak) streak.textContent = state.currentStreak;
  if (longest) longest.textContent = state.longestStreak;
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
    let dueText = daysLeft <= 0 ? 'Jatuh tempo hari ini!' : `Jatuh tempo ${daysLeft} hari`;
    let css = '';
    if (daysLeft <= 3 && daysLeft >= 0) {
      dueText = `⚠️ ${dueText}`;
      css = ' style="color: var(--color-gold-600);"';
    }
    return `
      <div class="list__item">
        <div class="list__icon">🧾</div>
        <div class="list__content">
          <div class="list__title">${escapeHtml(b.title)}</div>
          <div class="list__subtitle"${css}>${dueText}</div>
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

// ---- Analytics ----
function aggregateMonthly(transactions) {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('id-ID', { month: 'short' }), income: 0, expense: 0 });
  }
  const map = {};
  months.forEach(m => map[m.key] = m);

  transactions.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (map[key]) {
      if (t.type === 'Income') map[key].income += t.amount;
      if (t.type === 'Expense' || t.type === 'Transfer') map[key].expense += t.amount;
    }
  });
  return months;
}

function aggregateExpenses(transactions) {
  const cats = {};
  transactions.filter(t => t.type === 'Expense' || t.type === 'Transfer').forEach(t => {
    cats[t.category || 'Lainnya'] = (cats[t.category || 'Lainnya'] || 0) + t.amount;
  });
  return Object.entries(cats)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function formatCompact(n) {
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'M';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'jt';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'rb';
  return String(n);
}

function renderCharts(transactions) {
  if (typeof Chart === 'undefined') return;

  const cashflowEl = document.getElementById('cashflowChart');
  const expenseEl = document.getElementById('expenseChart');
  const isDark = document.documentElement.classList.contains('dark');
  const gridColor = 'rgba(128, 128, 128, 0.2)';
  const textColor = isDark ? '#d0d0d0' : '#5d5d5d';

  if (cashflowEl) {
    if (chartInstances.cashflow) chartInstances.cashflow.destroy();
    const months = aggregateMonthly(transactions);
    chartInstances.cashflow = new Chart(cashflowEl, {
      type: 'line',
      data: {
        labels: months.map(m => m.label),
        datasets: [
          {
            label: 'Pemasukan',
            data: months.map(m => m.income),
            borderColor: '#14b8a6',
            backgroundColor: 'rgba(20, 184, 166, 0.15)',
            fill: true, tension: 0.3, borderWidth: 2
          },
          {
            label: 'Pengeluaran',
            data: months.map(m => m.expense),
            borderColor: '#e11d48',
            backgroundColor: 'rgba(225, 29, 72, 0.12)',
            fill: true, tension: 0.3, borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor, font: { family: "'Nunito', sans-serif", size: 11 } } },
          title: { display: true, text: 'Tren Cashflow 6 Bulan', color: textColor, font: { family: "'Poppins', sans-serif", size: 14 } }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { ticks: { color: textColor, callback: (v) => formatCompact(v) }, grid: { color: gridColor } }
        }
      }
    });
  }

  if (expenseEl) {
    if (chartInstances.expense) chartInstances.expense.destroy();
    const expenses = aggregateExpenses(transactions);
    const palette = ['#e11d48', '#f59e0b', '#9333ea', '#14b8a6', '#2563eb', '#8c8c8c'];
    chartInstances.expense = new Chart(expenseEl, {
      type: 'doughnut',
      data: {
        labels: expenses.map(e => e.label),
        datasets: [{
          data: expenses.map(e => e.value),
          backgroundColor: expenses.map((_, i) => palette[i % palette.length]),
          borderWidth: 2, borderColor: 'transparent'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, font: { family: "'Nunito', sans-serif", size: 11 }, boxWidth: 12 } },
          title: { display: true, text: 'Breakdown Pengeluaran', color: textColor, font: { family: "'Poppins', sans-serif", size: 14 } }
        }
      }
    });
  }
}

// ---- Achievements ----
async function renderAchievements() {
  const grid = document.getElementById('achGrid');
  if (!grid) return;
  const state = await getState();
  const list = getAchievements(state).sort((a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1));
  grid.innerHTML = list.map(a => `
    <div class="card p-3 text-center" style="${a.unlocked ?
      'border-color: var(--color-gold-300); background: var(--color-gold-25);' :
      'opacity: 0.5; background: var(--color-bg-tertiary);'}">
      <div class="text-3xl mb-2">${a.icon}</div>
      <div class="font-semibold text-sm mb-1">${escapeHtml(a.name)}</div>
      <div class="text-xs text-tertiary">${escapeHtml(a.desc)}</div>
      <span class="badge ${a.unlocked ? 'badge--gold' : ''}" style="margin-top: 6px;">${a.unlocked ? '✅ Terbuka' : '🔒 Terkunci'}</span>
    </div>
  `).join('');
}

function notifyAchievements(achievements) {
  achievements.forEach(a => {
    showToast(`${a.icon} Achievement Terbuka: ${a.name}!`, 'success');
  });
}

function notifyLevelUp(level) {
  showToast(`🎉 Guild naik ke Level ${level}!`, 'warning');
}

// ---- Print & Backup ----
function setupExportPdf(transactions) {
  const btn = document.getElementById('btnExportPdf');
  if (!btn) return;
  btn.addEventListener('click', () => {
    window.print();
  });
}

function setupBackup() {
  const modalBtn = document.getElementById('btnBackup');
  const downloadBtn = document.getElementById('btnBackupDownload');
  const resetBtn = document.getElementById('btnResetAll');
  const fileInput = document.getElementById('backupFileInput');

  if (modalBtn) modalBtn.addEventListener('click', () => openModal('backupModal'));
  if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
      try {
        const data = await exportBackup();
        downloadBackup(data);
        showToast('Backup diunduh! 📥', 'success');
      } catch (err) {
        showToast('Gagal backup: ' + err.message, 'error');
      }
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Yakin hapus SEMUA data? Tindakan ini tidak bisa dibatalkan.')) return;
      try {
        await resetAllData();
        closeModal('backupModal');
        showToast('Semua data direset. Muat ulang...', 'success');
        setTimeout(() => location.reload(), 1200);
      } catch (err) {
        showToast('Gagal reset: ' + err.message, 'error');
      }
    });
  }
}

window.handleBackupRestore = async function(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await restoreBackup(data);
    showToast('Backup berhasil direstore! 🎉', 'success');
    setTimeout(() => location.reload(), 1200);
  } catch (err) {
    showToast('Gagal restore: ' + err.message, 'danger');
  } finally {
    e.target.value = '';
  }
};

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

  // Init DB & seed
  try {
    await initApp();
  } catch (err) {
    console.error('Init DB gagal:', err);
  }

  const [data, gamificationState] = await Promise.all([fetchAll(), getState()]);

  renderGuildBanner(data);
  renderRecentTransactions(data.transactions);
  renderBills(data.bills);
  renderGamification(gamificationState);
  renderCharts(data.transactions);

  // Populate pouch select in transaction modal
  const txModalForm = document.getElementById('txModalForm');
  if (txModalForm) populatePouchSelect(txModalForm.pouchId, data.pouches);

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
  setupExportPdf(data.transactions);
  setupBackup();

  // Achievements modal
  const achBtn = document.getElementById('openAchievements');
  const xpBadge = document.getElementById('xpBadge');
  const openAch = () => {
    renderAchievements();
    openModal('achModal');
  };
  if (achBtn) achBtn.addEventListener('click', openAch);
  if (xpBadge) xpBadge.addEventListener('click', openAch);

  // Gamification events
  subscribe('gamification:achievement-unlocked', (detail) => {
    notifyAchievements(detail.achievements || []);
  });
  subscribe('gamification:level-up', (detail) => {
    notifyLevelUp(detail.level);
  });

  // Reactivity: re-render on data updates
  subscribe('kelola-racun:updated', async () => {
    const fresh = await fetchAll();
    renderGuildBanner(fresh);
    renderRecentTransactions(fresh.transactions);
    renderBills(fresh.bills);
    renderCharts(fresh.transactions);
    try { renderGamification(await getState()); } catch (err) {}
  });

  // Request notification permission & show due-date reminder
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
  const soonBills = data.bills.filter(b => {
    const days = Math.ceil((new Date(b.dueDate) - Date.now()) / 86400000);
    return days >= 0 && days <= 3;
  });
  if (soonBills.length > 0 && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
    new Notification('KelolaRacun — Tagihan Sebentar Lagi', {
      body: `${soonBills.length} tagihan jatuh tempo dalam 3 hari: ${soonBills.map(b => b.title).join(', ')}`,
      icon: '../manifest.json'
    });
  }
})();