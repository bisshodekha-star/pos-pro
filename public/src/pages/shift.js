/** shift.js — Cashier shift open/close */
import { API } from '../api.js';
import { bn, dstr, tm, dateKey, esc, num } from '../utils/format.js';
import { toast } from '../components/toast.js';
import { ENTRY_LABELS } from '../utils/accounts.js';

/* ---------------- Day-End Cash Reconciliation ---------------- */
let recData = null;

const INPUT = 'w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100 outline-none focus:border-teal-500';

function breakdown(obj) {
  const parts = Object.entries(obj || {}).map(([k, v]) => `${ENTRY_LABELS[k] || k} ${bn(v)}`);
  return parts.length ? `<div class="text-[11px] text-slate-500 text-right">${parts.join(' · ')}</div>` : '';
}

function diffHtml(expected, counted) {
  if (counted === null) return '';
  const d = Math.round((counted - expected) * 100) / 100;
  if (d === 0) return '<div class="rounded-xl px-4 py-3 text-center font-bold" style="background:rgba(45,212,191,.12);color:#2dd4bf">✅ হিসাব মিলে গেছে</div>';
  const over = d > 0;
  return `<div class="rounded-xl px-4 py-3 text-center" style="background:${over ? 'rgba(134,239,172,.12)' : 'rgba(252,165,165,.12)'}">
    <b class="text-lg" style="color:${over ? '#86efac' : '#fca5a5'}">${over ? 'ক্যাশ বেশি' : 'ক্যাশ কম'}: ${bn(Math.abs(d))}</b>
    <div class="text-xs text-slate-400 mt-1">নিশ্চিত করলে ${over ? '+' : '−'}${bn(Math.abs(d))} ক্যাশ অ্যাডজাস্টমেন্ট এন্ট্রি নিজে থেকে হবে</div></div>`;
}

function recBody(d) {
  const sv = d.saved;
  return `
    <div class="flex justify-between py-2 text-sm"><span>ওপেনিং ব্যালেন্স</span><span class="font-semibold">${bn(d.opening)}</span></div>
    <div class="py-2 text-sm border-t border-slate-800"><div class="flex justify-between"><span>+ আয় (Income)</span><span class="font-semibold text-green-400">${bn(d.income)}</span></div>${breakdown(d.incomeBreakdown)}</div>
    <div class="py-2 text-sm border-t border-slate-800"><div class="flex justify-between"><span>− খরচ (Expenses)</span><span class="font-semibold text-red-400">${bn(d.expenses)}</span></div>${breakdown(d.expenseBreakdown)}</div>
    <div class="flex justify-between py-3 text-lg font-bold border-t-2 border-slate-600"><span>প্রত্যাশিত ব্যালেন্স</span><span class="text-teal-400">${bn(d.expected)}</span></div>
    ${sv ? `<div class="rounded-xl px-4 py-2 mb-3 text-sm text-slate-300" style="background:rgba(148,163,184,.12)">✔ এই তারিখে মেলানো হয়েছে — গুনে পেয়েছিলেন ${bn(sv.counted)}${sv.difference ? ` (${sv.difference > 0 ? 'বেশি' : 'কম'} ${bn(Math.abs(sv.difference))})` : ''}</div>` : ''}
    <label class="block text-slate-400 text-sm mb-1">গুনে আসলে কত ক্যাশ পেলেন? ৳</label>
    <input class="${INPUT} mb-3 text-xl" id="rec-counted" inputmode="decimal" placeholder="${(d.expected).toFixed(2)}" value="${sv ? sv.counted : ''}" autocomplete="off">
    <div id="rec-diff" class="mb-3">${sv ? diffHtml(d.expected, sv.counted) : ''}</div>
    <input class="${INPUT} mb-3" id="rec-note" placeholder="নোট (ঐচ্ছিক)" value="${esc(sv?.note || '')}">
    <button class="w-full bg-teal-500 text-slate-900 font-bold rounded-xl p-3.5" id="rec-save">${sv ? '♻ আবার মিলান' : '✅ হিসাব মিলান'}</button>`;
}

function recHistoryHtml(d) {
  const h = d.history || [];
  if (!h.length) return '<p class="text-slate-400 text-center py-4 m-0">এখনো কোনো হিসাব মেলানো হয়নি</p>';
  return h.map(r => `
    <div class="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
      <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl">${r.difference === 0 ? '✅' : r.difference > 0 ? '🔼' : '🔽'}</div>
      <div class="flex-1"><b class="block text-base">${dstr(r.rec_date)}</b><small class="text-slate-400">প্রত্যাশিত ${bn(r.expected)} · গোনা ${bn(r.counted)}</small></div>
      <span class="font-bold" style="color:${r.difference === 0 ? '#2dd4bf' : r.difference > 0 ? '#86efac' : '#fca5a5'}">${r.difference === 0 ? 'মিল' : (r.difference > 0 ? '+' : '−') + bn(Math.abs(r.difference))}</span>
    </div>`).join('');
}

async function loadRec(date) {
  const r = await API.get('/reconcile?date=' + date);
  recData = r.data;
  const box = document.getElementById('rec-box');
  if (box) box.innerHTML = recBody(recData);
  const his = document.getElementById('rec-history');
  if (his) his.innerHTML = recHistoryHtml(recData);
  bindRec();
}

function bindRec() {
  const inp = document.getElementById('rec-counted');
  if (!inp) return;
  const upd = () => {
    const raw = inp.value.trim();
    document.getElementById('rec-diff').innerHTML = raw === '' ? '' : diffHtml(recData.expected, num(raw));
  };
  inp.addEventListener('input', upd);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveRec(); } });
  document.getElementById('rec-save').onclick = saveRec;
}

async function saveRec() {
  const raw = document.getElementById('rec-counted').value.trim();
  if (raw === '') { toast('গুনে পাওয়া ক্যাশের পরিমাণ লিখুন'); return; }
  const date = document.getElementById('rec-date').value;
  if (recData.saved && !confirm('এই তারিখের হিসাব আগেই মেলানো হয়েছে। আবার মেলালে আগের অ্যাডজাস্টমেন্ট বাতিল হয়ে নতুনটা হবে। চালিয়ে যাবেন?')) return;
  const btn = document.getElementById('rec-save');
  btn.disabled = true;
  try {
    const r = await API.post('/reconcile', { date, counted: num(raw), note: document.getElementById('rec-note').value.trim() });
    const d = r.data;
    toast(d.adjusted ? `✓ মেলানো হয়েছে — ক্যাশ অ্যাডজাস্টমেন্ট ${d.difference > 0 ? '+' : '−'}${bn(Math.abs(d.difference))}` : '✓ হিসাব মিলে গেছে');
    await loadRec(date);
  } catch (err) { toast('ত্রুটি: ' + err.message); btn.disabled = false; }
}

async function recSection() {
  try {
    await loadRecData(dateKey(Date.now()));
    return `
      <div class="bg-slate-900 rounded-2xl p-5 mb-4">
        <h2 class="text-lg font-semibold mb-3">🧮 দিনের ক্যাশ মিলান <small class="text-slate-400 font-normal">(Day-End)</small></h2>
        <label class="block text-slate-400 text-sm mb-1">তারিখ</label>
        <input type="date" class="${INPUT} mb-3" id="rec-date" value="${recData.date}">
        <div id="rec-box">${recBody(recData)}</div>
      </div>
      <div class="bg-slate-900 rounded-2xl p-5 mb-4"><h2 class="text-lg font-semibold mb-2">📅 আগের হিসাব</h2><div id="rec-history">${recHistoryHtml(recData)}</div></div>`;
  } catch (err) {
    recData = null;
    return `<div class="bg-slate-900 rounded-2xl p-5 mb-4 text-red-400 text-sm">ক্যাশ মিলান লোড ব্যর্থ: ${esc(err.message)}</div>`;
  }
}
async function loadRecData(date) { recData = (await API.get('/reconcile?date=' + date)).data; }

export async function render() {
  const recHtml = await recSection();
  let currentHtml = '', listHtml = '';
  try {
    const cur = await API.get('/shifts?current=1');
    const curShift = cur.data;
    if (curShift) {
      currentHtml = `
        <h2 class="text-lg font-semibold mb-3">🟢 চলমান শিফট</h2>
        <div class="flex justify-between py-2 text-sm"><span>ক্যাশিয়ার</span><span>${curShift.user_name||'ক্যাশিয়ার'}</span></div>
        <div class="flex justify-between py-2 text-sm"><span>ওপেনিং ক্যাশ</span><span>${bn(curShift.opening_cash)}</span></div>
        <div class="flex justify-between py-2 text-sm"><span>শুরুর সময়</span><span>${tm(curShift.opened_at)}</span></div>
        <button class="w-full bg-slate-800 border border-slate-700 text-slate-100 font-bold rounded-xl p-3.5 mt-4" id="shift-close">🔒 শিফট বন্ধ করুন</button>
      `;
    } else {
      currentHtml = `
        <h2 class="text-lg font-semibold mb-3">🔴 কোনো শিফট খোলা নেই</h2>
        <p class="text-slate-400 text-sm mb-3">নতুন শিফট খুলতে ওপেনিং ক্যাশ দিন।</p>
        <label class="block text-slate-400 text-sm mb-1">ওপেনিং ক্যাশ ৳</label>
        <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3" id="shift-open-cash" inputmode="decimal" value="0">
        <button class="w-full bg-teal-500 text-slate-900 font-bold rounded-xl p-3.5" id="shift-open">🔓 শিফট খুলুন</button>
      `;
    }
    const all = await API.get('/shifts');
    const list = all.data || [];
    listHtml = list.length ? list.map(s => `
      <div class="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
        <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl">${s.status==='open'?'🟢':'🔴'}</div>
        <div class="flex-1"><b class="block text-base">${s.user_name||'ক্যাশিয়ার'}</b><small class="text-slate-400">${dstr(s.opened_at)} · ওপেনিং ${bn(s.opening_cash)}${s.status==='closed'?' · ক্লোজিং '+bn(s.closing_cash):''}</small></div>
        <span class="pill pill-${s.status==='open'?'paid':'low'}">${s.status==='open'?'চলমান':'বন্ধ'}</span>
      </div>
    `).join('') : '<p class="text-slate-400 text-center py-4 m-0">কোনো শিফট নেই</p>';
  } catch (err) { currentHtml = `<p class="text-red-400">শিফট লোড ব্যর্থ: ${err.message}</p>`; }
  return `
    <h1 class="text-3xl font-bold text-center mb-1">⏰ ক্যাশিয়ার শিফট</h1>
    <p class="text-slate-400 text-center mb-6">দিনের ক্যাশ হিসাব</p>
    <div class="two-col">
      <div>${recHtml}</div>
      <div>
        <div class="bg-slate-900 rounded-2xl p-5 mb-4">${currentHtml}</div>
        <div class="bg-slate-900 rounded-2xl p-5"><h2 class="text-lg font-semibold mb-3">🕒 সাম্প্রতিক শিফট</h2>${listHtml}</div>
      </div>
    </div>
  `;
}
export function init() {
  // NOTE: previously called bindRec() here too — but loadRec() already
  // calls bindRec() after building the form, so the duplicate call added
  // two sets of event listeners on #rec-counted. We only need the one
  // from loadRec(). Keep the date-picker + shift button bindings here.
  document.getElementById('rec-date')?.addEventListener('change', async e => {
    if (!e.target.value) return;
    try { await loadRec(e.target.value); } catch (err) { toast('ত্রুটি: ' + err.message); }
  });
  const openBtn = document.getElementById('shift-open');
  if (openBtn) openBtn.addEventListener('click', async () => {
    const cash = parseFloat(document.getElementById('shift-open-cash').value) || 0;
    try { await API.post('/shifts', { action: 'open', opening_cash: cash }); toast('✓ শিফট খোলা হয়েছে'); location.reload(); }
    catch (err) { toast('ত্রুটি: ' + err.message); }
  });
  const closeBtn = document.getElementById('shift-close');
  if (closeBtn) closeBtn.addEventListener('click', async () => {
    if (!confirm('শিফট বন্ধ করবেন?')) return;
    try { await API.post('/shifts', { action: 'close' }); toast('✓ শিফট বন্ধ হয়েছে'); location.reload(); }
    catch (err) { toast('ত্রুটি: ' + err.message); }
  });
}
