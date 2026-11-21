/** customers.js — Customer list, add, and detail */
import { API } from '../api.js';
import { bn, N, esc } from '../utils/format.js';
import { toast } from '../components/toast.js';

export async function render() {
  try {
    const r = await API.get('/customers');
    const list = r.data || [];
    const html = list.length ? list.map(c => `
      <div class="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
        <div class="w-10 h-10 rounded-full bg-teal-500 text-slate-900 flex items-center justify-center font-bold text-lg">${esc(String(c.name || '?').trim()[0] || '?')}</div>
        <div class="flex-1 min-w-0">
          <b class="block text-base truncate">${esc(c.name)}</b>
          <small class="text-slate-400">${esc(c.phone || '—')} · মোট কেনা ${bn(c.total_purchase)}</small>
        </div>
        ${Number(c.due) > 0 ? `<span class="pill pill-due">বাকি ${bn(c.due)}</span>` : '<span class="pill pill-paid">পরিষ্কার</span>'}
      </div>
    `).join('') : '<p class="text-slate-400 text-center py-4 m-0">কোনো কাস্টমার নেই</p>';
    return `
      <h1 class="text-3xl font-bold text-center mb-1">👥 কাস্টমার</h1>
      <p class="text-slate-400 text-center mb-6">মোট ${N(list.length)} জন</p>
      <button class="w-full bg-teal-500 text-slate-900 font-bold rounded-xl p-3.5 mb-4" id="cust-add">+ নতুন কাস্টমার</button>
      <div class="bg-slate-900 rounded-2xl p-5 list-grid">${html}</div>
    `;
  } catch (err) {
    return `<div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">কাস্টমার লোড ব্যর্থ: ${err.message}</div>`;
  }
}

export function init() {
  document.getElementById('cust-add')?.addEventListener('click', () => {
    const name = prompt('কাস্টমারের নাম:');
    if (!name) return;
    const phone = prompt('মোবাইল নম্বর (ঐচ্ছিক):') || '';
    const address = prompt('ঠিকানা (ঐচ্ছিক):') || '';
    API.post('/customers', { name: name.trim(), phone: phone.trim(), address: address.trim() })
      .then(() => { toast('✓ কাস্টমার যোগ হয়েছে'); location.reload(); })
      .catch(err => toast('ত্রুটি: ' + err.message));
  });
}
