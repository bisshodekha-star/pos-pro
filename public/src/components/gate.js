/**
 * gate.js — Password gates for products & reset
 *
 * Password verification is done SERVER-SIDE via POST /api/settings/verify-gate.
 * The actual password hash is never sent to the browser. This replaces the
 * old client-side comparison that exposed the plaintext password via GET /settings.
 */
import { getState, setState } from '../store.js';
import { API } from '../api.js';
import { toast } from './toast.js';
import { navigate } from '../router.js';

/** Show products password gate */
export async function showProductsGate() {
  const s = getState();
  if (s.productsUnlocked) { navigate('products'); return; }

  const hasPw = s.settings?.has_products_password;
  const mode = hasPw ? 'enter' : 'setup';

  const gate = document.createElement('div');
  gate.id = 'gate-overlay';
  gate.className = 'fixed inset-0 z-70 flex items-center justify-center bg-black/70';
  gate.innerHTML = `
    <div class="bg-slate-900 rounded-3xl p-7 w-full max-w-[340px] text-center shadow-2xl">
      <h2 class="text-xl mb-1">${mode === 'setup' ? '🔐 পাসওয়ার্ড সেট করুন' : '🔐 পণ্য মডিউল'}</h2>
      <p class="text-slate-400 text-sm mb-4">${mode === 'setup' ? 'প্রথমবার একটা পাসওয়ার্ড ঠিক করুন' : 'এই অংশে ঢুকতে পাসওয়ার্ড দিন'}</p>
      <input type="password" id="gate-pw" placeholder="পাসওয়ার্ড" autocomplete="off" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-center text-base mb-3 outline-none">
      <input type="password" id="gate-pw2" placeholder="আবার পাসওয়ার্ড" autocomplete="off" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-center text-base mb-3 outline-none" style="display:${mode === 'setup' ? 'block' : 'none'}">
      <p class="text-red-400 text-sm min-h-[20px] mb-2" id="gate-err"></p>
      <button class="w-full bg-gradient-to-br from-violet-600 to-purple-500 text-white font-bold text-base rounded-xl p-3.5 border-0 cursor-pointer transition-transform" id="gate-submit">${mode === 'setup' ? '💾 সেভ করুন' : '🔓 ঢুকুন'}</button>
      <button class="w-full text-slate-400 bg-transparent border-0 cursor-pointer p-2.5 mt-2 text-sm" id="gate-cancel">বাতিল</button>
    </div>
  `;
  document.body.appendChild(gate);
  setTimeout(() => document.getElementById('gate-pw').focus(), 50);

  const submit = document.getElementById('gate-submit');
  const err = document.getElementById('gate-err');

  document.getElementById('gate-cancel').addEventListener('click', () => gate.remove());

  document.getElementById('gate-pw').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (mode === 'setup' && document.getElementById('gate-pw2').style.display !== 'none') {
        document.getElementById('gate-pw2').focus();
      } else submit.click();
    }
  });

  submit.addEventListener('click', async () => {
    const pw = document.getElementById('gate-pw').value;
    if (mode === 'setup') {
      const pw2 = document.getElementById('gate-pw2').value;
      if (pw.length < 4) { err.textContent = 'পাসওয়ার্ড কমপক্ষে 4 অক্ষরের'; flee(submit); return; }
      if (pw !== pw2) { err.textContent = 'দুই ঘরের পাসওয়ার্ড মিলছে না'; flee(submit); return; }
      try {
        // Save password (server hashes it before storage)
        const r = await API.put('/settings', { products_password: pw });
        setState({ settings: r.data, productsUnlocked: true });
        gate.remove();
        navigate('products');
        toast('✓ পাসওয়ার্ড সেট হয়েছে');
      } catch (e) { err.textContent = 'সেভ ব্যর্থ: ' + e.message; }
    } else {
      try {
        // Verify password server-side
        const r = await API.post('/settings', { type: 'products', password: pw });
        if (r.ok) {
          setState({ productsUnlocked: true });
          gate.remove();
          navigate('products');
          toast('✓ পণ্য মডিউল খোলা হলো');
        } else {
          err.textContent = 'ভুল পাসওয়ার্ড!';
          flee(submit);
        }
      } catch (e) {
        err.textContent = e.message || 'ভুল পাসওয়ার্ড!';
        flee(submit);
      }
    }
  });
}

/** Show reset password gate */
export async function showResetGate(onUnlock) {
  const s = getState();
  const hasPw = s.settings?.has_reset_password;
  const mode = hasPw ? 'enter' : 'setup';

  const gate = document.createElement('div');
  gate.id = 'reset-overlay';
  gate.className = 'fixed inset-0 z-70 flex items-center justify-center bg-black/70';
  gate.innerHTML = `
    <div class="bg-slate-900 rounded-3xl p-7 w-full max-w-[340px] text-center shadow-2xl">
      <h2 class="text-xl mb-1">${mode === 'setup' ? '🔐 রিসেট পাসওয়ার্ড সেট করুন' : '⚠️ সফটওয়্যার রিসেট'}</h2>
      <p class="text-slate-400 text-sm mb-4">${mode === 'setup' ? 'প্রথমবার পাসওয়ার্ড ঠিক করুন' : 'রিসেট করতে পাসওয়ার্ড দিন'}</p>
      <input type="password" id="reset-pw" placeholder="পাসওয়ার্ড" autocomplete="off" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-center text-base mb-3 outline-none">
      <input type="password" id="reset-pw2" placeholder="আবার পাসওয়ার্ড" autocomplete="off" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-center text-base mb-3 outline-none" style="display:${mode === 'setup' ? 'block' : 'none'}">
      <p class="text-red-400 text-sm min-h-[20px] mb-2" id="reset-err"></p>
      <button class="w-full bg-gradient-to-br from-violet-600 to-purple-500 text-white font-bold text-base rounded-xl p-3.5 border-0 cursor-pointer" id="reset-submit">${mode === 'setup' ? '💾 সেভ করুন' : '🔓 ঢুকুন'}</button>
      <button class="w-full text-slate-400 bg-transparent border-0 cursor-pointer p-2.5 mt-2 text-sm" id="reset-cancel">বাতিল</button>
    </div>
  `;
  document.body.appendChild(gate);
  setTimeout(() => document.getElementById('reset-pw').focus(), 50);

  const submit = document.getElementById('reset-submit');
  const err = document.getElementById('reset-err');

  document.getElementById('reset-cancel').addEventListener('click', () => gate.remove());

  submit.addEventListener('click', async () => {
    const pw = document.getElementById('reset-pw').value;
    if (mode === 'setup') {
      const pw2 = document.getElementById('reset-pw2').value;
      if (pw.length < 4) { err.textContent = 'পাসওয়ার্ড কমপক্ষে 4 অক্ষরের'; return; }
      if (pw !== pw2) { err.textContent = 'দুই ঘরের পাসওয়ার্ড মিলছে না'; return; }
      try {
        const r = await API.put('/settings', { reset_password: pw });
        setState({ settings: r.data });
        toast('✓ পাসওয়ার্ড সেট হয়েছে');
        gate.remove();
        onUnlock();
      } catch (e) { err.textContent = 'সেভ ব্যর্থ: ' + e.message; }
    } else {
      try {
        const r = await API.post('/settings', { type: 'reset', password: pw });
        if (r.ok) {
          gate.remove();
          onUnlock();
        } else {
          err.textContent = 'ভুল পাসওয়ার্ড!';
        }
      } catch (e) {
        err.textContent = e.message || 'ভুল পাসওয়ার্ড!';
      }
    }
  });
}

/** Flee behavior — button moves to a random position */
function flee(btn) {
  const box = btn.closest('div');
  if (!box) return;
  const boxRect = box.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const relX = btnRect.left - boxRect.left;
  const relY = btnRect.top - boxRect.top;
  const maxX = boxRect.width - btnRect.width - 16;
  const maxY = boxRect.height - btnRect.height - 16;
  const newX = Math.random() * Math.max(0, maxX);
  const newY = Math.random() * Math.max(0, maxY - 60) + 60;
  btn.style.transform = `translate(${newX - relX}px, ${newY - relY}px)`;
}
