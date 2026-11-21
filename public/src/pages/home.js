/** home.js — Dashboard */
import { API } from '../api.js';
import { getState } from '../store.js';
import { COLORS } from '../config.js';
import { bn, N, bnd } from '../utils/format.js';

export async function render() {
  try {
    const r = await API.get('/reports?type=dashboard');
    const d = r.data;

    // Donut chart (product-wise)
    const prods = d.productBreakdown || [];
    const top8 = prods.slice(0, 8);
    const restRev = prods.slice(8).reduce((a, p) => a + Number(p.revenue), 0);
    if (restRev > 0) top8.push({ name: 'অন্যান্য', revenue: restRev });
    const total = top8.reduce((a, c) => a + Number(c.revenue), 0);
    let donutBg = '#1e293b';
    let legendHtml = '<p class="text-slate-400 text-center m-0">এখনো কোনো বিক্রি নেই</p>';
    if (total > 0) {
      let cum = 0;
      donutBg = 'conic-gradient(' + top8.map((c, i) => {
        const start = cum / total * 360;
        cum += Number(c.revenue);
        const end = cum / total * 360;
        return `${COLORS[i % COLORS.length]} ${start}deg ${end}deg`;
      }).join(',') + ')';
      legendHtml = top8.map((c, i) => {
        const pct = Math.round(Number(c.revenue) / total * 100);
        return `<div class="flex items-center gap-2 py-1 text-sm">
          <i class="w-3 h-3 rounded-sm flex-none" style="background:${COLORS[i % COLORS.length]}"></i>
          <span>${c.name}</span>
          <span class="ml-auto text-slate-400">${pct}% · ${bn(c.revenue)}</span>
        </div>`;
      }).join('');
    }

    // Low stock
    const lo = d.lowStock || [];
    const lowHtml = lo.length ? lo.map(p => `
      <div class="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
        <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl">${p.emoji || '👕'}</div>
        <div class="flex-1"><b class="block text-base">${p.name}</b><small class="text-slate-400">সীমা: ${N(p.low_stock)} পিস</small></div>
        <span class="pill pill-${p.stock <= 10 ? 'due' : 'low'}">${N(p.stock)} বাকি</span>
      </div>
    `).join('') : '<p class="text-slate-400 text-center py-4">কোনো পণ্যের স্টক কম নেই ✓</p>';

    // Top products
    const top = d.topProducts || [];
    const topHtml = top.length ? top.map(p => `
      <div class="mb-3">
        <div class="flex justify-between text-sm py-0">
          <span>${p.product_name}</span><span>${N(p.qty)}টি · ${bn(p.revenue)}</span>
        </div>
        <div class="stock-bar mt-1"><i class="bg-teal-500" style="width:${Math.min(100, p.qty)}%"></i></div>
      </div>
    `).join('') : '<p class="text-slate-400 text-center py-4">এখনো কোনো বিক্রি নেই</p>';

    return `
      <div class="grid grid-cols-2 home-stats gap-3 mb-4">
        <div class="bg-gradient-to-br from-teal-700 to-teal-600 rounded-2xl p-5 text-white">
          <b class="text-2xl block">${bn(d.todaySales)}</b><span class="text-lg">আজকের বিক্রি</span>
        </div>
        <div class="bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl p-5 text-white">
          <b class="text-2xl block">${N(d.todayBills)}টি</b><span class="text-lg">আজকের বিল</span>
        </div>
        <div class="bg-gradient-to-br from-amber-600 to-orange-500 rounded-2xl p-5 text-white">
          <b class="text-2xl block">${bn(d.totalDue)}</b><span class="text-lg">মোট বাকি (${N(d.dueCount)} জন)</span>
        </div>
        <div class="bg-gradient-to-br from-violet-600 to-purple-500 rounded-2xl p-5 text-white">
          <b class="text-2xl block">${bn(d.totalSales)}</b><span class="text-lg">মোট বিক্রি</span>
        </div>
      </div>

      <div class="home-cards">
      <div class="bg-slate-900 rounded-2xl p-5 mb-4 hc-donut">
        <h2 class="text-lg font-semibold mb-4">👗 পোশাক অনুযায়ী বিক্রি</h2>
        <div class="flex items-center justify-center gap-6 flex-wrap">
          <div class="donut w-48 h-48 rounded-full relative flex-none" style="background:${donutBg}">
            <div class="absolute inset-7 rounded-full bg-slate-900 flex flex-col items-center justify-center">
              <b class="text-xl">${bn(total)}</b><small class="text-slate-400 text-xs">মোট বিক্রি</small>
            </div>
          </div>
          <div class="flex-1 min-w-[190px]">${legendHtml}</div>
        </div>
      </div>

      <div class="bg-slate-900 rounded-2xl p-5 mb-4">
        <h2 class="text-lg font-semibold mb-3">⚠️ কম স্টক সতর্কতা</h2>
        ${lowHtml}
      </div>

      <div class="bg-slate-900 rounded-2xl p-5 mb-4">
        <h2 class="text-lg font-semibold mb-3">🏆 সেরা বিক্রিত পণ্য</h2>
        ${topHtml}
      </div>
      </div>

    `;
  } catch (err) {
    return `<div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">ড্যাশবোর্ড লোড ব্যর্থ: ${err.message}</div>`;
  }
}

export function init() {}
