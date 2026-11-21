// ============================================================
// scripts/screens/guildHallController.js — Dynamic rendering + Analytics + Gamification
// KelolaRacun
// ============================================================

import { initApp, showToast } from '../app.js';
import { getGuild, updateGuild } from '../services/guildService.js';
import { getPouches, createPouch } from '../services/pouchService.js';
import { getTransactions, addTransaction, deleteTransaction } from '../services/transactionService.js';
import { getBills, addBill, deleteBill, voidBillPayment } from '../services/billService.js';
import { openPayBillModal, setupPayBillForm } from '../core/payBill.js';
import { getCategories, createCategory, deleteCategory } from '../services/categoryService.js';
import { getBudgets, setBudgetBase, deleteBudget, monthKey, monthSpending, copyMonth, applyCarry, shiftMonth, getMonthView, pruneOrphans } from '../services/budgetService.js';
import { generateBudgetSuggestions } from '../services/budgetAdvisor.js';

import { subscribe } from '../core/eventBus.js';
import {
  formatRupiah, relativeDate, validateTransactionForm,
  openModal, closeModal, setupModalClose, escapeHtml, TYPE_META, POUCH_TYPE_META,
  setSimpleOn
} from '../core/helpers.js';
import {
  getState, getLevelInfo, getAchievements
} from '../core/gamification.js';
import { exportBackup, downloadBackup, restoreBackup, resetAllData } from '../core/backupService.js';
import { computeHealthScore } from '../core/healthScore.js';
import { requireAuth, syncSessionRole, requireAdmin, requireMember, getCurrentMember, canEdit, canManageGuild, canManageCategories, canManageMembers, canBackup } from '../core/authService.js';
import { isAllowedMemberId, getMembersByGuild, getMember, createMember, updateMember, deleteMember } from '../services/memberService.js';

let chartInstances = {};

// ---- Auto-backup mingguan ----
function scheduleAutoBackup() {
  try {
    const last = localStorage.getItem('ffh-backup-last');
    if (last && Date.now() - Number(last) < 7 * 86400000) return;
    window.setTimeout(async () => {
      try {
        const data = await exportBackup();
        localStorage.setItem('ffh-backup-latest', JSON.stringify(data));
        localStorage.setItem('ffh-backup-last', String(Date.now()));
      } catch {}
    }, 5000);
  } catch {}
}

// ---- Init & Data Fetch ----
async function fetchAll() {
  const [guild, pouches, transactions, bills, state] = await Promise.all([
    getGuild(),
    getPouches(),
    getTransactions(),
    getBills(),
    getState()
  ]);
  return { guild, pouches, transactions, bills, state };
}

function parseAmount(raw) {
  const cleaned = String(raw ?? '').replace(/[^0-9]/g, '');
  return cleaned ? Number(cleaned) : NaN;
}

function toLocalISO(dateValue) {
  if (!dateValue) return new Date().toISOString();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0).toISOString();
  return new Date(dateValue).toISOString();
}

// ---- Render Helpers ----
async function renderGuildBanner({ guild, pouches, state }) {
  const totalGold = (pouches || []).reduce((sum, p) => sum + (p.balance || 0), 0);
  document.querySelectorAll('.guild-banner__gold').forEach(el => {
    el.textContent = formatRupiah(totalGold);
  });
  const nameEl = document.querySelector('.guild-banner__title');
  if (nameEl) nameEl.textContent = `${guild?.familyName || 'Guild Baru'}`;
  const avatarEl = document.getElementById('guildAvatar');
  if (avatarEl && guild?.guildAvatar) avatarEl.textContent = guild.guildAvatar;
  const mottoEl = document.getElementById('guildMotto');
  if (mottoEl && guild) mottoEl.textContent = guild.guildMotto || 'Guild Hall Utama';

  const level = state?.level || 1;
  document.querySelectorAll('.guild-level').forEach((el) => {
    el.textContent = `Lv. ${level}`;
  });
  if (guild && guild.guildLevel !== level) {
    try { await updateGuild({ guildLevel: level }); } catch {}
  }
}

function renderGamification(state) {
  if (!state) return;
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

function renderHealthScore(health) {
  const scoreEl = document.getElementById('hsScore');
  const badgeEl = document.getElementById('hsBadge');
  const adviceEl = document.getElementById('hsAdvice') || createHealthAdvice();
  if (adviceEl) adviceEl.textContent = health.narrative || '';
  const els = {
    hsSavings: health.savingsRatio + '%',
    hsEmergency: health.emergencyFundMonths + ' Bulan',
    hsDebt: health.debtRatio + '%',
    hsBudget: health.budgetDiscipline + '%'
  };
  for (const [id, val] of Object.entries(els)) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
  if (scoreEl) {
    scoreEl.textContent = `${health.overall} / 100 (${health.status.label})`;
    scoreEl.className = `font-bold ${health.overall >= 75 ? 'text-income' : health.overall >= 50 ? 'text-warning' : 'text-expense'}`;
  }
  if (badgeEl) {
    badgeEl.textContent = `${health.status.icon} ${health.status.label}`;
    badgeEl.className = `badge badge--${health.status.badge}`;
  }
}

function createHealthAdvice() {
  const card = document.querySelector('.metric-grid')?.parentElement;
  if (!card) return null;
  const p = document.createElement('p');
  p.id = 'hsAdvice';
  p.className = 'text-sm mt-4 p-3 card';
  card.appendChild(p);
  return p;
}

function renderMonthlyQuest(guild, { monthIncome, monthExpense }) {
  const incomeTarget = guild?.monthlyTargetIncome || 5000000;
  const expenseTarget = guild?.monthlyTargetExpense || 3000000;

  const incPct = Math.min(100, Math.round((monthIncome / incomeTarget) * 100));
  const expPct = Math.min(100, Math.round((monthExpense / expenseTarget) * 100));

  // SVG ring: circumference approx 201
  const setRing = (ringId, pctId, pct) => {
    const ring = document.getElementById(ringId);
    const label = document.getElementById(pctId);
    if (ring) ring.setAttribute('stroke-dashoffset', String(201 - (201 * pct) / 100));
    if (label) label.textContent = pct + '%';
  };
  setRing('mqIncomeRing', 'mqIncomePct', incPct);
  setRing('mqExpenseRing', 'mqExpensePct', expPct);

  const incBar = document.getElementById('mqIncomeBar');
  const expBar = document.getElementById('mqExpenseBar');
  if (incBar) incBar.style.width = incPct + '%';
  if (expBar) expBar.style.width = expPct + '%';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('mqIncomeAmt', formatRupiah(monthIncome));
  set('mqIncomeTarget', formatRupiah(incomeTarget));
  set('mqExpenseAmt', formatRupiah(monthExpense));
  set('mqExpenseTarget', formatRupiah(expenseTarget));

  const daysLeft = Math.max(0, Math.ceil((new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) - Date.now()) / 86400000));
  set('mqIncomeFooter', `Sisa ${daysLeft} hari memenuhi target`);
  set('mqExpenseFooter', monthExpense > expenseTarget ? '⚠️ Melebihi batas taget!' : `Sisa ${daysLeft} hari`);
}

function renderRecentTransactions(transactions) {
  const container = document.querySelector('.list.transactions-list');
  if (!container) return;

  if (!transactions.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⚔️</div><p class="font-semibold">Belum ada quest tercatat</p><p class="text-sm text-tertiary">Tambah loot pertama untuk memulai petualangan guild.</p></div>';
    return;
  }

  const recent = transactions.slice(-10).reverse();
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
        <div class="list__meta flex-col items-end gap-1">
          <span class="list__amount ${meta.cls} font-bold">${sign}${amt}</span>
          <span class="list__date">${relativeDate(t.date)}</span>
          <button class="btn btn--ghost btn--danger-text tx-delete" data-tx="${escapeHtml(t.id)}">✕ Hapus</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Hapus transaksi ini? Saldo pouch dikembalikan.')) return;
      try {
        await deleteTransaction(btn.dataset.tx);
        showToast('Transaksi dihapus', 'info');
      } catch (err) {
        showToast('Gagal hapus: ' + err.message, 'danger');
      }
    });
  });
}

function renderBills(bills) {
  const container = document.querySelector('.list.bills-list');
  if (!container) return;
  const today = new Date();
  const dayNumber = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
  const pending = (bills || []).filter(b => b.status === 'Pending' || b.status === 'Partial')
    .map(b => { const due = new Date(b.dueDate); const validDue = Number.isFinite(due.getTime()); return { ...b, daysLeft: validDue ? dayNumber(due) - dayNumber(today) : Infinity, dateInvalid: !validDue }; })
    .sort((a, b) => a.daysLeft - b.daysLeft);
  const outstanding = document.getElementById('billsOutstanding');
  if (outstanding) outstanding.textContent = `Sisa kewajiban ${formatRupiah(pending.reduce((sum, b) => sum + Math.max(0, Number(b.amount) - (Number(b.paidAmount) || 0)), 0))}`;

  if (!pending.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📜</div><p class="font-semibold">Tidak ada tagihan pending</p><p class="text-sm text-tertiary">Guild bebas beban — mantap!</p></div>';
    const badgeEmpty = document.querySelector('.bills-count');
    if (badgeEmpty) badgeEmpty.textContent = 'aman';
    return;
  }

  const badge = document.querySelector('.bills-count');
  if (badge) {
    badge.textContent = `${pending.length} tagihan`;
  }

  let previousGroup = '';
  container.innerHTML = pending.map(b => {
    const daysLeft = b.daysLeft;
    const group = daysLeft < 0 ? 'Terlambat' : daysLeft <= 7 ? 'Jatuh tempo maksimal 7 hari' : 'Berikutnya';
    const heading = previousGroup !== group ? `<h4 class="hall-bill-group">${group}</h4>` : '';
    previousGroup = group;
    const date = b.dateInvalid ? 'Tanggal tidak tersedia' : new Date(b.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const dueText = `${date} · ${daysLeft < 0 ? `terlambat ${Math.abs(daysLeft)} hari` : daysLeft === 0 ? 'jatuh tempo hari ini!' : `jatuh tempo ${daysLeft} hari lagi`}`;
    const dueCls = daysLeft <= 7 ? ' bill-due--soon' : '';
    const paid = Number(b.paidAmount) || 0;
    const total = Number(b.amount) || 0;
    const remaining = Math.max(0, total - paid);
    const partialLine = b.status === 'Partial'
      ? `<div class="text-xs text-tertiary">Terbayar ${formatRupiah(paid)} / ${formatRupiah(total)}</div>
         <div class="bar-track bar-track--sm mt-1"><div class="bar-fill--income" style="width: ${total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0}%;"></div></div>`
      : `<div class="text-xs text-tertiary">${escapeHtml(b.category || '')}</div>`;
    return `
      ${heading}<div class="list__item hall-bill">
        <div class="list__icon">🧾</div>
        <div class="list__content">
          <div class="list__title">${escapeHtml(b.title)}</div>
          <div class="list__subtitle${dueCls}">${dueText}</div>
          ${partialLine}<div class="text-sm text-secondary">Total ${formatRupiah(total)} ? Terbayar ${formatRupiah(paid)}</div>
        </div>
        <div class="list__meta flex-col items-end gap-1">
          <span class="list__amount list__amount--danger font-bold">${formatRupiah(remaining)}</span>
          <button class="btn btn--primary pill-bill-paid" data-bill="${escapeHtml(b.id)}">💸 Bayar</button>
          <details class="hall-tools"><summary aria-label="Aksi lain untuk ${escapeHtml(b.title)}">Aksi lain</summary>
          ${(b.txIds || []).length ? `<button class="btn btn--ghost btn--sm-text bill-void" data-bill="${escapeHtml(b.id)}">↩ Batal lunas</button>` : ''}
          <button class="btn btn--ghost btn--danger-text bill-delete" data-bill="${escapeHtml(b.id)}">✕ Hapus</button></details>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.bill-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Hapus tagihan ini?')) return;
      try {
        await deleteBill(btn.dataset.bill);
        showToast('Tagihan dihapus', 'info');
      } catch (err) {
        showToast('Gagal hapus: ' + err.message, 'danger');
      }
    });
  });

  container.querySelectorAll('.pill-bill-paid').forEach(btn => {
    btn.addEventListener('click', () => {
      openPayBillModal(btn.dataset.bill);
    });
  });

  container.querySelectorAll('.bill-void').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Batalkan semua pembayaran tagihan ini? Saldo dikembalikan.')) return;
      try {
        await voidBillPayment(btn.dataset.bill);
        showToast('Pembayaran dibatalkan', 'info');
      } catch (err) {
        showToast('Gagal: ' + err.message, 'danger');
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
  const cssColor = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const gridColor = cssColor('--chart-grid', 'rgba(255,255,255,.14)');
  const textColor = cssColor('--color-text-primary', '#fff6d5');
  const incomeColor = cssColor('--color-income-500', '#5eead4');
  const expenseColor = cssColor('--color-expense-500', '#ff9b9f');
  const goldColor = cssColor('--color-gold-500', '#ffcc66');
  const blueColor = cssColor('--color-blue-500', '#65d9ff');
  Chart.defaults.color = textColor;
  Chart.defaults.borderColor = gridColor;

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
            borderColor: incomeColor,
            backgroundColor: incomeColor,
            fill: true, tension: 0.3, borderWidth: 2
          },
          {
            label: 'Pengeluaran',
            data: months.map(m => m.expense),
            borderColor: expenseColor,
            backgroundColor: expenseColor,
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
    const palette = [expenseColor, goldColor, blueColor, incomeColor, textColor, gridColor];
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
    <div class="card p-3 text-center ${a.unlocked ? 'ach-card--unlocked' : 'ach-card--locked'}">
      <div class="text-3xl mb-2">${a.icon}</div>
      <div class="font-semibold text-sm mb-1">${escapeHtml(a.name)}</div>
      <div class="text-xs text-tertiary">${escapeHtml(a.desc)}</div>
      <span class="badge ach-badge ${a.unlocked ? 'badge--gold' : ''}">${a.unlocked ? '✅ Terbuka' : '🔒 Terkunci'}</span>
    </div>
  `).join('');
}

function notifyAchievements(achievements) {
  if (isQuiet()) return;
  achievements.forEach(a => {
    showToast(`${a.icon} Achievement Terbuka: ${a.name}!`, 'success');
  });
}

function notifyLevelUp(level) {
  if (isQuiet()) return;
  showToast(`🎉 Guild naik ke Level ${level}!`, 'warning');
}

function isQuiet() {
  try {
    return JSON.parse(localStorage.getItem('ffh-prefs') || '{}').quiet === 'on';
  } catch { return false; }
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

function budgetStatus(spent, limit) {
  if (!limit || limit <= 0) return { pct: 0, label: 'Tanpa batas', cls: '' };
  const pct = Math.min(100, Math.round((spent / limit) * 100));
  if (spent > limit) return { pct: 100, label: `Lewat ${formatRupiah(spent - limit)}`, cls: 'text-expense' };
  if (pct >= 80) return { pct, label: `Sisa ${formatRupiah(limit - spent)}`, cls: 'bill-due--soon' };
  return { pct, label: `Sisa ${formatRupiah(limit - spent)}`, cls: 'text-income' };
}

let budgetMonth = monthKey();

function renderBudgetMonthLabel() {
  const label = document.getElementById('budgetMonthLabel');
  if (!label) return;
  try {
    const m = /^(\d{4})-(\d{2})$/.exec(budgetMonth);
    const d = new Date(+m[1], +m[2] - 1, 1);
    label.textContent = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  } catch {
    label.textContent = budgetMonth;
  }
}

async function renderBudgetCard(transactions) {
  const box = document.getElementById('budgetCatList');
  if (!box) return;
  renderBudgetMonthLabel();
  const month = budgetMonth;
  const [cats, view] = await Promise.all([getCategories(), getMonthView(month, transactions)]);
  const finite = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const rows = (view || [])
    .map((b) => {
      const cat = cats.find((c) => c.id === b.categoryId) || { id: b.categoryId, name: b.categoryName || 'Kategori', icon: '🏷️', type: 'Expense' };
      const amount = finite(b.amount);
      if ((cat.type && cat.type !== 'Expense') || amount <= 0) return null;
      const name = cat.name || b.categoryName;
      return { cat: { ...cat, name }, limit: amount, used: finite(b.used), carryIn: finite(b.carryIn), base: finite(b.base) };
    })
    .filter(Boolean);
  const total = rows.reduce((s, r) => s + r.limit, 0);
  const target = (window._guild?.monthlyTargetExpense) || 3000000;
  const totalTxt = document.getElementById('budgetTotalTxt');
  if (totalTxt) totalTxt.textContent = `${formatRupiah(total)} / ${formatRupiah(target)}`;
  const totalBar = document.getElementById('budgetTotalBar');
  if (totalBar) totalBar.style.width = (target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0) + '%';
  const totalNote = document.getElementById('budgetTotalNote');
  if (totalNote) {
    totalNote.textContent = total > target ? `⚠️ Total budget melebihi target global ${formatRupiah(target)}` : '';
  }
  const isPast = month < monthKey();
  const prevMonth = shiftMonth(month, -1);
  const prevBudgets = isPast ? [] : await getBudgets(prevMonth);
  const prevHasData = (prevBudgets || []).some((b) => (b.amount || 0) > 0);
  // ponytail: atur/salin/carry budget terbuka semua anggota; hapus kategori tetap Admin.
  const copyBtn = document.getElementById('budgetCopyPrev');
  if (copyBtn) {
    copyBtn.disabled = isPast || !prevHasData;
    copyBtn.title = !prevHasData ? 'Bulan lalu kosong.' : '';
    copyBtn.style.display = !rows.length && !prevHasData ? 'none' : '';
  }
  const carryBtn = document.getElementById('budgetApplyCarry');
  if (carryBtn) {
    carryBtn.disabled = isPast || !prevHasData;
    carryBtn.title = !prevHasData ? 'Bulan lalu kosong.' : '';
    carryBtn.style.display = !rows.length && !prevHasData ? 'none' : '';
  }
  if (!rows.length) {
    box.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🎯</div><p class="font-semibold">Belum ada budget bulan ini</p><p class="text-sm text-tertiary mb-4">Tentukan batas belanja per kategori agar quest terkendali.</p><div class="flex gap-2 justify-center flex-wrap"><button class="btn btn--primary" data-budget-empty-setup>🏷️ Atur Budget Pertama</button>${prevHasData ? '<button class="btn btn--secondary" data-budget-empty-copy>📋 Salin bulan lalu</button>' : ''}</div></div>`;
    box.querySelector('[data-budget-empty-setup]')?.addEventListener('click', async () => {
      if (!(await requireMember())) return;
      renderCategoryList();
      openModal('catModal');
      showToast('Isi nama + nominal per kategori Expense, lalu tambah', 'info');
    });
    box.querySelector('[data-budget-empty-copy]')?.addEventListener('click', () => {
      document.getElementById('budgetCopyPrev')?.click();
    });
    return;
  }
  const priority = r => r.used > r.limit ? 0 : r.used / r.limit >= 0.8 ? 1 : 2;
  rows.sort((a, b) => priority(a) - priority(b) || a.cat.name.localeCompare(b.cat.name, 'id'));
  box.innerHTML = rows.map(({ cat, limit, used, carryIn, base }) => {
    const st = budgetStatus(used, limit);
    const carryLine = carryIn > 0 ? `<span class="badge badge--gold">+${formatRupiah(carryIn)} carry</span>` : '';
    return `
      <div class="hall-budget-row mb-3">
        <div class="flex justify-between mb-1 flex-wrap gap-2">
          <span class="font-semibold text-sm">${escapeHtml(cat.icon || '🏷️')} ${escapeHtml(cat.name)} ${carryLine}</span>
          <strong class="${st.cls}">${st.label}</strong>
        </div>
        <div class="bar-track bar-track--sm">
          <div class="bar-fill--expense" style="width: ${st.pct}%;"></div>
        </div>
        <p class="text-secondary text-sm mt-1">${used > limit ? 'Melebihi batas' : used / limit >= 0.8 ? 'Hampir habis' : 'Masih tersedia'} · Terpakai ${formatRupiah(used)} · Batas ${formatRupiah(limit)}</p>
        <form class="hall-budget-edit" data-budget-category="${escapeHtml(cat.id)}">
          <label class="text-sm" for="budget-base-${escapeHtml(cat.id)}">Budget dasar${carryIn ? ` (di luar carry ${formatRupiah(carryIn)})` : ''}</label>
          <input class="modal__input" id="budget-base-${escapeHtml(cat.id)}" name="base" type="number" min="0" step="1" required value="${base}" ${isPast ? 'disabled' : ''}>
          <button class="btn btn--secondary" type="submit" ${isPast ? 'disabled title="Budget bulan lalu tidak dapat diubah"' : ''}>Ubah budget</button>
        </form>
      </div>`;
  }).join('');
  box.querySelectorAll('.hall-budget-edit').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!(await requireMember()) || month < monthKey()) return;
    const amount = Number(form.elements.base.value);
    if (!Number.isSafeInteger(amount) || amount < 0) { showToast('Isi nominal rupiah bulat yang valid', 'danger'); return; }
    const row = rows.find(r => r.cat.id === form.dataset.budgetCategory);
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await setBudgetBase(row.cat.id, month, amount, row.cat.name);
      const fresh = await fetchAll();
      await renderBudgetCard(fresh.transactions);
      renderCategoryList();
      showToast('Budget diperbarui', 'success');
    } catch (err) { showToast('Gagal mengubah budget: ' + err.message, 'danger'); }
    finally { button.disabled = false; }
  }));
}

async function showBudgetSuggestions() {
  const modal = document.getElementById('budgetAiModal');
  const list = document.getElementById('budgetAiList');
  const all = document.getElementById('budgetAiApplyAll');
  const status = document.getElementById('budgetAiStatus');
  const trigger = document.getElementById('budgetAiSuggest');
  if (!modal || !list || !all || !status) return;
  if (trigger?.disabled) return;
  if (trigger) trigger.disabled = true;
  all.disabled = true;
  all.onclick = null;
  status.textContent = 'Menyiapkan saran…';
  list.setAttribute('aria-busy', 'true');
  list.innerHTML = '<div class="budget-ai__empty"><span class="budget-ai__spinner" aria-hidden="true"></span><h4>Menganalisis pengeluaranmu</h4><p>Saran budget sedang disiapkan. Tunggu sebentar.</p></div>';
  modal.classList.add('modal--open');
  document.body.classList.add('modal-open');
  modal.querySelector('.modal__close')?.focus();
  try {
    const fresh = await fetchAll();
    const budgets = await getBudgets(budgetMonth);
    const suggestions = generateBudgetSuggestions(budgetMonth, fresh.transactions, budgets, await getCategories());
    const eligible = suggestions.filter(s => s.applicable !== false && s.categoryId);
    if (!suggestions.length) {
      list.innerHTML = '<div class="budget-ai__empty"><h4>Belum ada saran untuk bulan ini</h4><p>Catat transaksi pengeluaran beserta kategorinya, lalu buka Saran AI lagi setelah ada riwayat pengeluaran.</p></div>';
    } else list.innerHTML = suggestions.map((s, i) => {
      const confidence = s.confidence > 0.8 ? ['success', 'Yakin'] : s.confidence >= 0.7 ? ['warning', 'Cukup yakin'] : ['neutral', 'Perkiraan'];
      const delta = s.suggestedBudget - s.currentBudget;
      const available = s.applicable !== false && Boolean(s.categoryId);
      return `<article class="budget-ai__card" data-ai-index="${i}">
        <div class="budget-ai__heading"><h4>${escapeHtml(s.categoryName)}</h4><span class="badge badge--${confidence[0]}">${confidence[1]} <small>· ${Math.round(s.confidence * 100)}%</small></span></div>
        <div class="budget-ai__amounts"><div><span class="budget-ai__label">Saran per bulan</span><strong class="budget-ai__amount">${formatRupiah(s.suggestedBudget)}</strong></div><div><span class="budget-ai__label">Budget saat ini</span><span class="budget-ai__previous">${formatRupiah(s.currentBudget)}</span></div></div>
        <p class="budget-ai__delta budget-ai__delta--${delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'}">${delta > 0 ? '↑ Naik ' : delta < 0 ? '↓ Turun ' : 'Tidak berubah'}${delta ? formatRupiah(Math.abs(delta)) : ''}</p>
        <p class="budget-ai__reason">${escapeHtml(s.reasoning)}</p>
        <div class="budget-ai__action">${available ? `<button type="button" class="btn btn--secondary budget-ai-apply" data-index="${i}" aria-label="Terapkan saran untuk ${escapeHtml(s.categoryName)}">Terapkan saran ini</button>` : '<span class="budget-ai__unavailable" aria-disabled="true" title="Kategori belum tersedia">Kategori belum tersedia</span>'}</div>
      </article>`;
    }).join('');
    status.textContent = eligible.length ? `${eligible.length} saran siap diterapkan. Kamu tetap bisa mengubah budget nanti.` : 'Belum ada saran yang bisa diterapkan.';
    all.textContent = `Terapkan semua saran${eligible.length ? ` (${eligible.length})` : ''}`;
    all.disabled = !eligible.length;
    const apply = async (items, button) => {
      const buttons = [...list.querySelectorAll('.budget-ai-apply'), all];
      buttons.forEach(b => { b.disabled = true; });
      const label = button.textContent;
      button.textContent = 'Menerapkan…';
      button.classList.add('budget-ai__busy');
      status.textContent = 'Menyimpan budget. Tunggu sebentar…';
      try {
        for (const s of items) if (s.categoryId) await setBudgetBase(s.categoryId, budgetMonth, s.suggestedBudget, s.categoryName);
        const updated = await fetchAll();
        renderBudgetCard(updated.transactions);
        renderCategoryList();
        showToast('Budget AI diterapkan', 'success');
        closeModal('budgetAiModal');
      } catch (err) {
        status.textContent = 'Budget belum selesai diterapkan. Coba lagi.';
        showToast('Gagal menerapkan saran AI: ' + err.message, 'danger');
      } finally {
        buttons.forEach(b => { b.disabled = false; });
        button.textContent = label;
        button.classList.remove('budget-ai__busy');
      }
    };
    list.querySelectorAll('.budget-ai-apply').forEach(btn => btn.addEventListener('click', () => apply([suggestions[Number(btn.dataset.index)]], btn)));
    all.onclick = () => apply(eligible, all);
  } catch (err) {
    list.innerHTML = '<div class="budget-ai__empty"><h4>Saran belum bisa dimuat</h4><p>Tutup panel ini, lalu buka Saran AI untuk mencoba lagi.</p></div>';
    status.textContent = 'Tidak ada budget yang diubah.';
    showToast('Gagal memuat saran AI: ' + err.message, 'danger');
  } finally {
    list.setAttribute('aria-busy', 'false');
    if (trigger) trigger.disabled = false;
  }
}

function setupBudgetNav() {
  const ai = document.getElementById('budgetAiSuggest');
  if (ai && !ai.dataset.bound) { ai.dataset.bound = 'true'; ai.addEventListener('click', showBudgetSuggestions); }
  const prev = document.getElementById('budgetPrevMonth');
  if (prev && !prev.dataset.bound) {
    prev.dataset.bound = 'true';
    prev.addEventListener('click', async () => {
      try {
        budgetMonth = shiftMonth(budgetMonth, -1);
        const fresh = await fetchAll();
        renderBudgetCard(fresh.transactions);
        renderCategoryList();
      } catch (err) { showToast('Bulan tidak valid', 'danger'); }
    });
  }
  const next = document.getElementById('budgetNextMonth');
  if (next && !next.dataset.bound) {
    next.dataset.bound = 'true';
    next.addEventListener('click', async () => {
      try {
        budgetMonth = shiftMonth(budgetMonth, 1);
        const fresh = await fetchAll();
        renderBudgetCard(fresh.transactions);
        renderCategoryList();
      } catch (err) { showToast('Bulan tidak valid', 'danger'); }
    });
  }
  const copy = document.getElementById('budgetCopyPrev');
  if (copy && !copy.dataset.bound) {
    copy.dataset.bound = 'true';
    copy.addEventListener('click', async () => {
      if (!(await requireMember())) return;
      try {
        const month = budgetMonth;
        const [source, destination] = await Promise.all([getBudgets(shiftMonth(month, -1)), getBudgets(month)]);
        const candidates = source.filter(b => b.base > 0 && !destination.some(d => d.categoryId === b.categoryId && d.base > 0));
        if (!confirm(`Salin ke ${month}: ${candidates.length} kategori, total budget dasar ${formatRupiah(candidates.reduce((sum, b) => sum + b.base, 0))}. Budget dasar yang sudah terisi tidak ditimpa. Lanjutkan?`)) return;
        const n = await copyMonth(shiftMonth(month, -1), month);
        showToast(n ? `Disalin ${n} budget dari bulan lalu` : 'Bulan lalu kosong / sudah terisi', 'success');
        const fresh = await fetchAll();
        renderBudgetCard(fresh.transactions);
        renderCategoryList();
      } catch (err) { showToast('Gagal salin: ' + err.message, 'danger'); }
    });
  }
  const carry = document.getElementById('budgetApplyCarry');
  if (carry && !carry.dataset.bound) {
    carry.dataset.bound = 'true';
    carry.addEventListener('click', async () => {
      if (!(await requireMember())) return;
      try {
        const month = budgetMonth;
        const freshPreview = await fetchAll();
        const source = await getMonthView(shiftMonth(month, -1), freshPreview.transactions);
        const candidates = source.filter(b => b.amount > b.used);
        if (!confirm(`Terapkan sisa ke ${month}: ${candidates.length} kategori, total ${formatRupiah(candidates.reduce((sum, b) => sum + b.amount - b.used, 0))}. Nilai carry kategori terkait diganti, bukan ditambahkan; budget dasar tetap. Lanjutkan?`)) return;
        const n = await applyCarry(shiftMonth(month, -1), month);
        showToast(n ? `Carry diterapkan ke ${n} kategori` : 'Tidak ada sisa bulan lalu', 'success');
        const fresh = await fetchAll();
        renderBudgetCard(fresh.transactions);
        renderCategoryList();
      } catch (err) { showToast('Gagal carry: ' + err.message, 'danger'); }
    });
  }
}

async function checkBudgetWarning(category, amount) {
  if (!category || !Number.isFinite(amount) || amount <= 0) return;
  try {
    const cats = await getCategories();
    const cat = cats.find((c) => c.name === category);
    if (!cat || (cat.type && cat.type !== 'Expense')) return;
    const month = monthKey();
    const budgets = await getBudgets(month);
    const b = budgets.find((x) => x.categoryId === cat.id);
    if (!b || !b.amount || b.amount <= 0) return;
    const txs = await getTransactions();
    const spent = (await monthSpending(txs, month))[category] || 0;
    const projected = spent + amount;
    if (projected > b.amount) {
      showToast(`⚠️ ${category} lewat budget (${formatRupiah(projected)} / ${formatRupiah(b.amount)})`, 'warning');
    } else if (projected >= b.amount * 0.8) {
      showToast(`🔔 ${category} menyentuh 80% budget (${formatRupiah(projected)} / ${formatRupiah(b.amount)})`, 'warning');
    }
  } catch {}
}

async function renderCategoryList() {
  const list = document.getElementById('catList');
  if (!list) return;
  const month = budgetMonth;
  let [cats, budgets, txs] = await Promise.all([getCategories(), getBudgets(month), getTransactions()]);
  try {
    await pruneOrphans(cats.map((c) => c.name));
    budgets = await getBudgets(month);
  } catch {}
  const spent = await monthSpending(txs, month);
  // ponytail: isi/ubah budget terbuka semua anggota; hapus kategori tetap Admin.
  const delTitle = ' title="Hapus kategori khusus Admin."';
  const byCatId = {};
  (budgets || []).forEach((b) => { byCatId[b.categoryId] = b.amount; });
  list.innerHTML = cats.map(c => {
    const limit = byCatId[c.id] || 0;
    const used = spent[c.name] || 0;
    const st = budgetStatus(used, limit);
    const budgetLine = c.type === 'Expense'
      ? `<div class="text-xs ${st.cls}">${limit > 0 ? `${formatRupiah(used)} / ${formatRupiah(limit)} · ${st.label}` : 'Tanpa budget'}</div>
          <div class="flex gap-1 mt-1">
            <input type="number" class="modal__input cat-budget-input" data-cat="${escapeHtml(c.id)}" min="0" step="1" inputmode="numeric" placeholder="Budget Rp" value="${limit > 0 ? limit : ''}" aria-label="Budget ${escapeHtml(c.name)}">
            <button class="btn btn--ghost btn--sm-text cat-budget-save" data-cat="${escapeHtml(c.id)}">💾</button>
          </div>`
      : `<div class="list__subtitle">${c.type === 'Income' ? 'Pemasukan' : 'Pengeluaran'}</div>`;
    return `
    <div class="list__item p-2 row-item">
      <div class="list__icon">${escapeHtml(c.icon || '🏷️')}</div>
      <div class="list__content">
        <div class="list__title font-semibold">${escapeHtml(c.name)}</div>
        ${budgetLine}
      </div>
      <button class="btn btn--ghost btn--danger-text cat-delete" data-cat="${escapeHtml(c.id)}" data-name="${escapeHtml(c.name)}"${delTitle}>✕</button>
    </div>`;
  }).join('');

  list.querySelectorAll('.cat-budget-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!(await requireMember())) return;
      const input = list.querySelector(`.cat-budget-input[data-cat="${btn.dataset.cat}"]`);
      const amt = parseAmount(input?.value);
      try {
        const catsNow = await getCategories();
        const catName = catsNow.find((c) => c.id === btn.dataset.cat)?.name || '';
        if (!Number.isFinite(amt) || amt <= 0) {
          await deleteBudget(btn.dataset.cat, budgetMonth);
          showToast('Budget dihapus (tanpa batas)', 'info');
        } else {
          await setBudgetBase(btn.dataset.cat, budgetMonth, amt, catName);
          showToast('Budget disimpan! 🎯', 'success');
        }
        renderCategoryList();
        const fresh = await fetchAll();
        renderBudgetCard(fresh.transactions);
      } catch (err) {
        showToast('Gagal simpan budget: ' + err.message, 'danger');
      }
    });
  });

  list.querySelectorAll('.cat-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!(await requireAdmin('mengelola kategori'))) return;
      try {
        const txsNow = await getTransactions();
        const used = txsNow.some((t) => t.category === btn.dataset.name);
        if (used) {
          showToast('Kategori dipakai transaksi — hapus dibatalkan', 'danger');
          return;
        }
        const m = budgetMonth;
        const budgetsNow = await getBudgets(m);
        const hasBudget = budgetsNow.some((b) => b.categoryId === btn.dataset.cat && b.amount > 0);
        if (hasBudget && !confirm(`"${btn.dataset.name}" punya budget aktif bulan ini. Tetap hapus kategori + budget?`)) return;
        if (hasBudget) await deleteBudget(btn.dataset.cat, m);
        await deleteCategory(btn.dataset.cat);
        showToast('Kategori dihapus', 'info');
        renderCategoryList();
        const fresh = await fetchAll();
        renderBudgetCard(fresh.transactions);
      } catch (err) {
        showToast('Gagal hapus: ' + err.message, 'danger');
      }
    });
  });
}

async function openSettings(tab) {
  await fillSettingsForms();
  switchSettingsTab(tab || 'guild');
  openModal('settingsModal');
}

function setupQuestModalForm() {
  const btn = document.getElementById('btnEditQuest');
  const form = document.getElementById('questModalForm');
  if (btn && !btn.dataset.settingsBound) {
    btn.dataset.settingsBound = 'true';
    btn.addEventListener('click', () => openSettings('quest'));
  }
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const targetIncome = parseAmount(form.questIncome.value);
    const targetExpense = parseAmount(form.questExpense.value);
    try {
      await updateGuild({
        monthlyTargetIncome: Number.isFinite(targetIncome) ? targetIncome : 5000000,
        monthlyTargetExpense: Number.isFinite(targetExpense) ? targetExpense : 3000000
      });
      showToast('Target quest diperbarui! 🎯', 'success');
      closeModal('questModal');
    } catch (err) {
      showToast('Gagal update target: ' + err.message, 'danger');
    }
  });
}

function setupCategoryModal() {
  const form = document.getElementById('catForm');
  if (form && !form.dataset.bound) {
    form.dataset.bound = 'true';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!(await requireMember())) return;
      try {
        const name = form.catName.value.trim();
        if (!name) { showToast('Nama kategori wajib diisi', 'danger'); return; }
        const cats = await getCategories();
        if (cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
          showToast('Nama kategori sudah ada', 'danger');
          return;
        }
        const saved = await createCategory({
          name,
          icon: form.catIcon.value || '🏷️',
          type: form.catType.value
        });
        const budgetAmt = parseAmount(form.catBudget?.value);
        if (form.catType.value === 'Expense' && Number.isFinite(budgetAmt) && budgetAmt > 0) {
          await setBudgetBase(saved.id, budgetMonth, budgetAmt, saved.name);
        }
        showToast('Kategori ditambahkan! 🏷️', 'success');
        form.reset();
        renderCategoryList();
        const fresh = await fetchAll();
        renderBudgetCard(fresh.transactions);
      } catch (err) {
        showToast('Gagal tambah kategori: ' + err.message, 'danger');
      }
    });
  }

  const typeSel = document.getElementById('catType');
  const budgetWrap = document.getElementById('catBudgetWrap');
  if (typeSel && budgetWrap && !typeSel.dataset.budgetBound) {
    typeSel.dataset.budgetBound = 'true';
    const sync = () => { budgetWrap.hidden = typeSel.value !== 'Expense'; };
    typeSel.addEventListener('change', sync);
    sync();
  }
}

// ---- Role-based UI gating ----
function applyRoleGating() {
  const editable = canEdit();
  const manageGuild = canManageGuild();
  const manageCats = canManageCategories();
  const backup = canBackup();
  const manageMembers = canManageMembers();

  // Restore-first gating + show-first untuk Kelola Kategori:
  // tombol selalu tampil agar sesi basi tak terkunci permanen;
  // penolakan ketat di handler klik (sync-first via requireAdmin).
  const toggleDisplay = (sel, visible) => {
    document.querySelectorAll(sel).forEach((el) => { el.style.display = visible ? '' : 'none'; });
  };
  toggleDisplay('[data-open-modal="txModal"]', editable);
  toggleDisplay('[data-open-modal="pouchModal"]', editable);
  toggleDisplay('[data-open-modal="billModal"]', editable);
  toggleDisplay('.pill-bill-paid', editable);
  toggleDisplay('.tx-delete', editable);
  toggleDisplay('.bill-delete', editable);
  toggleDisplay('.bill-void', editable);
  // Co-Manager: tidak boleh atur target, backup/restore
  const bq = document.getElementById('btnEditQuest');
  if (bq) bq.style.display = manageGuild ? '' : 'none';
  document.querySelectorAll('[data-open-modal="catModal"]').forEach(el => {
    el.style.display = '';
    el.title = 'Tambah kategori terbuka untuk semua anggota. Ubah/hapus budget khusus Admin.';
  });
  const bb = document.getElementById('btnBackup');
  if (bb) bb.style.display = backup ? '' : 'none';
  if (!manageMembers) {
    document.querySelectorAll('.member-manage-btn').forEach(el => {
      el.disabled = true;
      el.title = 'Hanya Admin yang dapat menambah anggota. Login sebagai Admin.';
      el.style.opacity = '0.5';
      el.style.cursor = 'not-allowed';
    });
  }
}

// Logout di-wire terpusat via scripts/ui.js [data-logout]. ponytail: hapus helper lokal, markup header sudah bawa tombol logout.

// ---- Settings Modal (5 tab) ----
function getPrefs() {
  try {
    return { notif: 'on', simple: 'on', quiet: 'off', defaultPouchId: '', ...(JSON.parse(localStorage.getItem('ffh-prefs') || '{}')) };
  } catch { return { notif: 'on', simple: 'on', quiet: 'off', defaultPouchId: '' }; }
}

function setPrefs(patch) {
  localStorage.setItem('ffh-prefs', JSON.stringify({ ...getPrefs(), ...patch }));
}

function switchSettingsTab(name) {
  const tab = document.querySelector(`.settings-tab[data-settings-tab="${name}"]`);
  if (tab && tab.hidden) name = firstVisibleSettingsTab();
  document.querySelectorAll('.settings-tab').forEach((t) => {
    t.classList.toggle('settings-tab--active', t.dataset.settingsTab === name);
  });
  document.querySelectorAll('.settings-pane').forEach((p) => {
    p.classList.toggle('settings-pane--active', p.id === `pane-${name}` && !p.hidden);
  });
}

async function fillSettingsForms() {
  const showGuild = !document.getElementById('pane-guild')?.hidden;
  const showQuest = !document.getElementById('pane-quest')?.hidden;
  const showMembers = !document.getElementById('pane-members')?.hidden;
  const guild = (showGuild || showQuest) ? (window._guild || await getGuild()) : null;
  const gn = document.getElementById('setGuildName');
  if (gn && guild) gn.value = guild.familyName || '';
  const ga = document.getElementById('setGuildAvatar');
  if (ga && guild) ga.value = guild.guildAvatar || '👑';
  const gm = document.getElementById('setGuildMotto');
  if (gm && guild) gm.value = guild.guildMotto || '';
  const qi = document.getElementById('setQuestIncome');
  if (qi && guild) qi.value = guild.monthlyTargetIncome || 5000000;
  const qe = document.getElementById('setQuestExpense');
  if (qe && guild) qe.value = guild.monthlyTargetExpense || 3000000;
  const pouches = await getPouches();
  const pref = getPrefs();
  const ps = document.getElementById('prefPouch');
  if (ps) {
    ps.innerHTML = '<option value="">Otomatis (pouch pertama)</option>' +
      pouches.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
    if (pref.defaultPouchId && pouches.some((p) => p.id === pref.defaultPouchId)) ps.value = pref.defaultPouchId;
  }
  const pn = document.getElementById('prefNotif');
  if (pn) pn.value = pref.notif === 'off' ? 'off' : 'on';
  const simpleSelect = document.getElementById('prefSimple');
  if (simpleSelect) simpleSelect.value = pref.simple === 'off' ? 'off' : 'on';
  const pq = document.getElementById('prefQuiet');
  if (pq) pq.value = pref.quiet === 'on' ? 'on' : 'off';
  await renderProfilePane();
  if (showMembers) await renderSettingsMembers();
}

async function renderProfilePane() {
  const cur = getCurrentMember();
  const info = document.getElementById('profileInfo');
  if (!cur) {
    if (info) info.textContent = 'Sesi berakhir. Silakan login ulang.';
    return;
  }
  const m = await getMember(cur.memberId);
  if (!m) {
    if (info) info.textContent = 'Anggota tidak ditemukan.';
    return;
  }
  if (info) info.textContent = `${m.name} · ${m.role}`;
  const nameInput = document.getElementById('profileName');
  if (nameInput && document.activeElement !== nameInput) nameInput.value = m.name;
}

async function renderSettingsMembers() {
  const list = document.getElementById('settingsMemberList');
  if (!list) return;
  const guildId = getCurrentMember()?.guildId;
  if (!guildId) {
    list.innerHTML = '<p class="text-tertiary text-sm p-4">Sesi berakhir. Silakan login ulang.</p>';
    return;
  }
  const members = await getMembersByGuild(guildId, false);
  const current = getCurrentMember();
  list.replaceChildren();
  function append(parent, tag, className, text = '') {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    parent.append(node);
    return node;
  }
  for (const m of members) {
    const active = m.active !== false;
    const self = m.id === current?.memberId;
    const row = append(list, 'div', `list__item p-2 row-item${active ? '' : ' member-row--inactive'}`);
    append(row, 'div', 'list__icon', m.role === 'Admin' ? '👑' : m.role === 'Co-Manager' ? '🧙' : '👀');
    const content = append(row, 'div', 'list__content');
    append(content, 'div', 'list__title font-semibold', `${m.name}${self ? ' (Anda)' : ''}`);
    append(content, 'div', 'list__subtitle', `${m.role} • ${active ? 'Aktif' : 'Nonaktif'}`);
    if (self || isAllowedMemberId(m.id) || !canManageMembers()) continue;
    const meta = append(row, 'div', 'list__meta flex-col items-end gap-1');
    const role = append(meta, 'select', 'modal__select btn--sm-text setmem-role');
    role.setAttribute('aria-label', `Role ${m.name}`);
    role.dataset.id = m.id;
    for (const r of ['Admin', 'Member', 'Co-Manager', 'Viewer']) role.add(new Option(r, r, false, r === m.role));
    const actions = append(meta, 'div', 'flex gap-1');
    const toggle = append(actions, 'button', 'btn btn--ghost btn--sm-text setmem-toggle', active ? 'Nonaktifkan' : 'Aktifkan');
    toggle.dataset.id = m.id;
    toggle.dataset.active = active ? '1' : '0';
    const del = append(actions, 'button', 'btn btn--ghost btn--danger-text setmem-delete', 'Hapus');
    del.dataset.id = m.id;
    del.dataset.name = m.name;
  }

  list.querySelectorAll('.setmem-role').forEach((sel) => {
    sel.addEventListener('change', async () => {
      if (!canManageMembers()) { showToast('Hanya Admin.', 'danger'); return; }
      try {
        const all = await getMembersByGuild(guildId);
        const target = all.find((x) => x.id === sel.dataset.id);
        if (!target) return;
        if (target.role === 'Admin' && sel.value !== 'Admin') {
          const admins = all.filter((x) => x.role === 'Admin' && x.active !== false);
          if (admins.length <= 1) { showToast('Minimal 1 Admin aktif harus tersisa', 'danger'); sel.value = 'Admin'; return; }
        }
        await updateMember(sel.dataset.id, { role: sel.value });
        showToast('Role diperbarui', 'success');
        renderSettingsMembers();
      } catch (err) { showToast('Gagal update role: ' + err.message, 'danger'); }
    });
  });

  list.querySelectorAll('.setmem-toggle').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!canManageMembers()) { showToast('Hanya Admin.', 'danger'); return; }
      try {
        const makeActive = btn.dataset.active !== '1';
        if (!makeActive) {
          const all = await getMembersByGuild(guildId);
          const target = all.find((x) => x.id === btn.dataset.id);
          if (target && target.role === 'Admin') {
            const admins = all.filter((x) => x.role === 'Admin' && x.active !== false);
            if (admins.length <= 1) { showToast('Minimal 1 Admin aktif harus tersisa', 'danger'); return; }
          }
        }
        await updateMember(btn.dataset.id, { active: makeActive });
        showToast(makeActive ? 'Anggota diaktifkan' : 'Anggota dinonaktifkan', 'info');
        renderSettingsMembers();
      } catch (err) { showToast('Gagal: ' + err.message, 'danger'); }
    });
  });

  list.querySelectorAll('.setmem-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!canManageMembers()) { showToast('Hanya Admin.', 'danger'); return; }
      try {
        const all = await getMembersByGuild(guildId);
        const target = all.find((x) => x.id === btn.dataset.id);
        if (target && target.role === 'Admin') {
          const admins = all.filter((x) => x.role === 'Admin' && x.active !== false);
          if (admins.length <= 1) { showToast('Minimal 1 Admin aktif harus tersisa', 'danger'); return; }
        }
        if (!confirm(`Hapus anggota "${btn.dataset.name}"? Data transaksinya tetap tersimpan.`)) return;
        await deleteMember(btn.dataset.id);
        showToast('Anggota dihapus', 'info');
        renderSettingsMembers();
      } catch (err) { showToast('Gagal hapus: ' + err.message, 'danger'); }
    });
  });
}

function setupSettings() {
  document.querySelectorAll('.settings-tab').forEach((t) => {
    if (t.dataset.bound) return;
    t.dataset.bound = 'true';
    t.addEventListener('click', () => switchSettingsTab(t.dataset.settingsTab));
  });

  const openBtn = document.getElementById('btnSettings');
  if (openBtn && !openBtn.dataset.fillBound) {
    openBtn.dataset.fillBound = 'true';
    openBtn.addEventListener('click', async () => {
      await fillSettingsForms();
      applySettingsGating();
      switchSettingsTab(canManageGuild() ? 'guild' : 'profile');
    });
  }

  const manageBtn = document.getElementById('btnManageMembers');
  if (manageBtn && !manageBtn.dataset.settingsBound) {
    manageBtn.dataset.settingsBound = 'true';
    manageBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await openSettings('members');
    });
  }

  const guildForm = document.getElementById('settingsGuildForm');
  if (guildForm && !guildForm.dataset.bound) {
    guildForm.dataset.bound = 'true';
    guildForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!canManageGuild()) { showToast('Hanya Admin.', 'danger'); return; }
      const name = guildForm.guildName.value.trim();
      if (name.length < 3 || name.length > 50) { showToast('Nama guild 3-50 karakter', 'danger'); return; }
      try {
        await updateGuild({
          familyName: name,
          guildAvatar: guildForm.guildAvatar.value.trim() || '👑',
          guildMotto: guildForm.guildMotto.value.trim()
        });
        showToast('Guild diperbarui! 🏰', 'success');
      } catch (err) { showToast('Gagal: ' + err.message, 'danger'); }
    });
  }

  const questForm = document.getElementById('settingsQuestForm');
  if (questForm && !questForm.dataset.bound) {
    questForm.dataset.bound = 'true';
    questForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!canManageGuild()) { showToast('Hanya Admin.', 'danger'); return; }
      const inc = parseAmount(questForm.questIncome.value);
      const exp = parseAmount(questForm.questExpense.value);
      if (!Number.isFinite(inc) || inc <= 0 || !Number.isFinite(exp) || exp <= 0) {
        showToast('Target harus lebih dari 0', 'danger');
        return;
      }
      try {
        await updateGuild({ monthlyTargetIncome: inc, monthlyTargetExpense: exp });
        showToast('Target quest diperbarui! 🎯', 'success');
      } catch (err) { showToast('Gagal update target: ' + err.message, 'danger'); }
    });
  }

  const memForm = document.getElementById('settingsMemberForm');
  if (memForm && !memForm.dataset.bound) {
    memForm.dataset.bound = 'true';
    memForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!canManageMembers()) { showToast('Hanya Admin.', 'danger'); return; }
      const name = memForm.memName.value.trim();
      const role = memForm.memRole.value;
      if (!name) { showToast('Nama wajib diisi', 'danger'); return; }
      const guildId = getCurrentMember()?.guildId;
      if (!guildId) { showToast('Guild tidak ditemukan', 'danger'); return; }
      const dup = (await getMembersByGuild(guildId)).some((m) => m.name.toLowerCase() === name.toLowerCase());
      if (dup) { showToast('Nama sudah dipakai anggota lain', 'danger'); return; }
      try {
        await createMember({ name, role, guildId });
        showToast('Anggota ditambahkan! 👥', 'success');
        memForm.reset();
        renderSettingsMembers();
      } catch (err) { showToast('Gagal tambah anggota: ' + err.message, 'danger'); }
    });
  }

  const nameForm = document.getElementById('profileNameForm');
  if (nameForm && !nameForm.dataset.bound) {
    nameForm.dataset.bound = 'true';
    nameForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = getCurrentMember();
      if (!cur) { showToast('Sesi berakhir. Silakan login ulang.', 'danger'); return; }
      const name = nameForm.profileName.value.trim();
      if (name.length < 2 || name.length > 30) { showToast('Nama 2-30 karakter', 'danger'); return; }
      const dup = (await getMembersByGuild(cur.guildId)).some((m) => m.id !== cur.memberId && m.name.toLowerCase() === name.toLowerCase());
      if (dup) { showToast('Nama sudah dipakai anggota lain', 'danger'); return; }
      try {
        await updateMember(cur.memberId, { name });
        showToast('Nama diperbarui! 🙋', 'success');
        renderProfilePane();
      } catch (err) { showToast('Gagal: ' + err.message, 'danger'); }
    });
  }


  const prefPouch = document.getElementById('prefPouch');
  if (prefPouch && !prefPouch.dataset.bound) {
    prefPouch.dataset.bound = 'true';
    prefPouch.addEventListener('change', () => {
      setPrefs({ defaultPouchId: prefPouch.value });
      showToast('Pouch default disimpan', 'info');
    });
  }

  const prefNotif = document.getElementById('prefNotif');
  if (prefNotif && !prefNotif.dataset.bound) {
    prefNotif.dataset.bound = 'true';
    prefNotif.addEventListener('change', async () => {
      setPrefs({ notif: prefNotif.value });
      if (prefNotif.value === 'on' && 'Notification' in window && Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch {}
      }
      showToast('Preferensi notifikasi disimpan', 'info');
    });
  }

  const prefQuiet = document.getElementById('prefQuiet');
  if (prefQuiet && !prefQuiet.dataset.bound) {
    prefQuiet.dataset.bound = 'true';
    prefQuiet.addEventListener('change', () => {
      setPrefs({ quiet: prefQuiet.value });
      location.reload();
    });
  }

  const prefSimple = document.getElementById('prefSimple');
  if (prefSimple && !prefSimple.dataset.bound) {
    prefSimple.dataset.bound = 'true';
    prefSimple.addEventListener('change', () => {
      setSimpleOn(prefSimple.value === 'on');
      location.reload();
    });
  }

  const dlBtn = document.getElementById('setBtnBackupDownload');
  if (dlBtn && !dlBtn.dataset.bound) {
    dlBtn.dataset.bound = 'true';
    dlBtn.addEventListener('click', async () => {
      if (!canBackup()) { showToast('Hanya Admin.', 'danger'); return; }
      try {
        const data = await exportBackup();
        downloadBackup(data);
        showToast('Backup diunduh! 📥', 'success');
      } catch (err) { showToast('Gagal backup: ' + err.message, 'error'); }
    });
  }

  const fileInput = document.getElementById('setBackupFileInput');
  if (fileInput && !fileInput.dataset.bound) {
    fileInput.dataset.bound = 'true';
    fileInput.addEventListener('change', (e) => {
      if (!canBackup()) { showToast('Hanya Admin.', 'danger'); e.target.value = ''; return; }
      window.handleBackupRestore(e);
    });
  }

  const waBtn = document.getElementById('setBtnBackupWA');
  if (waBtn && !waBtn.dataset.bound) {
    waBtn.dataset.bound = 'true';
    waBtn.addEventListener('click', async () => {
      if (!canBackup()) { showToast('Hanya Admin.', 'danger'); return; }
      try {
        const data = await exportBackup();
        const file = new File([JSON.stringify(data)], `kelolaracun-backup-${new Date().toISOString().split('T')[0]}.json`, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Backup KelolaRacun' });
        } else {
          downloadBackup(data);
          showToast('Share tidak didukung — file diunduh, kirim manual via WA', 'warning');
        }
      } catch (err) {
        if (err?.name !== 'AbortError') showToast('Gagal share: ' + err.message, 'danger');
      }
    });
  }

  scheduleAutoBackup();

  const resetBtn = document.getElementById('setBtnResetAll');
  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.dataset.bound = 'true';
    resetBtn.addEventListener('click', async () => {
      if (!canBackup()) { showToast('Hanya Admin.', 'danger'); return; }
      if (!confirm('Yakin hapus SEMUA data? Tindakan ini tidak bisa dibatalkan.')) return;
      try {
        await resetAllData();
        closeModal('settingsModal');
        showToast('Semua data direset. Muat ulang...', 'success');
        setTimeout(() => location.reload(), 1200);
      } catch (err) { showToast('Gagal reset: ' + err.message, 'danger'); }
    });
  }
}

function setPaneVisible(name, visible) {
  const tab = document.querySelector(`.settings-tab[data-settings-tab="${name}"]`);
  const pane = document.getElementById(`pane-${name}`);
  if (tab) {
    tab.hidden = !visible;
    tab.disabled = !visible;
    // ponytail: restore display agar tab kembali terlihat setelah role segar.
    if (visible) tab.style.display = '';
  }
  if (pane) {
    pane.hidden = !visible;
    if (!visible) pane.classList.remove('settings-pane--active');
  }
}

function firstVisibleSettingsTab() {
  const order = ['guild', 'quest', 'members', 'profile', 'general'];
  for (const name of order) {
    const tab = document.querySelector(`.settings-tab[data-settings-tab="${name}"]`);
    if (tab && !tab.hidden) return name;
  }
  return 'profile';
}

function applySettingsGating() {
  const manageGuild = canManageGuild();
  const manageMembers = canManageMembers();
  const canBk = canBackup();
  setPaneVisible('guild', manageGuild);
  setPaneVisible('quest', manageGuild);
  setPaneVisible('members', manageMembers);
  setPaneVisible('profile', true);
  setPaneVisible('general', true);
  const bk = document.getElementById('settingsBackupSection');
  if (bk) bk.hidden = !canBk;
  const activeTab = document.querySelector('.settings-tab--active');
  if (activeTab && activeTab.hidden) switchSettingsTab(firstVisibleSettingsTab());
}

function wireHallLinks() {
  document.querySelectorAll('[data-hall-see-all]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '../index.html';
    });
  });
}

// ---- Modal Forms ----
function populatePouchSelect(selectEl, pouches, selectedId) {
  if (!selectEl) return;
  if (!selectedId) {
    try {
      const pref = JSON.parse(localStorage.getItem('ffh-prefs') || '{}');
      if (pref.defaultPouchId && pouches.some((p) => p.id === pref.defaultPouchId)) selectedId = pref.defaultPouchId;
    } catch {}
  }
  selectEl.innerHTML = pouches.map(p => {
    const meta = POUCH_TYPE_META[p.type] || { icon: '💰' };
    const sel = p.id === selectedId ? ' selected' : '';
    return `<option value="${escapeHtml(p.id)}"${sel}>${meta.icon} ${escapeHtml(p.name)} — ${formatRupiah(p.balance)}</option>`;
  }).join('');
}

function setupTransactionModalForm(showToastFn) {
  const form = document.getElementById('txModalForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseAmount(form.amount.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToastFn('Nominal tidak valid', 'danger');
      return;
    }
    const data = {
      pouchId: form.pouchId.value,
      type: form.txType.value,
      amount,
      category: form.category.value,
      notes: form.notes.value,
      date: toLocalISO(form.date.value)
    };

    const errors = validateTransactionForm(data);
    if (Object.keys(errors).length) {
      showToastFn(Object.values(errors)[0], 'danger');
      return;
    }

    try {
      if (data.type === 'Expense') await checkBudgetWarning(data.category, data.amount);
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
    const balance = parseAmount(form.pouchBalance.value || 0);
    const data = {
      name: form.pouchName.value,
      type: form.pouchType.value,
      balance: Number.isFinite(balance) ? balance : 0
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
    const amount = parseAmount(form.billAmount.value);
    const category = form.billCategory ? form.billCategory.value : '';
    if (!form.billTitle.value || !Number.isFinite(amount) || amount <= 0) {
      showToastFn('Judul dan nominal wajib valid', 'danger');
      return;
    }
    if (!category) {
      showToastFn('Kategori tagihan wajib diisi', 'danger');
      return;
    }
    const data = {
      title: form.billTitle.value,
      amount,
      category,
      dueDate: toLocalISO(form.billDueDate.value)
    };
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

  // Auth guard — redirect to login if not authenticated
  requireAuth();

  // Init DB & seed
  try {
    await initApp();
  } catch (err) {
    console.error('Init DB gagal:', err);
  }

  // Sinkronkan role sesi dari DB (atasi sesi basi setelah role diubah)
  try {
    const ok = await syncSessionRole();
    if (!ok) return;
  } catch {}

  let data;
  try {
    data = await fetchAll();
  } catch (err) {
    console.error('Gagal memuat data Hall:', err);
    showToast('Gagal memuat data: ' + (err?.message || err), 'danger');
    return;
  }

  const safe = (label, fn) => {
    try {
      const out = fn();
      if (out && typeof out.catch === 'function') {
        return out.catch((err) => console.error(`Render ${label} gagal:`, err));
      }
      return out;
    } catch (err) {
      console.error(`Render ${label} gagal:`, err);
    }
  };

  await safe('banner', () => renderGuildBanner(data));
  safe('transaksi', () => renderRecentTransactions(data.transactions));
  safe('tagihan', () => renderBills(data.bills));
  safe('gamifikasi', () => renderGamification(data.state));
  safe('budget', () => renderBudgetCard(data.transactions));
  safe('grafik', () => renderCharts(data.transactions));

  // Financial Health Score & Monthly Quest (computed from real data)
  try {
    const health = await computeHealthScore(data);
    renderHealthScore(health);
    renderMonthlyQuest(data.guild, health);
  } catch (err) {
    console.error('Render health/quest gagal:', err);
  }
  window._guild = data.guild;

  // Populate pouch select in transaction modal
  const txModalForm = document.getElementById('txModalForm');
  if (txModalForm) populatePouchSelect(txModalForm.pouchId, data.pouches);

  let cachedCats = [];
  const fillCatOptions = (type) => {
    const catSel = document.getElementById('txCategory');
    if (!catSel) return;
    const prev = catSel.value;
    const list = cachedCats.filter((c) => !c.type || c.type === type);
    const opts = list.length ? list : cachedCats;
    catSel.innerHTML = opts.map((c) =>
      `<option value="${escapeHtml(c.name)}">${escapeHtml(c.icon || '🏷️')} ${escapeHtml(c.name)}</option>`
    ).join('');
    if (prev && [...catSel.options].some((o) => o.value === prev)) catSel.value = prev;
  };

  // Wire action buttons to open modals & set types
  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', async () => {
      // Segarkan role dulu: tombol Kelola bisa tersembunyi permanen
      // bila gating init jalan saat sesi masih basi.
      try { await syncSessionRole(); } catch {}
      applyRoleGating();
      applySettingsGating();
      const modalId = btn.dataset.openModal;
      if (modalId === 'catModal') {
        if (!(await requireMember())) return;
        renderCategoryList();
      }
      const type = btn.dataset.type;
      if (type) {
        const typeInput = document.getElementById('txTypeInput');
        if (typeInput) typeInput.value = type;
        const titleEl = document.getElementById('txModalTitle');
        if (titleEl) {
          const emoji = titleEl.querySelector('.modal__emoji');
          emoji.textContent = type === 'Income' ? '➕' : '💸';
          titleEl.replaceChildren(emoji, document.createTextNode(type === 'Income' ? ' Uang Masuk' : ' Uang Keluar'));
        }
        fillCatOptions(type);
      }
      const txDate = document.getElementById('txDate');
      if (txDate && !txDate.value) {
        const d = new Date();
        txDate.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      openModal(modalId);
    });
  });

  // Wire modal forms
  setupTransactionModalForm(showToast);
  setupPouchModalForm(showToast);
  setupBillModalForm(showToast);
  setupPayBillForm();
  setupBudgetNav();
  budgetMonth = monthKey();
  setupExportPdf(data.transactions);
  setupBackup();
  setupQuestModalForm();
  setupCategoryModal();
  setupSettings();
  applySettingsGating();

  // Category selection in transaction form (list from categories store)
  cachedCats = await getCategories();
  fillCatOptions(document.getElementById('txTypeInput')?.value || 'Income');
  const billCatSel = document.getElementById('billCategory');
  if (billCatSel) {
    const expCats = cachedCats.filter((c) => !c.type || c.type === 'Expense');
    const opts = expCats.length ? expCats : cachedCats;
    billCatSel.innerHTML = opts.map((c) =>
      `<option value="${escapeHtml(c.name)}">${escapeHtml(c.icon || '🏷️')} ${escapeHtml(c.name)}</option>`
    ).join('');
  }

  // Role-based UI gating
  applyRoleGating();
  wireHallLinks();

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

  // Re-gate otomatis saat role sesi berubah (mis. baru dipromosikan).
  // ponytail: satu subscriber saja; duplikat bikin render ganda dan race.
  if (!window.__hallSessionWired) {
    window.__hallSessionWired = true;
    subscribe('kelola-racun:session', async () => {
      try {
        try { await syncSessionRole(); } catch {}
        applyRoleGating();
        applySettingsGating();
        await renderCategoryList();
        const fresh = await fetchAll();
        await renderGuildBanner(fresh);
        renderBudgetCard(fresh.transactions);
      } catch (err) {
        console.error('Re-gate sesi gagal:', err);
      }
    });
  }

  // Reactivity: re-render on data updates
  subscribe('kelola-racun:updated', async () => {
    try {
      const fresh = await fetchAll();
      await renderGuildBanner(fresh);
      renderRecentTransactions(fresh.transactions);
      renderBills(fresh.bills);
      renderBudgetCard(fresh.transactions);
      renderCategoryList();
      renderCharts(fresh.transactions);
      try {
        const h = await computeHealthScore(fresh);
        renderHealthScore(h);
        renderMonthlyQuest(fresh.guild, h);
      } catch (err) { console.warn('Health score refresh gagal:', err); }
      try { renderGamification(fresh.state); } catch (err) {}
    } catch (err) {
      console.error('Re-render Hall gagal:', err);
    }
  });

  // Request notification permission & show due-date reminder
  let notifPref = 'on';
  try { notifPref = JSON.parse(localStorage.getItem('ffh-prefs') || '{}').notif || 'on'; } catch {}
  if (notifPref !== 'off' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
  const soonBills = data.bills.filter(b => {
    const days = Math.ceil((new Date(b.dueDate) - Date.now()) / 86400000);
    return days >= 0 && days <= 3;
  });
  if (notifPref !== 'off' && soonBills.length > 0 && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
    new Notification('KelolaRacun — Tagihan Sebentar Lagi', {
      body: `${soonBills.length} tagihan jatuh tempo dalam 3 hari: ${soonBills.map(b => b.title).join(', ')}`,
      icon: '../manifest.json'
    });
  }
})();