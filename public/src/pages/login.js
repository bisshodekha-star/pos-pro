/** login.js — Password-only login page */
import { API } from '../api.js';
import { getState, setState } from '../store.js';
import { CONFIG } from '../config.js';
import { toast } from '../components/toast.js';

export function renderLogin() {
  const s = getState();
  const shopName = s.settings.shop_name || CONFIG.defaultShopName;
  return `
    <div class="fixed inset-0 z-100 flex items-center justify-center p-5 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-900">
      <div class="w-full max-w-[380px] bg-slate-900/85 backdrop-blur-xl border border-slate-700 rounded-3xl p-8 text-center">
        <div class="text-5xl mb-2">🛍️</div>
        <h1 class="text-3xl font-bold">POS Pro</h1>
        <p class="text-slate-400 text-base mb-6">${shopName}</p>
        <form id="login-form">
          <input type="password" id="login-password" placeholder="🔑 পাসওয়ার্ড দিন" autocomplete="current-password" required autofocus
            class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3.5 mb-3 text-slate-100 text-base outline-none focus:border-teal-500">
          <p class="text-red-400 text-sm min-h-[22px] mb-2" id="login-err"></p>
          <button type="submit" class="w-full bg-teal-500 text-slate-900 font-bold text-lg rounded-xl p-3.5" id="login-btn">লগইন করুন</button>
        </form>
        <p class="text-slate-500 text-sm mt-4">পাসওয়ার্ড APP_PASSWORD env var এ সেট করা আছে</p>
      </div>
    </div>
  `;
}

export function initLogin(onLogin) {
  // Check existing session
  API.get('/auth/me').then(r => {
    if (r.data?.authenticated) { setState({ user: r.data }); onLogin(); return; }
    // Load shop name
    API.get('/settings').then(r2 => {
      if (r2.data?.shop_name) setState({ settings: r2.data });
      document.getElementById('app').innerHTML = renderLogin();
      bindLogin(onLogin);
    }).catch(() => {
      document.getElementById('app').innerHTML = renderLogin();
      bindLogin(onLogin);
    });
  }).catch(() => {
    document.getElementById('app').innerHTML = renderLogin();
    bindLogin(onLogin);
  });
}

function bindLogin(onLogin) {
  const form = document.getElementById('login-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.textContent = 'লগইন হচ্ছে...';
    btn.disabled = true;
    document.getElementById('login-err').textContent = '';
    try {
      const r = await API.post('/auth/login', { password: document.getElementById('login-password').value });
      setState({ user: r.data });
      // Force landing on home after login (clear any deep-link hash)
      history.replaceState(null, '', '#/home');
      onLogin();
    } catch (err) {
      document.getElementById('login-err').textContent = err.message || 'লগইন ব্যর্থ';
      btn.textContent = 'লগইন করুন';
      btn.disabled = false;
    }
  });
}
