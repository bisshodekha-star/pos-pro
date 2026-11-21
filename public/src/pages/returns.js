/** returns.js — Barcode-based returns list & entry
 *
 * Flow:
 * 1. Click "+ নতুন রিটার্ন" → modal opens with barcode input
 * 2. Scan or type barcode → product auto-looked up
 * 3. Enter qty, optional reason, optional invoice no
 * 4. Click "রিটার্ন করুন" → stock restored, return recorded
 *
 * The "amount" shown is the goods value (sell_price × qty) — for record only.
 * Whether money is refunded to the customer is up to the shop owner.
 */
import { API } from '../api.js';
import { getState } from '../store.js';
import { bn, N, esc, tm, num, en } from '../utils/format.js';
import { toast } from '../components/toast.js';

export async function render() {
  try {
    const r = await API.get('/returns');
    const list = r.data || [];
    const html = list.length ? list.map(rtn => `
      <div class="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
        <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl">↩️</div>
        <div class="flex-1 min-w-0">
          <b class="block text-base truncate">${esc(rtn.product_name)} × ${N(rtn.qty)}</b>
          <small class="text-slate-400">
            ${rtn.invoice_no ? esc(rtn.invoice_no) : '—'}
            ${rtn.customer_name ? ' · ' + esc(rtn.customer_name) : ''}
            · ${tm(rtn.created_at)}
          </small>
        </div>
        <div class="text-right">
          <span class="font-bold text-lg">${bn(rtn.amount)}</span>
          <small class="block text-[10px] text-slate-500">পণ্যের মূল্য</small>
        </div>
        <span class="pill pill-low">ফেরত</span>
      </div>
    `).join('') : '<p class="text-slate-400 text-center py-4 m-0">কোনো রিটার্ন নেই</p>';
    return `
      <h1 class="text-3xl font-bold text-center mb-1">↩️ রিটার্ন</h1>
      <p class="text-slate-400 text-center mb-6">বারকোড দিয়ে পণ্য ফেরত নিন</p>
      <button class="w-full bg-teal-500 text-slate-900 font-bold rounded-xl p-3.5 mb-4" id="ret-add">+ নতুন রিটার্ন</button>
      <div class="bg-slate-900 rounded-2xl p-5">${html}</div>
    `;
  } catch (err) {
    return `<div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">রিটার্ন লোড ব্যর্থ</div>`;
  }
}

export function init() {
  document.getElementById('ret-add')?.addEventListener('click', openReturnModal);
}

let camStream = null, scanTimer = null;

function openReturnModal() {
  let el = document.getElementById('ret-modal');
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'ret-modal';
  el.className = 'fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 p-4';
  el.innerHTML = `
    <div class="bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-[440px] max-h-[94vh] overflow-y-auto animate-slide-up">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">↩️ নতুন রিটার্ন</h2>
        <button class="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center" id="ret-close">✕</button>
      </div>

      <label class="block text-slate-400 text-sm mb-1">বারকোড</label>
      <div class="flex gap-2 mb-2">
        <input class="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-3 outline-none focus:border-teal-500" id="ret-code" placeholder="স্ক্যান বা লিখুন" autocomplete="off">
        <button class="w-12 h-12 rounded-xl bg-teal-500 text-slate-900 text-xl flex items-center justify-center" id="ret-cam" title="ক্যামেরা">📷</button>
      </div>
      <div class="cam hidden relative mb-3 rounded-xl overflow-hidden bg-black" id="ret-camview">
        <video id="ret-cam-v" playsinline muted class="w-full max-h-48 object-cover"></video>
        <div class="absolute inset-[25%_12%] border-2 border-teal-400 rounded-xl pointer-events-none"></div>
      </div>

      <div class="bg-slate-800/40 border border-slate-700 rounded-xl p-3 mb-3 hidden" id="ret-prod-info"></div>

      <label class="block text-slate-400 text-sm mb-1">পরিমাণ (পিস)</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 outline-none focus:border-teal-500" id="ret-qty" inputmode="numeric" placeholder="১" autocomplete="off">

      <label class="block text-slate-400 text-sm mb-1">ইনভয়েস নং (ঐচ্ছিক)</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3 outline-none focus:border-teal-500" id="ret-inv" placeholder="INV-1001" autocomplete="off">

      <label class="block text-slate-400 text-sm mb-1">কারণ (ঐচ্ছিক)</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-4 outline-none focus:border-teal-500" id="ret-reason" placeholder="যেমন: ডিফেক্টিভ, ভুল সাইজ" autocomplete="off">

      <div class="grid grid-cols-2 gap-2">
        <button class="bg-slate-800 border border-slate-700 text-slate-100 rounded-xl p-3" id="ret-cancel">বাতিল</button>
        <button class="bg-teal-500 text-slate-900 font-bold rounded-xl p-3" id="ret-ok">✅ রিটার্ন করুন</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  let foundProduct = null;

  const close = () => { camOff(); el.remove(); };
  document.getElementById('ret-close').onclick = close;
  document.getElementById('ret-cancel').onclick = close;
  el.addEventListener('mousedown', e => { if (e.target === el) close(); });

  const codeInp = document.getElementById('ret-code');
  const prodInfo = document.getElementById('ret-prod-info');

  async function lookup(code) {
    code = en(code).trim();
    if (!code) { foundProduct = null; prodInfo.classList.add('hidden'); return; }
    // Check local cache first (faster)
    let p = getState().products.find(x => x.barcode === code);
    if (!p) {
      try {
        const r = await API.get('/products?q=' + encodeURIComponent(code));
        if (r.data?.length > 0) {
          // Find exact barcode match
          p = r.data.find(x => x.barcode === code) || r.data[0];
        }
      } catch {}
    }
    if (!p) {
      foundProduct = null;
      prodInfo.classList.add('hidden');
      return;
    }
    foundProduct = p;
    prodInfo.classList.remove('hidden');
    prodInfo.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl">${p.emoji || '👕'}</div>
        <div class="flex-1 min-w-0">
          <b class="block text-base truncate">${esc(p.name)}${p.size ? ' (' + esc(p.size) + ')' : ''}</b>
          <small class="text-slate-400">বিক্রি দাম ${bn(p.sell_price)} · স্টক ${N(p.stock)}</small>
        </div>
      </div>`;
  }

  codeInp.addEventListener('input', e => {
    const v = en(e.target.value).trim();
    // Auto-lookup on exact barcode match (typical scan)
    const p = getState().products.find(x => x.barcode === v);
    if (p) {
      e.target.value = v;
      lookup(v);
      // Move focus to qty
      document.getElementById('ret-qty').focus();
    } else {
      lookup(v);
    }
  });
  codeInp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('ret-qty').focus();
    }
  });

  document.getElementById('ret-cam').onclick = () => {
    const cam = document.getElementById('ret-camview');
    cam.classList.contains('hidden') ? camOn() : camOff();
  };

  async function camOn() {
    if (!('BarcodeDetector' in window)) { toast('এই ব্রাউজারে ক্যামেরা স্ক্যান চলে না'); return; }
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const v = document.getElementById('ret-cam-v');
      v.srcObject = camStream; await v.play();
      document.getElementById('ret-camview').classList.remove('hidden');
      const d = new BarcodeDetector();
      scanTimer = setInterval(async () => {
        try {
          const r = await d.detect(v);
          if (r[0]) {
            codeInp.value = r[0].rawValue;
            await lookup(r[0].rawValue);
            document.getElementById('ret-qty').focus();
            camOff();
          }
        } catch {}
      }, 400);
    } catch { toast('ক্যামেরার অনুমতি দিন'); }
  }
  function camOff() {
    clearInterval(scanTimer);
    if (camStream) camStream.getTracks().forEach(t => t.stop());
    camStream = null;
    const cam = document.getElementById('ret-camview');
    if (cam) cam.classList.add('hidden');
  }

  document.getElementById('ret-ok').onclick = async () => {
    if (!foundProduct) {
      toast('আগে বারকোড দিন');
      codeInp.focus();
      return;
    }
    const qty = parseInt(num(document.getElementById('ret-qty').value)) || 0;
    if (qty < 1) {
      toast('পরিমাণ সঠিক নয় (অন্তত ১)');
      document.getElementById('ret-qty').focus();
      return;
    }
    const invoice = document.getElementById('ret-inv').value.trim();
    const reason = document.getElementById('ret-reason').value.trim();

    // If invoice is given, find the sale_id
    let saleId = null;
    if (invoice) {
      try {
        // Try to find the sale by invoice_no via sales list
        const r = await API.get('/sales?q=' + encodeURIComponent(invoice));
        const match = (r.data || []).find(s => s.invoice_no === invoice);
        if (match) saleId = match.id;
      } catch {}
    }

    const btn = document.getElementById('ret-ok');
    btn.disabled = true; btn.textContent = 'প্রসেস হচ্ছে...';
    try {
      const r = await API.post('/returns', {
        barcode: foundProduct.barcode,
        qty,
        reason: reason || null,
        sale_id: saleId,
      });
      toast('✓ ' + foundProduct.name + ' × ' + qty + ' রিটার্ন হয়েছে, স্টক যোগ হয়েছে');
      close();
      location.reload();
    } catch (err) {
      toast('ত্রুটি: ' + err.message);
      btn.disabled = false; btn.textContent = '✅ রিটার্ন করুন';
    }
  };

  setTimeout(() => codeInp.focus(), 50);
}
