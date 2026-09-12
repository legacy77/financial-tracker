// ============================================================
// scripts/screens/homeController.js — Home harian (aksi cepat hari ini)
// Home = sapaan + gold + catat cepat + transaksi hari ini + tagihan H-3 + ringkas quest.
// Hall = analisa mendalam (health, quest detail, chart, XP, kelola data).
// ============================================================

import { initApp, showToast } from '../app.js';
import { getGuild, updateGuild } from '../services/guildService.js';
import { getState } from '../core/gamification.js';
import { getPouches } from '../services/pouchService.js';
import { getTransactions, addTransaction, deleteTransaction } from '../services/transactionService.js';
import { getBudgets, monthKey, monthSpending } from '../services/budgetService.js';
import { getBills } from '../services/billService.js';
import { openPayBillModal, setupPayBillForm } from '../core/payBill.js';
import { getCategories } from '../services/categoryService.js';
import { getMember } from '../services/memberService.js';
import { requireAuth, syncSessionRole, getCurrentMember, canEdit } from '../core/authService.js';
import {
  formatRupiah, relativeDate, validateTransactionForm,
  openModal, closeModal, setupModalClose, escapeHtml, TYPE_META
} from '../core/helpers.js';
import { computeHealthScore } from '../core/healthScore.js';
import { subscribe } from '../core/eventBus.js';

function sameDay(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

async function fetchHome() {
  const [guild, pouches, transactions, bills, cats, state] = await Promise.all([
    getGuild(), getPouches(), getTransactions(), getBills(), getCategories(), getState()
  ]);
  return { guild, pouches, transactions, bills, cats, state };
}

async function renderBanner({ guild, pouches, state }) {
  const total = pouches.reduce((s, p) => s + (p.balance || 0), 0);
  document.querySelectorAll('.guild-banner__gold').forEach((el) => { el.textContent = formatRupiah(total); });
  const nameEl = document.querySelector('.guild-banner__title');
  if (nameEl && guild) nameEl.textContent = `${guild.familyName || 'Guild'}`;
  const level = state?.level || 1;
  document.querySelectorAll('.guild-level').forEach((el) => {
    el.textContent = `Lv. ${level}`;
  });
  if (guild && guild.guildLevel !== level) {
    try { await updateGuild({ guildLevel: level }); } catch {}
  }
  const heroGold = document.getElementById('homeGold');
  if (heroGold) heroGold.textContent = formatRupiah(total);
}

async function renderGreeting({ guild }) {
  const h = new Date().getHours();
  const waktu = h < 11 ? 'Pagi' : h < 15 ? 'Siang' : h < 19 ? 'Sore' : 'Malam';
  let name = 'Guild';
  try {
    const cur = getCurrentMember();
    if (cur) {
      const m = await getMember(cur.memberId);
      if (m) name = m.name;
    }
  } catch {}
  const g = document.getElementById('homeGreeting');
  if (g) g.textContent = `Selamat ${waktu}, ${name}!`;
  const d = document.getElementById('homeDate');
  if (d) d.textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const sub = document.getElementById('homeGuildSub');
  if (sub && guild) sub.textContent = `${guild.familyName || 'Guild'} · Home Base harian`;
}

function renderToday(transactions) {
  const today = transactions.filter((t) => sameDay(t.date, new Date()));
  const inc = today.filter((t) => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
  const exp = today.filter((t) => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('homeTodayInc', `+${formatRupiah(inc)}`);
  set('homeTodayExp', `-${formatRupiah(exp)}`);
  set('homeTodayCount', `${today.length} transaksi hari ini`);
  const box = document.querySelector('.today-list');
  if (!box) return;
  if (!today.length) {
    box.innerHTML = '<div class="empty-state"><div class="empty-state__icon">🌅</div><p class="font-semibold">Belum ada aktivitas hari ini</p><p class="text-sm text-tertiary">Catat loot atau pengeluaran pertama hari ini.</p></div>';
    return;
  }
  box.innerHTML = today.slice().reverse().slice(0, 5).map((t) => {
    const meta = TYPE_META[t.type] || TYPE_META.Expense;
    const sign = meta.sign || (t.type === 'Expense' ? '-' : '+');
    return `
      <div class="list__item">
        <div class="list__icon">${meta.icon}</div>
        <div class="list__content">
          <div class="list__title">${escapeHtml(t.category)}</div>
          <div class="list__subtitle">${escapeHtml(t.notes || meta.label)} · ${relativeDate(t.date)}</div>
        </div>
        <div class="list__meta flex-col items-end">
          <span class="list__amount ${meta.cls} font-bold">${sign}${formatRupiah(t.amount)}</span>
          <button class="btn btn--ghost btn--danger-text home-tx-delete" data-tx="${t.id}">✕</button>
        </div>
      </div>`;
  }).join('');
  box.querySelectorAll('.home-tx-delete').forEach((btn) => {
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
  applyGating();
}

function renderDue(bills) {
  const pending = (bills || []).filter((b) => b.status === 'Pending' || b.status === 'Partial');
  const dayDiff = (b) => Math.ceil((new Date(b.dueDate) - Date.now()) / 86400000);
  const overdue = pending.filter((b) => dayDiff(b) < 0);
  const soon = pending.filter((b) => {
    const days = dayDiff(b);
    return days >= 0 && days <= 3;
  });
  const box = document.querySelector('.due-list');
  if (!box) return;
  if (!overdue.length && !soon.length) {
    box.innerHTML = '<div class="empty-state"><div class="empty-state__icon">🛡️</div><p class="font-semibold">Aman, tidak ada tagihan H-3</p><p class="text-sm text-tertiary">Guild bebas beban mendesak.</p></div>';
    return;
  }
  const progress = (b) => {
    if (b.status !== 'Partial') return '';
    const paid = Number(b.paidAmount) || 0;
    const total = Number(b.amount) || 0;
    return `<div class="text-xs text-tertiary">Terbayar ${formatRupiah(paid)} / ${formatRupiah(total)}</div>`;
  };
  const item = (b, label, cls) => `
      <div class="list__item">
        <div class="list__icon">🧾</div>
        <div class="list__content">
          <div class="list__title">${escapeHtml(b.title)}</div>
          <div class="list__subtitle ${cls}">${label}</div>
          ${progress(b)}
        </div>
        <div class="list__meta flex-col items-end">
          <span class="list__amount list__amount--danger font-bold">${formatRupiah((Number(b.amount) || 0) - (Number(b.paidAmount) || 0))}</span>
          <button class="btn btn--ghost btn--xs home-bill-paid" data-bill="${b.id}">💸 Bayar</button>
        </div>
      </div>`;
  box.innerHTML =
    overdue.map((b) => {
      const days = Math.ceil((Date.now() - new Date(b.dueDate)) / 86400000);
      return item(b, `🔴 Terlambat ${days} hari`, 'text-expense');
    }).join('') +
    soon.map((b) => {
      const days = dayDiff(b);
      const txt = days <= 0 ? 'Jatuh tempo hari ini!' : `H-${days}`;
      return item(b, `⚠️ ${txt}`, 'bill-due--soon');
    }).join('');
  box.querySelectorAll('.home-bill-paid').forEach((btn) => {
    btn.addEventListener('click', () => {
      openPayBillModal(btn.dataset.bill);
    });
  });
}

function renderMiniQuest(guild, health) {
  const incomeTarget = guild?.monthlyTargetIncome || 5000000;
  const expenseTarget = guild?.monthlyTargetExpense || 3000000;
  const incPct = incomeTarget > 0 ? Math.min(100, Math.round((health.monthIncome / incomeTarget) * 100)) : 0;
  const expPct = expenseTarget > 0 ? Math.min(100, Math.round((health.monthExpense / expenseTarget) * 100)) : 0;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const bar = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = pct + '%'; };
  bar('hqIncomeBar', incPct);
  bar('hqExpenseBar', expPct);
  set('hqIncomeTxt', `${incPct}% · ${formatRupiah(health.monthIncome)}`);
  set('hqExpenseTxt', `${expPct}% · ${formatRupiah(health.monthExpense)}`);
  set('hqScore', `${health.overall}/100 ${health.status.icon}`);
}

let pouchCount = 0;

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

let cachedCats = [];

function currentTxType() {
  const t = document.getElementById('txTypeInput');
  return t ? t.value : 'Income';
}

function fillCatOptions(type) {
  const catSel = document.getElementById('txCategory');
  if (!catSel) return;
  const prev = catSel.value;
  const list = cachedCats.filter((c) => !c.type || c.type === type);
  const opts = list.length ? list : cachedCats;
  catSel.innerHTML = opts.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.icon || '🏷️')} ${escapeHtml(c.name)}</option>`).join('');
  if (prev && [...catSel.options].some((o) => o.value === prev)) catSel.value = prev;
}

function populateTxForm(pouches, cats) {
  pouchCount = pouches.length;
  cachedCats = cats;
  const modalOpen = !!document.querySelector('#txModal.modal--open');
  if (!modalOpen) {
    const pouchSel = document.getElementById('txPouchId');
    if (pouchSel) {
      const prev = pouchSel.value;
      pouchSel.innerHTML = pouches.length
        ? pouches.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} — ${formatRupiah(p.balance)}</option>`).join('')
        : '<option value="" selected disabled>Belum ada pouch</option>';
      let def = '';
      try {
        const pref = JSON.parse(localStorage.getItem('ffh-prefs') || '{}');
        if (pref.defaultPouchId && pouches.some((p) => p.id === pref.defaultPouchId)) def = pref.defaultPouchId;
      } catch {}
      if (def) pouchSel.value = def;
      else if (prev && [...pouchSel.options].some((o) => o.value === prev)) pouchSel.value = prev;
    }
    fillCatOptions(currentTxType());
  }
  const form = document.getElementById('txModalForm');
  if (form) {
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = !pouches.length;
    let warn = document.getElementById('noPouchWarn');
    if (!pouches.length) {
      if (!warn) {
        warn = document.createElement('p');
        warn.id = 'noPouchWarn';
        warn.className = 'field-error';
        warn.innerHTML = 'Belum ada pouch — <a href="screens/03-inventory.html">buat pouch dulu di Inventory</a>.';
        const footer = form.querySelector('.modal__footer');
        if (footer) footer.before(warn);
        else form.appendChild(warn);
      }
    } else if (warn) {
      warn.remove();
    }
  }
}

function setupTxForm() {
  const form = document.getElementById('txModalForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pouchCount) {
      showToast('Belum ada pouch — buat pouch dulu di Inventory', 'danger');
      return;
    }
    const amount = parseAmount(form.amount.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Nominal tidak valid', 'danger');
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
      showToast(Object.values(errors)[0], 'danger');
      return;
    }
    try {
      if (data.type === 'Expense') await checkBudgetWarning(data.category, data.amount);
      await addTransaction(data);
      showToast(data.type === 'Income' ? 'Loot ditambahkan! 💰' : 'Pengeluaran dicatat! 💸');
      closeModal('txModal');
      form.reset();
    } catch (err) {
      showToast('Gagal: ' + err.message, 'danger');
    }
  });
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

function applyGating() {
  if (!canEdit()) {
    document.querySelectorAll('[data-open-modal="txModal"]').forEach((el) => {
      el.disabled = true;
      el.title = 'Hanya Admin/Co-Manager yang dapat mencatat transaksi.';
    });
    document.querySelectorAll('.home-bill-paid').forEach((el) => {
      el.disabled = true;
      el.title = 'Hanya Admin/Co-Manager yang dapat melunasi tagihan.';
    });
    document.querySelectorAll('.home-tx-delete').forEach((el) => {
      el.style.display = 'none';
    });
  }
}

function renderGameStrip(state, bills) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('homeXp', `⚡${state?.xp || 0} XP`);
  set('homeStreak', `🔥${state?.currentStreak || 0} hari`);
  const pending = (bills || []).filter((b) => b.status === 'Pending' || b.status === 'Partial').length;
  set('homeDueCount', pending ? `${pending} pending` : 'aman');
}

async function renderAll() {
  const data = await fetchHome();
  renderBanner(data);
  await renderGreeting(data);
  renderToday(data.transactions);
  renderDue(data.bills);
  renderGameStrip(data.state, data.bills);
  try {
    const health = await computeHealthScore(data);
    renderMiniQuest(data.guild, health);
  } catch {}
  populateTxForm(data.pouches, data.cats);
}

(async function init() {
  setupModalClose();
  requireAuth();
  try {
    await initApp();
  } catch (err) {
    console.error('Init DB gagal:', err);
  }
  try {
    const ok = await syncSessionRole();
    if (!ok) return;
  } catch {}
  await renderAll();
  applyGating();
  document.querySelectorAll('[data-open-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type) {
        const typeInput = document.getElementById('txTypeInput');
        if (typeInput) typeInput.value = type;
        const titleEl = document.getElementById('txModalTitle');
        if (titleEl) titleEl.textContent = type === 'Income' ? '➕ Tambah Loot (Pemasukan)' : '💸 Catat Pengeluaran';
        fillCatOptions(type);
      }
      openModal(btn.dataset.openModal);
    });
  });
  setupTxForm();
  setupPayBillForm();
  subscribe('kelola-racun:updated', async () => {
    await renderAll();
    applyGating();
  });
})();
