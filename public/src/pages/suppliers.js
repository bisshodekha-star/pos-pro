/** suppliers.js — Supplier list & add */
import { API } from '../api.js';
import { bn } from '../utils/format.js';
import { toast } from '../components/toast.js';

export async function render() {
  try {
    const r = await API.get('/suppliers');
    const d = r.data;
    const list = d.suppliers || [];
    const html = list.length ? list.map(s => `
      <div class="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
        <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl">🏭</div>
        <div class="flex-1"><b class="block text-base">${s.name}</b><small class="text-slate-400">${s.categories||''}</small></div>
        <span class="font-bold text-lg">${bn(s.balance)}</span>
      </div>
    `).join('') : '<p class="text-slate-400 text-center py-4 m-0">কোনো সাপ্লায়ার নেই</p>';
    return `
      <h1 class="text-3xl font-bold text-center mb-1">🚚 সাপ্লায়ার</h1>
      <p class="text-slate-400 text-center mb-6">মোট দেনা ${bn(d.totalDue)}</p>
      <button class="w-full bg-slate-800 border border-slate-700 text-slate-100 font-bold rounded-xl p-3.5 mb-4" id="sup-add">+ নতুন সাপ্লায়ার</button>
      <div class="bg-slate-900 rounded-2xl p-5">${html}</div>
    `;
  } catch (err) { return `<div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">সাপ্লায়ার লোড ব্যর্থ</div>`; }
}
export function init() {
  const btn = document.getElementById('sup-add');
  if (btn) btn.addEventListener('click', async () => {
    const name = prompt('সাপ্লায়ারের নাম:'); if (!name) return;
    const phone = prompt('মোবাইল:')||'';
    const categories = prompt('যা সরবরাহ করে:')||'';
    const balance = prompt('দেনা ৳:')||'0';
    try { await API.post('/suppliers', { name, phone, categories, balance: parseFloat(balance)||0 }); toast('✓ সাপ্লায়ার যোগ হয়েছে'); location.reload(); }
    catch (err) { toast('ত্রুটি: ' + err.message); }
  });
}
