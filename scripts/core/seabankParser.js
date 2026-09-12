export const MONTHS_ID = { jan: '01', januari: '01', feb: '02', februari: '02', mar: '03', maret: '03', apr: '04', april: '04', mei: '05', jun: '06', juni: '06', jul: '07', juli: '07', agu: '08', agustus: '08', sep: '09', sept: '09', september: '09', okt: '10', oktober: '10', nov: '11', november: '11', des: '12', desember: '12' };

export function parseIdr(raw) {
  if (raw == null) return 0;
  const s = String(raw).replace(/[^0-9.,-]/g, '').trim();
  if (!s) return 0;
  const neg = s.startsWith('-');
  const digits = s.replace(/[^0-9]/g, '');
  const n = Number(digits) || 0;
  return neg ? -n : n;
}

export function normDateId(raw, fallbackYear) {
  const t = String(raw || '').toLowerCase().replace(/\s+/g, ' ').trim();
  let m = t.match(/(\d{1,2})[\s\-\/.]+([a-z]+)[\s\-\/.]+(\d{2,4})/);
  if (m) {
    const d = String(m[1]).padStart(2, '0');
    const mo = MONTHS_ID[m[2]] || '01';
    let y = m[3];
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo}-${d}`;
  }
  m = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const d = String(m[1]).padStart(2, '0');
    const mo = String(m[2]).padStart(2, '0');
    let y = m[3];
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo}-${d}`;
  }
  m = t.match(/(\d{1,2})\s+([a-z]+)/);
  if (m) {
    const y = fallbackYear || new Date().getFullYear();
    return `${y}-${MONTHS_ID[m[2]] || '01'}-${String(m[1]).padStart(2, '0')}`;
  }
  return '';
}

const DATE_RE = /(\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{2,4})?|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/;
const AMT_RE = /-?(?:\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{5,}(?:,\d{2})?)/g;
const SKIP_RE = /halaman|page|seabank|periode|rekening|mutasi|opening|closing|balance|saldo awal/i;

export function rowHash(r) {
  const key = `${r.date}|${String(r.desc || '').toLowerCase().replace(/\s+/g, ' ').trim()}|${r.amount}|${r.type}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return 'sb-' + Math.abs(h).toString(36);
}

function groupByRow(items, yTol) {
  const pts = items.filter((c) => c && String(c.text || '').trim()).slice();
  pts.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const p of pts) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - p.y) <= yTol) {
      last.cells.push(p);
      last.y = (last.y * (last.cells.length - 1) + p.y) / last.cells.length;
    } else {
      rows.push({ y: p.y, cells: [p] });
    }
  }
  for (const r of rows) r.cells.sort((a, b) => a.x - b.x);
  return rows;
}

function headerX(cells, re) {
  const c = cells.find((c) => re.test(String(c.text || '').toLowerCase()));
  return c ? c.x : null;
}

function isHeaderRow(cells) {
  const j = cells.map((c) => String(c.text || '').toLowerCase()).join(' ');
  return j.includes('keluar') && j.includes('masuk') && /tanggal|transaksi|keterangan|deskripsi/.test(j);
}

export function parseTableRows(allRowCells, fallbackYear) {
  const rows = [];
  let skipped = 0;
  let zone = null;
  let lastRow = null;

  for (const cells of allRowCells) {
    if (!cells.length) continue;
    if (isHeaderRow(cells)) {
      zone = {
        keluarX: headerX(cells, /keluar/),
        masukX: headerX(cells, /masuk/),
        saldoX: headerX(cells, /saldo/)
      };
      continue;
    }
    const joined = cells.map((c) => String(c.text || '')).join(' ').replace(/\s+/g, ' ').trim();
    if (!joined) continue;
    const dm = joined.match(DATE_RE);
    if (!dm) {
      if (lastRow && !AMT_RE.test(joined) && joined.length > 2 && !SKIP_RE.test(joined)) {
        lastRow.desc = (lastRow.desc + ' ' + joined).slice(0, 160);
      }
      continue;
    }
    if (!zone || zone.keluarX == null || zone.masukX == null) { skipped++; continue; }
    if (SKIP_RE.test(joined)) continue;
    const date = normDateId(dm[1], fallbackYear);
    if (!date) { skipped++; continue; }

    const keluarVals = [];
    const masukVals = [];
    const descParts = [];
    for (const c of cells) {
      const t = String(c.text || '');
      const nums = t.match(AMT_RE) || [];
      if (nums.length) {
        for (const n of nums) {
          const v = parseIdr(n);
          if (v <= 0) continue;
          const dk = Math.abs(c.x - zone.keluarX);
          const dmx = Math.abs(c.x - zone.masukX);
          const ds = zone.saldoX == null ? Infinity : Math.abs(c.x - zone.saldoX);
          if (dk <= dmx && dk <= ds) keluarVals.push(v);
          else if (dmx <= dk && dmx <= ds) masukVals.push(v);
        }
      } else {
        descParts.push(t);
      }
    }
    let desc = descParts.join(' ').replace(dm[1], ' ').replace(/\b(19|20)\d{2}\b/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 160) || 'SeaBank Transaction';
    if (keluarVals.length === 1 && masukVals.length === 0) {
      const done = { date, desc, amount: keluarVals[0], type: 'Expense' };
      const r = { ...done, hash: rowHash(done) };
      rows.push(r);
      lastRow = r;
    } else if (masukVals.length === 1 && keluarVals.length === 0) {
      const done = { date, desc, amount: masukVals[0], type: 'Income' };
      const r = { ...done, hash: rowHash(done) };
      rows.push(r);
      lastRow = r;
    } else {
      skipped++;
    }
  }
  return { rows, skipped, noHeader: !zone };
}

export function parsePdfItemsToRows(pagesItems, fallbackYear) {
  const all = [];
  for (const pg of pagesItems || []) {
    const grouped = groupByRow(pg.items || [], 2.5);
    for (const g of grouped) all.push(g.cells);
  }
  return parseTableRows(all, fallbackYear);
}

export function parseOcrWordsToRows(pagesWords, fallbackYear) {
  const all = [];
  for (const pg of pagesWords || []) {
    const grouped = groupByRow(pg.words || [], 8);
    for (const g of grouped) all.push(g.cells);
  }
  return parseTableRows(all, fallbackYear);
}

export function parseLinesToRows() {
  return [];
}

export function markDuplicates(staged, existingTxs) {
  const seen = new Set((existingTxs || []).map((t) => {
    const key = `${String(t.date || '').slice(0, 10)}|${String(t.notes || t.desc || '').toLowerCase().replace(/\s+/g, ' ').trim()}|${t.amount}|${t.type}`;
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    return 'sb-' + Math.abs(h).toString(36);
  }));
  const local = new Set();
  return staged.map((r) => {
    const dup = seen.has(r.hash) || local.has(r.hash);
    local.add(r.hash);
    return { ...r, dup };
  });
}
