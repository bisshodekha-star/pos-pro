/** billing.js — Billing view with held bills */
import { API } from '../api.js';
import { tm, bn } from '../utils/format.js';

export async function render() {
  let heldHtml = '<p class="text-slate-400 text-center py-4 m-0">কোনো হোল্ড বিল নেই</p>';
  try {
    const r = await API.get('/sales?status=held');
    const list = r.data || [];
    if (list.length) {
      heldHtml = list.map(s => `
        <div class="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
          <div class="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-xl">⏸️</div>
          <div class="flex-1"><b class="block">${s.invoice_no}</b><small class="text-slate-400">${s.customer_name || 'ওয়াক-ইন'} · ${bn(s.total)} · ${tm(s.created_at)}</small></div>
          <button class="bg-teal-500 text-slate-900 font-bold rounded-xl px-3 py-2 text-sm" data-resume="${s.id}">▶️ চালু</button>
        </div>
      `).join('');
    }
  } catch {}

  return `
    <h1 class="text-3xl font-bold text-center mb-1">🛒 বিলিং</h1>
    <p class="text-slate-400 text-center mb-6">কুইকবিল বোতামে ক্লিক করুন (ডানদিকে ⚡)</p>
    <div class="two-col">
    <div class="bg-slate-900 rounded-2xl p-5 mb-4">
      <h2 class="text-lg font-semibold mb-3">🛒 বিক্রি শুরু করুন</h2>
      <p class="text-slate-400 text-sm mb-3">ডানদিকের সবুজ ⚡ কুইকবিল বাটনে ক্লিক করে বারকোড স্ক্যান বা পণ্য যোগ করে বিল তৈরি করুন।</p>
      <button class="w-full bg-teal-500 text-slate-900 font-bold text-lg rounded-xl p-3.5" id="billing-start">⚡ কুইকবিল খুলুন</button>
    </div>
    <div class="bg-slate-900 rounded-2xl p-5">
      <h2 class="text-lg font-semibold mb-3">⏸️ হোল্ড করা বিল</h2>
      ${heldHtml}
    </div>
    </div>
  `;
}

export function init() {
  const startBtn = document.getElementById('billing-start');
  if (startBtn) startBtn.addEventListener('click', () => {
    import('../components/quickbill.js').then(m => m.openQuickBill());
  });

  document.querySelectorAll('[data-resume]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.resume;
      try {
        const r = await API.get('/sales/' + id);
        const sale = r.data;
        import('../components/quickbill.js').then(m => m.resumeHeldBill(sale));
      } catch (err) { toast('ত্রুটি: ' + err.message); }
    });
  });
}

import { toast } from '../components/toast.js';
