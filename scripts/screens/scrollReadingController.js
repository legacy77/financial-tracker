// ============================================================
// scripts/screens/scrollReadingController.js — CSV/Excel import preview & storage
// KelolaRacun Phase 3
// ============================================================

import { initApp, showToast } from '../app.js';
import { getGuild, updateGuild } from '../services/guildService.js';
import { getState } from '../core/gamification.js';
import { getPouches } from '../services/pouchService.js';
import { addTransaction } from '../services/transactionService.js';
import { logImport, getImports } from '../services/importService.js';
import { formatRupiah, setupModalClose, escapeHtml } from '../core/helpers.js';
import { autoTag } from '../core/autoTag.js';
import { parsePdfItemsToRows, parseOcrWordsToRows, markDuplicates, rowHash } from '../core/seabankParser.js';
import { getCategories } from '../services/categoryService.js';
import { requireAuth, syncSessionRole, canEdit } from '../core/authService.js';

let importedRows = [];
let hideDup = false;
let categoryList = [];
let expandedIdx = -1;
let searchQuery = '';
let typeFilter = 'all';
const MAX_FILE = 10 * 1024 * 1024;

function toLocalISO(dateValue) {
  if (!dateValue) return new Date().toISOString();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0).toISOString();
  return new Date(dateValue).toISOString();
}

async function initBanner() {
  const [guild, pouches, state] = await Promise.all([getGuild(), getPouches(), getState()]);
  const totalGold = pouches.reduce((sum, p) => sum + (p.balance || 0), 0);
  document.querySelectorAll('.guild-banner__gold').forEach(el => {
    el.textContent = formatRupiah(totalGold);
  });
  const nameEl = document.querySelector('.guild-banner__title');
  if (nameEl && guild) nameEl.textContent = `${guild.familyName || 'Guild'}`;
  const level = state?.level || 1;
  document.querySelectorAll('.guild-level').forEach((el) => {
    el.textContent = `Lv. ${level}`;
  });
  if (guild && guild.guildLevel !== level) {
    try { await updateGuild({ guildLevel: level }); } catch {}
  }
  const sel = document.getElementById('importPouchId');
  if (sel) {
    sel.innerHTML = pouches.length
      ? pouches.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} — ${formatRupiah(p.balance)}</option>`).join('')
      : '<option value="" selected disabled>Belum ada pouch</option>';
  }
  if (!canEdit()) {
    const btn = document.getElementById('btnConfirmImport');
    if (btn) {
      btn.disabled = true;
      btn.title = 'Hanya Admin/Co-Manager yang dapat mengimpor transaksi.';
    }
    document.getElementById('fileInput')?.setAttribute('disabled', '');
  }
}

function setOcrStatus(msg, pct = null) {
  const status = document.getElementById('ocrStatus');
  const bar = document.getElementById('ocrBar');
  const legacy = document.getElementById('ocrStatusLegacy');
  if (legacy) legacy.textContent = msg || '';
  if (!status) return;
  status.textContent = msg || '';
  if (bar && pct != null) bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function showOcrWrap(fileName) {
  const wrap = document.getElementById('ocrWrap');
  const nameEl = document.getElementById('ocrFileName');
  if (nameEl) nameEl.textContent = fileName || '-';
  if (wrap) wrap.classList.remove('is-hidden');
  setOcrStatus('Menyiapkan...', 2);
}

function hideOcrWrap() {
  const wrap = document.getElementById('ocrWrap');
  const bar = document.getElementById('ocrBar');
  if (bar) bar.style.width = '100%';
  setOcrStatus('Selesai', 100);
  setTimeout(() => { if (wrap) wrap.classList.add('is-hidden'); }, 800);
}

function gotoStep(n) {
  [1, 2, 3].forEach((s) => {
    document.getElementById('step' + s)?.classList.toggle('is-hidden', s !== n);
    const li = document.querySelector(`.stepper__item[data-step="${s}"]`);
    if (li) {
      li.classList.toggle('stepper__item--active', s === n);
      li.classList.toggle('stepper__item--done', s < n);
      if (s === n) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    }
  });
  const bulk = document.getElementById('bulkBar');
  if (bulk) bulk.classList.toggle('is-hidden', n !== 2);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handlePickedFile(file) {
  if (!file) return;
  if (file.size > MAX_FILE) {
    showToast('File > 10MB, kecilkan dulu', 'danger');
    const inp = document.getElementById('fileInput');
    if (inp) inp.value = '';
    return;
  }
  showToast('File dipilih: ' + file.name, 'info');
  const fn = document.getElementById('fileName');
  if (fn) fn.textContent = file.name;
  showOcrWrap(file.name);

  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
    handlePdfFile(file);
    return;
  }
  setOcrStatus('');

  const reader = new FileReader();
  reader.onload = function(evt) {
    parseCSV(evt.target.result);
  };
  reader.onerror = function() {
    loadSamplePreview();
  };

  if (/\.csv$/i.test(file.name)) {
    reader.readAsText(file);
  } else {
    loadSamplePreview();
  }
}

window.handleFileSelect = function(e) {
  handlePickedFile(e.target.files[0]);
};

function bindDropzone() {
  const dz = document.getElementById('dropzone');
  const inp = document.getElementById('fileInput');
  if (!dz || !inp) return;
  dz.addEventListener('click', (e) => {
    if (e.target === inp) return;
    inp.click();
  });
  dz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inp.click();
    }
  });
  inp.addEventListener('change', (e) => {
    handlePickedFile(e.target.files[0]);
    inp.value = '';
  });
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => {
    e.preventDefault();
    dz.classList.add('dropzone--over');
  }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => {
    e.preventDefault();
    dz.classList.remove('dropzone--over');
  }));
  dz.addEventListener('drop', (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) handlePickedFile(f);
  });
}

async function handlePdfFile(file) {
  try {
    if (!window.pdfjsLib) throw new Error('PDF.js belum termuat (offline?)');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const pages = Math.min(pdf.numPages, 30);
    const pagesItems = [];
    let textChars = 0;
    for (let p = 1; p <= pages; p++) {
      setOcrStatus(`Baca halaman ${p}/${pages}...`, Math.round((p / pages) * 60));
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const items = tc.items.map((it) => ({
        text: it.str,
        x: it.transform[4],
        y: it.transform[5]
      })).filter((it) => Boolean(it.text && it.text.trim()));
      textChars += items.map((i) => i.text).join('').length;
      pagesItems.push({ pageNum: p, items });
    }
    const year = new Date().getFullYear();
    let result = { rows: [], skipped: 0 };
    if (textChars >= 200) {
      result = parsePdfItemsToRows(pagesItems, year);
    }
    if (!result.rows.length) {
      const ocrPages = await ocrPdf(pdf, pages);
      result = parseOcrWordsToRows(ocrPages, year);
    }
    if (!result.rows.length) throw new Error('Tidak ada transaksi di kolom Keluar/Masuk');
    setOcrStatus('Menyiapkan reconcile...', 95);
    await stageRows(result.rows, file.name, result.skipped);
    hideOcrWrap();
  } catch (err) {
    console.warn('PDF parse gagal:', err);
    setOcrStatus('Gagal: ' + err.message, 0);
    showToast('PDF gagal dibaca: ' + err.message, 'danger');
  }
}

async function ocrPdf(pdf, pages) {
  if (!window.Tesseract) throw new Error('OCR belum termuat (butuh internet)');
  const pagesWords = [];
  for (let p = 1; p <= pages; p++) {
    setOcrStatus(`OCR halaman ${p}/${pages}...`, 60 + Math.round((p / pages) * 35));
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    const { data } = await window.Tesseract.recognize(canvas, 'ind+eng');
    const words = (data.words || []).map((w) => ({
      text: w.text,
      x: w.bbox ? (w.bbox.x0 + w.bbox.x1) / 2 : 0,
      y: w.bbox ? vp.height - (w.bbox.y0 + w.bbox.y1) / 2 : 0
    })).filter((w) => Boolean(w.text && w.text.trim()));
    pagesWords.push({ pageNum: p, words });
  }
  return pagesWords;
}

async function stageRows(raw, fileName, skippedCount = 0) {
  try { categoryList = await getCategories(); } catch { categoryList = []; }
  let existing = [];
  try { const { getTransactions } = await import('../services/transactionService.js'); existing = await getTransactions(); } catch {}
  const enriched = raw.map((r) => ({
    ...r,
    category: r.category || autoTag(r.desc).category,
    checked: true
  }));
  importedRows = markDuplicates(enriched, existing).map((r) => ({ ...r, checked: !r.dup }));
  searchQuery = '';
  typeFilter = 'all';
  hideDup = false;
  expandedIdx = -1;
  const si = document.getElementById('searchInput');
  if (si) si.value = '';
  gotoStep(2);
  renderPreviewTable(importedRows);
  const skipMsg = skippedCount > 0 ? ` (${skippedCount} baris ambigu dibuang)` : '';
  showToast(`${importedRows.length} baris dari ${fileName || 'file'} siap reconcile${skipMsg}`, 'success');
}

async function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const rows = [];
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
      rows.push({ date, desc, amount, type, category, hash: rowHash({ date, desc, amount, type }) });
    }
  }
  if (!rows.length) {
    loadSamplePreview();
  } else {
    await stageRows(rows, 'CSV');
  }
}

async function loadSamplePreview() {
  const sample = [
    { date: '2026-03-01', desc: 'Salary Transfer', amount: 5000000, type: 'Income', category: 'Gaji' },
    { date: '2026-03-02', desc: 'Grocery Store', amount: 450000, type: 'Expense', category: 'Makanan' },
    { date: '2026-03-03', desc: 'Fuel Station', amount: 120000, type: 'Expense', category: 'Transport' },
    { date: '2026-03-04', desc: 'Dividend Payout', amount: 150000, type: 'Income', category: 'Investasi' }
  ].map((r) => ({ ...r, hash: rowHash(r) }));
  await stageRows(sample, 'Sample');
}

function visibleRows() {
  const q = searchQuery.trim().toLowerCase();
  return importedRows.map((r, i) => ({ r, i })).filter(({ r }) => {
    if (hideDup && r.dup) return false;
    if (typeFilter === 'Income' && r.type !== 'Income') return false;
    if (typeFilter === 'Expense' && r.type !== 'Expense') return false;
    if (typeFilter === 'dup' && !r.dup) return false;
    if (q && !String(r.desc || '').toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderPreviewTable(rows) {
  renderCards();
  recalcSummary();
}

function renderCards() {
  const list = document.getElementById('previewBody');
  const empty = document.getElementById('previewEmpty');
  const legacy = document.getElementById('previewBodyLegacy');
  if (legacy) legacy.innerHTML = '';
  if (!list) return;
  const cats = categoryList.length ? categoryList : [
    { name: 'Gaji' }, { name: 'Makanan' }, { name: 'Transport' },
    { name: 'Belanja Online' }, { name: 'Utilitas' }, { name: 'Investasi' },
    { name: 'Hiburan' }, { name: 'Pengeluaran Umum' }
  ];
  const vis = visibleRows();
  if (empty) empty.classList.toggle('is-hidden', vis.length > 0);
  const countEl = document.getElementById('rowCount');
  if (countEl) countEl.textContent = `${importedRows.length} baris`;

  list.innerHTML = vis.map(({ r, i }) => {
    const isInc = r.type === 'Income';
    const isExpanded = expandedIdx === i;
    const catOpts = cats.map(c => `<option value="${escapeHtml(c.name)}" ${c.name === r.category ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
    const dStr = r.date ? new Date(r.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
    return `
    <li class="reconcile-card ${isInc ? 'reconcile-card--income' : 'reconcile-card--expense'} ${r.dup ? 'reconcile-card--dup' : ''}">
      <div class="reconcile-card__main" role="button" tabindex="0" data-idx="${i}" aria-expanded="${isExpanded}" aria-label="${escapeHtml(r.desc)}, ${isInc ? 'masuk' : 'keluar'} ${formatRupiah(r.amount)}">
        <input type="checkbox" class="reconcile-check" data-check="${i}" ${r.checked ? 'checked' : ''} aria-label="Pilih ${escapeHtml(r.desc)}">
        <div class="reconcile-card__body">
          <div class="reconcile-card__desc">${escapeHtml(r.desc)}</div>
          <div class="reconcile-card__meta">
            <span class="reconcile-card__date">${dStr}</span>
            <span class="badge badge--gold text-xs">${escapeHtml(r.category || 'Umum')}</span>
            <span class="badge badge--${isInc ? 'success' : 'danger'} text-xs">${isInc ? 'Masuk' : 'Keluar'}</span>
            ${r.dup ? '<span class="badge badge--warning text-xs">Duplikat</span>' : ''}
          </div>
        </div>
        <div class="reconcile-card__amount ${isInc ? 'text-income' : 'text-expense'}">${isInc ? '+' : '-'}${formatRupiah(r.amount)}</div>
      </div>
      ${isExpanded ? `
      <div class="reconcile-card__editor">
        <div>
          <label>Tanggal</label>
          <input type="date" class="modal__input text-sm" value="${r.date || ''}" data-field="date" data-idx="${i}">
        </div>
        <div>
          <label>Deskripsi</label>
          <input type="text" class="modal__input text-sm" value="${escapeHtml(r.desc)}" data-field="desc" data-idx="${i}">
        </div>
        <div>
          <label>Jumlah (Rp)</label>
          <input type="number" class="modal__input text-sm font-mono" value="${r.amount}" min="1" data-field="amount" data-idx="${i}">
        </div>
        <div>
          <label>Tipe</label>
          <select class="modal__select text-sm" data-field="type" data-idx="${i}">
            <option value="Expense" ${!isInc ? 'selected' : ''}>💸 Keluar</option>
            <option value="Income" ${isInc ? 'selected' : ''}>💰 Masuk</option>
          </select>
        </div>
        <div>
          <label>Kategori</label>
          <select class="modal__select text-sm" data-field="category" data-idx="${i}">${catOpts}</select>
        </div>
      </div>` : ''}
    </li>`;
  }).join('');
}

function updateSummary(inc, exp, selCount, dupCount, total) {
  total = total ?? importedRows.length;
  const net = inc - exp;
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('sumIncome', formatRupiah(inc));
  set('sumExpense', formatRupiah(exp));
  set('sumNet', (net >= 0 ? '+' : '-') + formatRupiah(Math.abs(net)));
  set('sumSelected', `${selCount}/${total}`);
  set('sumDup', String(dupCount));
  document.getElementById('sumDupWrap')?.classList.toggle('is-hidden', dupCount === 0);
  const barEl = document.getElementById('selBar');
  if (barEl) barEl.style.width = `${total ? Math.round((selCount / total) * 100) : 0}%`;
  const selAmt = importedRows.filter((r) => r.checked).reduce((s, r) => s + (r.type === 'Income' ? r.amount : -r.amount), 0);
  set('bulkCount', `${selCount} dipilih`);
  set('bulkTotal', (selAmt >= 0 ? '+' : '-') + formatRupiah(Math.abs(selAmt)));
  const btn = document.getElementById('btnConfirmImport');
  if (btn) {
    btn.textContent = `✅ Import ${selCount}`;
    btn.disabled = selCount === 0;
  }
}

function recalcSummary() {
  let inc = 0, exp = 0, selCount = 0, dupCount = 0;
  for (const r of importedRows) {
    if (r.dup) dupCount++;
    if (r.checked) {
      selCount++;
      if (r.type === 'Income') inc += r.amount; else exp += r.amount;
    }
  }
  updateSummary(inc, exp, selCount, dupCount, importedRows.length);
}

function toggleExpand(i) {
  expandedIdx = expandedIdx === i ? -1 : i;
  renderCards();
}

window.toggleExpandRow = toggleExpand;

window.toggleRowCheck = function(i, checked) {
  if (importedRows[i]) {
    importedRows[i].checked = !!checked;
    recalcSummary();
  }
};

function applyRowField(i, field, val) {
  const r = importedRows[i];
  if (!r) return;
  if (field === 'amount') r.amount = Math.max(0, Number(val) || 0);
  else r[field] = val;
  if (field === 'desc' && !r.categoryManual) r.category = autoTag(r.desc).category;
  if (field === 'category') r.categoryManual = true;
  renderCards();
  recalcSummary();
}

window.updateRowField = applyRowField;

function updateRowLive(i) {
  renderCards();
  recalcSummary();
}

window.toggleCheckAll = function(checked) {
  const vis = visibleRows();
  vis.forEach(({ r }) => { if (!hideDup || !r.dup) r.checked = !!checked; });
  renderCards();
  recalcSummary();
};

window.toggleHideDup = function() {
  hideDup = !hideDup;
  const btn = document.getElementById('btnHideDup');
  if (btn) btn.textContent = hideDup ? '👁️ Tampilkan duplikat' : '👁️ Sembunyikan duplikat';
  renderCards();
};

window.resetImport = function() {
  const inp = document.getElementById('fileInput');
  if (inp) inp.value = '';
  importedRows = [];
  expandedIdx = -1;
  hideDup = false;
  searchQuery = '';
  typeFilter = 'all';
  const si = document.getElementById('searchInput');
  if (si) si.value = '';
  gotoStep(1);
  showToast('Import dibatalkan', 'info');
};

window.backToUpload = function() {
  gotoStep(1);
};

window.confirmImport = async function() {
  const toImport = importedRows.filter((r) => r.checked);
  if (toImport.length === 0) {
    showToast('Pilih minimal 1 baris untuk diimport', 'warning');
    return;
  }
  if (!canEdit()) {
    showToast('Hanya Admin/Co-Manager yang dapat mengimpor', 'danger');
    return;
  }

  try {
    const pouches = await getPouches();
    if (!pouches.length) {
      showToast('Buat pouch dulu sebelum impor', 'danger');
      return;
    }
    const picked = document.getElementById('importPouchId')?.value;
    const targetPouchId = (picked && pouches.some((p) => p.id === picked)) ? picked : pouches[0].id;

    let income = 0, expense = 0;
    const overCats = new Set();
    for (const r of toImport) {
      if (r.type === 'Expense') {
        try {
          const { getCategories: gc } = await import('../services/categoryService.js');
          const { getBudgets: gb, monthKey: mk, monthSpending: ms } = await import('../services/budgetService.js');
          const { getTransactions: gt } = await import('../services/transactionService.js');
          const cats = await gc();
          const cat = cats.find((c) => c.name === r.category);
          if (cat && (!cat.type || cat.type === 'Expense')) {
            const month = mk();
            const b = (await gb(month)).find((x) => x.categoryId === cat.id);
            if (b && b.amount > 0) {
              const spent = (await ms(await gt(), month))[r.category] || 0;
              if (spent + r.amount > b.amount) overCats.add(r.category);
            }
          }
        } catch {}
      }
      await addTransaction({
        pouchId: targetPouchId,
        type: r.type,
        amount: r.amount,
        category: r.category,
        notes: r.desc,
        date: toLocalISO(r.date)
      });
      if (r.type === 'Income') income += r.amount; else expense += r.amount;
    }
    if (overCats.size) {
      showToast(`⚠️ Lewat budget: ${[...overCats].join(', ')}`, 'warning');
    }
    const fileName = document.getElementById('fileName')?.textContent || 'Import';
    try {
      await logImport({ fileName, count: toImport.length, income, expense, pouchId: targetPouchId });
    } catch (err) {
      console.warn('Log import gagal:', err);
    }

    const targetName = (await getPouches()).find((p) => p.id === targetPouchId)?.name || 'Pouch';
    const sumEl = document.getElementById('doneSummary');
    if (sumEl) sumEl.textContent = `${toImport.length} transaksi berhasil dimasukkan ke pouch ${targetName}. (+${formatRupiah(income)} / -${formatRupiah(expense)})`;
    gotoStep(3);
    importedRows = [];
    expandedIdx = -1;
    await renderImportHistory();
    showToast(`${toImport.length} transaksi berhasil diimport ke ${targetName}! 🎉`, 'success');
  } catch (err) {
    showToast('Gagal import: ' + err.message, 'danger');
  }
};

async function renderImportHistory() {
  const box = document.getElementById('importHistoryList');
  if (!box) return;
  let rows = [];
  try { rows = await getImports(); } catch { rows = []; }
  if (!rows.length) {
    box.innerHTML = '<p class="text-tertiary text-sm p-4">Belum ada riwayat import.</p>';
    return;
  }
  const { formatRupiah: fr } = await import('../core/helpers.js');
  box.innerHTML = rows.slice(0, 10).map((r) => `
      <div class="list__item">
        <div class="list__icon">📄</div>
        <div class="list__content">
          <div class="list__title">${escapeHtml(r.fileName)}</div>
          <div class="list__subtitle">${r.count} transaksi · ${new Date(r.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
        <div class="list__meta flex-col items-end">
          <span class="badge badge--success">Selesai</span>
          <span class="text-xs text-tertiary">+${fr(r.income || 0)} / -${fr(r.expense || 0)}</span>
        </div>
      </div>`).join('');
}

function bindReconcileEvents() {
  document.getElementById('btnBackToUpload')?.addEventListener('click', window.backToUpload);
  document.getElementById('btnCheckAll')?.addEventListener('click', () => window.toggleCheckAll(true));
  document.getElementById('btnUncheckAll')?.addEventListener('click', () => window.toggleCheckAll(false));
  document.getElementById('btnHideDup')?.addEventListener('click', window.toggleHideDup);
  document.getElementById('btnBulkCancel')?.addEventListener('click', window.resetImport);
  document.getElementById('btnConfirmImport')?.addEventListener('click', window.confirmImport);
  document.getElementById('btnImportAgain')?.addEventListener('click', () => {
    window.resetImport();
    gotoStep(1);
  });

  const si = document.getElementById('searchInput');
  if (si) {
    si.addEventListener('input', (e) => {
      searchQuery = e.target.value || '';
      renderCards();
    });
  }

  document.querySelectorAll('.chip-row .chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chip-row .chip').forEach((c) => c.classList.remove('chip--active'));
      btn.classList.add('chip--active');
      typeFilter = btn.dataset.filter || 'all';
      renderCards();
    });
  });

  const list = document.getElementById('previewBody');
  if (list) {
    list.addEventListener('click', (e) => {
      const check = e.target.closest('input.reconcile-check');
      if (check) {
        const idx = Number(check.dataset.check);
        if (importedRows[idx]) {
          importedRows[idx].checked = check.checked;
          recalcSummary();
        }
        return;
      }
      if (e.target.closest('.reconcile-card__editor')) return;
      const main = e.target.closest('.reconcile-card__main');
      if (main) {
        const idx = Number(main.dataset.idx);
        toggleExpand(idx);
      }
    });

    list.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const main = e.target.closest('.reconcile-card__main');
        if (main && e.target === main) {
          e.preventDefault();
          const idx = Number(main.dataset.idx);
          toggleExpand(idx);
        }
      }
    });

    list.addEventListener('change', (e) => {
      const target = e.target;
      const field = target.dataset.field;
      const idx = Number(target.dataset.idx);
      if (field && !isNaN(idx)) {
        applyRowField(idx, field, target.value);
      }
    });
  }
}

// ---- Main Entry ----
(async function init() {
  setupModalClose();
  requireAuth();
  try {
    const ok = await syncSessionRole();
    if (!ok) return;
  } catch {}
  bindDropzone();
  bindReconcileEvents();
  gotoStep(1);
  await initBanner();
  await renderImportHistory();
  try {
    await initApp();
  } catch (err) {
    console.error('Init DB gagal:', err);
  }
})();