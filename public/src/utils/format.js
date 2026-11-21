/**
 * format.js — Bengali numeral, currency, date formatting utilities
 *
 * bn()       : currency with Bengali numerals → "৳১,২৫০"
 * N()        : plain number with Bengali numerals → "১,২৫০"
 * en()       : Bengali digits → English digits (used when parsing input)
 * toBnDigits : English digits → Bengali digits
 */

import { WEEKDAYS, MONTHS } from '../config.js';

/** English digit → Bengali digit lookup */
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Convert English digits in a string to Bengali digits */
export function toBnDigits(s) {
  return String(s).replace(/[0-9]/g, d => BN_DIGITS[+d]);
}

/** Convert Bengali digits in a string back to English digits */
export function en(x) {
  if (x === null || x === undefined) return '';
  return String(x).replace(/[০-৯]/g, d => String(BN_DIGITS.indexOf(d)));
}

/** Currency string with Bengali numerals: 1250 → "৳১,২৫০" */
export function bn(n) {
  const num = Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return '৳' + toBnDigits(num);
}

/** Plain number with Bengali numerals: 1250 → "১,২৫০" */
export function N(x) {
  return toBnDigits(Number(x).toLocaleString('en-US'));
}

/**
 * @deprecated Use en() instead. Kept for backwards compatibility —
 * older code imported `bnd` and used it as a Bengali→English digit
 * converter (despite the misleading name). It now does exactly that.
 */
export function bnd(x) {
  return en(x);
}

/** Parse a value to number (handles Bengali numerals, strings) */
export function num(x) {
  if (x === null || x === undefined || x === '') return 0;
  const s = en(String(x)).replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Date key: YYYY-MM-DD (local time) — kept in English digits for SQL */
export function dateKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/** Full date string: বুধবার, ১৮ নভেম্বর ২০২৬ */
export function dstr(ts) {
  const d = new Date(ts);
  return WEEKDAYS[d.getDay()] + ', ' + toBnDigits(d.getDate()) + ' ' +
         MONTHS[d.getMonth()] + ' ' + toBnDigits(d.getFullYear());
}

/** Time string: দুপুর ১:৫৭ */
export function tm(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const h = d.getHours();
  const period = h < 6 ? 'ভোর' : h < 12 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 18 ? 'বিকাল' : h < 20 ? 'সন্ধ্যা' : 'রাত';
  return period + ' ' + toBnDigits(h % 12 || 12) + ':' + toBnDigits(String(d.getMinutes()).padStart(2, '0'));
}

/** Stock status tone */
export function stockTone(s) {
  return s <= 10 ? 'due' : s <= 20 ? 'low' : 'paid';
}

/** Escape HTML */
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}
