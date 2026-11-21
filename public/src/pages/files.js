/** files.js — Settings, password change, logout, software reset */
import { API } from '../api.js';
import { getState, setState } from '../store.js';
import { toast } from '../components/toast.js';
import { showResetGate } from '../components/gate.js';

export function render() {
  return `
    <h1 class="text-3xl font-bold text-center mb-1">🗂️ ফাইল</h1>
    <p class="text-slate-400 text-center mb-6">পাসওয়ার্ড ও সেটিং</p>
    <div class="bg-slate-900 rounded-2xl p-5 mb-4">
      <h2 class="text-lg font-semibold mb-3">🔐 পণ্য পাসওয়ার্ড</h2>
      <p class="text-slate-400 text-sm mb-3">পণ্য মডিউলে ঢুকতে পাসওয়ার্ড দরকার।</p>
      <p class="text-sm mb-3">${getState().settings.products_password ? '✓ পাসওয়ার্ড সেট আছে' : '❌ পাসওয়ার্ড সেট নেই'}</p>
    </div>
    <div class="bg-slate-900 rounded-2xl p-5 mb-4">
      <h2 class="text-lg font-semibold mb-3">⚠️ সফটওয়্যার রিসেট</h2>
      <p class="text-slate-400 text-sm mb-3">সব ডাটা মুছে ফেলে নতুন থেকে শুরু করুন।</p>
      <button class="w-full bg-red-500 text-white font-bold rounded-xl p-3.5" id="reset-btn">🗑️ সফটওয়্যার রিসেট</button>
    </div>
    <button class="w-full bg-slate-800 border border-slate-700 text-slate-100 font-bold rounded-xl p-3.5" id="logout-btn">🚪 লগআউট</button>
  `;
}

export function init() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    if (!confirm('লগআউট করবেন?')) return;
    try { await API.post('/auth/logout', {}); } catch {}
    setState({ user: null });
    location.reload();
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    showResetGate(async () => {
      // After unlock, show confirm
      if (!confirm('আসলেই সব রিসেট করবেন? সব ডাটা মুছে যাবে!')) return;
      try {
        await API.post('/reset', { confirm: true });
        toast('✓ সফটওয়্যার রিসেট হয়েছে');
        setTimeout(() => location.reload(), 1500);
      } catch (err) { toast('রিসেট ব্যর্থ: ' + err.message); }
    });
  });
}
