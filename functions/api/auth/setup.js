/**
 * GET /api/auth/check-setup
 * Returns needsSetup: false (single password system, no setup needed)
 */
import { success } from '../../_shared/response.js';

export async function onRequestGet() {
  return success({ needsSetup: false });
}
