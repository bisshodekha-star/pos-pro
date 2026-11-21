/** history.js — Simple, fast sales history */
import { API } from '../api.js';
import { getState } from '../store.js';
import { bn, N, bnd, dateKey, dstr, tm, esc } from '../utils/format.js';

let cache = null;

export async function render() {
  // Show cached data immediately if available
  if (cache) {
    return buildHtml(cache);
  }
  return '<div class="text-center py-20 text-slate-400"><div class="text-3xl mb-2 animate-pulse">⏳</div>লোড হচ্ছে...</div>';
}

async function load() {
  try {
    const from = dateKey(Date.now() - 30 * 86400000);
    const to = dateKey(Date.now() + 86400000);
    const r = await API.get(`/sales?from=${from}&to=${to}&status=completed`);
    const sales = r.data || [];
    cache = sales.map(s => {
      let rawDate = s.completed_at || s.created_at || '';
      let dateStr = typeof rawDate === 'string' ? rawDate : String(rawDate);
      const dm = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      const dayKey = dm ? dm[0] : dateKey(Date.now());
      const tm2 = dateStr.match(/(\d{2}):(\d{2})/);
      const timeStr = tm2 ? tm2[1]+':'+tm2[2] : '00:00';
      return {
        id: s.id, no: s.invoice_no, dayKey, timeStr,
        customer: s.customer_name || 'ওয়াক-ইন',
        total: parseFloat(s.total) || 0,
        paid: parseFloat(s.paid) || 0,
        due: parseFloat(s.due) || 0,
        method: s.payment_method || 'cash',
        // extra fields for accurate reprint
        ret: parseFloat(s.change_given) || 0,
        bd: parseFloat(s.bill_discount) || 0,
        vat: parseFloat(s.vat) || 0,
        vatPct: parseFloat(getState().settings.vat_percent) || 0,
        // profit is sent by the server to the admin only
        cost: s.total_cost === undefined ? null : parseFloat(s.total_cost) || 0,
        profit: s.net_profit === undefined ? null : parseFloat(s.net_profit) || 0,
        items: [],
      };
    });
    updateContent(buildHtml(cache));
    bindEvents();
  } catch (err) {
    updateContent(`<div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">ত্রুটি: ${err.message}</div>`);
  }
}

export function init() {
  if (!cache) load();
  else bindEvents();
}

function buildHtml(sales) {
  if (!sales || sales.length === 0) {
    return '<div class="text-center py-20 text-slate-400"><div class="text-5xl mb-3">🧾</div>কোনো বিল নেই</div>';
  }

  // Group by day
  const days = {};
  sales.forEach(s => {
    if (!days[s.dayKey]) days[s.dayKey] = [];
    days[s.dayKey].push(s);
  });
  const sortedDays = Object.keys(days).sort().reverse();

  // Summary
  const totalSales = sales.reduce((a, s) => a + s.total, 0);
  const totalDue = sales.reduce((a, s) => a + s.due, 0);
  const totalCash = totalSales - totalDue;

  let html = `
    <div class="grid grid-cols-3 gap-2 mb-4">
      <div class="bg-slate-900 rounded-xl p-3 text-center">
        <div class="text-xs text-slate-400">মোট বিক্রি</div>
        <div class="text-lg font-bold text-teal-400">${bn(totalSales)}</div>
      </div>
      <div class="bg-slate-900 rounded-xl p-3 text-center">
        <div class="text-xs text-slate-400">নগদ</div>
        <div class="text-lg font-bold text-green-400">${bn(totalCash)}</div>
      </div>
      <div class="bg-slate-900 rounded-xl p-3 text-center">
        <div class="text-xs text-slate-400">বাকি</div>
        <div class="text-lg font-bold text-red-400">${bn(totalDue)}</div>
      </div>
    </div>
    <input class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 mb-4 text-slate-100 outline-none focus:border-teal-500" id="hist-search" placeholder="🔍 বিল নং বা কাস্টমার খুঁজুন">
  `;

  sortedDays.forEach(day => {
    const dayBills = days[day];
    const dayTotal = dayBills.reduce((a, s) => a + s.total, 0);
    html += `
      <div class="mb-4">
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-sm font-semibold text-slate-300">${dstr(day)}</h3>
          <span class="text-sm text-slate-400">${N(dayBills.length)}টি · ${bn(dayTotal)}</span>
        </div>
        <div class="bg-slate-900 rounded-xl p-2 bills-grid">
          ${dayBills.map(s => `
            <div class="flex items-center gap-3 p-2.5 hover:bg-slate-800 rounded-lg cursor-pointer" data-bill="${s.id}">
              <div class="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-lg">🧾</div>
              <div class="flex-1 min-w-0">
                <b class="block text-sm truncate">${esc(s.customer)}</b>
                <small class="text-slate-400 text-xs">${esc(s.no)} · ${s.timeStr}</small>
              </div>
              <div class="text-right">
                <b class="block text-sm">${bn(s.total)}</b>
                ${canSeeProfit(s) ? `<small class="block text-[11px] ${s.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}">লাভ ${bn(s.profit)}</small>` : ''}
                <span class="text-[10px] px-2 py-0.5 rounded-full ${s.due > 0 ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}">${s.due > 0 ? 'বাকি' : 'নগদ'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  return html;
}

/** Profit is shown to the admin only (and never on customer receipts) */
function canSeeProfit(s) {
  return getState().user?.role === 'admin' && s.profit !== null && s.profit !== undefined;
}

function updateContent(html) {
  const el = document.getElementById('page-content');
  if (el) el.innerHTML = html;
}

function bindEvents() {
  const search = document.getElementById('hist-search');
  if (search) {
    search.addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) { updateContent(buildHtml(cache)); bindEvents(); return; }
      const filtered = cache.filter(s => (s.customer + s.no).toLowerCase().includes(q));
      updateContent(buildHtml(filtered));
      bindEvents();
      document.getElementById('hist-search').value = q;
      document.getElementById('hist-search').focus();
    });
  }

  document.querySelectorAll('[data-bill]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.dataset.bill;
      const s = cache.find(x => x.id == id);
      if (!s) return;
      // Load items if not loaded
      if (s.items.length === 0) {
        try {
          const r = await API.get('/sales/' + id);
          const sale = r.data;
          s.items = (sale.items || []).map(it => ({
            name: it.product_name,
            qty: parseInt(it.qty) || 1,
            price: parseFloat(it.unit_price) || 0,
            total: parseFloat(it.total) || 0,
          }));
        } catch {}
      }
      showDetail(s);
    });
  });
}

function showDetail(s) {
  let modal = document.getElementById('bill-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'bill-modal';
  modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4';
  const itemsHtml = (s.items || []).map(it => `
    <div class="flex justify-between py-2 border-b border-slate-700 text-sm">
      <span>${esc(it.name)} <small class="text-slate-400 block">${it.qty} × ${bn(it.price)}</small></span>
      <span class="font-semibold">${bn(it.total)}</span>
    </div>
  `).join('');
  const methodLabel = { bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', bank: 'ব্যাংক', card: 'কার্ড' }[s.method] || 'নগদ';
  modal.innerHTML = `
    <div class="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-[380px] max-h-[88vh] overflow-y-auto animate-slide-up">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-bold">বিল বিস্তারিত</h2>
        <button class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center" id="bill-close">✕</button>
      </div>
      <div class="text-center mb-4">
        <div class="text-sm text-slate-400">${esc(s.no)}</div>
        <div class="text-sm text-slate-400">${dstr(s.dayKey)} · ${s.timeStr}</div>
        <div class="text-sm text-slate-300 mt-1">কাস্টমার: ${esc(s.customer)}</div>
      </div>
      <div class="border-t border-slate-700 pt-3 mb-3">${itemsHtml}</div>
      <div class="flex justify-between py-1.5 text-sm"><span class="text-slate-400">মোট</span><span class="font-bold">${bn(s.total)}</span></div>
      <div class="flex justify-between py-1.5 text-sm"><span class="text-slate-400">${methodLabel}</span><span>${bn(s.paid)}</span></div>
      ${s.due > 0 ? `<div class="flex justify-between py-1.5 text-sm"><span class="text-red-400">বাকি</span><span class="font-bold text-red-400">${bn(s.due)}</span></div>` : ''}
      ${canSeeProfit(s) ? `
        <div class="mt-3 rounded-xl border border-slate-700 bg-slate-800/50 p-3">
          <div class="text-[11px] text-slate-400 mb-1">🔒 শুধু অ্যাডমিন দেখতে পারবে (রসিদে আসবে না)</div>
          <div class="flex justify-between py-1 text-sm"><span class="text-slate-400">ক্রয়মূল্য</span><span>${bn(s.cost)}</span></div>
          <div class="flex justify-between py-1 text-sm font-bold"><span>এই বিলের লাভ</span><span class="${s.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}">${bn(s.profit)}</span></div>
        </div>` : ''}
      <button class="w-full bg-teal-500 text-slate-900 font-bold rounded-xl p-3 mt-4" id="bill-print">🖨️ রিসিট প্রিন্ট</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('bill-close').onclick = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('bill-print').onclick = () => {
    import('../components/receipt.js').then(m => m.printReceipt({
      no: s.no, t: s.total, paid: s.paid,
      ret: s.ret || 0,        // change given — was hardcoded 0
      due: s.due,
      bd: s.bd || 0,          // bill discount — was missing
      vat: s.vat || 0,        // VAT amount — was missing
      vatPct: s.vatPct || 0,  // VAT percent — was missing
      who: s.customer, method: s.method,
      items: (s.items || []).map(it => ({ product_name: it.name, qty: it.qty, unit_price: it.price, total: it.total })),
    }));
  };
}
