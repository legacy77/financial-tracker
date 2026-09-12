// ============================================================
// scripts/core/payBill.js — Shared Pay Bill modal (Hall + Home)
// Best practice: bayar = Expense tx tertaut billId + update bill atomik.
// ============================================================

import { getBills, payBill } from '../services/billService.js';
import { getPouches } from '../services/pouchService.js';
import { getCategories } from '../services/categoryService.js';
import { getTransactions } from '../services/transactionService.js';
import { getBudgets, monthKey, monthSpending } from '../services/budgetService.js';
import { formatRupiah, openModal, closeModal } from './helpers.js';
import { canEdit } from './authService.js';
import { showToast } from '../app.js';

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

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function refreshWarn() {
  const warn = document.getElementById('payBillWarn');
  const pouchSel = document.getElementById('payBillPouch');
  const amountInput = document.getElementById('payBillAmount');
  if (!warn || !pouchSel || !amountInput) return;
  const amt = parseAmount(amountInput.value);
  const pouches = await getPouches();
  const pouch = pouches.find((p) => p.id === pouchSel.value);
  if (pouch && Number.isFinite(amt) && amt > 0 && (Number(pouch.balance) || 0) < amt) {
    warn.textContent = `⚠️ Saldo ${pouch.name} kurang (${formatRupiah(pouch.balance)}). Tetap dicatat sesuai pengaturan.`;
  } else {
    warn.textContent = '';
  }
}

export async function openPayBillModal(billId) {
  if (!canEdit()) {
    showToast('Hanya Admin/Co-Manager yang dapat membayar tagihan.', 'danger');
    return;
  }
  const bills = await getBills();
  const bill = bills.find((b) => b.id === billId);
  if (!bill) {
    showToast('Tagihan tidak ditemukan', 'danger');
    return;
  }
  if (bill.status === 'Paid') {
    showToast('Tagihan sudah lunas', 'info');
    return;
  }
  const total = Number(bill.amount) || 0;
  const paid = Number(bill.paidAmount) || 0;
  const remaining = total - paid;
  const pouches = await getPouches();
  if (!pouches.length) {
    showToast('Buat pouch dulu sebelum membayar', 'danger');
    return;
  }

  document.getElementById('payBillId').value = bill.id;
  document.getElementById('payBillTitle').textContent = bill.title;
  document.getElementById('payBillInfo').textContent =
    `${bill.category || 'Tanpa kategori'} · Terbayar ${formatRupiah(paid)} / ${formatRupiah(total)} · Sisa ${formatRupiah(remaining)}`;

  const bar = document.getElementById('payBillBar');
  if (bar) bar.style.width = (total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0) + '%';

  const pouchSel = document.getElementById('payBillPouch');
  let def = '';
  try {
    const pref = JSON.parse(localStorage.getItem('ffh-prefs') || '{}');
    if (pref.defaultPouchId && pouches.some((p) => p.id === pref.defaultPouchId)) def = pref.defaultPouchId;
  } catch {}
  const fallback = (bill.paidPouchId && pouches.some((p) => p.id === bill.paidPouchId)) ? bill.paidPouchId : pouches[0].id;
  pouchSel.innerHTML = pouches.map((p) => `<option value="${p.id}">${p.name} — ${formatRupiah(p.balance)}</option>`).join('');
  pouchSel.value = def || fallback;

  const amountInput = document.getElementById('payBillAmount');
  amountInput.value = remaining;
  const dateInput = document.getElementById('payBillDate');
  if (dateInput && !dateInput.value) dateInput.value = todayLocal();
  await refreshWarn();
  openModal('payBillModal');
}

async function checkBudgetWarning(category, amount) {
  if (!category || !Number.isFinite(amount) || amount <= 0) return;
  try {
    const cats = await getCategories();
    const cat = cats.find((c) => c.name === category);
    if (!cat || (cat.type && cat.type !== 'Expense')) return;
    const month = monthKey();
    const b = (await getBudgets(month)).find((x) => x.categoryId === cat.id);
    if (!b || !b.amount || b.amount <= 0) return;
    const spent = (await monthSpending(await getTransactions(), month))[category] || 0;
    if (spent + amount > b.amount) {
      showToast(`⚠️ ${category} lewat budget (${formatRupiah(spent + amount)} / ${formatRupiah(b.amount)})`, 'warning');
    }
  } catch {}
}

export function setupPayBillForm() {
  const form = document.getElementById('payBillForm');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = 'true';

  const pouchSel = document.getElementById('payBillPouch');
  const amountInput = document.getElementById('payBillAmount');
  if (pouchSel) pouchSel.addEventListener('change', refreshWarn);
  if (amountInput) amountInput.addEventListener('input', () => { refreshWarn(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canEdit()) {
      showToast('Hanya Admin/Co-Manager yang dapat membayar tagihan.', 'danger');
      return;
    }
    const submit = document.getElementById('payBillSubmit');
    if (submit.disabled) return;
    const amount = parseAmount(amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Jumlah bayar tidak valid', 'danger');
      return;
    }
    submit.disabled = true;
    const orig = submit.textContent;
    submit.textContent = 'Memproses...';
    try {
      const bills = await getBills();
      const bill = bills.find((b) => b.id === document.getElementById('payBillId').value);
      if (!bill) throw new Error('Tagihan tidak ditemukan');
      await checkBudgetWarning(bill.category, amount);
      const res = await payBill(bill.id, {
        pouchId: pouchSel.value,
        amount,
        date: toLocalISO(document.getElementById('payBillDate').value),
        category: bill.category
      });
      if (res.insufficient) {
        showToast('⚠️ Saldo pouch kurang — pembayaran tetap dicatat', 'warning');
      }
      showToast(
        res.bill.status === 'Paid'
          ? `Tagihan lunas! 🎉 (+50 XP)`
          : `Terbayar ${formatRupiah(res.bill.paidAmount)} / ${formatRupiah(res.bill.amount)}`,
        'success'
      );
      closeModal('payBillModal');
      form.reset();
    } catch (err) {
      showToast('Gagal bayar: ' + err.message, 'danger');
    } finally {
      submit.disabled = false;
      submit.textContent = orig;
    }
  });
}
