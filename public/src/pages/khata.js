/** khata.js — Dues management with WhatsApp/SMS/Call */
import { API } from '../api.js';
import { getState } from '../store.js';
import { bn, en, esc, num, tm } from '../utils/format.js';
import { accountOptions } from '../utils/accounts.js';
import { toast } from '../components/toast.js';

let openIdx = -1;
let dues = [];

/** Normalise a BD mobile number to 01XXXXXXXXX (returns '' if not valid) */
function normPhone(p) {
  let d = en(String(p || '')).replace(/\D/g, '');
  if (d.startsWith('880')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('1')) d = '0' + d;
  return /^01\d{9}$/.test(d) ? d : '';
}

export async function render() {
  try {
    const r = await API.get('/dues');
    const d = r.data;
    dues = d.customers || [];
    const totalDue = d.totalDue || 0;

    const listHtml = dues.length ? dues.map((c, i) => {
      const ph = normPhone(c.phone);
      const dueAmt = Number(c.due) || 0;
      const msg = encodeURIComponent(c.name + ', ' + (getState().settings.shop_name||'আমাদের দোকান') + ' থেকে জানাচ্ছি — আপনার ' + bn(dueAmt) + ' বাকি আছে। সুবিধামতো পরিশোধ করবেন। ধন্যবাদ।');
      return `<div class="dl" data-i="${i}" data-id="${c.id}">
        <div class="dtop">
          <div class="av">${esc(String(c.name).trim()[0] || '?')}</div>
          <div class="who"><b>${esc(c.name)}</b><small>শেষ: ${tm(c.updated_at)}</small></div>
          <div class="amt"><span>${bn(dueAmt)}</span><small>বাকি</small></div>
        </div>
        ${ph ? `<div class="dacts">
          <a class="ab sms" href="sms:${ph}?&body=${msg}">💬 মেসেজ</a>
          <a class="ab wa" href="https://api.whatsapp.com/send?phone=88${ph}&text=${msg}" target="_blank" rel="noopener">🟢 হোয়াটসঅ্যাপ</a>
          <a class="ab call" href="tel:${ph}">📞 কল</a>
        </div>` : `<div class="dacts"><span class="ab off">মোবাইল নম্বর নেই</span></div>`}
        ${i === openIdx ? `<div class="dedit">
          <label class="dd"><span>আদায় ৳</span><input inputmode="decimal" placeholder="${dueAmt}" autocomplete="off" data-due="${dueAmt}"></label>
          <select class="dacc bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm" title="কোন অ্যাকাউন্টে জমা হবে">${accountOptions('cash')}</select>
          <button class="no" data-act="all">সবটা</button>
          <button class="ok" data-act="ok">আদায় করুন</button>
        </div>` : ''}
      </div>`;
    }).join('') : '<p class="text-slate-400 text-center py-4 m-0">কারো বাকি নেই ✓</p>';

    return `
      <h1 class="text-3xl font-bold text-center mb-1">📒 খাতা</h1>
      <p class="text-slate-400 text-center mb-6">মোট বাকি ${bn(totalDue)} · ${dues.length} জন</p>
      <div class="khata-grid">${listHtml}</div>
    `;
  } catch (err) {
    return `<div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">খাতা লোড ব্যর্থ: ${err.message}</div>`;
  }
}

export function init() {
  // NOTE: previously used { once: true } — that auto-removed the listener
  // after the first click anywhere on the document, so clicking outside
  // a khata card (header, nav, blank space) silently disabled all
  // further khata clicks. Removing `once: true` fixes this.
  document.addEventListener('click', async e => {
    const box = e.target.closest('.dl');
    if (!box) return;
    const i = +box.dataset.i;
    const id = +box.dataset.id;

    if (e.target.closest('[data-act="all"]')) {
      // "সবটা" — fill the input with the full remaining due
      const inp = box.querySelector('input');
      const dueAmt = dues[i]?.due ?? 0;
      inp.value = en(String(dueAmt));
      inp.focus();
      return;
    }
    if (e.target.closest('[data-act="ok"]')) {
      const inp = box.querySelector('input');
      // num() handles Bengali digits, commas, spaces — much safer than parseFloat
      const v = num(inp.value);
      const dueAmt = Number(dues[i]?.due) || 0;
      if (!(v > 0)) { toast('আদায়ের টাকা লিখুন'); inp.focus(); return; }
      if (v > dueAmt) {
        toast('বাকির চেয়ে বেশি আদায় হয় না (বাকি ' + bn(dueAmt) + ')');
        return;
      }
      try {
        const r = await API.post('/dues', { customer_id: id, amount: v, account: box.querySelector('select')?.value || 'cash' });
        const remaining = dueAmt - v;
        toast(remaining > 0
          ? '✓ ' + bn(v) + ' আদায়, বাকি ' + bn(remaining)
          : '✓ সম্পূর্ণ বাকি আদায় হয়েছে (' + bn(v) + ')');
        openIdx = -1;
        location.reload();
      } catch (err) { toast('ত্রুটি: ' + err.message); }
      return;
    }
    if (e.target.closest('.dedit') || e.target.closest('.ab') || e.target.closest('.csel-btn')) return;
    // toggle the collect box
    openIdx = openIdx === i ? -1 : i;
    const pc = document.getElementById('page-content');
    if (pc) { pc.innerHTML = await render(); init(); }
  });

  // Submit-on-Enter inside the collect input
  document.querySelectorAll('.dl input[inputmode="decimal"]').forEach(inp => {
    if (inp.dataset.bound) return;
    inp.dataset.bound = '1';
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const box = inp.closest('.dl');
        box?.querySelector('[data-act="ok"]')?.click();
      }
    });
  });
}
