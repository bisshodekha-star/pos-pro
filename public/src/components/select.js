/**
 * select.js — Turns every native <select> into a clean custom dropdown.
 * The original <select> stays in the page (hidden), so all existing code that
 * reads select.value or listens to "change" keeps working unchanged.
 */
let openMenu = null;

function closeMenu() {
  if (!openMenu) return;
  openMenu.menu.remove();
  openMenu.btn.classList.remove('csel-open');
  openMenu.btn.setAttribute('aria-expanded', 'false');
  openMenu = null;
}

function labelOf(sel) {
  const o = sel.options[sel.selectedIndex];
  return o ? o.textContent : '';
}

function refresh(sel) {
  const btn = sel._cselBtn;
  if (!btn) return;
  const lbl = btn.querySelector('.csel-label');
  const t = labelOf(sel);
  if (lbl.textContent !== t) lbl.textContent = t;
  if (btn.disabled !== sel.disabled) btn.disabled = sel.disabled;
}

function pick(sel, index) {
  if (sel.selectedIndex !== index) {
    sel.selectedIndex = index;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
  refresh(sel);
  closeMenu();
  sel._cselBtn.focus();
}

function open(sel) {
  const btn = sel._cselBtn;
  if (openMenu && openMenu.btn === btn) { closeMenu(); return; }
  closeMenu();

  const menu = document.createElement('div');
  menu.className = 'csel-menu';
  menu.setAttribute('role', 'listbox');
  Array.from(sel.options).forEach((o, i) => {
    const item = document.createElement('div');
    item.className = 'csel-item' + (i === sel.selectedIndex ? ' on' : '') + (o.disabled ? ' dis' : '');
    item.setAttribute('role', 'option');
    item.innerHTML = '<span></span><i>✓</i>';
    item.firstChild.textContent = o.textContent;
    if (!o.disabled) item.addEventListener('click', () => pick(sel, i));
    menu.appendChild(item);
  });
  document.body.appendChild(menu);

  const r = btn.getBoundingClientRect();
  const width = Math.max(r.width, 170);
  const vh = window.innerHeight;
  const menuH = Math.min(menu.scrollHeight, 280);
  const below = vh - r.bottom - 12;
  const above = r.top - 12;
  const up = below < menuH && above > below;
  menu.style.width = width + 'px';
  menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) + 'px';
  menu.style.maxHeight = Math.max(140, Math.min(280, up ? above : below)) + 'px';
  if (up) menu.style.bottom = (vh - r.top + 6) + 'px';
  else menu.style.top = (r.bottom + 6) + 'px';

  btn.classList.add('csel-open');
  btn.setAttribute('aria-expanded', 'true');
  openMenu = { menu, btn, sel };
  const on = menu.querySelector('.on');
  if (on) on.scrollIntoView({ block: 'nearest' });
}

function enhance(sel) {
  if (sel._cselBtn || sel.multiple || sel.dataset.native !== undefined) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  // keep the same size/margin/colour classes the select had
  btn.className = (sel.className + ' csel-btn').trim();
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span class="csel-label"></span><svg class="csel-arrow" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l5 5 5-5"/></svg>';
  sel.parentNode.insertBefore(btn, sel);
  sel.classList.add('csel-native');
  sel.tabIndex = -1;
  sel._cselBtn = btn;
  refresh(sel);

  btn.addEventListener('click', () => open(sel));
  btn.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!openMenu) { open(sel); return; }
      const d = e.key === 'ArrowDown' ? 1 : -1;
      let i = sel.selectedIndex + d;
      while (i >= 0 && i < sel.options.length && sel.options[i].disabled) i += d;
      if (i >= 0 && i < sel.options.length) {
        sel.selectedIndex = i;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        refresh(sel);
        openMenu.menu.querySelectorAll('.csel-item').forEach((el, k) => el.classList.toggle('on', k === i));
        openMenu.menu.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Escape' || e.key === 'Enter') {
      if (openMenu) { e.preventDefault(); closeMenu(); }
    }
  });
  sel.addEventListener('change', () => refresh(sel));
}

function scan(root) {
  if (root.nodeType !== 1) return;
  if (root.tagName === 'SELECT') enhance(root);
  root.querySelectorAll && root.querySelectorAll('select').forEach(enhance);
}

export function initSelects() {
  scan(document.body);
  new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(scan));
    // keep labels in sync if code changed a select's value
    document.querySelectorAll('select.csel-native').forEach(refresh);
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('mousedown', e => {
    if (openMenu && !openMenu.menu.contains(e.target) && !openMenu.btn.contains(e.target)) closeMenu();
  });
  window.addEventListener('resize', closeMenu);
  window.addEventListener('scroll', e => {
    if (openMenu && !openMenu.menu.contains(e.target)) closeMenu();
  }, true);
}
