/**
 * quickbill.js — QuickBill modal: barcode scan, items, discount, payment
 */
import { API } from '../api.js';
import { getState, setState } from '../store.js';
import { CATEGORIES } from '../config.js';
import { bn, N, num, en } from '../utils/format.js';
import { toast } from './toast.js';
import { printReceipt, sendWhatsApp } from './receipt.js';

let QB = [];
let QD = { m: 'p', v: 0 };
let lastCode = '', lastTime = 0, camStream = null, scanTimer = null;

const line = i => i.unit_price * i.qty;
const disc = i => i.dv ? (i.dt === 't' ? Math.min(line(i), i.dv) : Math.round(line(i) * Math.min(100, i.dv) / 100)) : 0;
const net = i => line(i) - disc(i);
const f2 = x => (Math.round(x * 100) / 100).toFixed(2);

function calc() {
  const gross = QB.reduce((a, i) => a + line(i), 0);
  const itemDisc = QB.reduce((a, i) => a + disc(i), 0);
  const base = gross - itemDisc;
  let billDisc = QD.m === 'p' ? base * QD.v / 100 : QD.v;
  billDisc = Math.round(Math.max(0, Math.min(base, billDisc)) * 100) / 100;
  const after = base - billDisc;
  const vatPct = parseFloat(getState().settings.vat_percent) || 0;
  const vat = after * vatPct / (100 + vatPct);
  return { lines: QB.length, qty: QB.reduce((a, i) => a + i.qty, 0), gross, itemDisc, billDisc, disc: itemDisc + billDisc, sub: after, vat };
}

function rowSmall(i) { const d = disc(i); return bn(i.unit_price) + ' × ' + N(i.qty) + (d ? ' · ছাড় ' + (i.dt === 'p' ? N(i.dv) + '%' : bn(i.dv)) : ''); }
function rowAmt(i) { return (disc(i) ? `<s>${bn(line(i))}</s>` : '') + bn(net(i)); }

function renderItems() {
  const el = document.getElementById('qb-items');
  if (!el) return;
  el.innerHTML = QB.length ? QB.map(i => `
    <div class="qi bg-slate-800/50 border border-slate-700 rounded-xl mb-2 overflow-hidden" data-c="${i.c}">
      <div class="qrow flex items-center gap-2.5 p-2.5 cursor-pointer">
        <div class="who flex-1 min-w-0"><b class="block text-base font-semibold">${i.n}</b><small class="text-slate-400">${rowSmall(i)}</small></div>
        <div class="flex gap-2"><button class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-lg" data-d="-1">−</button><button class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-lg" data-d="1">+</button></div>
        <span class="amt text-right min-w-[72px] font-bold">${rowAmt(i)}</span>
      </div>
      ${i.o ? `<div class="dedit flex gap-2 items-center flex-wrap p-2.5 border-t border-dashed border-slate-700 bg-black/20">
        <label class="dd flex-1 min-w-[110px] flex items-center gap-1.5"><span class="text-slate-400 text-sm whitespace-nowrap">% ছাড়</span><input class="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2" data-k="p" inputmode="decimal" placeholder="0" value="${i.dt==='p'?i.dv:''}"></label>
        <label class="dd flex-1 min-w-[110px] flex items-center gap-1.5"><span class="text-slate-400 text-sm whitespace-nowrap">৳ ছাড়</span><input class="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2" data-k="t" inputmode="decimal" placeholder="0" value="${i.dt==='t'?i.dv:''}"></label>
        <button class="no text-slate-400 px-2.5">বাদ</button><button class="ok bg-teal-500 text-slate-900 rounded-lg px-3.5 py-2 font-semibold">ঠিক</button>
      </div>` : ''}
    </div>
  `).join('') : '<p class="text-slate-400 text-center py-4 m-0">বারকোড স্ক্যান করুন বা লিখুন</p>';
  updateSummary();
}

function updateSummary() {
  const c = calc();
  const el = s => document.getElementById(s);
  if (!el('s-line')) return;
  el('s-line').textContent = c.lines;
  el('s-qty').textContent = c.qty;
  el('s-tot').textContent = f2(c.gross);
  el('s-vat').textContent = f2(c.vat);
  const vp = parseFloat(getState().settings.vat_percent) || 0;
  el('s-vat-l').textContent = vp ? `VAT (${vp}%) — মূল্যের ভেতরে` : 'VAT';
  el('s-disc-row').style.display = c.disc > 0 ? 'flex' : 'none';
  el('s-disc').textContent = '-' + f2(c.disc);
  el('s-sub').textContent = f2(c.sub);
}

async function addItem(code, fromCam) {
  code = en(code).trim();
  let p = getState().products.find(x => x.barcode === code);
  if (!p) {
    try { const r = await API.get('/products?q=' + encodeURIComponent(code)); if (r.data?.length > 0) { p = r.data[0]; getState().products.unshift(p); } } catch {}
  }
  if (!p) { toast('এই বারকোডে কোনো পণ্য পাওয়া যায়নি'); return false; }
  const now = Date.now();
  if (fromCam && code === lastCode && now - lastTime < 1500) return true;
  lastCode = code; lastTime = now;
  let item = QB.find(x => x.c === code);
  if (!item) {
    item = { c: code, pid: p.id, n: p.name + (p.size ? ' (' + p.size + ')' : ''), unit_price: parseFloat(p.sell_price) || 0, qty: 0, dt: 'p', dv: 0, o: false };
    QB.push(item);
  }
  item.qty++;
  renderItems();
  return true;
}

export function openQuickBill() {
  // Reset button
  QB = []; QD = { m: 'p', v: 0 };
  createModal();
  renderItems();
}

export function resumeHeldBill(sale) {
  QB = (sale.items || []).map(it => ({
    c: it.barcode || 'manual-' + it.id, pid: it.product_id,
    n: it.product_name, unit_price: parseFloat(it.unit_price) || 0,
    qty: parseInt(it.qty) || 1, dt: 't', dv: parseFloat(it.discount) || 0, o: false,
  }));
  createModal();
  const nameEl = document.getElementById('qb-name');
  const mobEl = document.getElementById('qb-mob');
  if (nameEl) nameEl.value = sale.customer_name || '';
  if (mobEl) mobEl.value = sale.customer_phone || '';
  renderItems();
  toast('হোল্ড বিল লোড হয়েছে');
}

function createModal() {
  let el = document.getElementById('qb-modal');
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'qb-modal';
  el.className = 'fixed inset-0 z-[100] flex items-end justify-center bg-black/70';
  el.innerHTML = `
    <div class="bg-slate-900 border border-slate-700 border-b-0 w-full max-w-[520px] max-h-[94vh] overflow-y-auto rounded-t-3xl p-4 animate-slide-up">
      <div class="flex justify-between items-center mb-3">
        <h2 class="text-xl font-bold">⚡ কুইকবিল</h2>
        <button class="w-9 h-9 rounded-xl bg-slate-800 text-base flex items-center justify-center" id="qb-close">✕</button>
      </div>
      <div class="qb-grid">
      <div class="qb-left">
      <div class="flex gap-2 mb-2.5">
        <input class="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100 outline-none focus:border-teal-500" id="qb-code" placeholder="বারকোড স্ক্যান বা লিখুন" autocomplete="off">
        <button class="w-12 h-12 rounded-xl bg-teal-500 text-slate-900 text-xl flex items-center justify-center" id="qb-cam">📷</button>
      </div>
      <div class="cam hidden relative mb-2.5 rounded-xl overflow-hidden bg-black" id="cam">
        <video id="cam-v" playsinline muted class="w-full max-h-60 object-cover"></video>
        <div class="absolute inset-[25%_12%] border-2 border-teal-400 rounded-xl pointer-events-none"></div>
      </div>
      <div id="qb-items" class="mb-3"></div>
      </div>
      <div class="qb-right">
      <div class="grid grid-cols-2 gap-2 mb-3">
        <input class="bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100 outline-none focus:border-teal-500" id="qb-name" placeholder="কাস্টমারের নাম">
        <input class="bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-100 outline-none focus:border-teal-500" id="qb-mob" type="tel" placeholder="মোবাইল নম্বর">
      </div>
      <label class="block text-slate-400 text-sm mb-1">পেমেন্ট মেথড</label>
      <select class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-2 text-slate-100" id="qb-method">
        <option value="cash">নগদ</option>
        <option value="bkash">bKash</option>
        <option value="nagad">Nagad</option>
        <option value="rocket">Rocket</option>
        <option value="bank">ব্যাংক</option>
        <option value="card">কার্ড</option>
      </select>

      <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-3 mt-3">
        <div class="flex justify-between items-center py-1.5 text-sm">
          <span class="text-slate-400">মোট লাইন</span>
          <span class="font-semibold text-teal-100 bg-teal-500/15 px-3 py-1 rounded" id="s-line">0</span>
        </div>
        <div class="flex justify-between items-center py-1.5 text-sm">
          <span class="text-slate-400">মোট পিস</span>
          <span class="font-semibold text-teal-100 bg-teal-500/15 px-3 py-1 rounded" id="s-qty">0</span>
        </div>
        <div class="flex justify-between items-center py-1.5 text-sm">
          <span class="text-slate-400">মোট দাম</span>
          <span class="font-semibold text-teal-100 bg-teal-500/15 px-3 py-1 rounded" id="s-tot">0.00</span>
        </div>
        <div class="flex justify-between items-center py-1.5 text-sm">
          <span class="text-slate-400" id="s-vat-l">VAT</span>
          <span class="font-semibold text-teal-100 bg-teal-500/15 px-3 py-1 rounded" id="s-vat">0.00</span>
        </div>
        <div class="flex justify-between items-center py-1.5 text-sm">
          <span class="text-slate-400">ছাড় %</span>
          <input class="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right font-semibold w-20 text-slate-100 outline-none" id="s-dp" inputmode="decimal" placeholder="0">
        </div>
        <div class="flex justify-between items-center py-1.5 text-sm">
          <span class="text-slate-400">ছাড় ৳</span>
          <input class="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right font-semibold w-20 text-slate-100 outline-none" id="s-dt" inputmode="decimal" placeholder="0">
        </div>
        <div class="justify-between items-center py-1.5 text-sm" id="s-disc-row" style="display:none">
          <span class="text-slate-400">মোট ছাড়</span>
          <span class="font-semibold text-red-300 bg-red-500/15 px-3 py-1 rounded" id="s-disc">0.00</span>
        </div>
        <div class="flex justify-between items-center py-2 mt-2 border-t border-slate-700">
          <span class="font-bold text-base">সর্বমোট</span>
          <span class="font-bold text-2xl text-teal-400" id="s-sub">0.00</span>
        </div>
      </div>

      <button class="w-full bg-slate-800 border border-slate-700 text-slate-100 font-bold rounded-xl p-3.5 mt-3" id="qb-hold">⏸️ হোল্ড করুন</button>
      <button class="w-full bg-teal-500 text-slate-900 font-bold text-lg rounded-xl p-3.5 mt-2" id="qb-done">✅ বিল সম্পন্ন করুন</button>
      <button class="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl p-3.5 mt-2" id="qb-cancel">বাতিল</button>
      </div>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  bindEvents();
  setTimeout(() => document.getElementById('qb-code')?.focus(), 50);
}

function bindEvents() {
  document.getElementById('qb-close').onclick = () => closeQB(false);
  document.getElementById('qb-cancel').onclick = () => closeQB(true);
  document.getElementById('qb-code').addEventListener('input', e => {
    const v = en(e.target.value).trim();
    const p = getState().products.find(x => x.barcode === v);
    if (v && p) { addItem(v); e.target.value = ''; }
  });
  document.getElementById('qb-code').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value) { addItem(e.target.value); e.target.value = ''; }
  });
  document.getElementById('qb-name').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const mob = document.getElementById('qb-mob');
    if (!mob.value.trim()) mob.focus(); else openPay();
  });
  document.getElementById('qb-mob').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); openPay(); }
  });
  document.getElementById('qb-cam').onclick = () => {
    const cam = document.getElementById('cam');
    cam.classList.contains('hidden') ? camOn() : camOff();
  };
  document.getElementById('qb-items').addEventListener('click', e => {
    const box = e.target.closest('.qi'); if (!box) return;
    const item = QB.find(x => x.c === box.dataset.c); if (!item) return;
    const q = e.target.closest('[data-d]');
    if (q) { item.qty += +q.dataset.d; if (item.qty < 1) QB = QB.filter(x => x !== item); renderItems(); return; }
    if (e.target.closest('.no')) { item.dv = 0; item.o = false; renderItems(); return; }
    if (e.target.closest('.ok')) { item.o = false; renderItems(); return; }
    if (e.target.closest('.dedit')) return;
    QB.forEach(x => x.o = false); item.o = !item.o; renderItems();
  });
  document.getElementById('qb-items').addEventListener('input', e => {
    const inp = e.target.closest('.dedit input'); if (!inp) return;
    const box = inp.closest('.qi'); const item = QB.find(x => x.c === box.dataset.c);
    const lt = line(item); const other = box.querySelector(`.dedit input:not([data-k="${inp.dataset.k}"])`);
    const v = num(inp.value);
    if (isNaN(v) || v <= 0) { item.dv = 0; other.value = ''; }
    else if (inp.dataset.k === 'p') { item.dt = 'p'; item.dv = Math.min(100, v); other.value = disc(item); }
    else { item.dt = 't'; item.dv = Math.min(lt, v); other.value = Math.round(item.dv / lt * 10000) / 100; }
    box.querySelector('.who small').textContent = rowSmall(item);
    box.querySelector('.amt').innerHTML = rowAmt(item);
    updateSummary();
  });
  document.getElementById('s-dp').addEventListener('input', e => { QD = { m: 'p', v: num(e.target.value) }; updateSummary(); });
  document.getElementById('s-dt').addEventListener('input', e => {
    const id = QB.reduce((a, i) => a + disc(i), 0);
    QD = { m: 't', v: Math.max(0, num(e.target.value) - id) };
    document.getElementById('s-dp').value = '';
    updateSummary();
  });
  document.getElementById('qb-hold').onclick = holdBill;
  document.getElementById('qb-done').onclick = openPay;
}

function closeQB(reset) {
  camOff();
  const el = document.getElementById('qb-modal');
  if (el) el.remove();
  if (reset) { QB = []; QD = { m: 'p', v: 0 }; }
}

async function camOn() {
  if (!('BarcodeDetector' in window)) { toast('এই ব্রাউজারে ক্যামেরা স্ক্যান চলে না'); return; }
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = document.getElementById('cam-v');
    v.srcObject = camStream; await v.play();
    document.getElementById('cam').classList.remove('hidden');
    const d = new BarcodeDetector();
    scanTimer = setInterval(async () => {
      try { const r = await d.detect(v); if (r[0]) addItem(r[0].rawValue, true); } catch {}
    }, 400);
  } catch { toast('ক্যামেরার অনুমতি দিন'); }
}

function camOff() {
  clearInterval(scanTimer);
  if (camStream) camStream.getTracks().forEach(t => t.stop());
  camStream = null;
  const cam = document.getElementById('cam');
  if (cam) cam.classList.add('hidden');
}

async function holdBill() {
  if (QB.length === 0) { toast('আগে পণ্য যোগ করুন'); return; }
  const c = calc();
  try {
    const items = QB.map(i => ({ product_id: i.pid, product_name: i.n, qty: i.qty, unit_price: i.unit_price, discount: disc(i) }));
    await API.post('/sales', {
      items, customer: { name: document.getElementById('qb-name').value.trim() || null, phone: en(document.getElementById('qb-mob').value).trim() || null },
      bill_discount: c.billDisc, paid: 0, payment_method: 'cash', status: 'held', cashier_name: 'ক্যাশিয়ার',
    });
    toast('⏸️ বিল হোল্ড করা হয়েছে');
    closeQB(true);
  } catch (err) { toast('ত্রুটি: ' + err.message); }
}

function openPay() {
  const t = calc().sub;
  if (!t) { toast('আগে পণ্য যোগ করুন'); return; }
  let el = document.getElementById('pay-modal');
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'pay-modal';
  el.className = 'fixed inset-0 z-[120] flex items-center justify-center bg-black/70';
  el.innerHTML = `
    <div class="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-[400px] mx-3 animate-slide-up">
      <h2 class="text-xl font-bold text-center mb-4">💳 পেমেন্ট</h2>
      <div class="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 text-center mb-4">
        <div class="text-slate-400 text-sm">মোট বিল</div>
        <div class="text-4xl font-bold text-teal-400 mt-1">${bn(t)}</div>
      </div>
      <label class="block text-slate-400 text-sm mb-1">কাস্টমার কত টাকা দিলো?</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xl text-slate-100 outline-none focus:border-teal-500" id="pay-in" inputmode="decimal" placeholder="${f2(t)}" autocomplete="off">
      <div class="text-red-400 text-sm mt-2 min-h-[20px]" id="pay-warn"></div>
      <div class="grid grid-cols-2 gap-2 mt-3">
        <button class="bg-slate-800 border border-slate-700 text-slate-100 rounded-xl p-3" id="pay-cancel">বাতিল</button>
        <button class="bg-teal-500 text-slate-900 font-bold rounded-xl p-3" id="pay-ok">✅ নিশ্চিত করুন</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  const inp = document.getElementById('pay-in');
  const close = () => { el.remove(); document.getElementById('qb-name')?.focus(); };
  inp.addEventListener('input', () => {
    const raw = inp.value.trim();
    const v = num(raw);
    document.getElementById('pay-warn').textContent = raw && v > 0 && v < t ? `বাকি থাকবে ${bn(t - v)} (খাতায় জমা হবে)` : '';
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.getElementById('pay-cancel').onclick = close;
  document.getElementById('pay-ok').onclick = submit;
  setTimeout(() => inp.focus(), 30);

  function submit() {
    const raw = inp.value.trim();
    const v = num(raw);
    completeBill(!raw || v === 0 ? t : v);
  }
}

async function completeBill(paidFinal) {
  const c = calc();
  const t = c.sub;
  if (!t) { toast('আগে পণ্য যোগ করুন'); return; }
  const name = document.getElementById('qb-name').value.trim();
  const mob = en(document.getElementById('qb-mob').value).trim();
  const method = document.getElementById('qb-method').value;
  if (paidFinal < t && (!name || !mob)) {
    document.getElementById('pay-modal')?.remove();
    toast('বাকি হলে কাস্টমারের নাম ও মোবাইল দিন');
    (name ? document.getElementById('qb-mob') : document.getElementById('qb-name'))?.focus();
    return;
  }

  const btn = document.getElementById('pay-ok');
  if (btn.disabled) return;
  btn.textContent = 'সম্পন্ন হচ্ছে...'; btn.disabled = true;

  try {
    const items = QB.map(i => ({ product_id: i.pid, product_name: i.n, qty: i.qty, unit_price: i.unit_price, discount: disc(i) }));
    const r = await API.post('/sales', {
      items, customer: { name: name || null, phone: mob || null },
      bill_discount: c.billDisc, paid: paidFinal, payment_method: method, status: 'completed', cashier_name: 'ক্যাশিয়ার',
    });
    const sale = r.data;
    document.getElementById('pay-modal')?.remove();
    closeQB(true);
    showChange({ no: sale.invoice_no, t: parseFloat(sale.total), paid: parseFloat(sale.paid), ret: parseFloat(sale.change_given), due: parseFloat(sale.due), bd: parseFloat(sale.bill_discount) || 0, vat: parseFloat(sale.vat) || 0, vatPct: parseFloat(getState().settings.vat_percent) || 0, who: name || 'ওয়াক-ইন', phone: mob, method, saleId: sale.id, items: sale.items });
    // Reload dashboard
    if (window.location.hash === '#/home') location.reload();
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
    btn.textContent = '✅ নিশ্চিত করুন'; btn.disabled = false;
  }
}

function showChange(o) {
  let el = document.getElementById('chg-modal');
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'chg-modal';
  el.className = 'fixed inset-0 z-60 flex items-center justify-center bg-black/55';
  el.innerHTML = `
    <div class="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-[380px] text-center mx-3 animate-slide-up">
      <div class="text-5xl mb-2">✅</div>
      <h2 class="text-xl justify-center">বিল সম্পন্ন!</h2>
      <p class="text-slate-400 text-sm my-3">ইনভয়েস #${o.no} · ${o.who}</p>
      <div class="flex justify-between py-2 text-slate-400 text-sm"><span>মোট বিল</span><span class="text-slate-100">${bn(o.t)}</span></div>
      <div class="flex justify-between py-2 text-slate-400 text-sm"><span>কাস্টমার দিল</span><span class="text-slate-100">${bn(o.paid)}</span></div>
      <div class="res ${o.due > 0 ? 'bad' : 'ok'} text-xl my-3" id="chg-r">${o.due > 0 ? `বাকি থাকবে <b>${bn(o.due)}</b>` : o.ret > 0 ? `ফেরত দিতে হবে <b>${bn(o.ret)}</b>` : 'ঠিক টাকা — ফেরত নেই'}</div>
      <button class="w-full bg-teal-500 text-slate-900 font-bold rounded-xl p-3 mb-2" id="chg-print">🖨️ রিসিট প্রিন্ট</button>
      <button class="w-full bg-green-600 text-white font-bold rounded-xl p-3 mb-2" id="chg-wa">🟢 WhatsApp এ পাঠান</button>
      <button class="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl p-3" id="chg-ok">ঠিক আছে</button>
    </div>
  `;
  document.body.appendChild(el);
  document.getElementById('chg-ok').onclick = () => { el.remove(); location.reload(); };
  document.getElementById('chg-print').onclick = () => printReceipt(o);
  document.getElementById('chg-wa').onclick = () => sendWhatsApp(o);
  printReceipt(o);
}
