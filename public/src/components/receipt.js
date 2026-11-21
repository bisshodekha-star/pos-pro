/**
 * receipt.js — Receipt printing & WhatsApp sending
 */
import { getState } from '../store.js';
import { bn, dstr, tm } from '../utils/format.js';

export function printReceipt(sale) {
  const s = getState().settings;
  const shop = s.shop_name || 'POS Pro';
  const addr = s.shop_address || '';
  const phone = s.shop_phone || '';
  const phone2 = s.shop_phone2 || '';
  const header = s.receipt_header || '';
  const footer = s.receipt_footer || '3 দিনের মধ্যে রিটার্ন গ্রহণযোগ্য (বিলসহ)';
  const receiptWidth = getReceiptWidth(s);
  applyPrintPageStyle(`@page{size:${receiptWidth}mm auto;margin:0}
@media print{.receipt{width:${receiptWidth}mm!important;max-width:${receiptWidth}mm!important}}`);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const itemsHtml = (sale.items || []).map(it => {
    const qty = parseInt(it.qty) || 1;
    const unitPrice = parseFloat(it.unit_price) || 0;
    const discount = parseFloat(it.discount) || 0;
    const total = parseFloat(it.total) || (unitPrice * qty - discount);
    const hasDisc = discount > 0;
    return `<div class="r-item">
      <div class="r-item-name">${it.product_name}</div>
      <div class="r-item-detail">${qty} পিস × ${bn(unitPrice)}</div>
      ${hasDisc ? `<div class="r-item-disc">ছাড়: -${bn(discount)}</div>` : ''}
      <div class="r-item-total">${bn(total)}</div>
    </div>`;
  }).join('');

  const subtotal = (sale.items || []).reduce((a, it) => a + (parseFloat(it.unit_price) || 0) * (parseInt(it.qty) || 1), 0);
  const totalDiscount = (sale.items || []).reduce((a, it) => a + (parseFloat(it.discount) || 0), 0);
  const netAmount = parseFloat(sale.t) || 0;
  const allDiscount = totalDiscount + (parseFloat(sale.bd) || 0);
  const vatAmt = parseFloat(sale.vat) || 0;
  const vatPct = parseFloat(sale.vatPct) || 0;
  const methodLabels = { cash: 'নগদ', bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', bank: 'ব্যাংক', card: 'কার্ড' };
  const methodLabel = methodLabels[sale.method] || 'নগদ';

  let el = document.getElementById('receipt-print');
  if (!el) { el = document.createElement('div'); el.id = 'receipt-print'; document.body.appendChild(el); }

  el.innerHTML = `<div class="receipt on">
    <div class="r-header">
      ${s.shop_logo ? `<img src="${s.shop_logo}" class="r-logo">` : ''}
      <div class="r-shop-name">${shop}</div>
      ${addr ? `<div class="r-shop-addr">${addr}</div>` : ''}
      ${phone ? `<div class="r-shop-phone">📞 ${phone}${phone2 ? ' / ' + phone2 : ''}</div>` : ''}
    </div>
    ${header ? `<div class="r-tagline">${header}</div>` : ''}
    <div class="r-divider"></div>
    <div class="r-line"><span>ইনভয়েস নং:</span><span class="r-bold">${sale.no}</span></div>
    <div class="r-line"><span>তারিখ:</span><span>${dateStr}</span></div>
    <div class="r-line"><span>কাস্টমার:</span><span>${sale.who || ''}</span></div>
    <div class="r-divider"></div>
    <div class="r-items-header"><span>পণ্যের বিবরণ</span><span>মোট</span></div>
    ${itemsHtml}
    <div class="r-divider"></div>
    <div class="r-line"><span>সাবটোটাল</span><span>${bn(subtotal)}</span></div>
    ${allDiscount > 0 ? `<div class="r-line r-discount"><span>ছাড়</span><span>-${bn(allDiscount)}</span></div>` : ''}
    ${vatAmt > 0 ? `<div class="r-line"><span>VAT${vatPct ? ' (' + vatPct + '%)' : ''} (মূল্যের ভেতরে)</span><span>${bn(vatAmt)}</span></div>` : ''}
    <div class="r-line r-net"><span>নেট মোট</span><span class="r-bold">${bn(netAmount)}</span></div>
    <div class="r-divider"></div>
    <div class="r-line"><span>${methodLabel}</span><span>${bn(sale.paid)}</span></div>
    ${sale.ret > 0 ? `<div class="r-line r-change"><span>ফেরত</span><span>${bn(sale.ret)}</span></div>` : ''}
    ${sale.due > 0 ? `<div class="r-line r-due"><span>বাকি</span><span>${bn(sale.due)}</span></div>` : ''}
    <div class="r-divider"></div>
    <div class="r-center r-footer">${footer}</div>
    <div class="r-center r-footer">আপনার সন্তুষ্টিই আমাদের লক্ষ্য</div>
    ${s.bkash_number ? `<div class="r-center" style="margin-top:4px;font-size:9pt">bKash: ${s.bkash_number}</div>` : ''}
    ${s.nagad_number ? `<div class="r-center" style="font-size:9pt">Nagad: ${s.nagad_number}</div>` : ''}
    <div class="r-center r-powered">Powered by POS Pro</div>
  </div>`;
  setTimeout(() => window.print(), 100);
}


function getReceiptWidth(settings = {}) {
  const mode = String(settings.receipt_width || settings.printer_size || '80');
  const custom = Number(settings.receipt_custom_width);
  return mode === 'custom' ? Math.min(120, Math.max(40, custom || 80)) : (mode === '58' ? 58 : 80);
}

function applyPrintPageStyle(css) {
  let style = document.getElementById('pos-print-dynamic-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'pos-print-dynamic-style';
    document.head.appendChild(style);
  }
  style.textContent = css;
}

export function printTestReceipt() {
  const s = getState().settings || {};
  const width = getReceiptWidth(s);
  applyPrintPageStyle(`@page{size:${width}mm auto;margin:0}
    @media print{.receipt{width:${width}mm!important;max-width:${width}mm!important}}`);
  const el = document.getElementById('receipt-print') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'receipt-print' }));
  el.innerHTML = `<div class="receipt on"><div class="r-header"><div class="r-shop-name">${s.shop_name || 'POS Pro'}</div><div class="r-shop-addr">প্রিন্টার টেস্ট</div></div><div class="r-divider"></div><div class="r-line"><span>কাগজের প্রস্থ</span><b>${width} mm</b></div><div class="r-line"><span>প্রিন্ট টেস্ট</span><b>সফল হলে ঠিক আছে</b></div><div class="r-divider"></div><div class="r-center">POS Pro Printer Test</div></div>`;
  setTimeout(() => window.print(), 150);
}


export function printTestLabel() {
  const s = getState().settings || {};
  const width = Math.min(100, Math.max(20, Number(s.label_width_mm) || 50));
  const height = Math.min(100, Math.max(10, Number(s.label_height_mm) || 25));
  const area = document.getElementById('print-area') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'print-area' }));
  let style = document.getElementById('pos-label-print-style');
  if (!style) { style = document.createElement('style'); style.id = 'pos-label-print-style'; document.head.appendChild(style); }
  style.textContent = `@page{size:${width}mm ${height}mm;margin:0}@media print{#print-area .lbl{width:${width}mm!important;height:${height}mm!important;break-after:page;page-break-after:always}#print-area .lbl:last-child{break-after:auto;page-break-after:auto}}#print-area .lbl{width:${width}mm;height:${height}mm}#print-area .lbl svg{width:${Math.max(12,width-6)}mm;height:${Math.max(5,Math.min(height*.42,height-12))}mm}`;
  area.innerHTML = `<div class="lbl"><small>${s.shop_name || 'POS Pro'}</small><b>টেস্ট পণ্য (M)</b><svg id="pos-test-barcode"></svg><span>৳ 1,250</span></div>`;
  if (typeof JsBarcode === 'function') JsBarcode('#pos-test-barcode', '8901234567890', { format:'CODE128', width:1.4, height:Math.max(12,height*.42), displayValue:true, fontSize:11, margin:0, background:'#fff' });
  setTimeout(() => window.print(), 150);
}

export function sendWhatsApp(sale) {
  const s = getState().settings;
  const shop = s.shop_name || 'POS Pro';
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const itemsText = (sale.items || []).map(it => `• ${it.product_name} × ${parseInt(it.qty)||1} = ${bn(parseFloat(it.total)||0)}`).join('\n');
  const methodLabels = { cash: 'নগদ', bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', bank: 'ব্যাংক', card: 'কার্ড' };
  const methodLabel = methodLabels[sale.method] || 'নগদ';

  let msg = `*${shop}*\n`;
  if (s.shop_address) msg += `${s.shop_address}\n`;
  if (s.shop_phone) msg += `📞 ${s.shop_phone}\n`;
  msg += `\n*ইনভয়েস:* ${sale.no}\n*তারিখ:* ${dateStr}\n*কাস্টমার:* ${sale.who || ''}\n`;
  msg += `\n*পণ্য:*\n${itemsText}\n`;
  const allDisc = (sale.items || []).reduce((a, it) => a + (parseFloat(it.discount) || 0), 0) + (parseFloat(sale.bd) || 0);
  if (allDisc > 0) msg += `\n*ছাড়:* -${bn(allDisc)}`;
  if (parseFloat(sale.vat) > 0) msg += `\n*VAT${sale.vatPct ? ' (' + sale.vatPct + '%)' : ''}:* ${bn(sale.vat)}`;
  msg += `\n*মোট:* ${bn(sale.t)}\n*${methodLabel}:* ${bn(sale.paid)}\n`;
  if (sale.ret > 0) msg += `*ফেরত:* ${bn(sale.ret)}\n`;
  if (sale.due > 0) msg += `*বাকি:* ${bn(sale.due)}\n`;
  msg += `\n${s.receipt_footer || '3 দিনের মধ্যে রিটার্ন গ্রহণযোগ্য'}\n`;
  msg += `\n_Powered by POS Pro_`;

  const phone = sale.phone || '';
  const url = phone
    ? `https://api.whatsapp.com/send?phone=88${phone}&text=${encodeURIComponent(msg)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}
