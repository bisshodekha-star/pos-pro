/**
 * toast.js — Toast notification system
 */
let toastEl = null;
let toastTimer = null;

function ensureToast() {
  if (toastEl) return toastEl;
  toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.id = 'toast';
  document.body.appendChild(toastEl);
  return toastEl;
}

export function toast(msg) {
  const el = ensureToast();
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2400);
}
