/** products.js — Product CRUD + Excel bulk upload + barcode print */
import { API } from '../api.js';
import { getState } from '../store.js';
import { CATEGORIES, EMOJIS } from '../config.js';
import { bn, N, num, esc } from '../utils/format.js';
import { toast } from '../components/toast.js';

let activeTab = null;

export async function render() {
  const s = getState();
  if (!s.products.length) {
    try {
      const r = await API.get('/products');
      getState().products = r.data || [];
    } catch (err) {
      return `<div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">পণ্য লোড ব্যর্থ: ${err.message}</div>`;
    }
  }
  const products = s.products;
  return `
    <h1 class="text-3xl font-bold text-center mb-1">📦 পণ্য</h1>
    <p class="text-slate-400 text-center mb-6">মোট ${N(products.length)}টি পণ্য</p>
    <div class="grid grid-cols-3 gap-2.5 mb-4">
      <button class="bg-slate-800 border border-slate-700 rounded-2xl p-3.5 flex flex-col items-center gap-1.5 font-semibold text-center ${activeTab==='add'?'border-teal-500 bg-slate-800 text-teal-400':''}" data-tab="add"><span class="text-2xl">➕</span>পণ্য যোগ</button>
      <button class="bg-slate-800 border border-slate-700 rounded-2xl p-3.5 flex flex-col items-center gap-1.5 font-semibold text-center ${activeTab==='list'?'border-teal-500 bg-slate-800 text-teal-400':''}" data-tab="list"><span class="text-2xl">📋</span>সব পণ্য</button>
      <button class="bg-slate-800 border border-slate-700 rounded-2xl p-3.5 flex flex-col items-center gap-1.5 font-semibold text-center ${activeTab==='excel'?'border-teal-500 bg-slate-800 text-teal-400':''}" data-tab="excel"><span class="text-2xl">📤</span>Excel</button>
    </div>
    <div id="tab-content">${renderTab()}</div>
  `;
}

function renderTab() {
  const products = getState().products;
  if (activeTab === 'add') {
    return `<div class="bg-slate-900 rounded-2xl p-5">
      <h2 class="text-lg font-semibold mb-4">➕ নতুন পণ্য যোগ</h2>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3" id="np-n" placeholder="পণ্যের নাম">
      <div class="grid grid-cols-2 gap-2 mb-3"><input class="bg-slate-800 border border-slate-700 rounded-xl p-3" id="np-b" inputmode="decimal" placeholder="কেনা দাম ৳"><input class="bg-slate-800 border border-slate-700 rounded-xl p-3" id="np-p" inputmode="decimal" placeholder="বিক্রি দাম ৳"></div>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3" id="np-s" inputmode="numeric" placeholder="স্টকের পরিমাণ (পিস)">
      <div class="flex gap-2 mb-3"><input class="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-3" id="np-c" placeholder="বারকোড"><button class="w-13 h-12 rounded-xl bg-teal-500 text-slate-900 font-bold px-3" id="np-gen">🎲</button></div>
      <div class="grid grid-cols-2 gap-2 mb-4"><select class="bg-slate-800 border border-slate-700 rounded-xl p-3" id="np-cat">${CATEGORIES.map(k=>`<option>${k}</option>`).join('')}</select><input class="bg-slate-800 border border-slate-700 rounded-xl p-3" id="np-z" placeholder="সাইজ (M, L, XL…)"></div>
      <button class="w-full bg-teal-500 text-slate-900 font-bold text-lg rounded-xl p-3.5" id="np-add">+ পণ্য যোগ করুন</button>
    </div>`;
  }
  if (activeTab === 'list') {
    return `<div class="bg-slate-900 rounded-2xl p-5">
      <h2 class="text-lg font-semibold mb-4">📋 সব পণ্য (${N(products.length)}টি)</h2>
      ${products.length ? products.map(p => `
        <div class="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
          <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl">${p.emoji||'👕'}</div>
          <div class="flex-1"><b class="block text-base">${esc(p.name)}${p.size?' ('+esc(p.size)+')':''}</b><small class="text-slate-400">${p.category} · কেনা ${bn(p.cost_price)} · বিক্রি ${bn(p.sell_price)} · স্টক ${N(p.stock)}<br>বারকোড ${p.barcode}</small></div>
          <div class="flex gap-2">
            <button class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700" data-pr="${p.id}" title="বারকোড প্রিন্ট">🏷️</button>
            <button class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700" data-edit="${p.id}" title="এডিট">✏️</button>
            <button class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700" data-del="${p.id}" title="মুছুন">🗑️</button>
          </div>
        </div>
      `).join('') : '<p class="text-slate-400 text-center py-4 m-0">কোনো পণ্য নেই</p>'}
      <button class="w-full bg-slate-800 border border-slate-700 text-slate-100 font-bold rounded-xl p-3.5 mt-4" id="np-printall">🏷️ সব পণ্যের বারকোড প্রিন্ট</button>
    </div>`;
  }
  if (activeTab === 'excel') {
    return `<div class="bg-slate-900 rounded-2xl p-5">
      <h2 class="text-lg font-semibold mb-2">📤 Excel দিয়ে পণ্য যোগ</h2>
      <p class="text-slate-400 text-sm mb-4">একসাথে অনেক পণ্য যোগ করতে Excel (.xlsx) ফাইল আপলোড করুন।</p>
      <input type="file" id="excel-file" accept=".xlsx,.xls,.csv" class="hidden">
      <button class="w-full bg-blue-600 text-white font-bold rounded-xl p-3.5 mb-2" id="excel-upload">📤 Excel ফাইল আপলোড</button>
      <button class="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl p-3 text-sm" id="excel-template">📥 টেমপ্লেট ডাউনলোড</button>
      <div id="excel-preview" class="mt-3"></div>
    </div>`;
  }
  return '';
}

export function init() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => { activeTab = btn.dataset.tab; refreshTab(); });
  });
  if (!activeTab) activeTab = 'add';
  bindTabEvents();
}

function refreshTab() {
  const el = document.getElementById('tab-content');
  if (el) { el.innerHTML = renderTab(); bindTabEvents(); }
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.classList.toggle('border-teal-500', btn.dataset.tab === activeTab);
    btn.classList.toggle('text-teal-400', btn.dataset.tab === activeTab);
  });
}

function bindTabEvents() {
  if (activeTab === 'add') bindAdd();
  if (activeTab === 'list') bindList();
  if (activeTab === 'excel') bindExcel();
}

function bindAdd() {
  const gen = document.getElementById('np-gen');
  if (gen) gen.onclick = () => {
    let c; do { c = 'A0' + String(Math.floor(Math.random()*1e4)).padStart(4,'0'); } while (getState().products.find(p=>p.barcode===c));
    document.getElementById('np-c').value = c;
    return c;
  };
  const add = document.getElementById('np-add');
  if (add) add.onclick = async () => {
    const name = document.getElementById('np-n').value.trim();
    const barcode = document.getElementById('np-c').value.trim() || (gen && gen.onclick());
    const cost = num(document.getElementById('np-b').value);
    const sell = num(document.getElementById('np-p').value);
    const stock = parseInt(document.getElementById('np-s').value) || 0;
    const category = document.getElementById('np-cat').value;
    const size = document.getElementById('np-z').value.trim();
    if (!name || sell <= 0) { toast('পণ্যের নাম ও বিক্রি দাম দিন'); return; }
    try {
      const r = await API.post('/products', { barcode, name, category, size, cost_price: cost, sell_price: sell, stock, emoji: EMOJIS[category]||'👕' });
      getState().products.unshift(r.data);
      toast('✓ ' + name + ' যোগ হয়েছে');
      refreshTab();
    } catch (err) { toast('ত্রুটি: ' + err.message); }
  };
}

function bindList() {
  document.querySelectorAll('[data-pr]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = getState().products.find(x => x.id == btn.dataset.pr);
      if (p) openBarcodePrint([p]);
    });
  });
  document.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = getState().products.find(x => x.id == btn.dataset.edit);
      if (p) openEditForm(p);
    });
  });
  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = getState().products.find(x => x.id == btn.dataset.del);
      if (p && confirm('"'+p.name+'" মুছে ফেলবেন?')) {
        try {
          await API.del('/products/' + p.id);
          getState().products = getState().products.filter(x => x.id != p.id);
          toast('পণ্য মুছে ফেলা হয়েছে');
          refreshTab();
        } catch (err) { toast('ত্রুটি: ' + err.message); }
      }
    });
  });
  const pa = document.getElementById('np-printall');
  if (pa) pa.onclick = () => {
    const prods = getState().products;
    if (prods.length) openBarcodePrint(prods);
  };
}

/** Edit-product modal — pre-filled with the product's current values */
function openEditForm(p) {
  let el = document.getElementById('edit-modal');
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'edit-modal';
  el.className = 'fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4';
  el.innerHTML = `
    <div class="bg-slate-900 border border-slate-700 rounded-3xl p-5 w-full max-w-[420px] max-h-[90vh] overflow-y-auto animate-slide-up">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">✏️ পণ্য এডিট</h2>
        <button class="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center" id="edit-close">✕</button>
      </div>
      <label class="block text-slate-400 text-sm mb-1">নাম</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3" id="ep-n" value="${esc(p.name)}">
      <div class="grid grid-cols-2 gap-2 mb-3">
        <div><label class="block text-slate-400 text-sm mb-1">কেনা ৳</label><input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3" id="ep-b" inputmode="decimal" value="${p.cost_price}"></div>
        <div><label class="block text-slate-400 text-sm mb-1">বিক্রি ৳</label><input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3" id="ep-p" inputmode="decimal" value="${p.sell_price}"></div>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-3">
        <div><label class="block text-slate-400 text-sm mb-1">স্টক</label><input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3" id="ep-s" inputmode="numeric" value="${p.stock}"></div>
        <div><label class="block text-slate-400 text-sm mb-1">কম স্টক সীমা</label><input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3" id="ep-l" inputmode="numeric" value="${p.low_stock || 20}"></div>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-3">
        <select class="bg-slate-800 border border-slate-700 rounded-xl p-3" id="ep-cat">${CATEGORIES.map(k=>`<option ${k===p.category?'selected':''}>${k}</option>`).join('')}</select>
        <input class="bg-slate-800 border border-slate-700 rounded-xl p-3" id="ep-z" placeholder="সাইজ" value="${esc(p.size || '')}">
      </div>
      <label class="block text-slate-400 text-sm mb-1">বারকোড</label>
      <input class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 mb-4" id="ep-c" value="${esc(p.barcode)}">
      <button class="w-full bg-teal-500 text-slate-900 font-bold text-lg rounded-xl p-3.5" id="ep-save">💾 সেভ করুন</button>
    </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  document.getElementById('edit-close').onclick = close;
  el.addEventListener('mousedown', e => { if (e.target === el) close(); });
  document.getElementById('ep-save').onclick = async () => {
    const body = {
      name: document.getElementById('ep-n').value.trim(),
      barcode: document.getElementById('ep-c').value.trim(),
      category: document.getElementById('ep-cat').value,
      size: document.getElementById('ep-z').value.trim() || null,
      cost_price: num(document.getElementById('ep-b').value),
      sell_price: num(document.getElementById('ep-p').value),
      stock: parseInt(num(document.getElementById('ep-s').value)),
      low_stock: parseInt(num(document.getElementById('ep-l').value)),
      emoji: EMOJIS[document.getElementById('ep-cat').value] || '👕',
    };
    if (!body.name || body.sell_price <= 0) {
      toast('নাম ও বিক্রি দাম দিন');
      return;
    }
    try {
      const r = await API.put('/products/' + p.id, body);
      // Update local cache
      const idx = getState().products.findIndex(x => x.id == p.id);
      if (idx >= 0) getState().products[idx] = { ...getState().products[idx], ...r.data };
      toast('✓ পণ্য আপডেট হয়েছে');
      close();
      refreshTab();
    } catch (err) { toast('ত্রুটি: ' + err.message); }
  };
}

function bindExcel() {
  const up = document.getElementById('excel-upload');
  const file = document.getElementById('excel-file');
  if (up) up.onclick = () => file.click();
  if (file) file.addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    const prev = document.getElementById('excel-preview');
    prev.innerHTML = '<p class="text-slate-400">ফাইল পড়া হচ্ছে...</p>';
    try {
      const data = await f.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const parseN = v => { if(v===null||v===undefined||v==='') return 0; const s=String(v).replace(/[^\d.-]/g,''); const n=parseFloat(s); return isNaN(n)?0:n; };
      const normalized = rows.map(r => {
        const get = keys => { for(const k of keys) for(const rk of Object.keys(r)) if(rk.toLowerCase().trim()===k.toLowerCase().trim()) return r[rk]; return ''; };
        return {
          name: String(get(['name','নাম'])).trim(),
          barcode: String(get(['barcode','বারকোড'])).trim(),
          category: String(get(['category'])).trim() || 'অন্যান্য',
          cost_price: parseN(get(['cost_price','cost'])),
          sell_price: parseN(get(['sell_price','price'])),
          stock: parseInt(parseN(get(['stock','qty']))),
          unit: String(get(['unit'])).trim() || 'pcs',
          alert_qty: parseInt(parseN(get(['alert_qty','low_stock']))),
          size: String(get(['size'])).trim() || null,
        };
      }).filter(p => p.name && p.barcode);
      if (!normalized.length) { prev.innerHTML = '<p class="text-red-400">কোনো বৈধ পণ্য পাওয়া যায়নি</p>'; return; }
      prev.innerHTML = `<div class="bg-teal-500/10 border border-teal-500/30 rounded-xl p-3 mb-2">
        <div class="flex justify-between text-sm py-1"><span>মোট পণ্য</span><span class="text-teal-400 font-bold">${N(normalized.length)}টি</span></div>
      </div>
      <button class="w-full bg-teal-500 text-slate-900 font-bold rounded-xl p-3" id="excel-confirm">✅ ${N(normalized.length)}টি পণ্য যোগ করুন</button>`;
      document.getElementById('excel-confirm').onclick = async () => {
        try {
          const r = await API.post('/products/bulk', { products: normalized });
          const d = r.data;
          toast(`✓ ${d.inserted}নতুন, ${d.updated}আপডেট, ${d.skipped}বাদ`);
          prev.innerHTML = `<div class="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-green-400">
            নতুন: ${N(d.inserted)}টি · আপডেট: ${N(d.updated)}টি · বাদ: ${N(d.skipped)}টি
          </div>`;
          // Reload products
          const pr = await API.get('/products');
          getState().products = pr.data || [];
        } catch (err) { toast('ত্রুটি: ' + err.message); }
      };
    } catch (err) { prev.innerHTML = '<p class="text-red-400">ফাইল পড়া যায়নি</p>'; }
    file.value = '';
  });
  const tmpl = document.getElementById('excel-template');
  if (tmpl) tmpl.onclick = () => {
    const ws = XLSX.utils.json_to_sheet([
      { name: 'Pant A3', barcode: 'A01101', category: 'Pants', cost_price: 500, sell_price: 1000, stock: 50, unit: 'pcs', alert_qty: 5 },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, 'pos_pro_template.xlsx');
  };
}

function openBarcodePrint(list) {
  if (typeof XLSX === 'undefined' && typeof JsBarcode === 'undefined') { toast('লাইব্রেরি লোড হয়নি'); return; }
  const settings = getState().settings || {};
  const shop = settings.shop_name || 'POS Pro';
  const labelWidth = Math.min(100, Math.max(20, Number(settings.label_width_mm) || 50));
  const labelHeight = Math.min(100, Math.max(10, Number(settings.label_height_mm) || 25));
  const barcodeWidth = Math.max(12, labelWidth - 6);
  const barcodeHeight = Math.max(5, Math.min(labelHeight * 0.42, labelHeight - 12));
  let printStyle = document.getElementById('pos-label-print-style');
  if (!printStyle) { printStyle = document.createElement('style'); printStyle.id = 'pos-label-print-style'; document.head.appendChild(printStyle); }
  printStyle.textContent = `@page{size:${labelWidth}mm ${labelHeight}mm;margin:0}@media print{#print-area .lbl{width:${labelWidth}mm!important;height:${labelHeight}mm!important;break-after:page;page-break-after:always}#print-area .lbl:last-child{break-after:auto;page-break-after:auto}} #print-area .lbl{width:${labelWidth}mm;height:${labelHeight}mm}#print-area .lbl svg{width:${barcodeWidth}mm;height:${barcodeHeight}mm}`;
  const lbl = p => `<div class="lbl"><small>${shop}</small><b>${p.name}${p.size?' ('+p.size+')':''}</b><svg class="bc" data-c="${p.barcode}"></svg><span>${bn(p.sell_price)}</span></div>`;
  let el = document.getElementById('print-area');
  if (!el) { el = document.createElement('div'); el.id = 'print-area'; document.body.appendChild(el); }
  el.innerHTML = list.map(p => lbl(p).repeat(2)).join('');
  el.querySelectorAll('svg.bc').forEach(sv => { try { JsBarcode(sv, sv.dataset.c, { format: 'CODE128', width: 1.6, height: 36, displayValue: true, fontSize: 12, margin: 0, background: '#fff' }); } catch {} });
  setTimeout(() => window.print(), 150);
}
