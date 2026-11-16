/* ============================================================
   POS Pro — app.js
   সম্পূর্ণ ফ্রন্টএন্ড লজিক: API integration, লগইন, বিলিং,
   সেলস হিস্ট্রি, শিফট, হোল্ড বিল, অন/অফলাইন, ডেমো সীড
   ============================================================ */

/* ===== API হেল্পার ===== */
const API = {
  async call(path, opts = {}) {
    const res = await fetch('/api' + path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...opts,
    });
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const msg = data?.error || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  },
  get(path) { return this.call(path); },
  post(path, body) { return this.call(path, { method: 'POST', body: JSON.stringify(body) }); },
  put(path, body) { return this.call(path, { method: 'PUT', body: JSON.stringify(body) }); },
  del(path) { return this.call(path, { method: 'DELETE' }); },
};

/* ===== সাধারণ হেল্পার ===== */
const $ = id => document.getElementById(id);
const bn = n => '৳' + Number(n || 0).toLocaleString('bn-BD', { maximumFractionDigits: 2 });
const bnd = x => String(x).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const en = x => String(x).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
const N = x => Number(x).toLocaleString('bn-BD');
const num = x => Number(en(String(x || '0').replace(/[^\d.০-৯]/g, ''))) || 0;

let tt;
function toast(m) {
  const t = $('toast');
  t.textContent = m;
  t.classList.add('on');
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove('on'), 2400);
}

/* তারিখ ফরম্যাট */
const WD = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
const MO = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
function dstr(ts) {
  const d = new Date(ts);
  return WD[d.getDay()] + ', ' + bnd(d.getDate()) + ' ' + MO[d.getMonth()] + ' ' + bnd(d.getFullYear());
}
function tm(ts) {
  const d = new Date(ts), h = d.getHours();
  const period = h < 6 ? 'ভোর' : h < 12 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 18 ? 'বিকাল' : h < 20 ? 'সন্ধ্যা' : 'রাত';
  return period + ' ' + bnd(h % 12 || 12) + ':' + bnd(String(d.getMinutes()).padStart(2, '0'));
}
function dateKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const tone = s => s <= 10 ? 'due' : s <= 20 ? 'low' : 'paid';

/* ডাটা স্টেট */
let currentUser = null;
let SETTINGS = {};
let PRODUCTS = [];
let QB_ITEMS = [];
let QD = { m: 'p', v: 0 };
let lastScannedCode = '', lastScanTime = 0;
let camStream = null, scanTimer = null;
let editingCustId = null;
let editingSupId = null;
let editingUserId = null;

/* ============================================================
   অন/অফলাইন ইন্ডিকেটর
   ============================================================ */
function updateOnline() {
  const dot = $('online-indicator');
  if (!dot) return;
  if (navigator.onLine) {
    dot.classList.remove('off');
    dot.title = 'অনলাইন';
  } else {
    dot.classList.add('off');
    dot.title = 'অফলাইন — কিছু কাজ কাজ নাও করতে পারে';
  }
}
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);

/* ============================================================
   লগইন / সেটআপ
   ============================================================ */
async function initLogin() {
  // Check if setup is needed
  try {
    const r = await API.get('/auth/check-setup').catch(() => null);
    if (r?.data?.needsSetup) {
      $('setup-btn').style.display = 'block';
      $('login-hint').textContent = 'প্রথমবার: উপরের বাটনে ক্লিক করুন';
    }
  } catch {}

  // Try to load shop name from settings
  try {
    const r = await API.get('/settings');
    if (r.data?.shop_name) {
      $('login-shop-name').textContent = r.data.shop_name;
    }
  } catch {}
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('login-btn');
  btn.textContent = 'লগইন হচ্ছে...';
  btn.disabled = true;
  $('login-err').textContent = '';
  try {
    const r = await API.post('/auth/login', {
      username: $('login-username').value.trim(),
      password: $('login-password').value,
    });
    currentUser = r.data;
    showApp();
  } catch (err) {
    $('login-err').textContent = err.message || 'লগইন ব্যর্থ';
    btn.textContent = 'লগইন করুন';
    btn.disabled = false;
  }
});

$('setup-btn').addEventListener('click', async () => {
  const btn = $('setup-btn');
  btn.textContent = 'সেটআপ হচ্ছে...';
  btn.disabled = true;
  try {
    await API.post('/auth/setup', {});
    toast('✓ সেটআপ সম্পন্ন! এখন admin / admin123 দিয়ে লগইন করুন');
    $('setup-btn').style.display = 'none';
    $('login-username').value = 'admin';
    $('login-password').value = 'admin123';
    $('login-hint').textContent = 'ইউজারনেম: admin · পাসওয়ার্ড: admin123 (পরে বদলাবেন)';
  } catch (err) {
    toast('সেটআপ ব্যর্থ: ' + err.message);
    btn.textContent = '🔐 প্রথমবার সেটআপ';
    btn.disabled = false;
  }
});

function showApp() {
  $('login-screen').style.display = 'none';
  $('app-main').style.display = 'block';
  updateOnline();
  initApp();
}

async function initApp() {
  // Load settings
  try {
    const r = await API.get('/settings');
    SETTINGS = r.data || {};
    applySettings();
  } catch {}

  // Build category options
  const CC = { 'শার্ট': '#2dd4bf', 'প্যান্ট': '#3b82f6', 'পাঞ্জাবি': '#f59e0b', 'শাড়ি': '#ec4899', 'থ্রি-পিস': '#a855f7', 'বাচ্চাদের': '#22c55e', 'লুঙ্গি': '#06b6d4', 'কুর্তি': '#f97316', 'জ্যাকেট': '#8b5cf6', 'টাই': '#14b8a6', 'বেল্ট': '#eab308', 'অন্যান্য': '#94a3b8' };
  $('np-cat').innerHTML = Object.keys(CC).map(k => `<option>${k}</option>`).join('');

  buildNav();
  await loadDashboard();
  await loadHeldBills();
}

/* ============================================================
   সেটিংস প্রয়োগ
   ============================================================ */
function applySettings() {
  const shopName = SETTINGS.shop_name || 'রহমান ফ্যাশন শোরুম';
  $('shop-name').textContent = shopName;
  document.querySelectorAll('.shop-name-sync').forEach(e => e.textContent = shopName);
  document.title = 'POS Pro · ' + shopName;

  // Fill settings drawer
  $('set-shop-name').value = SETTINGS.shop_name || '';
  $('set-shop-address').value = SETTINGS.shop_address || '';
  $('set-shop-phone').value = SETTINGS.shop_phone || '';
  $('set-shop-phone2').value = SETTINGS.shop_phone2 || '';
  $('set-receipt-header').value = SETTINGS.receipt_header || '';
  $('set-receipt-footer').value = SETTINGS.receipt_footer || '';
  $('set-vat').value = SETTINGS.vat_percent || '0';
  $('set-invoice-prefix').value = SETTINGS.invoice_prefix || 'INV-';
  $('set-bkash').value = SETTINGS.bkash_number || '';
  $('set-nagad').value = SETTINGS.nagad_number || '';
  $('set-low-stock').value = SETTINGS.low_stock_default || '20';

  // Printer size buttons
  const printerSize = SETTINGS.printer_size || '80';
  document.querySelectorAll('#set-printer-size button').forEach(b => {
    b.classList.toggle('on', b.dataset.val === printerSize);
  });
}

/* ============================================================
   নেভিগেশন
   ============================================================ */
const BASE_MODULES = [
  ['home', '🏠', 'হোম'],
  ['billing', '🛒', 'বিলিং'],
  ['history', '🧾', 'হিস্ট্রি'],
  ['khata', '📒', 'খাতা'],
  ['products', '📦', 'পণ্য'],
  ['stock', '📊', 'স্টক'],
  ['customers', '👥', 'কাস্টমার'],
  ['suppliers', '🚚', 'সাপ্লায়ার'],
  ['expense', '💸', 'খরচ'],
  ['reports', '📈', 'রিপোর্ট'],
  ['returns', '↩️', 'রিটার্ন'],
  ['users', '🔐', 'ইউজার'],
  ['shift', '⏰', 'শিফট'],
  ['files', '🗂️', 'ফাইল'],
];

let currentView = 'home';
function buildNav() {
  const nav = $('nav');
  nav.querySelectorAll('button').forEach(b => b.remove());
  BASE_MODULES.forEach(m => {
    // Hide users module from non-admin
    if (m[0] === 'users' && currentUser?.role !== 'admin') return;
    const b = document.createElement('button');
    b.dataset.go = m[0];
    b.innerHTML = `<span class="ic">${m[1]}</span>${m[2]}`;
    b.classList.toggle('active', m[0] === currentView);
    nav.appendChild(b);
  });
}

function show(id) {
  currentView = id;
  document.querySelectorAll('.view').forEach(x => x.classList.toggle('active', x.id === id));
  $('nav').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.go === id));
  scrollTo({ top: 0, behavior: 'smooth' });

  // Lazy-load view data
  if (id === 'products') loadProducts();
  if (id === 'stock') loadStock();
  if (id === 'customers') loadCustomers();
  if (id === 'khata') loadKhata();
  if (id === 'history') loadHistory();
  if (id === 'suppliers') loadSuppliers();
  if (id === 'expense') loadExpenses();
  if (id === 'returns') loadReturns();
  if (id === 'users') loadUsers();
  if (id === 'shift') loadShifts();
  if (id === 'reports') loadReports();
}

$('nav').addEventListener('click', e => {
  const b = e.target.closest('button[data-go]');
  if (b) show(b.dataset.go);
});

/* ============================================================
   ড্যাশবোর্ড
   ============================================================ */
async function loadDashboard() {
  try {
    const r = await API.get('/reports?type=dashboard');
    const d = r.data;
    $('kpi-today').textContent = bn(d.todaySales);
    $('kpi-bills').textContent = N(d.todayBills) + 'টি';
    $('kpi-due').textContent = bn(d.totalDue);
    $('kpi-duen').textContent = 'মোট বাকি (' + N(d.dueCount) + ' জন)';
    $('kpi-total').textContent = bn(d.totalSales);

    // Donut chart
    const CC = { 'শার্ট': '#2dd4bf', 'প্যান্ট': '#3b82f6', 'পাঞ্জাবি': '#f59e0b', 'শাড়ি': '#ec4899', 'থ্রি-পিস': '#a855f7', 'বাচ্চাদের': '#22c55e', 'লুঙ্গি': '#06b6d4', 'কুর্তি': '#f97316', 'জ্যাকেট': '#8b5cf6', 'অন্যান্য': '#94a3b8' };
    const cats = d.categoryBreakdown || [];
    const total = cats.reduce((a, c) => a + Number(c.revenue), 0);
    if (total > 0) {
      let cum = 0;
      $('donut').style.background = 'conic-gradient(' + cats.map(c => {
        const start = cum / total * 360;
        cum += Number(c.revenue);
        const end = cum / total * 360;
        return `${CC[c.category] || '#94a3b8'} ${start}deg ${end}deg`;
      }).join(',') + ')';
    } else {
      $('donut').style.background = '#22394a';
    }
    $('d-total').textContent = bn(total);
    $('legend').innerHTML = cats.map(c => `<div><i style="background:${CC[c.category] || '#94a3b8'}"></i><span>${c.category}</span><span>${Math.round(Number(c.revenue) / total * 100)}% · ${bn(c.revenue)}</span></div>`).join('') || '<p class="hint" style="margin:0">এখনো কোনো বিক্রি নেই</p>';

    // Low stock
    const lo = d.lowStock || [];
    $('low').innerHTML = lo.length ? lo.map(p => `
      <div class="row">
        <div class="av" style="background:#1d3a48;color:inherit">${p.emoji || '👕'}</div>
        <div class="who"><b>${p.name}</b><small>সীমা: ${N(p.low_stock)} পিস</small></div>
        <span class="pill ${tone(p.stock)}">${N(p.stock)} বাকি</span>
      </div>
    `).join('') : '<p class="hint" style="margin:0">কোনো পণ্যের স্টক কম নেই ✓</p>';

    // Top products
    const top = d.topProducts || [];
    $('top').innerHTML = top.length ? top.map(p => `
      <div style="margin-bottom:12px">
        <div class="ln" style="padding:0">
          <span style="color:var(--text)">${p.product_name}</span>
          <span>${N(p.qty)}টি · ${bn(p.revenue)}</span>
        </div>
        <div class="bar"><i style="width:${Math.min(100, p.qty)}%"></i></div>
      </div>
    `).join('') : '<p class="hint" style="margin:0">এখনো কোনো বিক্রি নেই</p>';
  } catch (err) {
    toast('ড্যাশবোর্ড লোড ব্যর্থ: ' + err.message);
  }
}

/* ============================================================
   পণ্য — লোড, যোগ, মুছা, বারকোড প্রিন্ট
   ============================================================ */
async function loadProducts() {
  try {
    const r = await API.get('/products');
    PRODUCTS = r.data || [];
    $('pcount').textContent = 'মোট ' + N(PRODUCTS.length) + 'টি পণ্য';
    $('np-cnt').textContent = '(' + N(PRODUCTS.length) + 'টি)';
    renderProducts();
    renderStock();
  } catch (err) {
    toast('পণ্য লোড ব্যর্থ: ' + err.message);
  }
}

function renderProducts() {
  $('fprod').innerHTML = PRODUCTS.map(p => `
    <div class="row">
      <div class="av" style="background:#1d3a48;color:inherit">${p.emoji || '👕'}</div>
      <div class="who">
        <b>${p.name}${p.size ? ' (' + p.size + ')' : ''}</b>
        <small>${p.category} · কেনা ${bn(p.cost_price)} · বিক্রি ${bn(p.sell_price)} · স্টক ${N(p.stock)}<br>বারকোড ${p.barcode}</small>
      </div>
      <div class="acts">
        <button data-pr="${p.id}" aria-label="বারকোড প্রিন্ট">🏷️</button>
        <button data-del="${p.id}" aria-label="মুছুন">🗑️</button>
      </div>
    </div>
  `).join('') || '<p class="hint" style="margin:0">কোনো পণ্য নেই</p>';
}

function renderStock() {
  const tot = PRODUCTS.reduce((a, p) => a + p.stock, 0);
  $('sk-tot').textContent = 'মোট ' + N(PRODUCTS.length) + 'টি পণ্য · ' + N(tot) + ' পিস';
  const q = ($('sk-q')?.value || '').trim().toLowerCase();
  const list = PRODUCTS.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q));
  $('sk').innerHTML = list.map(p => `
    <div class="row">
      <div class="av" style="background:#1d3a48;color:inherit">${p.emoji || '👕'}</div>
      <div class="who"><b>${p.name}${p.size ? ' (' + p.size + ')' : ''}</b><small>${p.category} · ${p.barcode}</small></div>
      <span class="pill ${tone(p.stock)}">${N(p.stock)} পিস</span>
    </div>
  `).join('') || '<p class="hint" style="margin:0">কিছু পাওয়া যায়নি</p>';

  // Stock view (low first)
  $('slist').innerHTML = [...PRODUCTS].sort((a, b) => a.stock - b.stock).map(p => `
    <div class="row">
      <div class="who">
        <b>${p.name}${p.size ? ' (' + p.size + ')' : ''}</b>
        <div class="bar"><i class="${p.stock <= 10 ? 'bad' : p.stock <= 20 ? 'warn' : ''}" style="width:${Math.min(100, p.stock * 1.6)}%"></i></div>
      </div>
      <span class="pill ${tone(p.stock)}">${N(p.stock)} পিস</span>
    </div>
  `).join('');
}

function closePO() {
  document.querySelectorAll('#popts button, .po').forEach(x => x.classList.remove('on'));
}

$('popts').addEventListener('click', e => {
  const b = e.target.closest('[data-o]');
  if (!b) return;
  const was = b.classList.contains('on');
  closePO();
  if (!was) { b.classList.add('on'); $(b.dataset.o).classList.add('on'); }
});

function genBarcode() {
  let c;
  do { c = '8' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'); }
  while (PRODUCTS.find(p => p.barcode === c));
  return c;
}

$('np-gen').onclick = () => $('np-c').value = genBarcode();

$('np-add').onclick = async () => {
  const name = $('np-n').value.trim();
  const barcode = $('np-c').value.trim() || genBarcode();
  const cost = num($('np-b').value);
  const sell = num($('np-p').value);
  const stock = parseInt(en($('np-s').value)) || 0;
  const category = $('np-cat').value;
  const size = $('np-z').value.trim();
  if (!name || sell <= 0) { toast('পণ্যের নাম ও বিক্রি দাম দিন'); return; }
  try {
    const r = await API.post('/products', { barcode, name, category, size, cost_price: cost, sell_price: sell, stock, emoji: '👕' });
    PRODUCTS.unshift(r.data);
    renderProducts();
    renderStock();
    $('pcount').textContent = 'মোট ' + N(PRODUCTS.length) + 'টি পণ্য';
    ['np-n', 'np-c', 'np-z', 'np-b', 'np-p', 'np-s'].forEach(i => $(i).value = '');
    toast('✓ ' + name + ' যোগ হয়েছে');
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
  }
};

$('fprod').addEventListener('click', async e => {
  const pr = e.target.closest('[data-pr]');
  const d = e.target.closest('[data-del]');
  if (pr) {
    const p = PRODUCTS.find(x => x.id == pr.dataset.pr);
    if (p) openPrint([p]);
  }
  if (d) {
    const p = PRODUCTS.find(x => x.id == d.dataset.del);
    if (p && confirm('"' + p.name + '" মুছে ফেলবেন?')) {
      try {
        await API.del('/products/' + p.id);
        PRODUCTS = PRODUCTS.filter(x => x.id != p.id);
        renderProducts();
        renderStock();
        toast('পণ্য মুছে ফেলা হয়েছে');
      } catch (err) { toast('ত্রুটি: ' + err.message); }
    }
  }
});

$('sk-q').addEventListener('input', renderStock);

$('np-printall').onclick = () => PRODUCTS.length ? openPrint(PRODUCTS) : toast('কোনো পণ্য নেই');

/* ============================================================
   বারকোড লেবেল প্রিন্ট
   ============================================================ */
let printQueue = [];

function lbl(p) {
  const shop = SETTINGS.shop_name || 'POS Pro';
  return `<div class="lbl"><small>${shop}</small><b>${p.name}${p.size ? ' (' + p.size + ')' : ''}</b><svg class="bc" data-c="${p.barcode}"></svg><span>${bn(p.sell_price)}</span></div>`;
}

function drawBC(root) {
  root.querySelectorAll('svg.bc').forEach(sv => {
    try {
      JsBarcode(sv, sv.dataset.c, { format: 'CODE128', width: 1.6, height: 36, displayValue: true, fontSize: 12, margin: 0, background: '#fff' });
    } catch (e) {}
  });
}

function openPrint(list) {
  if (typeof JsBarcode === 'undefined') { toast('বারকোড লাইব্রেরি লোড হয়নি'); return; }
  printQueue = list;
  $('pm-prev').innerHTML = lbl(list[0]) + lbl(list[0]);
  drawBC($('pm-prev'));
  $('pm-note').textContent = list.length > 1 ? 'মোট ' + N(list.length) + 'টি পণ্যের লেবেল প্রিন্ট হবে' : (list[0].name + (list[0].size ? ' (' + list[0].size + ')' : ''));
  $('pm').classList.add('on');
}

$('pm-x').onclick = () => $('pm').classList.remove('on');

$('pm-go').onclick = () => {
  const n = Math.max(1, parseInt(en($('pm-n').value)) || 1);
  $('print-area').innerHTML = printQueue.map(p => lbl(p).repeat(n)).join('');
  drawBC($('print-area'));
  setTimeout(() => window.print(), 150);
};

/* ============================================================
   কুইকবিল — বিলিং
   ============================================================ */
function qbLine(i) { return i.unit_price * i.qty; }
function qbDisc(i) {
  if (!i.dv) return 0;
  if (i.dt === 't') return Math.min(qbLine(i), i.dv);
  return Math.round(qbLine(i) * Math.min(100, i.dv) / 100);
}
function qbNet(i) { return qbLine(i) - qbDisc(i); }
const f2 = x => (Math.round(x * 100) / 100).toFixed(2);

function qbCalc() {
  const gross = QB_ITEMS.reduce((a, i) => a + qbLine(i), 0);
  const itemDisc = QB_ITEMS.reduce((a, i) => a + qbDisc(i), 0);
  const base = gross - itemDisc;
  let billDisc = QD.m === 'p' ? base * QD.v / 100 : QD.v;
  billDisc = Math.round(Math.max(0, Math.min(base, billDisc)) * 100) / 100;
  const after = base - billDisc;
  const vatPct = parseFloat(SETTINGS.vat_percent) || 0;
  const vat = after * vatPct / (100 + vatPct);
  return {
    lines: QB_ITEMS.length,
    qty: QB_ITEMS.reduce((a, i) => a + i.qty, 0),
    gross, itemDisc, billDisc,
    disc: itemDisc + billDisc,
    sub: after, vat,
  };
}

function qbSum(skip) {
  const c = qbCalc();
  $('s-line').textContent = c.lines;
  $('s-qty').textContent = c.qty;
  $('s-tot').textContent = f2(c.gross);
  $('s-vat').textContent = f2(c.vat);
  if (skip !== 'dt') $('s-dt').value = c.disc ? f2(c.disc) : '';
  $('s-sub').textContent = f2(c.sub);
  qbPaid();
}

function qbTotal() { return qbCalc().sub; }

function qbPaid() {
  const t = qbTotal();
  const v = num($('qb-paid').value);
  $('s-ret').textContent = f2(!isNaN(v) && v > t ? v - t : 0);
  const r = $('qb-res');
  if (!t || isNaN(v)) { r.className = 'res'; r.textContent = ''; return; }
  if (v >= t) { r.className = 'res ok'; r.innerHTML = `ফেরত দিতে হবে <b>${bn(v - t)}</b>`; }
  else { r.className = 'res bad'; r.innerHTML = `বাকি থাকবে <b>${bn(t - v)}</b>`; }
}

function rowSmall(i) {
  const d = qbDisc(i);
  return bn(i.unit_price) + ' × ' + N(i.q) + (d ? ' · ছাড় ' + (i.dt === 'p' ? N(i.dv) + '%' : bn(i.dv)) : '');
}
function rowAmt(i) {
  return (qbDisc(i) ? `<s>${bn(qbLine(i))}</s>` : '') + bn(qbNet(i));
}

function qbRender() {
  $('qb-items').innerHTML = QB_ITEMS.length ? QB_ITEMS.map(i => `
    <div class="qi" data-c="${i.c}">
      <div class="qrow">
        <div class="who"><b>${i.n}</b><small>${rowSmall(i)}</small></div>
        <div class="acts">
          <button data-d="-1" aria-label="কমান">−</button>
          <button data-d="1" aria-label="বাড়ান">+</button>
        </div>
        <span class="amt">${rowAmt(i)}</span>
      </div>
      ${i.o ? `<div class="dedit">
        <label class="dd"><span>% ছাড়</span><input data-k="p" inputmode="decimal" placeholder="০" value="${i.dt === 'p' ? i.dv : ''}"></label>
        <label class="dd"><span>৳ ছাড়</span><input data-k="t" inputmode="decimal" placeholder="০" value="${i.dt === 't' ? i.dv : ''}"></label>
        <button class="no">বাদ</button>
        <button class="ok">ঠিক</button>
      </div>` : ''}
    </div>
  `).join('') : '<p class="hint" style="margin:0">বারকোড স্ক্যান করুন বা লিখুন</p>';
  qbSum();
}

async function qbAdd(code, fromCam) {
  code = en(code).trim();
  let p = PRODUCTS.find(x => x.barcode === code);
  if (!p) {
    // Try loading from API
    try {
      const r = await API.get('/products?q=' + encodeURIComponent(code));
      if (r.data && r.data.length > 0) {
        p = r.data[0];
        PRODUCTS.unshift(p);
      }
    } catch {}
  }
  if (!p) { toast('এই বারকোডে কোনো পণ্য পাওয়া যায়নি'); return false; }

  const now = Date.now();
  if (fromCam && code === lastScannedCode && now - lastScanTime < 1500) return true;
  lastScannedCode = code;
  lastScanTime = now;

  let item = QB_ITEMS.find(x => x.c === code);
  if (!item) {
    item = { c: code, pid: p.id, n: p.name + (p.size ? ' (' + p.size + ')' : ''), p: Number(p.sell_price), qty: 0, dt: 'p', dv: 0, o: false };
    QB_ITEMS.push(item);
  }
  item.qty++;
  qbRender();
  const last = $('qb-items').lastElementChild;
  if (last) last.scrollIntoView({ block: 'nearest' });
  return true;
}

$('qb-items').addEventListener('click', e => {
  const box = e.target.closest('.qi');
  if (!box) return;
  const item = QB_ITEMS.find(x => x.c === box.dataset.c);
  if (!item) return;
  const q = e.target.closest('[data-d]');
  if (q) {
    item.qty += +q.dataset.d;
    if (item.qty < 1) QB_ITEMS = QB_ITEMS.filter(x => x !== item);
    qbRender();
    return;
  }
  if (e.target.closest('.no')) { item.dv = 0; item.o = false; qbRender(); return; }
  if (e.target.closest('.ok')) { item.o = false; qbRender(); return; }
  if (e.target.closest('.dedit')) return;
  const was = item.o;
  QB_ITEMS.forEach(x => x.o = false);
  item.o = !was;
  qbRender();
  if (item.o) {
    const inp = $('qb-items').querySelector(`[data-c="${item.c}"] .dedit input`);
    if (inp) inp.focus();
  }
});

$('qb-items').addEventListener('input', e => {
  const inp = e.target.closest('.dedit input');
  if (!inp) return;
  const box = inp.closest('.qi');
  const item = QB_ITEMS.find(x => x.c === box.dataset.c);
  const lineTotal = qbLine(item);
  const other = box.querySelector(`.dedit input:not([data-k="${inp.dataset.k}"])`);
  const v = num(inp.value);
  if (isNaN(v) || v <= 0) { item.dv = 0; other.value = ''; }
  else if (inp.dataset.k === 'p') {
    item.dt = 'p'; item.dv = Math.min(100, v);
    if (v > 100) inp.value = '100';
    other.value = qbDisc(item);
  } else {
    item.dt = 't'; item.dv = Math.min(lineTotal, v);
    if (v > lineTotal) inp.value = String(lineTotal);
    other.value = Math.round(item.dv / lineTotal * 10000) / 100;
  }
  box.querySelector('.who small').textContent = rowSmall(item);
  box.querySelector('.amt').innerHTML = rowAmt(item);
  qbSum();
});

$('qb-items').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('.dedit input')) {
    const item = QB_ITEMS.find(x => x.c === e.target.closest('.qi').dataset.c);
    item.o = false;
    qbRender();
  }
});

$('qb-code').addEventListener('input', e => {
  const v = en(e.target.value).trim();
  const p = PRODUCTS.find(x => x.barcode === v);
  if (v && p) { qbAdd(v); e.target.value = ''; }
});

$('qb-code').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.value) { qbAdd(e.target.value); e.target.value = ''; }
});

$('qb-paid').addEventListener('input', qbPaid);
$('s-dp').addEventListener('input', e => {
  QD = { m: 'p', v: num(e.target.value) };
  qbSum('dp');
});
$('s-dt').addEventListener('input', e => {
  const itemDisc = QB_ITEMS.reduce((a, i) => a + qbDisc(i), 0);
  QD = { m: 't', v: Math.max(0, num(e.target.value) - itemDisc) };
  $('s-dp').value = '';
  qbSum('dt');
});

/* ক্যামেরা স্ক্যান */
async function camOn() {
  if (!('BarcodeDetector' in window)) { toast('এই ব্রাউজারে ক্যামেরা স্ক্যান চলে না — বারকোড লিখুন'); return; }
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = $('cam-v');
    v.srcObject = camStream;
    await v.play();
    $('cam').classList.add('on');
    const d = new BarcodeDetector();
    scanTimer = setInterval(async () => {
      try {
        const r = await d.detect(v);
        if (r[0]) qbAdd(r[0].rawValue, true);
      } catch {}
    }, 400);
  } catch (e) {
    toast('ক্যামেরার অনুমতি দিন (HTTPS লাগে)');
  }
}

function camOff() {
  clearInterval(scanTimer);
  if (camStream) camStream.getTracks().forEach(t => t.stop());
  camStream = null;
  $('cam').classList.remove('on');
}

$('qb-cam').onclick = () => $('cam').classList.contains('on') ? camOff() : camOn();

function qbOpen() {
  $('qb').classList.add('on');
  qbRender();
  setTimeout(() => $('qb-code').focus(), 50);
}

function qbClose(reset) {
  camOff();
  $('qb').classList.remove('on');
  if (reset) {
    QB_ITEMS = [];
    QD = { m: 'p', v: 0 };
    ['qb-name', 'qb-mob', 'qb-paid', 'qb-code', 's-dp', 's-dt'].forEach(i => $(i).value = '');
    qbRender();
  }
}

$('qb-open').onclick = qbOpen;
$('billing-start').onclick = qbOpen;
$('qb-close').onclick = () => qbClose(false);
$('qb-cancel').onclick = () => qbClose(true);

$('qb-done').onclick = async () => {
  const c = qbCalc();
  const t = c.sub;
  if (!t) { toast('আগে পণ্য যোগ করুন'); return; }
  const paid = num($('qb-paid').value);
  const paidFinal = isNaN(paid) || paid === 0 ? t : paid;
  const name = $('qb-name').value.trim();
  const mob = en($('qb-mob').value).trim();
  const method = $('qb-method').value;

  if (paidFinal < t && (!name || !mob)) {
    toast('বাকি হলে কাস্টমারের নাম ও মোবাইল দিন');
    return;
  }

  const btn = $('qb-done');
  btn.textContent = 'সম্পন্ন হচ্ছে...';
  btn.disabled = true;

  try {
    const items = QB_ITEMS.map(i => ({
      product_id: i.pid,
      product_name: i.n,
      qty: i.qty,
      unit_price: i.unit_price,
      discount: qbDisc(i),
    }));

    const r = await API.post('/sales', {
      items,
      customer: { name: name || null, phone: mob || null },
      bill_discount: c.billDisc,
      paid: paidFinal,
      payment_method: method,
      status: 'completed',
      cashier_name: currentUser?.name,
    });

    const sale = r.data;
    qbClose(true);
    showChange({
      no: sale.invoice_no,
      t: sale.total,
      paid: sale.paid,
      ret: sale.change_given,
      due: sale.due,
      who: name || 'ওয়াক-ইন কাস্টমার',
      saleId: sale.id,
      items: sale.items,
    });
    await loadDashboard();
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
    btn.textContent = '✅ বিল সম্পন্ন করুন';
    btn.disabled = false;
  }
};

/* হোল্ড বিল */
$('qb-hold').onclick = async () => {
  if (QB_ITEMS.length === 0) { toast('আগে পণ্য যোগ করুন'); return; }
  const c = qbCalc();
  try {
    const items = QB_ITEMS.map(i => ({
      product_id: i.pid,
      product_name: i.n,
      qty: i.qty,
      unit_price: i.unit_price,
      discount: qbDisc(i),
    }));
    const r = await API.post('/sales', {
      items,
      customer: { name: $('qb-name').value.trim() || null, phone: en($('qb-mob').value).trim() || null },
      bill_discount: c.billDisc,
      paid: 0,
      payment_method: 'cash',
      status: 'held',
      cashier_name: currentUser?.name,
    });
    toast('⏸️ বিল হোল্ড করা হয়েছে — ' + r.data.invoice_no);
    qbClose(true);
    await loadHeldBills();
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
  }
};

/* হোল্ড করা বিল লোড */
async function loadHeldBills() {
  try {
    const r = await API.get('/sales?status=held');
    const list = r.data || [];
    $('held-bills-list').innerHTML = list.length ? list.map(s => `
      <div class="row">
        <div class="av" style="background:#f59e0b;color:#000">⏸️</div>
        <div class="who">
          <b>${s.invoice_no}</b>
          <small>${s.customer_name || 'ওয়াক-ইন'} · ${bn(s.total)} · ${tm(s.created_at)}</small>
        </div>
        <button class="btn" style="width:auto;margin:0;padding:8px 14px;font-size:14px" data-resume="${s.id}">▶️ চালু</button>
      </div>
    `).join('') : '<p class="hint" style="margin:0">কোনো হোল্ড বিল নেই</p>';
  } catch {}
}

$('held-bills-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-resume]');
  if (!b) return;
  const id = b.dataset.resume;
  try {
    const r = await API.get('/sales/' + id);
    const sale = r.data;
    // Load items into QB
    QB_ITEMS = sale.items.map(it => ({
      c: it.barcode || 'manual-' + it.id,
      pid: it.product_id,
      n: it.product_name,
      p: Number(it.unit_price),
      qty: it.qty,
      dt: 't', dv: Number(it.discount) || 0,
      o: false,
    }));
    $('qb-name').value = sale.customer_name || '';
    $('qb-mob').value = sale.customer_phone || '';
    qbRender();
    qbOpen();
    toast('হোল্ড বিল লোড হয়েছে — সম্পন্ন করুন');
    // Note: the held bill will remain until we cancel it via API after completion
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
  }
});

/* ============================================================
   বিল সম্পন্ন পপ-আপ + রিসিট প্রিন্ট
   ============================================================ */
let lastSaleData = null;

function showChange(o) {
  lastSaleData = o;
  $('chg-inv').textContent = 'ইনভয়েস #' + o.no + ' · ' + o.who;
  $('chg-t').textContent = bn(o.t);
  $('chg-p').textContent = bn(o.paid);
  const r = $('chg-r');
  r.className = 'res ' + (o.due > 0 ? 'bad' : 'ok');
  r.innerHTML = o.due > 0 ? `বাকি থাকবে <b>${bn(o.due)}</b>` : o.ret > 0 ? `ফেরত দিতে হবে <b>${bn(o.ret)}</b>` : 'ঠিক টাকা — ফেরত নেই';
  $('chg').classList.add('on');
}

$('chg-ok').onclick = () => {
  $('chg').classList.remove('on');
  show('home');
  ['kpi-today', 'kpi-bills', 'kpi-due'].forEach(id => {
    const e = $(id).parentElement;
    e.classList.remove('pop');
    void e.offsetWidth;
    e.classList.add('pop');
  });
};

$('chg-print').onclick = () => {
  if (!lastSaleData) return;
  printReceipt(lastSaleData);
};

function printReceipt(sale) {
  const shop = SETTINGS.shop_name || 'POS Pro';
  const addr = SETTINGS.shop_address || '';
  const phone = SETTINGS.shop_phone || '';
  const header = SETTINGS.receipt_header || '';
  const footer = SETTINGS.receipt_footer || '';
  const prefix = SETTINGS.invoice_prefix || 'INV-';
  const now = new Date();

  const itemsHtml = (sale.items || []).map(it => `
    <div class="r-line">
      <span>${it.product_name} × ${it.qty}</span>
      <span>${bn(it.total)}</span>
    </div>
  `).join('');

  $('receipt-print').innerHTML = `
    <div class="receipt on">
      <h3>${shop}</h3>
      ${addr ? `<div class="r-shop">${addr}</div>` : ''}
      ${phone ? `<div class="r-shop">📞 ${phone}</div>` : ''}
      ${header ? `<div class="r-shop" style="margin-top:6px">${header}</div>` : ''}
      <div class="r-divider"></div>
      <div class="r-line"><span>ইনভয়েস</span><span>${sale.no}</span></div>
      <div class="r-line"><span>তারিখ</span><span>${dstr(now)}</span></div>
      <div class="r-line"><span>সময়</span><span>${tm(now)}</span></div>
      <div class="r-line"><span>কাস্টমার</span><span>${sale.who}</span></div>
      <div class="r-line"><span>ক্যাশিয়ার</span><span>${currentUser?.name || ''}</span></div>
      <div class="r-divider"></div>
      ${itemsHtml}
      <div class="r-divider"></div>
      <div class="r-line"><span>মোট</span><span>${bn(sale.t)}</span></div>
      <div class="r-line"><span>পরিশোধ</span><span>${bn(sale.paid)}</span></div>
      ${sale.due > 0 ? `<div class="r-line r-total"><span>বাকি</span><span>${bn(sale.due)}</span></div>` : ''}
      ${sale.ret > 0 ? `<div class="r-line r-total"><span>ফেরত</span><span>${bn(sale.ret)}</span></div>` : ''}
      ${SETTINGS.bkash_number ? `<div class="r-shop" style="margin-top:8px">bKash: ${SETTINGS.bkash_number}</div>` : ''}
      ${SETTINGS.nagad_number ? `<div class="r-shop">Nagad: ${SETTINGS.nagad_number}</div>` : ''}
      <div class="r-center">${footer}</div>
      <div class="r-center" style="margin-top:4px">— POS Pro —</div>
    </div>
  `;
  setTimeout(() => window.print(), 100);
}

/* ============================================================
   সেলস হিস্ট্রি
   ============================================================ */
async function loadHistory() {
  const from = $('hist-from').value || dateKey(Date.now() - 7 * 86400000);
  const to = $('hist-to').value || dateKey(Date.now() + 86400000);
  $('hist-from').value = from;
  $('hist-to').value = to;
  await searchHistory();
}

async function searchHistory() {
  const from = $('hist-from').value;
  const to = $('hist-to').value;
  const q = $('hist-q').value.trim();
  const list = $('hist-list');
  list.innerHTML = '<p class="hint">খোঁজা হচ্ছে...</p>';
  try {
    let url = `/sales?from=${from}&to=${to}&status=completed`;
    const r = await API.get(url);
    let sales = r.data || [];
    if (q) {
      const ql = q.toLowerCase();
      sales = sales.filter(s =>
        (s.customer_name || '').toLowerCase().includes(ql) ||
        (s.customer_phone || '').includes(q) ||
        (s.invoice_no || '').toLowerCase().includes(ql)
      );
    }
    list.innerHTML = sales.length ? sales.map(s => `
      <div class="row">
        <div class="av" style="background:#1d3a48;color:inherit">🧾</div>
        <div class="who">
          <b>${s.invoice_no}</b>
          <small>${s.customer_name || 'ওয়াক-ইন'} · ${tm(s.created_at)} · ${s.cashier_name || ''}</small>
        </div>
        <span class="amt">${bn(s.total)}</span>
        <div class="acts">
          <button data-reprint="${s.id}" aria-label="রিসিট প্রিন্ট">🖨️</button>
          <button data-view="${s.id}" aria-label="বিস্তারিত">👁️</button>
        </div>
      </div>
    `).join('') : '<p class="hint" style="margin:0">কোনো বিল পাওয়া যায়নি</p>';
  } catch (err) {
    list.innerHTML = '<p class="hint" style="margin:0;color:#fca5a5">ত্রুটি: ' + err.message + '</p>';
  }
}

$('hist-search').onclick = searchHistory;
$('hist-q').addEventListener('keydown', e => { if (e.key === 'Enter') searchHistory(); });

$('hist-list').addEventListener('click', async e => {
  const vp = e.target.closest('[data-view]');
  const rp = e.target.closest('[data-reprint]');
  if (vp || rp) {
    const id = (vp || rp).dataset.view || (rp || vp).dataset.reprint;
    try {
      const r = await API.get('/sales/' + id);
      const sale = r.data;
      const o = {
        no: sale.invoice_no,
        t: Number(sale.total),
        paid: Number(sale.paid),
        ret: Number(sale.change_given),
        due: Number(sale.due),
        who: sale.customer_name || 'ওয়াক-ইন',
        items: sale.items,
      };
      if (rp) {
        printReceipt(o);
      } else {
        // Show details in a toast-like view
        const detail = `${sale.invoice_no}\n${sale.customer_name || 'ওয়াক-ইন'}\nমোট: ${bn(sale.total)}\nপরিশোধ: ${bn(sale.paid)}\n${sale.due > 0 ? 'বাকি: ' + bn(sale.due) : 'ফেরত: ' + bn(sale.change_given)}`;
        alert(detail);
      }
    } catch (err) {
      toast('ত্রুটি: ' + err.message);
    }
  }
});

/* ============================================================
   খাতা (বাকি)
   ============================================================ */
let openDueIdx = -1;

async function loadKhata() {
  try {
    const r = await API.get('/dues');
    const d = r.data;
    const dues = d.customers || [];
    $('khp').textContent = 'মোট বাকি ' + bn(d.totalDue) + ' · ' + N(d.count) + ' জন';

    $('duel').innerHTML = dues.length ? dues.map((c, i) => {
      const okPhone = c.phone && /^01\d{9}$/.test(c.phone);
      const msg = encodeURIComponent(c.name + ', ' + (SETTINGS.shop_name || 'আমাদের দোকান') + ' থেকে জানাচ্ছি — আপনার ' + bn(c.due) + ' বাকি আছে। সুবিধামতো পরিশোধ করবেন। ধন্যবাদ।');
      return `
        <div class="dl" data-i="${i}" data-id="${c.id}">
          <div class="dtop">
            <div class="av">${c.name[0]}</div>
            <div class="who">
              <b>${c.name}</b>
              <small>📱 ${c.phone ? bnd(c.phone) : 'নেই'}</small>
              <small>শেষ আপডেট: ${tm(c.updated_at)}</small>
            </div>
            <span class="amt" style="color:#fca5a5">${bn(c.due)}</span>
          </div>
          ${okPhone ? `
          <div class="dacts">
            <a class="ab" href="sms:${c.phone}?&body=${msg}">💬 মেসেজ</a>
            <a class="ab wa" href="https://wa.me/88${c.phone}?text=${msg}" target="_blank" rel="noopener">🟢 হোয়াটসঅ্যাপ</a>
            <a class="ab" href="tel:${c.phone}">📞 কল</a>
          </div>` : `<div class="dacts"><span class="ab" style="opacity:.5">মোবাইল নম্বর নেই</span></div>`}
          ${i === openDueIdx ? `<div class="dedit">
            <label class="dd"><span>আদায় ৳</span><input inputmode="decimal" value="${c.due}"></label>
            <button class="no" data-act="all">সবটা</button>
            <button class="ok" data-act="ok">আদায় করুন</button>
          </div>` : ''}
        </div>
      `;
    }).join('') : '<p class="hint" style="margin:0">কারো বাকি নেই ✓</p>';

    // Recent transactions
    const txR = await API.get('/dues').catch(() => null);
    // For simplicity, show a placeholder for transactions
    $('recent').innerHTML = '<p class="hint" style="margin:0">সাম্প্রতিক লেনদেন দেখতে কাস্টমার মডিউলে যান</p>';
  } catch (err) {
    toast('খাতা লোড ব্যর্থ: ' + err.message);
  }
}

$('duel').addEventListener('click', async e => {
  const box = e.target.closest('.dl');
  if (!box) return;
  const i = +box.dataset.i;
  const id = +box.dataset.id;

  if (e.target.closest('[data-act="all"]')) {
    const inp = box.querySelector('input');
    const dueText = box.querySelector('.amt').textContent;
    inp.value = en(dueText.replace(/[^\d০-৯]/g, ''));
    return;
  }
  if (e.target.closest('[data-act="ok"]')) {
    const v = num(box.querySelector('input').value);
    if (!(v > 0)) { toast('আদায়ের টাকা লিখুন'); return; }
    try {
      await API.post('/dues', { customer_id: id, amount: v });
      toast('✓ আদায় সফল');
      openDueIdx = -1;
      await loadKhata();
      await loadDashboard();
    } catch (err) {
      toast('ত্রুটি: ' + err.message);
    }
    return;
  }
  if (e.target.closest('.dedit') || e.target.closest('.ab')) return;
  openDueIdx = openDueIdx === i ? -1 : i;
  await loadKhata();
});

/* ============================================================
   কাস্টমার
   ============================================================ */
async function loadCustomers() {
  const q = $('cust-q').value.trim();
  try {
    const r = await API.get('/customers' + (q ? '?q=' + encodeURIComponent(q) : ''));
    const list = r.data || [];
    $('cust-count').textContent = 'মোট ' + N(list.length) + ' জন';
    $('cust-list').innerHTML = list.length ? list.map(c => `
      <div class="row">
        <div class="av">${c.name[0]}</div>
        <div class="who">
          <b>${c.name}</b>
          <small>📱 ${c.phone ? bnd(c.phone) : 'নেই'} · মোট কেনা ${bn(c.total_purchase)}</small>
        </div>
        ${Number(c.due) > 0 ? `<span class="pill due">বাকি ${bn(c.due)}</span>` : '<span class="pill paid">পরিষ্কার</span>'}
      </div>
    `).join('') : '<p class="hint" style="margin:0">কোনো কাস্টমার নেই</p>';
  } catch (err) {
    toast('কাস্টমার লোড ব্যর্থ: ' + err.message);
  }
}

$('cust-q').addEventListener('input', () => { clearTimeout(window._custT); window._custT = setTimeout(loadCustomers, 300); });

$('cust-add-btn').onclick = async () => {
  const name = prompt('কাস্টমারের নাম:');
  if (!name) return;
  const phone = prompt('মোবাইল নম্বর (ঐচ্ছিক):') || '';
  const address = prompt('ঠিকানা (ঐচ্ছিক):') || '';
  try {
    await API.post('/customers', { name, phone: phone.trim(), address });
    toast('✓ কাস্টমার যোগ হয়েছে');
    await loadCustomers();
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
  }
};

/* ============================================================
   সাপ্লায়ার
   ============================================================ */
async function loadSuppliers() {
  try {
    const r = await API.get('/suppliers');
    const d = r.data;
    const list = d.suppliers || [];
    $('sup-summary').textContent = 'মোট দেনা ' + bn(d.totalDue);
    $('sup-list').innerHTML = list.length ? list.map(s => `
      <div class="row">
        <div class="av" style="background:#1d3a48;color:inherit">🏭</div>
        <div class="who">
          <b>${s.name}</b>
          <small>${s.categories || ''} · 📱 ${s.phone ? bnd(s.phone) : 'নেই'}</small>
        </div>
        <span class="amt">${bn(s.balance)}</span>
      </div>
    `).join('') : '<p class="hint" style="margin:0">কোনো সাপ্লায়ার নেই</p>';
  } catch (err) {
    toast('সাপ্লায়ার লোড ব্যর্থ: ' + err.message);
  }
}

$('sup-add-btn').onclick = async () => {
  const name = prompt('সাপ্লায়ারের নাম:');
  if (!name) return;
  const phone = prompt('মোবাইল নম্বর:') || '';
  const categories = prompt('যা সরবরাহ করে (যেমন: শার্ট, প্যান্ট):') || '';
  const balance = prompt('বর্তমান দেনা ৳:') || '0';
  try {
    await API.post('/suppliers', { name, phone, categories, balance: num(balance) });
    toast('✓ সাপ্লায়ার যোগ হয়েছে');
    await loadSuppliers();
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
  }
};

/* ============================================================
   খরচ
   ============================================================ */
async function loadExpenses() {
  try {
    const r = await API.get('/expenses');
    const d = r.data;
    const list = d.expenses || [];
    $('exp-summary').textContent = 'মোট খরচ ' + bn(d.total);
    $('exp-list').innerHTML = list.length ? list.map(e => `
      <div class="row">
        <div class="av" style="background:#1d3a48;color:inherit">💸</div>
        <div class="who">
          <b>${e.description || e.category}</b>
          <small>${e.category} · ${dstr(e.expense_date)}</small>
        </div>
        <span class="amt">${bn(e.amount)}</span>
      </div>
    `).join('') : '<p class="hint" style="margin:0">কোনো খরচ নেই</p>';
  } catch (err) {
    toast('খরচ লোড ব্যর্থ: ' + err.message);
  }
}

$('exp-add-btn').onclick = async () => {
  const cat = prompt('ক্যাটাগরি (ভাড়া/বিল/বেতন/নাস্তা/অন্যান্য):', 'অন্যান্য');
  if (!cat) return;
  const desc = prompt('বিবরণ:') || '';
  const amt = prompt('টাকার পরিমাণ ৳:');
  if (!amt) return;
  try {
    await API.post('/expenses', { category: cat, description: desc, amount: num(amt) });
    toast('✓ খরচ যোগ হয়েছে');
    await loadExpenses();
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
  }
};

/* ============================================================
   রিটার্ন
   ============================================================ */
async function loadReturns() {
  try {
    const r = await API.get('/returns');
    const list = r.data || [];
    $('ret-list').innerHTML = list.length ? list.map(r => `
      <div class="row">
        <div class="av" style="background:#1d3a48;color:inherit">↩️</div>
        <div class="who">
          <b>${r.product_name} × ${r.qty}</b>
          <small>${r.invoice_no || '—'} · ${r.reason || ''} · ${tm(r.created_at)}</small>
        </div>
        <span class="amt">${bn(r.amount)}</span>
        <span class="pill low">ফেরত</span>
      </div>
    `).join('') : '<p class="hint" style="margin:0">কোনো রিটার্ন নেই</p>';
  } catch (err) {
    toast('রিটার্ন লোড ব্যর্থ: ' + err.message);
  }
}

$('ret-add-btn').onclick = async () => {
  const invoice = prompt('ইনভয়েস নম্বর (ঐচ্ছিক):') || '';
  const prodName = prompt('পণ্যের নাম:');
  if (!prodName) return;
  const qty = prompt('পরিমাণ:', '1') || '1';
  const amt = prompt('ফেরতের টাকা ৳:');
  if (!amt) return;
  const reason = prompt('কারণ:') || '';
  try {
    await API.post('/returns', {
      sale_id: null,
      product_id: null,
      product_name: prodName,
      qty: parseInt(qty),
      amount: num(amt),
      reason,
    });
    toast('✓ রিটার্ন প্রসেস হয়েছে');
    await loadReturns();
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
  }
};

/* ============================================================
   ইউজার ম্যানেজমেন্ট
   ============================================================ */
async function loadUsers() {
  if (currentUser?.role !== 'admin') {
    $('usr-list').innerHTML = '<p class="hint">শুধু অ্যাডমিন দেখতে পারবে</p>';
    return;
  }
  try {
    const r = await API.get('/users');
    const list = r.data || [];
    $('usr-list').innerHTML = list.length ? list.map(u => `
      <div class="row">
        <div class="av" style="background:#1d3a48;color:inherit">${u.role === 'admin' ? '👑' : u.role === 'manager' ? '👔' : '👤'}</div>
        <div class="who">
          <b>${u.name}</b>
          <small>@${u.username} · ${u.role} · ${u.active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</small>
        </div>
        ${u.id != currentUser.id ? `<button class="btn alt" style="width:auto;margin:0;padding:8px 12px;font-size:13px" data-del-user="${u.id}">🗑️</button>` : '<span class="pill paid">আপনি</span>'}
      </div>
    `).join('') : '<p class="hint">কোনো ইউজার নেই</p>';
  } catch (err) {
    toast('ইউজার লোড ব্যর্থ: ' + err.message);
  }
}

$('usr-add-btn').onclick = async () => {
  if (currentUser?.role !== 'admin') { toast('শুধু অ্যাডমিন ইউজার যোগ করতে পারে'); return; }
  const name = prompt('পুরো নাম:');
  if (!name) return;
  const username = prompt('ইউজারনেম:');
  if (!username) return;
  const password = prompt('পাসওয়ার্ড (কমপক্ষে ৪ অক্ষর):');
  if (!password || password.length < 4) { toast('পাসওয়ার্ড ছোট'); return; }
  const role = prompt('রোল (admin/manager/cashier):', 'cashier');
  if (!['admin', 'manager', 'cashier'].includes(role)) { toast('ভুল রোল'); return; }
  try {
    await API.post('/users', { name, username, password, role });
    toast('✓ ইউজার যোগ হয়েছে');
    await loadUsers();
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
  }
};

$('usr-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-del-user]');
  if (!b) return;
  const id = b.dataset.delUser;
  if (!confirm('ইউজার মুছে ফেলবেন?')) return;
  try {
    await API.del('/users/' + id);
    toast('ইউজার মুছে ফেলা হয়েছে');
    await loadUsers();
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
  }
});

/* ============================================================
   শিফট
   ============================================================ */
async function loadShifts() {
  try {
    const cur = await API.get('/shifts?current=1');
    const curShift = cur.data;
    if (curShift) {
      $('shift-current').innerHTML = `
        <h2>🟢 চলমান শিফট</h2>
        <div class="ln"><span>ক্যাশিয়ার</span><span>${curShift.user_name}</span></div>
        <div class="ln"><span>ওপেনিং ক্যাশ</span><span>${bn(curShift.opening_cash)}</span></div>
        <div class="ln"><span>শুরুর সময়</span><span>${tm(curShift.opened_at)}</span></div>
        <button class="btn alt" id="shift-close-btn">🔒 শিফট বন্ধ করুন</button>
      `;
      $('shift-close-btn').onclick = closeShift;
    } else {
      $('shift-current').innerHTML = `
        <h2>🔴 কোনো শিফট খোলা নেই</h2>
        <p class="hint" style="text-align:left;margin:0 0 12px">নতুন শিফট খুলতে ওপেনিং ক্যাশ দিন।</p>
        <label class="field">ওপেনিং ক্যাশ ৳</label>
        <input class="search" id="shift-open-cash" inputmode="decimal" value="0" placeholder="০">
        <button class="btn" id="shift-open-btn">🔓 শিফট খুলুন</button>
      `;
      $('shift-open-btn').onclick = openShift;
    }

    const all = await API.get('/shifts');
    const list = all.data || [];
    $('shift-list').innerHTML = list.length ? list.map(s => `
      <div class="row">
        <div class="av" style="background:#1d3a48;color:inherit">${s.status === 'open' ? '🟢' : '🔴'}</div>
        <div class="who">
          <b>${s.user_name}</b>
          <small>${dstr(s.opened_at)} · ওপেনিং ${bn(s.opening_cash)}${s.status === 'closed' ? ' · ক্লোজিং ' + bn(s.closing_cash) : ''}</small>
        </div>
        <span class="pill ${s.status === 'open' ? 'paid' : 'low'}">${s.status === 'open' ? 'চলমান' : 'বন্ধ'}</span>
      </div>
    `).join('') : '<p class="hint" style="margin:0">কোনো শিফট নেই</p>';
  } catch (err) {
    toast('শিফট লোড ব্যর্থ: ' + err.message);
  }
}

async function openShift() {
  const cash = num($('shift-open-cash').value);
  try {
    await API.post('/shifts', { action: 'open', opening_cash: cash });
    toast('✓ শিফট খোলা হয়েছে');
    await loadShifts();
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
  }
}

async function closeShift() {
  if (!confirm('শিফট বন্ধ করবেন?')) return;
  try {
    await API.post('/shifts', { action: 'close' });
    toast('✓ শিফট বন্ধ হয়েছে');
    await loadShifts();
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
  }
}

/* ============================================================
   রিপোর্ট
   ============================================================ */
async function loadReports() {
  const today = dateKey(Date.now());
  const weekAgo = dateKey(Date.now() - 7 * 86400000);
  $('rep-from').value = weekAgo;
  $('rep-to').value = today;
}

$('rep-gen').onclick = async () => {
  const from = $('rep-from').value;
  const to = $('rep-to').value;
  const out = $('rep-out');
  out.innerHTML = '<p class="hint">রিপোর্ট তৈরি হচ্ছে...</p>';
  try {
    const salesR = await API.get(`/reports?type=sales&from=${from}&to=${to}`);
    const profitR = await API.get(`/reports?type=profit&from=${from}&to=${to}`);
    const s = salesR.data;
    const p = profitR.data;

    const dailyRows = (s.daily || []).map(d => `
      <div class="ln"><span>${dstr(d.day)}</span><span>${N(d.bills)}টি · ${bn(d.sales)}</span></div>
    `).join('');

    out.innerHTML = `
      <h2>📊 বিক্রি সারাংশ</h2>
      <div class="ln"><span>মোট বিক্রি</span><span>${bn(s.summary.sales)}</span></div>
      <div class="ln"><span>মোট বিল</span><span>${N(s.summary.bills)}টি</span></div>
      <div class="ln"><span>বাকি বিক্রি</span><span>${bn(s.summary.due)}</span></div>
      ${dailyRows}
      <div style="margin-top:14px"></div>
      <h2>💰 লাভ-ক্ষতি</h2>
      <div class="ln"><span>মোট বিক্রি</span><span>${bn(p.revenue)}</span></div>
      <div class="ln"><span>পণ্যের ক্রয়মূল্য</span><span style="color:#fca5a5">− ${bn(p.cogs)}</span></div>
      <div class="ln"><span>সর্বমোট খরচ</span><span style="color:#fca5a5">− ${bn(p.expenses)}</span></div>
      <div class="ln t"><span>নিট লাভ</span><span style="color:${p.netProfit >= 0 ? 'var(--teal)' : '#fca5a5'}">${bn(p.netProfit)}</span></div>
    `;
  } catch (err) {
    out.innerHTML = '<p class="hint" style="color:#fca5a5">ত্রুটি: ' + err.message + '</p>';
  }
};

/* ============================================================
   সেটিংস ড্রয়ার
   ============================================================ */
const drawer = $('drawer');
function setOpen(o) {
  document.body.classList.toggle('set-open', o);
  drawer.setAttribute('aria-hidden', !o);
}
$('openSet').onclick = () => setOpen(true);
$('closeSet').onclick = () => setOpen(false);
$('scrim').onclick = () => setOpen(false);

document.querySelectorAll('#set-printer-size button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#set-printer-size button').forEach(x => x.classList.toggle('on', x === b));
  };
});

$('settings-save').onclick = async () => {
  const data = {
    shop_name: $('set-shop-name').value.trim(),
    shop_address: $('set-shop-address').value.trim(),
    shop_phone: $('set-shop-phone').value.trim(),
    shop_phone2: $('set-shop-phone2').value.trim(),
    receipt_header: $('set-receipt-header').value.trim(),
    receipt_footer: $('set-receipt-footer').value.trim(),
    vat_percent: $('set-vat').value,
    invoice_prefix: $('set-invoice-prefix').value,
    bkash_number: $('set-bkash').value.trim(),
    nagad_number: $('set-nagad').value.trim(),
    low_stock_default: $('set-low-stock').value,
    printer_size: document.querySelector('#set-printer-size button.on')?.dataset.val || '80',
  };
  try {
    const r = await API.put('/settings', data);
    SETTINGS = r.data;
    applySettings();
    toast('✓ সেটিংস সেভ হয়েছে');
    setOpen(false);
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
  }
};

/* ============================================================
   ডেমো ডাটা সীড
   ============================================================ */
$('load-seed-btn').onclick = async () => {
  if (!confirm('ডেমো ডাটা লোড করবেন? এতে ১২টি পণ্য, ৭ জন কাস্টমার, ৩ জন সাপ্লায়ার, কিছু খরচ ও বিক্রি যোগ হবে।')) return;
  const btn = $('load-seed-btn');
  btn.textContent = 'লোড হচ্ছে...';
  btn.disabled = true;
  try {
    const r = await API.post('/seed', {});
    toast(`✓ ডেমো ডাটা লোড হয়েছে — ${r.data.products}টি পণ্য, ${r.data.customers} জন কাস্টমার, ${r.data.sales}টি বিক্রি`);
    await loadProducts();
    await loadDashboard();
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
  }
  btn.textContent = '🎲 ডেমো ডাটা লোড করুন';
  btn.disabled = false;
};

/* ============================================================
   পাসওয়ার্ড বদল
   ============================================================ */
$('pw-save').onclick = async () => {
  const p = $('pw-new').value;
  if (p.length < 4) { toast('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে'); return; }
  try {
    // Find own user ID from currentUser
    const id = currentUser?.id;
    if (!id) { toast('ইউজার আইডি পাওয়া যায়নি'); return; }
    await API.put('/users/' + id, { password: p });
    $('pw-new').value = '';
    toast('✓ পাসওয়ার্ড বদলানো হয়েছে');
  } catch (err) {
    toast('ত্রুটি: ' + err.message);
  }
};

/* ============================================================
   লগআউট
   ============================================================ */
$('logout-btn').onclick = async () => {
  if (!confirm('লগআউট করবেন?')) return;
  try {
    await API.post('/auth/logout', {});
  } catch {}
  currentUser = null;
  $('login-screen').style.display = 'flex';
  $('app-main').style.display = 'none';
  $('login-username').value = '';
  $('login-password').value = '';
  $('login-btn').textContent = 'লগইন করুন';
  $('login-btn').disabled = false;
};

/* ============================================================
   ফাইল মডিউল (পারমিশন toggle — UI only, roles are fixed server-side)
   ============================================================ */
function renderFiles() {
  const html = BASE_MODULES.map(m => {
    const isProtected = m[0] === 'users' && currentUser?.role !== 'admin';
    return `
      <div class="row">
        <div class="av" style="background:#1d3a48;color:inherit">${m[1]}</div>
        <div class="who"><b>${m[2]}</b></div>
        <button class="sw ${isProtected ? '' : 'on'}" data-mod="${m[0]}" ${isProtected ? 'disabled' : ''} aria-label="${m[2]}"></button>
      </div>
    `;
  }).join('');
  const fl = $('fl');
  if (fl) fl.innerHTML = html;
}

/* ============================================================
   কীবোর্ড শর্টকাট
   ============================================================ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    qbClose(false);
    $('pm').classList.remove('on');
    $('chg').classList.remove('on');
    setOpen(false);
  }
});

/* ============================================================
   শুরু
   ============================================================ */
initLogin();
