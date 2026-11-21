import { initApp, showToast } from '../app.js';
import { getGuild, updateGuild } from '../services/guildService.js';
import { getPouches } from '../services/pouchService.js';
import { getTransactions, getAgingReport, markTransactionsReviewed } from '../services/transactionService.js';
import { getBills } from '../services/billService.js';
import { getCategories } from '../services/categoryService.js';
import { getMonthView, monthKey } from '../services/budgetService.js';
import { getState } from '../core/gamification.js';
import { requireAuth, syncSessionRole } from '../core/authService.js';
import { subscribe } from '../core/eventBus.js';
import { formatRupiah, formatDate, escapeHtml, setupModalClose } from '../core/helpers.js';

let charts = {};
let allTx = [];
let allBills = [];
let selMonth = '';

function safeKey(v) {
  try { return monthKey(v); } catch { return ''; }
}

function monthTx(month) {
  return allTx.filter((t) => safeKey(t.date) === month);
}

function paidBills(month) {
  return allBills.filter((b) => b.status === 'Paid' && b.paidAt && safeKey(b.paidAt) === month);
}

function sumBy(list, type) {
  return list.filter((t) => t.type === type).reduce((s, t) => s + (Number(t.amount) || 0), 0);
}

function fmtPct(n) {
  if (!Number.isFinite(n)) return '-';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function mom(cur, prev) {
  if (!prev) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

function renderBanner(pouches, guild, state) {
  const total = (pouches || []).reduce((s, p) => s + (Number(p.balance) || 0), 0);
  document.querySelectorAll('.guild-banner__gold').forEach((el) => { el.textContent = formatRupiah(total); });
  const nameEl = document.querySelector('.guild-banner__title');
  if (nameEl && guild) nameEl.textContent = guild.familyName || 'KelolaRacun';
  const lv = state?.level || 1;
  document.querySelectorAll('.guild-level').forEach((el) => { el.textContent = `Lv. ${lv}`; });
  if (guild && guild.guildLevel !== lv) { try { updateGuild({ guildLevel: lv }); } catch {} }
}

function buildMonths() {
  const set = new Set();
  allTx.forEach((t) => { const k = safeKey(t.date); if (k) set.add(k); });
  return [...set].sort().reverse();
}

function monthLabel(m) {
  try {
    const x = /^(\d{4})-(\d{2})$/.exec(m);
    return new Date(+x[1], +x[2] - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  } catch { return m; }
}

function renderPicker(months) {
  const sel = document.getElementById('sumMonth');
  if (!sel) return;
  sel.innerHTML = months.map((m) => `<option value="${m}">${monthLabel(m)}</option>`).join('');
  if (selMonth && months.includes(selMonth)) sel.value = selMonth;
}

async function renderAgingReport() {
  const wrap = document.getElementById('agingReport');
  if (!wrap) return;
  const report = await getAgingReport(30);
  const total = report.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  wrap.innerHTML = `<div class="flex items-center justify-between gap-2 flex-wrap mb-3"><div><h3>Belum direview</h3><p class="text-sm text-tertiary">${report.length} transaksi lebih dari 30 hari · ${formatRupiah(total)}</p></div>${report.length ? '<button class="btn btn--secondary btn--sm" id="btnReviewAging">✓ Tandai yang terlihat sudah direview</button>' : ''}</div>${report.length ? `<div class="stack-col">${report.map((tx) => `<label class="list__item"><input type="checkbox" data-aging-id="${escapeHtml(tx.id)}"><span class="list__content"><span class="list__title">${escapeHtml(tx.notes || tx.category || tx.type)}</span><span class="list__subtitle">${formatDate(tx.date)} · ${tx.ageDays} hari</span></span><span class="list__amount">${formatRupiah(tx.amount)}</span></label>`).join('')}</div>` : '<p class="text-sm text-tertiary">Tidak ada transaksi aging.</p>'}`;
  const button = document.getElementById('btnReviewAging');
  button?.addEventListener('click', async () => {
    const ids = [...wrap.querySelectorAll('[data-aging-id]:checked')].map((el) => el.dataset.agingId);
    if (!ids.length) return showToast('Pilih transaksi dulu', 'warning');
    await markTransactionsReviewed(ids);
    showToast(`${ids.length} transaksi ditandai sudah direview`, 'success');
    await renderAgingReport();
  });
}

async function renderAll() {
  const months = buildMonths();
  const empty = document.getElementById('sumEmpty');
  const body = document.getElementById('sumBody');
  if (!months.length) {
    if (empty) empty.classList.remove('is-hidden');
    if (body) body.classList.add('is-hidden');
    return;
  }
  if (empty) empty.classList.add('is-hidden');
  if (body) body.classList.remove('is-hidden');
  if (!months.includes(selMonth)) selMonth = months[0];
  renderPicker(months);
  await renderAgingReport();

  const list = monthTx(selMonth);
  const income = sumBy(list, 'Income');
  const spending = sumBy(list, 'Expense');
  const net = income - spending;
  const paid = paidBills(selMonth);
  const paidSum = paid.reduce((s, b) => s + (Number(b.paidAmount) || Number(b.amount) || 0), 0);
  const billsAll = allBills.filter((b) => {
    const due = safeKey(b.dueDate);
    const pd = b.paidAt ? safeKey(b.paidAt) : '';
    return due === selMonth || pd === selMonth;
  });
  const completion = billsAll.length ? Math.round((paid.length / billsAll.length) * 100) : 0;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('sumKpiTitle', `Ringkasan · ${monthLabel(selMonth)}`);
  set('kpiIncome', formatRupiah(income));
  set('kpiSpending', formatRupiah(spending));
  set('kpiBills', paid.length ? `${paid.length} lunas · ${formatRupiah(paidSum)}` : 'Rp0');
  set('kpiBillsSub', billsAll.length ? `${completion}% tagihan ${monthLabel(selMonth)}` : `Tidak ada tagihan ${monthLabel(selMonth)}`);
  const balEl = document.getElementById('kpiBalance');
  if (balEl) { balEl.textContent = formatRupiah(net); balEl.className = `font-bold text-base hs-metric ${net >= 0 ? 'text-income' : 'text-expense'}`; }
  set('kpiBalanceSub', `dari ${list.length} transaksi ${monthLabel(selMonth)}`);
  set('kpiIncomeSub', `${list.filter((t) => t.type === 'Income').length} pemasukan`);
  set('kpiSpendingSub', `${list.filter((t) => t.type === 'Expense').length} pengeluaran`);

  const idx = months.indexOf(selMonth);
  const prevKey = idx >= 0 && idx + 1 < months.length ? months[idx + 1] : '';
  const prevList = prevKey ? monthTx(prevKey) : [];
  const pInc = sumBy(prevList, 'Income');
  const pExp = sumBy(prevList, 'Expense');
  const mi = mom(income, pInc);
  const me = mom(spending, pExp);
  set('anHeader', `Analisa ${monthLabel(selMonth)}`);
  set('anMomInc', prevKey ? fmtPct(mi) : '-');
  set('anMomExp', prevKey ? fmtPct(me) : '-');
  set('anMomIncSub', `vs ${prevKey ? monthLabel(prevKey) : '-'}`);
  set('anMomExpSub', `vs ${prevKey ? monthLabel(prevKey) : '-'}`);
  const saving = income > 0 ? Math.max(0, ((income - spending) / income) * 100) : 0;
  set('anSaving', `${saving.toFixed(1)}%`);

  const d = /^(\d{4})-(\d{2})$/.exec(selMonth);
  const daysIn = d ? new Date(+d[1], +d[2], 0).getDate() : 30;
  const now = new Date();
  const isCur = d && +d[1] === now.getFullYear() && +d[2] - 1 === now.getMonth();
  const dayN = isCur ? Math.max(1, now.getDate()) : daysIn;
  const avg = spending / Math.max(1, dayN);
  const proj = avg * daysIn;
  set('anDaily', formatRupiah(avg));
  set('anDailySub', isCur ? `proyeksi ${formatRupiah(proj)} akhir ${monthLabel(selMonth)}` : `${daysIn} hari ${monthLabel(selMonth)}`);

  const cats = await getCategories();
  const view = await getMonthView(selMonth, allTx);
  const rows = (view || []).map((b) => {
    const cat = cats.find((c) => c.id === b.categoryId) || { name: b.categoryName, icon: '🏷️' };
    return { name: cat.name || b.categoryName, icon: cat.icon || '🏷️', limit: b.amount || 0, used: b.used || 0 };
  }).filter((r) => r.limit > 0);
  const totB = rows.reduce((s, r) => s + r.limit, 0);
  const totU = rows.reduce((s, r) => s + r.used, 0);
  const over = rows.filter((r) => r.used > r.limit);
  const overRp = over.reduce((s, r) => s + (r.used - r.limit), 0);
  set('anAdhere', rows.length ? `${Math.round((rows.filter((r) => r.used <= r.limit).length / rows.length) * 100)}%` : '-');
  set('anAdhereSub', rows.length ? `${over.length} jebol · ${formatRupiah(overRp)}` : 'Belum ada budget');

  const unpaid = allBills.filter((b) => (b.status === 'Pending' || b.status === 'Partial') && safeKey(b.dueDate) === selMonth);
  const unpaidRp = unpaid.reduce((s, b) => s + ((Number(b.amount) || 0) - (Number(b.paidAmount) || 0)), 0);
  set('anUnpaid', unpaid.length ? `${unpaid.length} · ${formatRupiah(unpaidRp)}` : 'aman');
  set('anUnpaidSub', unpaid.length ? `jatuh tempo ${monthLabel(selMonth)}` : `tidak ada sisa ${monthLabel(selMonth)}`);

  const byCat = {};
  list.filter((t) => t.type === 'Expense').forEach((t) => { byCat[t.category || 'Lainnya'] = (byCat[t.category || 'Lainnya'] || 0) + t.amount; });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topBox = document.getElementById('anTopList');
  if (topBox) {
    topBox.innerHTML = top.length ? top.map(([n, v], i) => `
      <div class="mb-3">
        <div class="flex justify-between mb-1">
          <span class="font-semibold text-sm">${i + 1}. ${escapeHtml(n)}</span>
          <span class="text-sm">${formatRupiah(v)}</span>
        </div>
        <div class="bar-track bar-track--sm"><div class="bar-fill--expense" style="width: ${spending > 0 ? Math.min(100, Math.round((v / spending) * 100)) : 0}%;"></div></div>
      </div>`).join('') : '<p class="text-tertiary text-sm">Belum ada pengeluaran bulan ini.</p>';
  }

  set('sumBudgetLabel', monthLabel(selMonth));
  set('sumBudgetTotal', `${formatRupiah(totU)} / ${formatRupiah(totB)}`);
  const bb = document.getElementById('sumBudgetBar');
  if (bb) bb.style.width = (totB > 0 ? Math.min(100, Math.round((totU / totB) * 100)) : 0) + '%';
  set('sumBudgetNote', over.length ? `⚠️ ${over.length} kategori jebol ${formatRupiah(overRp)}` : (rows.length ? 'Semua kategori dalam batas.' : ''));
  const bl = document.getElementById('sumBudgetList');
  if (bl) {
    bl.innerHTML = rows.length ? rows.map((r) => {
      const pct = r.limit > 0 ? Math.min(100, Math.round((r.used / r.limit) * 100)) : 0;
      const st = r.used > r.limit ? `Lewat ${formatRupiah(r.used - r.limit)}` : `Sisa ${formatRupiah(r.limit - r.used)}`;
      const cls = r.used > r.limit ? 'text-expense' : pct >= 80 ? 'bill-due--soon' : 'text-income';
      return `
      <div class="mb-3">
        <div class="flex justify-between mb-1">
          <span class="font-semibold text-sm">${escapeHtml(r.icon)} ${escapeHtml(r.name)}</span>
          <span class="text-sm">${formatRupiah(r.used)} / ${formatRupiah(r.limit)}</span>
        </div>
        <div class="bar-track bar-track--sm"><div class="bar-fill--expense" style="width: ${pct}%;"></div></div>
        <p class="text-tertiary text-xs mt-1 ${cls}">${st}</p>
      </div>`;
    }).join('') : '<p class="text-tertiary text-sm p-4">Belum ada budget bulan ini. Atur di Hall → Budget Kategori.</p>';
  }

  set('billsHeader', `Tagihan Lunas ${monthLabel(selMonth)}`);
  const badge = document.getElementById('sumBillsBadge');
  if (badge) badge.textContent = paid.length ? `${paid.length} lunas` : 'nihil';
  const pl = document.getElementById('sumBillsList');
  if (pl) {
    pl.innerHTML = paid.length ? paid.map((b) => `
      <div class="list__item">
        <div class="list__icon">🧾</div>
        <div class="list__content">
          <div class="list__title">${escapeHtml(b.title)}</div>
          <div class="list__subtitle">Lunas ${formatDate(b.paidAt)}${b.category ? ` · ${escapeHtml(b.category)}` : ''}</div>
        </div>
        <div class="list__meta"><span class="list__amount list__amount--success font-bold">${formatRupiah(b.paidAmount || b.amount)}</span></div>
      </div>`).join('') : '<p class="text-tertiary text-sm p-4">Tidak ada tagihan lunas bulan ini.</p>';
  }

  set('txHeader', `Transaksi ${monthLabel(selMonth)}`);
  const tb = document.getElementById('sumTxBadge');
  if (tb) tb.textContent = `${list.length} transaksi`;
  const tl = document.getElementById('sumTxList');
  if (tl) {
    const sorted = list.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
    tl.innerHTML = sorted.length ? sorted.map((t) => `
      <div class="list__item">
        <div class="list__icon">${t.type === 'Income' ? '💰' : t.type === 'Transfer' ? '🔄' : '💸'}</div>
        <div class="list__content">
          <div class="list__title">${escapeHtml(t.category)}</div>
          <div class="list__subtitle">${escapeHtml(t.notes || t.type)} · ${formatDate(t.date)}</div>
        </div>
        <div class="list__meta"><span class="list__amount ${t.type === 'Income' ? 'list__amount--success' : 'list__amount--danger'} font-bold">${t.type === 'Income' ? '+' : '-'}${formatRupiah(t.amount)}</span></div>
      </div>`).join('') : '<p class="text-tertiary text-sm p-4">Tidak ada transaksi bulan ini.</p>';
  }

  renderCharts(months);
  set('printTitle', `Laporan Bulanan — ${monthLabel(selMonth)}`);
  set('printSub', `Income ${formatRupiah(income)} · Spending ${formatRupiah(spending)} · Bills paid ${paid.length} (${formatRupiah(paidSum)}) · Sisa ${formatRupiah(net)}`);
}

function compact(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'M';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'jt';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'rb';
  return String(n);
}

function renderCharts(months) {
  if (typeof Chart === 'undefined') return;
  const cssColor = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const text = cssColor('--color-text-primary', '#fff6d5');
  const grid = cssColor('--chart-grid', 'rgba(255,255,255,.14)');
  const income = cssColor('--color-income-500', '#5eead4');
  const expense = cssColor('--color-expense-500', '#ff9b9f');
  const gold = cssColor('--color-gold-500', '#ffcc66');
  const blue = cssColor('--color-blue-500', '#65d9ff');
  Chart.defaults.color = text;
  Chart.defaults.borderColor = grid;
  const idx = months.indexOf(selMonth);
  const win = idx >= 0 ? months.slice(idx, idx + 6).reverse() : months.slice(0, 6).reverse();
  const cf = document.getElementById('sumCashflow');
  if (cf) {
    if (charts.cf) charts.cf.destroy();
    charts.cf = new Chart(cf, {
      type: 'line',
      data: {
        labels: win.map((m) => monthLabel(m).split(' ')[0]),
        datasets: [
          { label: 'Pemasukan', data: win.map((m) => sumBy(monthTx(m), 'Income')), borderColor: income, backgroundColor: income, fill: true, tension: 0.3, borderWidth: 2 },
          { label: 'Pengeluaran', data: win.map((m) => sumBy(monthTx(m), 'Expense')), borderColor: expense, backgroundColor: expense, fill: true, tension: 0.3, borderWidth: 2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: text } }, title: { display: true, text: 'Cashflow 6 Bulan', color: text } },
        scales: { x: { ticks: { color: text }, grid: { display: false } }, y: { ticks: { color: text, callback: compact }, grid: { color: grid } } }
      }
    });
  }
  const pie = document.getElementById('sumExpensePie');
  if (pie) {
    if (charts.pie) charts.pie.destroy();
    const byCat = {};
    monthTx(selMonth).filter((t) => t.type === 'Expense').forEach((t) => { byCat[t.category || 'Lainnya'] = (byCat[t.category || 'Lainnya'] || 0) + t.amount; });
    const rows = Object.entries(byCat).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
    const pal = [expense, gold, blue, income, text, grid];
    charts.pie = new Chart(pie, {
      type: 'doughnut',
      data: { labels: rows.map((r) => r.label), datasets: [{ data: rows.map((r) => r.value), backgroundColor: rows.map((_, i) => pal[i % pal.length]), borderWidth: 2, borderColor: 'transparent' }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { color: text, boxWidth: 12 } }, title: { display: true, text: `Breakdown ${monthLabel(selMonth)}`, color: text } } }
    });
  }
}

function csvCell(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

async function exportCsv() {
  const rows = [[`SUMMARY ${monthLabel(selMonth)}`]];
  const list = monthTx(selMonth);
  const income = sumBy(list, 'Income');
  const spending = sumBy(list, 'Expense');
  const paid = paidBills(selMonth);
  const paidSum = paid.reduce((s, b) => s + (Number(b.paidAmount) || Number(b.amount) || 0), 0);
  rows.push(['Metric', 'Value']);
  rows.push(['Total income', income]);
  rows.push(['Total spending', spending]);
  rows.push(['Bills paid count', paid.length]);
  rows.push(['Bills paid nominal', paidSum]);
  rows.push(['Sisa uang', income - spending]);
  rows.push([]);
  rows.push(['BUDGET VS SPENDING']);
  rows.push(['Kategori', 'Budget', 'Realisasi', 'Sisa']);
  const cats = await getCategories();
  const view = await getMonthView(selMonth, allTx);
  (view || []).forEach((b) => {
    const cat = cats.find((c) => c.id === b.categoryId);
    rows.push([cat?.name || b.categoryName, b.amount || 0, b.used || 0, (b.amount || 0) - (b.used || 0)]);
  });
  rows.push([]);
  rows.push(['TRANSAKSI']);
  rows.push(['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Catatan']);
  list.slice().sort((a, b) => new Date(a.date) - new Date(b.date)).forEach((t) => {
    rows.push([formatDate(t.date), t.type, t.category, t.amount, t.notes || '']);
  });
  // ponytail: CSV polos; upgrade ke XLSX pakai vendor/xlsx bila diminta.
  const blob = new Blob([`\uFEFF${rows.map((r) => r.map(csvCell).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `summary-${selMonth}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  showToast('CSV diunduh 📥', 'success');
}

async function boot() {
  setupModalClose();
  requireAuth();
  try { await initApp(); } catch (e) { console.error(e); }
  try { if (!(await syncSessionRole())) return; } catch {}
  const [guild, pouches, txs, bills, state] = await Promise.all([getGuild(), getPouches(), getTransactions(), getBills(), getState()]);
  allTx = txs || [];
  allBills = bills || [];
  renderBanner(pouches, guild, state);
  const months = buildMonths();
  selMonth = months[0] || '';
  await renderAll();

  const sel = document.getElementById('sumMonth');
  if (sel) sel.addEventListener('change', async () => { selMonth = sel.value; await renderAll(); });
  const step = async (d) => {
    const ms = buildMonths();
    const i = ms.indexOf(selMonth);
    const n = i + d;
    if (n >= 0 && n < ms.length) { selMonth = ms[n]; await renderAll(); }
  };
  document.getElementById('sumPrev')?.addEventListener('click', () => step(1));
  document.getElementById('sumNext')?.addEventListener('click', () => step(-1));
  document.getElementById('btnExportCsv')?.addEventListener('click', exportCsv);
  document.getElementById('btnExportPrint')?.addEventListener('click', () => window.print());

  subscribe('kelola-racun:updated', async () => {
    try {
      const [p, t, b, s, g] = await Promise.all([getPouches(), getTransactions(), getBills(), getState(), getGuild()]);
      allTx = t || [];
      allBills = b || [];
      renderBanner(p, g, s);
      await renderAll();
    } catch (e) { console.error(e); }
  });
}

boot();
