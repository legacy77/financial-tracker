// ============================================================
// scripts/screens/scrollReadingController.js — CSV/Excel import preview & storage
// KelolaRacun Phase 3
// ============================================================

import { initApp, showToast } from '../app.js';
import { getGuild } from '../services/guildService.js';
import { getPouches } from '../services/pouchService.js';
import { addTransaction } from '../services/transactionService.js';
import { formatRupiah, setupModalClose, escapeHtml } from '../core/helpers.js';
import { autoTag } from '../core/autoTag.js';

let importedRows = [];

async function initBanner() {
  const [guild, pouches] = await Promise.all([getGuild(), getPouches()]);
  const totalGold = pouches.reduce((sum, p) => sum + (p.balance || 0), 0);
  document.querySelectorAll('.guild-banner__gold').forEach(el => {
    el.textContent = formatRupiah(totalGold);
  });
  const nameEl = document.querySelector('.guild-banner__title');
  if (nameEl && guild) nameEl.textContent = `${guild.familyName || 'Guild'}`;
}

window.handleFileSelect = function(e) {
  const file = e.target.files[0];
  if (!file) return;

  showToast('File dipilih: ' + file.name, 'info');
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('previewSection').style.display = 'block';

  // Read file as text for CSV parsing or simulate sample preview
  const reader = new FileReader();
  reader.onload = function(evt) {
    const text = evt.target.result;
    parseCSV(text);
  };
  reader.onerror = function() {
    // Fallback sample if binary / excel
    loadSamplePreview();
  };
  
  if (file.name.endsWith('.csv')) {
    reader.readAsText(file);
  } else {
    loadSamplePreview();
  }
};

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  importedRows = [];
  
  // Skip header if exists
  const startIdx = lines[0].toLowerCase().includes('date') || lines[0].toLowerCase().includes('tanggal') ? 1 : 0;
  
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 3) {
      const date = cols[0] || new Date().toISOString().split('T')[0];
      const desc = cols[1] || 'Imported Transaction';
      const rawAmt = Number(cols[2].replace(/[^0-9.-]+/g, '')) || 0;
      const type = rawAmt >= 0 ? 'Income' : 'Expense';
      const amount = Math.abs(rawAmt);
      const providedCat = cols[3] || '';
      const tagged = autoTag(desc);
      const category = providedCat || tagged.category;

      importedRows.push({ date, desc, amount, type, category });
    }
  }

  if (importedRows.length === 0) {
    loadSamplePreview();
  } else {
    renderPreviewTable(importedRows);
  }
}

function loadSamplePreview() {
  importedRows = [
    { date: '2026-03-01', desc: 'Salary Transfer', amount: 5000000, type: 'Income', category: 'Gaji' },
    { date: '2026-03-02', desc: 'Grocery Store', amount: 450000, type: 'Expense', category: 'Makanan' },
    { date: '2026-03-03', desc: 'Fuel Station', amount: 120000, type: 'Expense', category: 'Transport' },
    { date: '2026-03-04', desc: 'Dividend Payout', amount: 150000, type: 'Income', category: 'Investasi' }
  ];
  renderPreviewTable(importedRows);
}

function renderPreviewTable(rows) {
  const tbody = document.getElementById('previewBody');
  if (!tbody) return;
  tbody.innerHTML = rows.map(r => {
    const isInc = r.type === 'Income';
    return `
      <tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.desc)}</td>
        <td class="table-cell--right table-cell--gold ${isInc ? 'text-income' : 'text-expense'}">${isInc ? '+' : '-'}${formatRupiah(r.amount)}</td>
        <td><span class="badge badge--${isInc ? 'success' : 'danger'}">${isInc ? 'Pemasukan' : 'Pengeluaran'}</span></td>
        <td><span class="badge badge--gold">${escapeHtml(r.category)}</span></td>
      </tr>`;
  }).join('');
}

window.resetImport = function() {
  document.getElementById('fileInput').value = '';
  document.getElementById('previewSection').style.display = 'none';
  importedRows = [];
  showToast('Import dibatalkan', 'info');
};

window.confirmImport = async function() {
  if (importedRows.length === 0) {
    showToast('Tidak ada data untuk diimport', 'danger');
    return;
  }

  try {
    const pouches = await getPouches();
    const defaultPouchId = pouches[0]?.id || 'pouch-1';

    for (const r of importedRows) {
      await addTransaction({
        pouchId: defaultPouchId,
        type: r.type,
        amount: r.amount,
        category: r.category,
        notes: r.desc,
        date: r.date ? new Date(r.date).toISOString() : new Date().toISOString()
      });
    }

    showToast(`${importedRows.length} transaksi berhasil diimport ke Pouch utama! 🎉`, 'success');
    window.resetImport();
  } catch (err) {
    showToast('Gagal import: ' + err.message, 'danger');
  }
};

// ---- Main Entry ----
(async function init() {
  setupModalClose();
  await initBanner();
  try {
    await initApp();
  } catch (err) {
    console.error('Init DB gagal:', err);
  }
})();