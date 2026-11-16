/**
 * POST /api/auth/logout
 * Clears the auth cookie
 */
import { withClearedAuthCookie } from '../../_shared/auth.js';
import { success } from '../../_shared/response.js';

export async function onRequestPost() {
  const res = success(null, 'লগআউট হয়েছে');
  return withClearedAuthCookie(res);
}
