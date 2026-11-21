/**
 * layout.js — Main layout: navigation, header, settings drawer
 */
import { NAV_MODULES, CONFIG } from '../config.js';
import { getState, setState, store } from '../store.js';
import { navigate } from '../router.js';
import { API } from '../api.js';
import { toast } from './toast.js';
import { bn, N } from '../utils/format.js';
import { printTestReceipt, printTestLabel } from './receipt.js';

export function renderLayout(content) {
  const s = getState();
  const shopName = s.settings.shop_name || CONFIG.defaultShopName;

  return `
    <nav class="app-nav fixed bottom-0 left-0 right-0 z-20 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex overflow-x-auto safe-bottom">
      ${NAV_MODULES.map(m => `
        <button class="flex flex-col items-center gap-1 ${s.currentView === m.id ? 'text-teal-400 font-semibold' : 'text-slate-500'} text-xs py-2 px-2 min-w-[56px] flex-1 whitespace-nowrap" data-nav="${m.id}">
          <span class="text-2xl leading-none">${m.icon}</span>${m.label}
        </button>
      `).join('')}
    </nav>

    <main class="app-main max-w-[760px] mx-auto px-4 pt-3 pb-24 safe-top">
      <header class="app-header sticky top-0 z-30 -mx-4 px-4 py-2.5 glass text-center mb-3">
        <button class="absolute left-3 top-2.5 w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 text-slate-900 font-bold flex flex-col items-center justify-center text-base leading-none shadow-lg" id="qb-open" title="কুইকবিল">⚡<small class="text-[9px]">কুইকবিল</small></button>
        <h1 class="text-lg font-bold text-white">${shopName}</h1>
        <div class="text-xs text-slate-300">POS Pro</div>
        <button class="absolute right-3 top-2.5 w-11 h-11 rounded-2xl bg-white/10 border border-white/15 text-xl flex items-center justify-center text-white" id="open-settings">☰</button>
      </header>
      <div id="page-content" class="page-wrap">${content}</div>
    </main>

    ${renderSettingsDrawer()}
  `;
}

/** Update only the page content area, preserving header events */
export function updateContent(content) {
  const el = document.getElementById('page-content');
  if (el) el.innerHTML = content;
}

function renderSettingsDrawer() {
  const s = getState().settings;
  return `
    <div class="fixed inset-0 z-40 bg-black/50 opacity-0 pointer-events-none transition-opacity duration-250" id="settings-scrim"></div>
    <aside class="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[430px] overflow-y-auto bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 translate-x-full transition-transform duration-250 p-4 safe-top" id="settings-drawer">
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-2xl">সেটিং</h2>
        <button class="w-10 h-10 rounded-xl bg-slate-800 text-lg" id="close-settings">✕</button>
      </div>

      <h3 class="text-lg font-semibold mt-6 mb-3">🏪 দোকানের তথ্য</h3>
      <label class="block text-slate-400 text-sm mb-1">দোকানের নাম</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 text-slate-100" id="set-shop-name" value="${s.shop_name || ''}" maxlength="40">
      <label class="block text-slate-400 text-sm mb-1">ঠিকানা</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 text-slate-100" id="set-shop-address" value="${s.shop_address || ''}">
      <label class="block text-slate-400 text-sm mb-1">মোবাইল 1</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 text-slate-100" id="set-shop-phone" value="${s.shop_phone || ''}">
      <label class="block text-slate-400 text-sm mb-1">মোবাইল 2</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 text-slate-100" id="set-shop-phone2" value="${s.shop_phone2 || ''}">
      <label class="block text-slate-400 text-sm mb-1">দোকানের লোগো (রিসিটে দেখাবে)</label>
      <input type="file" id="set-logo" accept="image/png,image/jpeg" class="text-sm mb-2 w-full">
      <div id="logo-preview" class="text-center mb-3">${s.shop_logo ? `<img src="${s.shop_logo}" class="max-h-14 mx-auto rounded-lg">` : ''}</div>

      <h3 class="text-lg font-semibold mt-6 mb-3">🖨️ প্রিন্টার ও কাগজের সেটিং</h3>
      <p class="text-slate-400 text-xs mb-3">প্রিন্ট বাটনে চাপলে ডিভাইসের প্রিন্ট ডায়ালগ থেকে সংযুক্ত প্রিন্টার নির্বাচন করুন। সঠিক মাপের কাগজ/লেবেল ড্রাইভারেও সেট করতে হবে।</p>
      <label class="block text-slate-400 text-sm mb-1">প্রিন্টারের নাম (চেনার জন্য)</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 text-slate-100" id="set-printer-name" value="${s.printer_name || ''}" placeholder="যেমন: Xprinter XP-365B">
      <label class="block text-slate-400 text-sm mb-1">থার্মাল রসিদের কাগজ</label>
      <select class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-2 text-slate-100" id="set-receipt-width">
        <option value="58" ${(s.receipt_width || s.printer_size || '80') === '58' ? 'selected' : ''}>58 mm</option>
        <option value="80" ${(s.receipt_width || s.printer_size || '80') === '80' ? 'selected' : ''}>80 mm</option>
        <option value="custom" ${(s.receipt_width || s.printer_size || '80') === 'custom' ? 'selected' : ''}>Custom</option>
      </select>
      <label class="block text-slate-400 text-sm mb-1">কাস্টম রসিদ প্রস্থ (mm)</label>
      <input type="number" min="40" max="120" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 text-slate-100" id="set-receipt-custom-width" value="${s.receipt_custom_width || '80'}">
      <div class="grid grid-cols-2 gap-2 mb-3">
        <div><label class="block text-slate-400 text-sm mb-1">স্টিকার প্রস্থ (mm)</label><input type="number" min="20" max="100" id="set-label-width" value="${s.label_width_mm || '50'}" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100"></div>
        <div><label class="block text-slate-400 text-sm mb-1">স্টিকার উচ্চতা (mm)</label><input type="number" min="10" max="100" id="set-label-height" value="${s.label_height_mm || '25'}" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100"></div>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-4">
        <button type="button" class="bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm font-semibold" id="test-receipt-print">🧾 রসিদ টেস্ট</button>
        <button type="button" class="bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm font-semibold" id="test-label-print">🏷️ স্টিকার টেস্ট</button>
      </div>
      <h3 class="text-lg font-semibold mt-6 mb-3">🧾 রসিদের লেখা</h3>
      <label class="block text-slate-400 text-sm mb-1">রিসিটের উপরের লেখা</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 text-slate-100" id="set-receipt-header" value="${s.receipt_header || ''}">
      <label class="block text-slate-400 text-sm mb-1">রিসিটের নিচের লেখা</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 text-slate-100" id="set-receipt-footer" value="${s.receipt_footer || ''}">
      <label class="block text-slate-400 text-sm mb-1">VAT (%)</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 text-slate-100" id="set-vat" value="${s.vat_percent || '0'}" inputmode="decimal">
      <label class="block text-slate-400 text-sm mb-1">ইনভয়েস প্রিফিক্স</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 text-slate-100" id="set-invoice-prefix" value="${s.invoice_prefix || 'INV-'}">
      <label class="block text-slate-400 text-sm mb-1">bKash নম্বর</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 text-slate-100" id="set-bkash" value="${s.bkash_number || ''}">
      <label class="block text-slate-400 text-sm mb-1">Nagad নম্বর</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 text-slate-100" id="set-nagad" value="${s.nagad_number || ''}">
      <label class="block text-slate-400 text-sm mb-1">কম স্টক সতর্কতা (পিস)</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 text-slate-100" id="set-low-stock" value="${s.low_stock_default || '20'}" inputmode="numeric">

      <button class="w-full bg-teal-500 text-slate-900 font-bold text-lg rounded-xl p-3.5 mt-2" id="settings-save">💾 সেভ করুন</button>

      <hr class="border-slate-700 my-4">

      <button class="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-bold rounded-xl p-3.5" id="drawer-logout">🚪 লগআউট</button>
    </aside>
  `;
}

export function initLayout() {
  // Nav clicks
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.nav);
      if (btn.dataset.nav === 'billing') import('./quickbill.js').then(m => m.openQuickBill());
    });
  });

  // Settings drawer
  const scrim = document.getElementById('settings-scrim');
  const drawer = document.getElementById('settings-drawer');
  document.getElementById('open-settings').addEventListener('click', () => {
    document.body.classList.add('set-open');
    scrim.style.opacity = '1';
    scrim.style.pointerEvents = 'auto';
    drawer.style.transform = 'none';
  });
  document.getElementById('close-settings').addEventListener('click', closeSettings);
  scrim.addEventListener('click', closeSettings);

  // Logo upload
  const logoInput = document.getElementById('set-logo');
  if (logoInput) {
    logoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 100000) { toast('লোগো 100KB এর ছোট হতে হবে'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        document.getElementById('logo-preview').innerHTML = `<img src="${reader.result}" class="max-h-14 mx-auto rounded-lg">`;
        document.getElementById('logo-preview').dataset.logo = reader.result;
        toast('✓ লোগো লোড হয়েছে — সেভ করুন');
      };
      reader.readAsDataURL(file);
    });
  }

  // Settings save
  document.getElementById('settings-save').addEventListener('click', async () => {
    const data = {
      shop_name: document.getElementById('set-shop-name').value.trim(),
      shop_address: document.getElementById('set-shop-address').value.trim(),
      shop_phone: document.getElementById('set-shop-phone').value.trim(),
      shop_phone2: document.getElementById('set-shop-phone2').value.trim(),
      receipt_header: document.getElementById('set-receipt-header').value.trim(),
      receipt_footer: document.getElementById('set-receipt-footer').value.trim(),
      vat_percent: document.getElementById('set-vat').value,
      invoice_prefix: document.getElementById('set-invoice-prefix').value,
      bkash_number: document.getElementById('set-bkash').value.trim(),
      nagad_number: document.getElementById('set-nagad').value.trim(),
      low_stock_default: document.getElementById('set-low-stock').value,
      printer_name: document.getElementById('set-printer-name').value.trim(),
      receipt_width: document.getElementById('set-receipt-width').value,
      receipt_custom_width: document.getElementById('set-receipt-custom-width').value,
      label_width_mm: document.getElementById('set-label-width').value,
      label_height_mm: document.getElementById('set-label-height').value,
    };
    const logoPrev = document.getElementById('logo-preview');
    if (logoPrev?.dataset.logo) data.shop_logo = logoPrev.dataset.logo;
    try {
      const r = await API.put('/settings', data);
      setState({ settings: r.data });
      toast('✓ সেটিংস সেভ হয়েছে');
      closeSettings();
      // Re-render to update shop name
      location.reload();
    } catch (err) {
      toast('ত্রুটি: ' + err.message);
    }
  });

  // Printer test actions
  document.getElementById('test-receipt-print')?.addEventListener('click', () => printTestReceipt());
  document.getElementById('test-label-print')?.addEventListener('click', () => printTestLabel());

  // QuickBill button
  document.getElementById('qb-open').addEventListener('click', () => {
    import('./quickbill.js').then(m => m.openQuickBill());
  });

  // Logout button (in settings drawer)
  document.getElementById('drawer-logout')?.addEventListener('click', async () => {
    if (!confirm('লগআউট করবেন?')) return;
    try { await API.post('/auth/logout', {}); } catch {}
    setState({ user: null, settings: {}, products: [], productsUnlocked: false, resetUnlocked: false });
    // Clear any deep-link hash so re-login lands on home
    history.replaceState(null, '', '#/home');
    location.reload();
  });

  // Online/offline
  window.addEventListener('online', () => { setState({ online: true }); });
  window.addEventListener('offline', () => { setState({ online: false }); });
}

function closeSettings() {
  const scrim = document.getElementById('settings-scrim');
  const drawer = document.getElementById('settings-drawer');
  if (scrim) { scrim.style.opacity = '0'; scrim.style.pointerEvents = 'none'; }
  if (drawer) drawer.style.transform = 'translateX(100%)';
}
