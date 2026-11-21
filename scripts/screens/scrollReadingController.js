// ============================================================
// scripts/screens/scrollReadingController.js — template bulk import
// ============================================================

import { initApp, showToast } from '../app.js';
import { getGuild, updateGuild } from '../services/guildService.js';
import { getState } from '../core/gamification.js';
import { getPouches } from '../services/pouchService.js';
import { addTransaction } from '../services/transactionService.js';
import { logImport, getImports } from '../services/importService.js';
import { formatRupiah, setupModalClose, escapeHtml } from '../core/helpers.js';
import { autoTag } from '../core/autoTag.js';
import { getCategories } from '../services/categoryService.js';
import { requireAuth, syncSessionRole, canEdit } from '../core/authService.js';

let importedRows = [];
let hideDup = false;
let categoryList = [];
let expandedIdx = -1;
let searchQuery = '';
let typeFilter = 'all';
let pouchList = [];
const MAX_FILE = 10 * 1024 * 1024;
const TEMPLATE_HEADERS = ['Date', 'Deskripsi Transaksi', 'Amount', 'Cashflow (Source of fund)', 'Kategori'];

function normalize(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function parseDate(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !isNaN(value)) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400000);
    return isNaN(date) ? '' : date.toISOString().slice(0, 10);
  }
  const text = normalize(value);
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(text);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const parsed = new Date(text);
  return isNaN(parsed) ? '' : parsed.toISOString().slice(0, 10);
}

function parseAmount(value) {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : Math.round(Math.abs(value) * 100) / 100;
  }
  let text = normalize(value).replace(/Rp\s*/i, '').trim();
  if (!text) return 0;
  if (text.includes('.') && text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (text.includes(',')) {
    if (/,\d{3}$/.test(text) && !text.includes('.')) {
      text = text.replace(/,/g, '');
    } else {
      text = text.replace(',', '.');
    }
  } else if (text.includes('.')) {
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
      text = text.replace(/\./g, '');
    }
  }
  const raw = Number(text);
  if (isNaN(raw) || raw === 0) return 0;
  return Math.round(Math.abs(raw) * 100) / 100;
}

function rowHash(r) {
  return [r.date, normalize(r.desc).toLowerCase(), Math.round(r.amount * 100), r.type].join('|');
}

function toLocalISO(dateValue) {
  if (!dateValue) return new Date().toISOString();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0).toISOString();
  return new Date(dateValue).toISOString();
}

async function initBanner() {
  const [guild, pouches, state] = await Promise.all([getGuild(), getPouches(), getState()]);
  pouchList = pouches;
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

function csvEscape(value) {
  const text = normalize(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadText(fileName, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildTemplateCsv() {
  const headers = TEMPLATE_HEADERS.map(csvEscape).join(',');
  const pouchNames = pouchList.map(p => csvEscape(p.name)).join(' / ');
  const catNames = categoryList.map(c => csvEscape(c.name)).join(' / ');
  const rows = [
    headers,
    ['2026-03-15', csvEscape('Belanja Bulanan'), 150000, csvEscape('Kas Utama'), csvEscape('Makanan')].join(','),
    ['2026-03-16', csvEscape('Gaji Transfer'), 5000000, csvEscape('BCA'), csvEscape('Gaji')].join(','),
    ['2026-03-17', csvEscape('Langganan Internet'), 300000, '', csvEscape('Utilitas')].join(',')
  ];
  return [
    'Template Import Transaksi KelolaRacun',
    '',
    `Pouch tersedia: ${pouchNames || '-'}`,
    `Kategori tersedia: ${catNames || '-'}`,
    '',
    'ATURAN:',
    '- Date: YYYY-MM-DD (contoh: 2026-03-15).',
    '- Amount: angka positif, tanpa Rp atau titik ribuan.',
    '- Cashflow (Source of fund): isi nama pouch. Kosongkan untuk memakai Pouch Cadangan.',
    '- Kategori: nama kategori; kosongkan untuk auto-tag otomatis.',
    '',
    rows.join('\n')
  ].join('\n');
}

function downloadCsvTemplate() {
  downloadText(`template-bulk-${new Date().toISOString().slice(0, 10)}.csv`, buildTemplateCsv(), 'text/csv;charset=utf-8');
  showToast('Template CSV diunduh', 'success');
}

function downloadXlsxTemplate() {
  if (!window.XLSX) {
    showToast('Library Excel belum termuat. Muat ulang halaman.', 'danger');
    return;
  }
  const pouchNames = pouchList.map(p => p.name).join(' / ');
  const catNames = categoryList.map(c => c.name).join(' / ');
  const workbook = window.XLSX.utils.book_new();
  const sheet = window.XLSX.utils.aoa_to_sheet([
    ['Template Import Transaksi KelolaRacun'],
    [''],
    [`Pouch tersedia: ${pouchNames || '-'}`],
    [`Kategori tersedia: ${catNames || '-'}`],
    [''],
    ['ATURAN:'],
    ['- Date: YYYY-MM-DD (contoh: 2026-03-15).'],
    ['- Amount: angka positif, tanpa Rp atau titik ribuan.'],
    ['- Cashflow (Source of fund): isi nama pouch. Kosongkan untuk memakai Pouch Cadangan.'],
    ['- Kategori: nama kategori; kosongkan untuk auto-tag otomatis.'],
    [''],
    TEMPLATE_HEADERS,
    ['2026-03-15', 'Belanja Bulanan', 150000, 'Kas Utama', 'Makanan'],
    ['2026-03-16', 'Gaji Transfer', 5000000, 'BCA', 'Gaji'],
    ['2026-03-17', 'Langganan Internet', 300000, '', 'Utilitas']
  ]);
  window.XLSX.utils.book_append_sheet(workbook, sheet, 'Template');
  window.XLSX.writeFile(workbook, `template-bulk-${new Date().toISOString().slice(0, 10)}.xlsx`);
  showToast('Template Excel diunduh', 'success');
}

function parseCsvToMatrix(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (c === '\r') {
        // ignore
      } else if (c === '\n') {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += c;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

function handlePickedFile(file) {
  if (!file) return;
  if (file.size > MAX_FILE) {
    showToast('File > 10MB, kecilkan dulu', 'danger');
    const inp = document.getElementById('fileInput');
    if (inp) inp.value = '';
    return;
  }
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    showToast('Format file harus CSV atau Excel (.xlsx / .xls)', 'danger');
    return;
  }
  showToast('File dipilih: ' + file.name, 'info');
  const fn = document.getElementById('fileName');
  if (fn) fn.textContent = file.name;

  if (/\.csv$/i.test(file.name)) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const matrix = parseCsvToMatrix(evt.target.result);
      parseTemplateRows(matrix, file.name);
    };
    reader.onerror = function() {
      showToast('File gagal dibaca', 'danger');
    };
    reader.readAsText(file, 'utf-8');
    return;
  }

  if (!window.XLSX) {
    showToast('Library Excel belum termuat. Muat ulang halaman.', 'danger');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const workbook = window.XLSX.read(evt.target.result, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('File tidak berisi sheet');
      const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
      parseTemplateRows(rows, file.name);
    } catch (err) {
      console.warn('Excel parse gagal:', err);
      showToast('Excel gagal dibaca: ' + err.message, 'danger');
    }
  };
  reader.onerror = function() {
    showToast('File gagal dibaca', 'danger');
  };
  reader.readAsArrayBuffer(file);
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

function findHeaderIndex(headers, aliases) {
  const lower = headers.map(h => normalize(h).toLowerCase());
  for (const alias of aliases) {
    const idx = lower.findIndex(h => h === alias.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function findTemplateHeader(rows) {
  const aliases = {
    date: ['date', 'tanggal', 'tgl'],
    desc: ['deskripsi transaksi', 'deskripsi', 'keterangan', 'description', 'desc'],
    amount: ['amount', 'nominal', 'jumlah', 'nilai'],
    pouch: ['cashflow (source of fund)', 'cashflow', 'source of fund', 'pouch', 'dompet'],
    category: ['kategori', 'category', 'kategori transaksi']
  };
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const row = rows[r] || [];
    const idx = {
      date: findHeaderIndex(row, aliases.date),
      desc: findHeaderIndex(row, aliases.desc),
      amount: findHeaderIndex(row, aliases.amount),
      pouch: findHeaderIndex(row, aliases.pouch),
      category: findHeaderIndex(row, aliases.category)
    };
    if (idx.date >= 0 && idx.desc >= 0 && idx.amount >= 0) return { row: r, ...idx };
  }
  return null;
}

function markDuplicates(staged, existingTxs) {
  const hashes = new Set((existingTxs || []).map(t => rowHash({
    date: parseDate(t.date),
    desc: t.notes || t.desc || '',
    amount: Number(t.amount) || 0,
    type: t.type || (Number(t.amount) >= 0 ? 'Income' : 'Expense')
  })));
  return staged.map(r => ({ ...r, dup: hashes.has(r.hash) }));
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

async function parseTemplateRows(rows, fileName) {
  try { if (!categoryList.length) categoryList = await getCategories(); } catch {}
  const header = findTemplateHeader(rows);
  if (!header) {
    showToast('Header template tidak dikenali. Gunakan template resmi.', 'danger');
    return;
  }
  const rawRows = [];
  const skipped = [];
  for (let i = header.row + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const date = parseDate(row[header.date]);
    const desc = normalize(row[header.desc]);
    const amount = parseAmount(row[header.amount]);
    const pouchName = normalize(row[header.pouch]);
    const category = normalize(row[header.category]);
    if (!date || !desc || !amount) {
      skipped.push(i + 1);
      continue;
    }
    const targetCat = category || autoTag(desc).category;
    let type = 'Expense';
    const foundCat = (categoryList || []).find(c => c.name.toLowerCase() === targetCat.toLowerCase());
    if (foundCat && foundCat.type) {
      type = foundCat.type;
    } else if (/gaji|salary|pendapatan|income|transfer masuk|terima|dividen|bonus/i.test(desc) || /gaji|investasi/i.test(targetCat)) {
      type = 'Income';
    }
    const rawAmount = Math.abs(amount);
    rawRows.push({ date, desc, amount: rawAmount, type, category: targetCat, pouchName, hash: rowHash({ date, desc, amount: rawAmount, type }) });
  }
  if (!rawRows.length) {
    showToast('Tidak ada baris transaksi valid. Cek format Date, Deskripsi, dan Amount.', 'warning');
    return;
  }
  await stageRows(rawRows, fileName, skipped.length);
  if (skipped.length) {
    showToast(`${skipped.length} baris dilewati karena data wajib kosong atau invalid`, 'warning');
  }
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
            <span class="badge badge--info text-xs">${escapeHtml(r.pouchName || 'Pouch Cadangan')}</span>
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
        <div>
          <label>Cashflow (Source of fund)</label>
          <select class="modal__select text-sm" data-field="pouchName" data-idx="${i}">
            <option value="" ${!r.pouchName ? 'selected' : ''}>Pouch Cadangan</option>
            ${pouchList.map(p => `<option value="${escapeHtml(p.name)}" ${p.name === r.pouchName ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
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
    const fallbackPouch = (picked && pouches.some((p) => p.id === picked)) ? picked : pouches[0].id;
    const pouchByName = new Map(pouches.map(p => [p.name, p.id]));

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
      const targetPouchId = r.pouchName ? (pouchByName.get(r.pouchName) || fallbackPouch) : fallbackPouch;
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
      await logImport({ fileName, count: toImport.length, income, expense, pouchId: fallbackPouch });
    } catch (err) {
      console.warn('Log import gagal:', err);
    }

    const targetName = (await getPouches()).find((p) => p.id === fallbackPouch)?.name || 'Pouch';
    const sumEl = document.getElementById('doneSummary');
    if (sumEl) sumEl.textContent = `${toImport.length} transaksi berhasil dimasukkan. Fallback: pouch ${targetName}. (+${formatRupiah(income)} / -${formatRupiah(expense)})`;
    gotoStep(3);
    importedRows = [];
    expandedIdx = -1;
    await renderImportHistory();
    showToast(`${toImport.length} transaksi berhasil diimport! 🎉`, 'success');
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
  document.getElementById('btnDownloadXlsx')?.addEventListener('click', downloadXlsxTemplate);
  document.getElementById('btnDownloadCsv')?.addEventListener('click', downloadCsvTemplate);
  bindDropzone();
  bindReconcileEvents();
  gotoStep(1);
  try { categoryList = await getCategories(); } catch {}
  await initBanner();
  await renderImportHistory();
  try {
    await initApp();
  } catch (err) {
    console.error('Init DB gagal:', err);
  }
})();
