/** stock.js — Stock view with low stock alerts
 *
 * Sort + tone use each product's own low_stock threshold (not a hardcoded
 * 10/20 cutoff). A product with stock ≤ low_stock is shown red/amber.
 */
import { API } from '../api.js';
import { getState } from '../store.js';
import { N, toBnDigits } from '../utils/format.js';

/** Tone based on the product's own low_stock threshold */
function toneFor(p) {
  const low = Number(p.low_stock) || 20;
  if (Number(p.stock) <= 0) return 'due';
  if (Number(p.stock) <= low * 0.5) return 'due';
  if (Number(p.stock) <= low) return 'low';
  return 'paid';
}

function barColor(p) {
  const t = toneFor(p);
  return t === 'due' ? 'bg-red-500' : t === 'low' ? 'bg-amber-500' : 'bg-teal-500';
}

function barWidth(p) {
  const low = Number(p.low_stock) || 20;
  const stock = Number(p.stock) || 0;
  // Bar fills relative to 2× low_stock threshold (so a fully-stocked product
  // shows ~100% and one at low_stock shows ~50%).
  return Math.min(100, Math.max(2, (stock / Math.max(low * 2, 10)) * 100));
}

export async function render() {
  let products = getState().products;
  if (!products.length) {
    try { const r = await API.get('/products'); products = r.data || []; getState().products = products; }
    catch (err) { return `<div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">স্টক লোড ব্যর্থ: ${err.message}</div>`; }
  }
  // Sort by how close to (or below) the low_stock threshold a product is.
  // Most critical (lowest stock relative to its threshold) first.
  const sorted = [...products].sort((a, b) => {
    const ra = (Number(a.stock) || 0) - (Number(a.low_stock) || 20);
    const rb = (Number(b.stock) || 0) - (Number(b.low_stock) || 20);
    return ra - rb;
  });
  const html = sorted.length ? sorted.map(p => `
    <div class="py-3 border-b border-slate-800 last:border-0">
      <div class="flex justify-between items-center mb-1">
        <b class="text-base">${p.name}${p.size ? ' (' + p.size + ')' : ''}</b>
        <span class="pill pill-${toneFor(p)}">${N(p.stock)} পিস</span>
      </div>
      <div class="text-[11px] text-slate-500 mb-1">সীমা: ${N(p.low_stock || 20)} পিস</div>
      <div class="stock-bar"><i class="${barColor(p)}" style="width:${barWidth(p)}%"></i></div>
    </div>
  `).join('') : '<p class="text-slate-400 text-center py-4 m-0">কোনো পণ্য নেই</p>';
  return `
    <h1 class="text-3xl font-bold text-center mb-1">📊 স্টক</h1>
    <p class="text-slate-400 text-center mb-6">কম স্টকের পণ্য আগে দেখাচ্ছে</p>
    <div class="bg-slate-900 rounded-2xl p-5 list-grid">${html}</div>
  `;
}
export function init() {}
