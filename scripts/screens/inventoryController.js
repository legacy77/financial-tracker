// ============================================================
// scripts/screens/inventoryController.js — Pouch & Vault dynamic rendering
// KelolaRacun Phase 3
// ============================================================

import { initApp, showToast } from '../app.js';
import { getGuild, updateGuild } from '../services/guildService.js';
import { getState } from '../core/gamification.js';
import { getPouches, createPouch, getPouch, setSavingsGoal, getSavingsProgress } from '../services/pouchService.js';
import { getTransactionsByPouch, addTransaction } from '../services/transactionService.js';
import { getCategories } from '../services/categoryService.js';
import { canEdit } from '../core/authService.js';
import { subscribe, publish } from '../core/eventBus.js';
import {
  formatRupiah, formatDate, relativeDate, validateTransactionForm,
  openModal, closeModal, setupModalClose, escapeHtml, TYPE_META, POUCH_TYPE_META
} from '../core/helpers.js';
import { requireAuth, syncSessionRole } from '../core/authService.js';
import { categorizeTransaction } from '../services/aiCategorizer.js';
import { predictGoalAchievability } from '../services/savingsPredictor.js';

let activePouchId = null;

async function fetchInventoryData() {
  const [guild, pouches, cats] = await Promise.all([getGuild(), getPouches(), getCategories()]);
  if (!activePouchId && pouches.length > 0) {
    activePouchId = pouches[0].id;
  }
  const transactions = activePouchId ? await getTransactionsByPouch(activePouchId) : [];
  const selectedPouch = pouches.find(p => p.id === activePouchId) || pouches[0] || null;
  return { guild, pouches, transactions, selectedPouch, cats };
}

let cachedInvCats = [];

function fillInvCatOptions(type) {
  const sel = document.getElementById('invTxCategory');
  if (!sel) return;
  const prev = sel.value;
  const list = cachedInvCats.filter((c) => !c.type || c.type === type);
  const opts = list.length ? list : cachedInvCats;
  sel.innerHTML = opts.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.icon || '🏷️')} ${escapeHtml(c.name)}</option>`).join('');
  if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

function applyInvGating() {
  if (!canEdit()) {
    document.querySelectorAll('#invTxForm button[type="submit"], #pouchModalForm button[type="submit"]').forEach((el) => {
      el.disabled = true;
      el.title = 'Hanya Admin/Co-Manager yang dapat menambah data.';
    });
    document.querySelectorAll('[data-open-modal="pouchModal"], [data-open-modal="txModal"]').forEach((el) => {
      if (el.tagName === 'BUTTON') {
        el.disabled = true;
        el.title = 'Hanya Admin/Co-Manager yang dapat menambah data.';
      }
    });
  }
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

async function renderBanner({ guild, pouches }) {
  const totalGold = pouches.reduce((sum, p) => sum + (p.balance || 0), 0);
  document.querySelectorAll('.guild-banner__gold').forEach(el => {
    el.textContent = formatRupiah(totalGold);
  });
  const nameEl = document.querySelector('.guild-banner__title');
  if (nameEl && guild) nameEl.textContent = `${guild.familyName || 'Guild'}`;
  let level = 1;
  try { level = (await getState())?.level || 1; } catch {}
  document.querySelectorAll('.guild-level').forEach((el) => {
    el.textContent = `Lv. ${level}`;
  });
  if (guild && guild.guildLevel !== level) {
    try { await updateGuild({ guildLevel: level }); } catch {}
  }
}

function renderPouchesList(pouches, selectedId) {
  const container = document.querySelector('.pouches-list');
  if (!container) return;

  if (!pouches.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">🎒</div><p class="font-semibold">Belum ada pouch</p><p class="text-sm text-tertiary">Buat pouch pertama untuk mulai menyimpan gold.</p></div>';
    return;
  }

  container.classList.add('pouch-grid');
  container.innerHTML = pouches.map(p => {
    const meta = POUCH_TYPE_META[p.type] || { icon: '💰', label: p.type };
    const isSelected = p.id === selectedId;
    return `
      <div class="list__item card--interactive p-3 rounded-lg pouch-card${isSelected ? ' pouch-card--active' : ''}" data-pouch-id="${p.id}">
        <div class="list__icon text-2xl">${meta.icon}</div>
        <div class="list__content">
          <div class="list__title font-bold">${escapeHtml(p.name)}</div>
          <div class="list__subtitle">${meta.label} • ${isSelected ? 'Aktif' : 'Tersedia'}</div>
        </div>
        <div class="list__meta flex-col items-end">
          <span class="list__amount list__amount--success font-bold text-base">${formatRupiah(p.balance)}</span>
          <span class="badge ${isSelected ? 'badge--success' : 'badge--info'} mt-1">${meta.label}</span>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.pouch-card').forEach(card => {
    card.addEventListener('click', () => {
      activePouchId = card.dataset.pouchId;
      publish('kelola-racun:inventory-switch', { pouchId: activePouchId });
    });
  });
}

function renderPouchDetail(pouch, transactions) {
  const detailContainer = document.querySelector('.pouch-detail-section');
  if (!detailContainer) return;

  if (!pouch) {
    detailContainer.innerHTML = '<p class="text-tertiary p-4">Pilih pouch untuk melihat detail.</p>';
    return;
  }

  const meta = POUCH_TYPE_META[pouch.type] || { icon: '💰', label: pouch.type };

  detailContainer.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h3>Detail: ${escapeHtml(pouch.name)}</h3>
      <span class="badge badge--success">${meta.label}</span>
    </div>

    <div class="flex gap-4 mb-6 balance-wrap">
      <div class="flex-1">
        <p class="text-tertiary text-sm">Saldo Saat Ini</p>
        <p class="text-2xl font-bold text-income">${formatRupiah(pouch.balance)} IDR</p>
      </div>
      <div class="flex gap-2 items-center">
        ${pouch.type === 'Savings' ? `<button class="btn btn--secondary" data-open-modal="goalModal">🎯 Atur goal</button><button class="btn btn--primary" data-open-modal="txModal" data-pouch="${pouch.id}">➕ Kontribusi</button>` : `<button class="btn btn--primary" data-open-modal="txModal" data-pouch="${pouch.id}">➕ Tambah Transaksi</button>`}
      </div>
    </div>
    ${pouch.type === 'Savings' && pouch.target ? (() => {
      const goal = getSavingsProgress(pouch);
      return `<div class="card p-4 mb-4"><div class="flex items-center justify-between"><strong>🎯 Goal tabungan</strong><span>${Math.round(goal.progress * 100)}%</span></div><p class="text-sm text-tertiary">Tersisa ${formatRupiah(goal.remaining)} · Per bulan ${formatRupiah(goal.monthlyContribution)}</p><p class="text-sm ${goal.overdue ? 'text-expense' : 'text-tertiary'}">${goal.overdue ? 'Deadline terlewat' : `Deadline ${formatDate(pouch.deadline)}`}</p></div>`;
    })() : ''}

    <div class="divider"></div>

    <h4 class="mb-3">Aktivitas Pouch</h4>
    <div class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Deskripsi</th>
            <th class="table-cell--right">Kategori</th>
            <th class="table-cell--right">Jumlah</th>
            <th class="table-cell--center">Tipe</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.length === 0 ? `
            <tr><td colspan="5" class="text-center text-tertiary py-4">Belum ada transaksi di pouch ini.</td></tr>
          ` : transactions.map(t => {
            const m = TYPE_META[t.type] || TYPE_META.Expense;
            const sign = m.sign || (t.type === 'Expense' ? '-' : '+');
            return `
              <tr>
                <td>${relativeDate(t.date)}</td>
                <td>${escapeHtml(t.notes || t.category)}</td>
                <td class="table-cell--right"><span class="badge badge--gold">${escapeHtml(t.category)}</span></td>
                <td class="table-cell--right table-cell--gold ${m.cls}">${sign}${formatRupiah(t.amount)}</td>
                <td class="table-cell--center"><span class="badge badge--${m.badge}">${m.label}</span></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  // Re-bind modal opener inside detail
  detailContainer.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.openModal));
  });
}

function suggestInventoryCategory() {
  try {
    const form = document.getElementById('invTxForm');
    const category = document.getElementById('invTxCategory');
    if (!form || !category || category.dataset.manual === 'true') return;
    const result = categorizeTransaction(form.elements.namedItem('notes')?.value || '', form.elements.namedItem('amount')?.value || 0, form.elements.namedItem('type')?.value || 'Expense', cachedInvCats);
    if (result.categoryId && result.confidence > 0.7 && result.categoryName && [...category.options].some((o) => o.value === result.categoryName)) {
      category.value = result.categoryName;
      category.dataset.aiSuggested = 'true';
      category.title = '🤖 AI suggestion — dapat diubah manual';
    }
  } catch (err) { console.warn('AI category suggestion gagal:', err); }
}

function syncTransferWrap() {
  const typeSel = document.getElementById('invTxType');
  const wrap = document.getElementById('invToPouchWrap');
  const toSel = document.getElementById('invToPouchId');
  const isTransfer = typeSel?.value === 'Transfer';
  if (wrap) wrap.hidden = !isTransfer;
  if (toSel) toSel.required = !!isTransfer;
}

function setupForms(pouches) {
  const aiCategory = document.getElementById('invTxCategory');
  if (aiCategory && !aiCategory.dataset.manualBound) {
    aiCategory.dataset.manualBound = 'true';
    aiCategory.addEventListener('change', () => { aiCategory.dataset.manual = 'true'; delete aiCategory.dataset.aiSuggested; aiCategory.title = ''; });
    document.getElementById('invTxForm')?.addEventListener('reset', () => { delete aiCategory.dataset.manual; delete aiCategory.dataset.aiSuggested; aiCategory.title = ''; });
  }
  const opts = pouches.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${formatRupiah(p.balance)})</option>`).join('');
  const pouchSelect = document.getElementById('invPouchId');
  if (pouchSelect) {
    pouchSelect.innerHTML = opts;
  }
  const toSelect = document.getElementById('invToPouchId');
  if (toSelect) {
    const prev = toSelect.value;
    toSelect.innerHTML = opts;
    if (prev && [...toSelect.options].some((o) => o.value === prev)) toSelect.value = prev;
  }
  syncTransferWrap();

  const txForm = document.getElementById('invTxForm');
  if (txForm && !txForm.dataset.bound) {
    txForm.dataset.bound = 'true';
    const category = document.getElementById('invTxCategory');
    if (category) {
      ['input', 'blur'].forEach((eventName) => category.addEventListener(eventName, suggestInventoryCategory));
      category.setAttribute('aria-label', 'Kategori transaksi 🤖 AI');
    }
    txForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = parseAmount(txForm.elements.namedItem('amount').value);
      if (!Number.isFinite(amount) || amount <= 0) {
        showToast('Nominal tidak valid', 'danger');
        return;
      }
      const data = {
        pouchId: txForm.elements.namedItem('pouchId').value,
        toPouchId: txForm.elements.namedItem('toPouchId')?.value || null,
        type: txForm.elements.namedItem('type').value,
        amount,
        category: txForm.elements.namedItem('category').value,
        notes: txForm.elements.namedItem('notes').value,
        date: toLocalISO(txForm.elements.namedItem('date')?.value)
      };
      const errors = validateTransactionForm(data);
      if (Object.keys(errors).length) {
        showToast(Object.values(errors)[0], 'danger');
        return;
      }
      try {
        if (data.type === 'Expense') {
          try {
            const { getCategories: gc } = await import('../services/categoryService.js');
            const { getBudgets: gb, monthKey: mk, monthSpending: ms } = await import('../services/budgetService.js');
            const { getTransactions: gt } = await import('../services/transactionService.js');
            const cats = await gc();
            const cat = cats.find((c) => c.name === data.category);
            if (cat && (!cat.type || cat.type === 'Expense')) {
              const month = mk();
              const b = (await gb(month)).find((x) => x.categoryId === cat.id);
              if (b && b.amount > 0) {
                const spent = (await ms(await gt(), month))[data.category] || 0;
                if (spent + data.amount > b.amount) {
                  showToast(`⚠️ ${data.category} lewat budget (${formatRupiah(spent + data.amount)} / ${formatRupiah(b.amount)})`, 'warning');
                }
              }
            }
          } catch {}
        }
        await addTransaction(data);
        showToast('Transaksi berhasil ditambahkan!', 'success');
        closeModal('txModal');
        txForm.reset();
      } catch (err) {
        showToast('Gagal: ' + err.message, 'danger');
      }
    });
  }

  const goalForm = document.getElementById('goalForm');
  if (goalForm && !goalForm.dataset.bound) {
    goalForm.dataset.bound = 'true';
    goalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const goal = {
          target: goalForm.elements.namedItem('goalTarget').value,
          deadline: goalForm.elements.namedItem('goalDeadline').value
        };
        await setSavingsGoal(activePouchId, goal);
        try {
          const transactions = await getTransactionsByPouch(activePouchId);
          const pouches = await getPouches();
          const prediction = predictGoalAchievability({ ...goal, balance: (await getPouch(activePouchId))?.balance || 0 }, transactions, pouches);
          let result = document.getElementById('goalAiPrediction');
          if (!result) { result = document.createElement('div'); result.id = 'goalAiPrediction'; result.className = 'ai-suggestion'; goalForm.after(result); }
          const money = (value) => formatRupiah(Math.round(value || 0));
          result.innerHTML = `<strong>🤖 AI Prediction: ${prediction.achievable ? 'achievable' : 'not achievable'}</strong><br>Projected completion: ${prediction.projectedDate || 'belum tersedia'}<br>Suggested monthly contribution: ${money(prediction.suggestedMonthly)}<br><small>Optimistic: ${money(prediction.scenarios.optimistic)} · Realistic: ${money(prediction.scenarios.realistic)} · Pessimistic: ${money(prediction.scenarios.pessimistic)}</small>${prediction.achievable ? '' : `<br><span class="text-warning">${escapeHtml(prediction.reasoning)}</span>`}`;
          result.hidden = false;
        } catch (err) {
          console.warn('Prediksi goal AI gagal:', err);
          showToast('Goal tersimpan, prediksi AI tidak tersedia', 'warning');
        }
        closeModal('goalModal');
        showToast('Goal tabungan disimpan', 'success');
      } catch (err) {
        showToast('Gagal: ' + err.message, 'danger');
      }
    });
  }

  const pouchForm = document.getElementById('pouchModalForm');
  if (pouchForm && !pouchForm.dataset.bound) {
    pouchForm.dataset.bound = 'true';
    pouchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const balance = parseAmount(pouchForm.elements.namedItem('pouchBalance').value || 0);
      const data = {
        name: pouchForm.elements.namedItem('pouchName').value,
        type: pouchForm.elements.namedItem('pouchType').value,
        balance: Number.isFinite(balance) ? balance : 0
      };
      if (!data.name) {
        showToast('Nama pouch wajib diisi', 'danger');
        return;
      }
      try {
        await createPouch(data);
        showToast('Pouch baru berhasil dibuat! 🎒', 'success');
        closeModal('pouchModal');
        pouchForm.reset();
      } catch (err) {
        showToast('Gagal: ' + err.message, 'danger');
      }
    });
  }
}

// ---- Main Entry ----
(async function init() {
  setupModalClose();

  // Auth guard
  requireAuth();

  try {
    const ok = await syncSessionRole();
    if (!ok) return;
  } catch {}

  const data = await fetchInventoryData();
  await renderBanner(data);
  renderPouchesList(data.pouches, activePouchId);
  renderPouchDetail(data.selectedPouch, data.transactions);
  cachedInvCats = data.cats;
  fillInvCatOptions(document.getElementById('invTxType')?.value || 'Income');
  setupForms(data.pouches);
  applyInvGating();

  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (activePouchId) {
        const sel = document.getElementById('invPouchId');
        if (sel) sel.value = activePouchId;
      }
      openModal(btn.dataset.openModal);
    });
  });

  const typeSel = document.getElementById('invTxType');
  if (typeSel && !typeSel.dataset.bound) {
    typeSel.dataset.bound = 'true';
    typeSel.addEventListener('change', () => {
      fillInvCatOptions(typeSel.value);
      syncTransferWrap();
    });
  }

  subscribe('kelola-racun:updated', async () => {
    const fresh = await fetchInventoryData();
    await renderBanner(fresh);
    renderPouchesList(fresh.pouches, activePouchId);
    renderPouchDetail(fresh.selectedPouch, fresh.transactions);
    cachedInvCats = fresh.cats;
    const modalOpen = !!document.querySelector('#txModal.modal--open');
    if (!modalOpen) fillInvCatOptions(document.getElementById('invTxType')?.value || 'Income');
    setupForms(fresh.pouches);
    applyInvGating();
  });

  subscribe('kelola-racun:inventory-switch', async (e) => {
    activePouchId = e.pouchId;
    const fresh = await fetchInventoryData();
    renderPouchesList(fresh.pouches, activePouchId);
    renderPouchDetail(fresh.selectedPouch, fresh.transactions);
  });

  try {
    await initApp();
  } catch (err) {
    console.error('Init DB gagal:', err);
  }
})();