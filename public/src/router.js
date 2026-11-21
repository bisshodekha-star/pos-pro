/**
 * router.js — Simple hash-based router
 * Routes: #/home, #/billing, #/products, etc.
 *
 * IMPORTANT: On a fresh page load (or hard refresh) we ALWAYS land on
 * "home". Only in-app navigation updates the hash; if the user reloads
 * on #/billing or any deep link, the hash is rewritten to #/home so
 * the dashboard is the first thing they see.
 */
import { setState } from './store.js';

const listeners = new Set();
const HOME = 'home';

/** Get current route from hash (falls back to 'home') */
export function getRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  return hash || HOME;
}

/** Navigate to a route (in-app navigation only — sets the hash) */
export function navigate(route) {
  const target = route || HOME;
  if (location.hash !== '#/' + target) {
    location.hash = '/' + target;
  } else {
    notify(target);
  }
}

/** Notify listeners of route change */
function notify(route) {
  setState({ currentView: route });
  listeners.forEach(fn => fn(route));
}

/** Subscribe to route changes */
export function onRoute(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Initialize router.
 * On first call (page load or refresh): force the route to 'home'
 * regardless of what's in location.hash. After that, hashchange events
 * drive normal in-app navigation.
 */
let initialised = false;
export function initRouter() {
  // Force home on first load / refresh
  if (!initialised) {
    initialised = true;
    // Clear any deep-link hash so we always land on home
    if (location.hash && location.hash !== '#/' + HOME && location.hash !== '#') {
      // Replace the hash silently (without adding a history entry)
      history.replaceState(null, '', '#/' + HOME);
    }
    notify(HOME);
  }

  // Subsequent hash changes → normal routing
  window.addEventListener('hashchange', () => {
    notify(getRoute());
  });
}
