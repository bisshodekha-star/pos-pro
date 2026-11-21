/**
 * ui.js — Shared UI helpers (API wrappers, modal, confirm)
 */
import { API } from '../api.js';
import { toast } from '../components/toast.js';
import { handle401 } from './auth.js';

/** GET with auto error toast + 401 handling */
export async function apiGet(path) {
  try {
    const res = await API.get(path);
    return res.data;
  } catch (e) {
    if (handle401(e)) throw e;
    toast(e.message || 'সমস্যা হয়েছে');
    throw e;
  }
}

/** POST with auto success toast + error handling */
export async function apiPost(path, body = {}) {
  try {
    const res = await API.post(path, body);
    if (res.message) toast(res.message);
    return res.data;
  } catch (e) {
    if (handle401(e)) throw e;
    toast(e.message || 'সমস্যা হয়েছে');
    throw e;
  }
}

/** PUT with auto success toast + error handling */
export async function apiPut(path, body = {}) {
  try {
    const res = await API.put(path, body);
    if (res.message) toast(res.message);
    return res.data;
  } catch (e) {
    if (handle401(e)) throw e;
    toast(e.message || 'সমস্যা হয়েছে');
    throw e;
  }
}

/** DELETE with auto success toast + error handling */
export async function apiDel(path) {
  try {
    const res = await API.del(path);
    if (res.message) toast(res.message);
    return res.data;
  } catch (e) {
    if (handle401(e)) throw e;
    toast(e.message || 'সমস্যা হয়েছে');
    throw e;
  }
}

/** Fire-and-forget POST (shows toast but never throws) */
export async function apiSend(path, body = {}) {
  try {
    return await apiPost(path, body);
  } catch {
    return null;
  }
}

/**
 * Open a modal overlay.
 * @param {string} innerHtml
 * @param {object} opts { size, closeOnOverlay }
 * @returns {HTMLElement} overlay element
 */
export function modal(innerHtml, opts = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 animate-fade-in';
  const sizeClass = opts.size || 'sm:max-w-lg';
  overlay.innerHTML =
    '<div class="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full ' + sizeClass +
    ' max-h-[92vh] overflow-y-auto animate-slide-up safe-bottom">' + innerHtml + '</div>';
  document.body.appendChild(overlay);
  if (opts.closeOnOverlay !== false) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
  return overlay;
}

/** Close a modal overlay */
export function closeModal(overlay) {
  if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
}

/**
 * Confirmation dialog (promise-based)
 * @param {string} msg
 * @param {object} opts { title, danger, yesText }
 * @returns {Promise<boolean>}
 */
export function confirmDialog(msg, opts = {}) {
  return new Promise((resolve) => {
    const overlay = modal(
      '<div class="p-6">' +
        '<h3 class="text-lg font-semibold mb-2 text-slate-100">' + (opts.title || 'নিশ্চিত করুন') + '</h3>' +
        '<p class="text-slate-400 mb-6 text-sm">' + msg + '</p>' +
        '<div class="flex gap-3">' +
          '<button id="qb-no" class="flex-1 px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 font-medium">না</button>' +
          '<button id="qb-yes" class="flex-1 px-4 py-2.5 rounded-lg ' + (opts.danger ? 'bg-red-500 hover:bg-red-600' : 'bg-teal-500 hover:bg-teal-600') + ' text-white font-medium">' + (opts.yesText || 'হ্যাঁ') + '</button>' +
        '</div>' +
      '</div>',
      { size: 'sm:max-w-sm' }
    );
    overlay.querySelector('#qb-yes').onclick = () => { closeModal(overlay); resolve(true); };
    overlay.querySelector('#qb-no').onclick = () => { closeModal(overlay); resolve(false); };
  });
}

/** Render a full-page loading spinner HTML */
export function loadingView(msg = 'লোড হচ্ছে...') {
  return (
    '<div class="flex flex-col items-center justify-center py-20 text-slate-400">' +
      '<div class="w-10 h-10 border-3 border-slate-700 border-t-teal-500 rounded-full animate-spin mb-3"></div>' +
      '<p class="text-sm">' + msg + '</p>' +
    '</div>'
  );
}

/** Empty state HTML */
export function emptyView(msg, icon = '📭') {
  return (
    '<div class="flex flex-col items-center justify-center py-16 text-slate-500">' +
      '<div class="text-4xl mb-3 opacity-60">' + icon + '</div>' +
      '<p class="text-sm">' + msg + '</p>' +
    '</div>'
  );
}

/** Format money with currency */
export { bn } from './format.js';
