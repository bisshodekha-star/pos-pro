/** reports.js — Monthly & custom date reports */
import { API } from '../api.js';
import { MONTHS } from '../config.js';
import { bn, N, dstr, dateKey, esc } from '../utils/format.js';
import { getState } from '../store.js';

export function render() {
  const now = new Date();
  return `
    <h1 class="text-3xl font-bold text-center mb-1">📈 রিপোর্ট</h1>
    <p class="text-slate-400 text-center mb-6">বিক্রি ও লাভ-ক্ষতি</p>
    <div class="bg-slate-900 rounded-2xl p-5 mb-4">
      <h2 class="text-lg font-semibold mb-3">📅 মাস সিলেক্ট করুন</h2>
      <div class="grid grid-cols-2 gap-2 mb-4">
        <select id="rep-month" class="bg-slate-800 border border-slate-700 rounded-xl p-3">${MONTHS.map((m,i)=>`<option value="${i+1}" ${i===now.getMonth()?'selected':''}>${m}</option>`).join('')}</select>
        <input type="number" id="rep-year" class="bg-slate-800 border border-slate-700 rounded-xl p-3" value="${now.getFullYear()}" min="2024" max="2030">
      </div>
      <button class="w-full bg-teal-500 text-slate-900 font-bold rounded-xl p-3.5" id="rep-monthly">📊 মাসিক রিপোর্ট</button>
    </div>
    <div class="bg-slate-900 rounded-2xl p-5 mb-4">
      <h2 class="text-lg font-semibold mb-3">📅 কাস্টম তারিখ</h2>
      <div class="grid grid-cols-2 gap-2 mb-4">
        <input type="date" id="rep-from" class="bg-slate-800 border border-slate-700 rounded-xl p-3">
        <input type="date" id="rep-to" class="bg-slate-800 border border-slate-700 rounded-xl p-3">
      </div>
      <button class="w-full bg-slate-800 border border-slate-700 text-slate-100 font-bold rounded-xl p-3.5" id="rep-gen">📊 রিপোর্ট তৈরি করুন</button>
    </div>
    <div class="bg-slate-900 rounded-2xl p-5 mt-4" id="rep-out"></div>
  `;
}

export function init() {
  const today = dateKey(Date.now());
  const weekAgo = dateKey(Date.now() - 7*86400000);
  document.getElementById('rep-from').value = weekAgo;
  document.getElementById('rep-to').value = today;

  document.getElementById('rep-monthly').addEventListener('click', async () => {
    const month = parseInt(document.getElementById('rep-month').value);
    const year = parseInt(document.getElementById('rep-year').value);
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    await genReport(from, to, MONTHS[month-1] + ' ' + year);
  });

  document.getElementById('rep-gen').addEventListener('click', async () => {
    await genReport(document.getElementById('rep-from').value, document.getElementById('rep-to').value, 'কাস্টম রিপোর্ট');
  });
}

async function genReport(from, to, title) {
  const out = document.getElementById('rep-out');
  out.innerHTML = '<p class="text-slate-400 text-center py-4">রিপোর্ট তৈরি হচ্ছে...</p>';
  try {
    const sr = await API.get(`/reports?type=sales&from=${from}&to=${to}`);
    const s = sr.data;
    // Profit & loss is admin-only
    let p = null;
    if (getState().user?.role === 'admin') {
      try { p = (await API.get(`/reports?type=profit&from=${from}&to=${to}`)).data; } catch {}
    }
    const dailyRows = (s.daily||[]).map(d => `<div class="flex justify-between py-2 text-sm"><span>${dstr(d.day)}</span><span>${N(d.bills)}টি · ${bn(d.sales)}</span></div>`).join('');
    out.innerHTML = `
      <h2 class="text-lg font-semibold mb-3">📊 ${title}</h2>
      <div class="flex justify-between py-2 text-sm"><span>মোট বিক্রি</span><span class="text-teal-400 font-bold">${bn(s.summary.sales)}</span></div>
      <div class="flex justify-between py-2 text-sm"><span>মোট বিল</span><span>${N(s.summary.bills)}টি</span></div>
      <div class="flex justify-between py-2 text-sm"><span>বাকি বিক্রি</span><span class="text-red-400">${bn(s.summary.due)}</span></div>
      ${dailyRows}
      ${p ? plHtml(p) : ''}
    `;
  } catch (err) { out.innerHTML = `<p class="text-red-400">ত্রুটি: ${err.message}</p>`; }
}

/** Detailed Profit & Loss:  Sales - COGS = Gross Profit - Operating Expenses = Net Profit */
function plHtml(p) {
  const good = '#2dd4bf', bad = '#fca5a5';
  const row = (label, val, cls = '', sign = '') =>
    `<div class="flex justify-between py-2 text-sm"><span>${label}</span><span class="${cls}">${sign}${bn(val)}</span></div>`;
  const total = (label, val, color) =>
    `<div class="flex justify-between py-2.5 text-base font-bold border-t border-slate-700 mt-1"><span>${label}</span><span style="color:${color}">${bn(val)}</span></div>`;
  const expRows = (p.expenseList || []).map(e =>
    `<div class="flex justify-between py-1 text-xs text-slate-400 pl-3"><span>${esc(e.category)}</span><span>${bn(e.amount)}</span></div>`).join('');
  return `
    <div class="mt-5 pt-4 border-t border-slate-700">
      <h2 class="text-lg font-semibold mb-1">💰 লাভ-ক্ষতি (P&amp;L)</h2>
      <p class="text-xs text-slate-400 mb-2">🔒 শুধু অ্যাডমিন · ${N(p.bills)}টি বিল</p>
      ${row('মোট বিক্রি (Total Sales)', p.revenue, 'text-teal-400 font-bold')}
      ${p.vat > 0 ? row('ভ্যাট (সরকারের টাকা)', p.vat, 'text-slate-400', '− ') : ''}
      ${p.vat > 0 ? total('নিট বিক্রি (ভ্যাট বাদে)', p.netSales, '#e2e8f0') : ''}
      ${row('পণ্যের ক্রয়মূল্য (COGS)', p.cogs, 'text-red-400', '− ')}
      ${total(`গ্রস লাভ (Gross Profit) · ${p.grossMargin}%`, p.grossProfit, p.grossProfit >= 0 ? good : bad)}
      <div class="flex justify-between py-2 text-sm mt-1"><span>অপারেটিং খরচ (Operating Expenses)</span><span class="text-red-400">− ${bn(p.expenses)}</span></div>
      ${expRows}
      <div class="flex justify-between items-center py-3 text-xl font-bold border-t-2 border-slate-600 mt-2">
        <span>নিট লাভ (Net Profit)</span><span style="color:${p.netProfit >= 0 ? good : bad}">${bn(p.netProfit)}</span>
      </div>
      <div class="flex justify-between items-center rounded-xl px-4 py-3 mt-1" style="background:${p.netProfit >= 0 ? 'rgba(45,212,191,.12)' : 'rgba(252,165,165,.12)'}">
        <span class="text-sm">নিট প্রফিট মার্জিন</span>
        <b class="text-xl" style="color:${p.netProfit >= 0 ? good : bad}">${p.margin}%</b>
      </div>
    </div>`;
}
