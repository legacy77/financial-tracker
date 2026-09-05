// ============================================================
// scripts/screens/inventoryController.js — Pouch & Vault dynamic rendering
// KelolaRacun Phase 3
// ============================================================

import { initApp, showToast } from '../app.js';
import { getGuild } from '../services/guildService.js';
import { getPouches, createPouch, getPouch } from '../services/pouchService.js';
import { getTransactionsByPouch, addTransaction } from '../services/transactionService.js';
import { subscribe, publish } from '../core/eventBus.js';
import {
  formatRupiah, relativeDate, validateTransactionForm,
  openModal, closeModal, setupModalClose, escapeHtml, TYPE_META, POUCH_TYPE_META
} from '../core/helpers.js';

let activePouchId = null;

async function fetchInventoryData() {
  const [guild, pouches] = await Promise.all([getGuild(), getPouches()]);
  if (!activePouchId && pouches.length > 0) {
    activePouchId = pouches[0].id;
  }
  const transactions = activePouchId ? await getTransactionsByPouch(activePouchId) : [];
  const selectedPouch = pouches.find(p => p.id === activePouchId) || pouches[0] || null;
  return { guild, pouches, transactions, selectedPouch };
}

function renderBanner({ guild, pouches }) {
  const totalGold = pouches.reduce((sum, p) => sum + (p.balance || 0), 0);
  document.querySelectorAll('.guild-banner__gold').forEach(el => {
    el.textContent = formatRupiah(totalGold);
  });
  const nameEl = document.querySelector('.guild-banner__title');
  if (nameEl && guild) nameEl.textContent = `${guild.familyName || 'Guild'}`;
}

function renderPouchesList(pouches, selectedId) {
  const container = document.querySelector('.pouches-list');
  if (!container) return;

  if (!pouches.length) {
    container.innerHTML = '<p class="text-tertiary text-sm p-4">Belum ada pouch. Buat pouch baru sekarang!</p>';
    return;
  }

  container.innerHTML = pouches.map(p => {
    const meta = POUCH_TYPE_META[p.type] || { icon: '💰', label: p.type };
    const isSelected = p.id === selectedId;
    const activeClass = isSelected ? 'border-color: var(--color-income-500); background: var(--color-income-25);' : '';
    return `
      <div class="list__item card--interactive p-3 rounded-lg pouch-card" data-pouch-id="${p.id}" style="border: 1px solid var(--color-border-light); cursor: pointer; ${activeClass}">
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

    <div class="flex gap-4 mb-6" style="flex-wrap: wrap;">
      <div class="flex-1">
        <p class="text-tertiary text-sm">Saldo Saat Ini</p>
        <p class="text-2xl font-bold text-income">${formatRupiah(pouch.balance)} IDR</p>
      </div>
      <div class="flex gap-2 items-center">
        <button class="btn btn--primary" data-open-modal="txModal" data-pouch="${pouch.id}">➕ Tambah Transaksi</button>
      </div>
    </div>

    <div class="divider"></div>

    <h4 class="mb-3">Aktivitas Pouch</h4>
    <div style="overflow-x: auto;">
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

function setupForms(pouches) {
  const pouchSelect = document.getElementById('invPouchId');
  if (pouchSelect) {
    pouchSelect.innerHTML = pouches.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${formatRupiah(p.balance)})</option>`).join('');
  }

  const txForm = document.getElementById('invTxForm');
  if (txForm && !txForm.dataset.bound) {
    txForm.dataset.bound = 'true';
    txForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        pouchId: txForm.elements.namedItem('pouchId').value,
        type: txForm.elements.namedItem('type').value,
        amount: Number(txForm.elements.namedItem('amount').value),
        category: txForm.elements.namedItem('category').value,
        notes: txForm.elements.namedItem('notes').value,
        date: new Date().toISOString()
      };
      const errors = validateTransactionForm(data);
      if (Object.keys(errors).length) {
        showToast(Object.values(errors)[0], 'danger');
        return;
      }
      try {
        await addTransaction(data);
        showToast('Transaksi berhasil ditambahkan!', 'success');
        closeModal('txModal');
        txForm.reset();
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
      const data = {
        name: pouchForm.elements.namedItem('pouchName').value,
        type: pouchForm.elements.namedItem('pouchType').value,
        balance: Number(pouchForm.elements.namedItem('pouchBalance').value || 0)
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

  const data = await fetchInventoryData();
  renderBanner(data);
  renderPouchesList(data.pouches, activePouchId);
  renderPouchDetail(data.selectedPouch, data.transactions);
  setupForms(data.pouches);

  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (activePouchId) {
        const sel = document.getElementById('invPouchId');
        if (sel) sel.value = activePouchId;
      }
      openModal(btn.dataset.openModal);
    });
  });

  subscribe('kelola-racun:updated', async () => {
    const fresh = await fetchInventoryData();
    renderBanner(fresh);
    renderPouchesList(fresh.pouches, activePouchId);
    renderPouchDetail(fresh.selectedPouch, fresh.transactions);
    setupForms(fresh.pouches);
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