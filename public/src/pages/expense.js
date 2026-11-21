/** expense.js — Expenses + multi-account cashbook (Cash, bKash, Nagad, Rocket, Bank) */
import { API } from '../api.js';
import { bn, dstr, dateKey, esc, num } from '../utils/format.js';
import { toast } from '../components/toast.js';
import { ACCOUNTS, accountLabel, accountOptions, ENTRY_LABELS } from '../utils/accounts.js';

const CATEGORIES = ['ভাড়া', 'বিল', 'বেতন', 'নাস্তা', 'পরিবহন', 'অন্যান্য'];
const INPUT = 'w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 text-slate-100 outline-none focus:border-teal-500';

export async function render() {
  try {
    const [er, cr] = await Promise.all([API.get('/expenses'), API.get('/cashbook').catch(() => null)]);
    const d = er.data;
    const list = d.expenses || [];
    const cb = cr?.data;

    const cards = cb ? ACCOUNTS.map(a => {
      const v = cb.balances[a.id] || 0;
      return `<div class="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <div class="flex items-center gap-2 text-sm text-slate-400"><span class="text-xl">${a.icon}</span>${a.label}</div>
        <div class="text-xl font-bold mt-1" style="color:${v < 0 ? '#fca5a5' : a.color}">${bn(v)}</div>
      </div>`;
    }).join('') : '';

    const expHtml = list.length ? list.map(e => `
      <div class="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
        <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl">💸</div>
        <div class="flex-1 min-w-0"><b class="block text-base truncate">${esc(e.description || e.category)}</b><small class="text-slate-400">${esc(e.category)} · ${dstr(e.expense_date)} · ${accountLabel(e.account)}</small></div>
        <span class="font-bold text-lg">${bn(e.amount)}</span>
      </div>`).join('') : '<p class="text-slate-400 text-center py-4 m-0">কোনো খরচ নেই</p>';

    const entHtml = cb && cb.entries.length ? cb.entries.map(e => `
      <div class="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
        <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl">${(ACCOUNTS.find(a => a.id === e.account) || {}).icon || '💵'}</div>
        <div class="flex-1 min-w-0"><b class="block text-base truncate">${ENTRY_LABELS[e.entry_type] || e.entry_type}</b><small class="text-slate-400">${accountLabel(e.account)} · ${dstr(e.entry_date)}${e.note ? ' · ' + esc(e.note) : ''}</small></div>
        <span class="font-bold text-lg" style="color:${e.amount < 0 ? '#fca5a5' : '#86efac'}">${e.amount < 0 ? '−' : '+'}${bn(Math.abs(e.amount))}</span>
      </div>`).join('') : '<p class="text-slate-400 text-center py-4 m-0">কোনো এন্ট্রি নেই — আগে ওপেনিং ব্যালেন্স দিন</p>';

    return `
      <h1 class="text-3xl font-bold text-center mb-1">💸 খরচ ও ক্যাশবুক</h1>
      <p class="text-slate-400 text-center mb-5">${cb ? `সব অ্যাকাউন্টে মোট ${bn(cb.total)} · ` : ''}মোট খরচ ${bn(d.total)}</p>
      ${cb ? `<div class="cb-cards grid grid-cols-2 gap-3 mb-4">${cards}</div>` : ''}
      <div class="grid grid-cols-3 gap-2 mb-4">
        <button class="bg-teal-500 text-slate-900 font-bold rounded-xl p-3 text-sm" id="exp-add">+ খরচ</button>
        <button class="bg-slate-800 border border-slate-700 text-slate-100 font-bold rounded-xl p-3 text-sm" id="cb-transfer">↔ ট্রান্সফার</button>
        <button class="bg-slate-800 border border-slate-700 text-slate-100 font-bold rounded-xl p-3 text-sm" id="cb-opening">⚙ ওপেনিং</button>
      </div>
      <div class="two-col">
        <div class="bg-slate-900 rounded-2xl p-5 mb-4"><h2 class="text-lg font-semibold mb-2">💸 খরচের তালিকা</h2>${expHtml}</div>
        <div class="bg-slate-900 rounded-2xl p-5 mb-4"><h2 class="text-lg font-semibold mb-2">📒 ক্যাশবুক এন্ট্রি</h2>${entHtml}</div>
      </div>
    `;
  } catch (err) { return `<div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">খরচ লোড ব্যর্থ: ${esc(err.message)}</div>`; }
}

/** Small reusable popup form */
function openForm(title, bodyHtml, submitLabel, onSubmit) {
  document.getElementById('cb-form')?.remove();
  const el = document.createElement('div');
  el.id = 'cb-form';
  el.className = 'fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4';
  el.innerHTML = `
    <div class="bg-slate-900 border border-slate-700 rounded-3xl p-5 w-full max-w-[420px] max-h-[90vh] overflow-y-auto animate-slide-up">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">${title}</h2>
        <button class="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center" id="cb-x">✕</button>
      </div>
      ${bodyHtml}
      <div class="grid grid-cols-2 gap-2 mt-1">
        <button class="bg-slate-800 border border-slate-700 text-slate-100 rounded-xl p-3" id="cb-cancel">বাতিল</button>
        <button class="bg-teal-500 text-slate-900 font-bold rounded-xl p-3" id="cb-ok">${submitLabel}</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.querySelector('#cb-x').onclick = close;
  el.querySelector('#cb-cancel').onclick = close;
  el.addEventListener('mousedown', e => { if (e.target === el) close(); });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); go(); } });
  el.querySelector('#cb-ok').onclick = go;
  setTimeout(() => el.querySelector('input')?.focus(), 40);
  let busy = false;
  async function go() {
    if (busy) return;
    busy = true;
    try { await onSubmit(el); close(); location.reload(); }
    catch (err) { toast('ত্রুটি: ' + err.message); busy = false; }
  }
}

const val = (el, id) => el.querySelector('#' + id).value;

export function init() {
  document.getElementById('exp-add')?.addEventListener('click', () => {
    openForm('💸 খরচ যোগ করুন', `
      <label class="block text-slate-400 text-sm mb-1">ক্যাটাগরি</label>
      <select class="${INPUT}" id="f-cat">${CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select>
      <label class="block text-slate-400 text-sm mb-1">বিবরণ</label>
      <input class="${INPUT}" id="f-desc" placeholder="যেমন: দোকান ভাড়া">
      <label class="block text-slate-400 text-sm mb-1">টাকার পরিমাণ ৳</label>
      <input class="${INPUT}" id="f-amt" inputmode="decimal" placeholder="0">
      <label class="block text-slate-400 text-sm mb-1">কোন অ্যাকাউন্ট থেকে দিলেন?</label>
      <select class="${INPUT}" id="f-acc">${accountOptions('cash')}</select>
      <label class="block text-slate-400 text-sm mb-1">তারিখ</label>
      <input type="date" class="${INPUT}" id="f-date" value="${dateKey(Date.now())}">
    `, '✅ যোগ করুন', async el => {
      const amount = num(val(el, 'f-amt'));
      if (!(amount > 0)) throw new Error('টাকার পরিমাণ দিন');
      await API.post('/expenses', {
        category: val(el, 'f-cat'), description: val(el, 'f-desc').trim(),
        amount, account: val(el, 'f-acc'), expense_date: val(el, 'f-date'),
      });
      toast('✓ খরচ যোগ হয়েছে');
    });
  });

  document.getElementById('cb-transfer')?.addEventListener('click', () => {
    openForm('↔ ট্রান্সফার', `
      <label class="block text-slate-400 text-sm mb-1">কোথা থেকে</label>
      <select class="${INPUT}" id="f-from">${accountOptions('cash')}</select>
      <label class="block text-slate-400 text-sm mb-1">কোথায়</label>
      <select class="${INPUT}" id="f-to">${accountOptions('bank')}</select>
      <label class="block text-slate-400 text-sm mb-1">টাকার পরিমাণ ৳</label>
      <input class="${INPUT}" id="f-amt" inputmode="decimal" placeholder="0">
      <label class="block text-slate-400 text-sm mb-1">নোট (ঐচ্ছিক)</label>
      <input class="${INPUT}" id="f-note" placeholder="যেমন: ব্যাংকে জমা">
    `, '✅ ট্রান্সফার করুন', async el => {
      await API.post('/cashbook', { action: 'transfer', from: val(el, 'f-from'), to: val(el, 'f-to'), amount: num(val(el, 'f-amt')), note: val(el, 'f-note').trim() });
      toast('✓ ট্রান্সফার হয়েছে');
    });
  });

  document.getElementById('cb-opening')?.addEventListener('click', () => {
    openForm('⚙ ওপেনিং ব্যালেন্স', `
      <p class="text-slate-400 text-sm mb-3">কোনো অ্যাকাউন্টে এখন যত টাকা আছে সেটা দিন। এটাই ওই অ্যাকাউন্টের শুরুর হিসাব হবে।</p>
      <label class="block text-slate-400 text-sm mb-1">অ্যাকাউন্ট</label>
      <select class="${INPUT}" id="f-acc">${accountOptions('cash')}</select>
      <label class="block text-slate-400 text-sm mb-1">ওপেনিং ব্যালেন্স ৳</label>
      <input class="${INPUT}" id="f-amt" inputmode="decimal" placeholder="0">
    `, '✅ সেভ করুন', async el => {
      const raw = val(el, 'f-amt').trim();
      if (raw === '') throw new Error('টাকার পরিমাণ দিন');
      await API.post('/cashbook', { action: 'opening', account: val(el, 'f-acc'), amount: num(raw) });
      toast('✓ ওপেনিং ব্যালেন্স সেভ হয়েছে');
    });
  });
}
