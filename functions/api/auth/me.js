/**
 * GET /api/auth/me
 * Returns auth status
 */
import { requireAuth } from '../../_shared/auth.js';
import { success } from '../../_shared/response.js';

export async function onRequestGet(context) {
  const { user, response } = await requireAuth(context);
  if (response) return response;
  return success({ authenticated: true, role: user.role || 'admin' });
}
