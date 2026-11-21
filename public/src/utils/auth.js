/**
 * auth.js — Frontend auth helpers (logout + 401 handler)
 */
import { API } from '../api.js';
import { setState } from '../store.js';

/** Logout: clear server session, reset state, reload to login */
export async function logout() {
  try {
    await API.post('/auth/logout', {});
  } catch {}
  setState({ user: null, settings: {}, products: [], productsUnlocked: false, resetUnlocked: false });
  // Force a full reload to clear any in-memory state
  location.hash = '';
  location.reload();
}

/** If error is a 401, logout and return true */
export function handle401(e) {
  if (e && e.status === 401) {
    logout();
    return true;
  }
  return false;
}
