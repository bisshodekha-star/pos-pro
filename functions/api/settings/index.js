/**
 * GET  /api/settings  — get all settings (as key-value object)
 * PUT  /api/settings  — update settings (admin/manager)
 *   Body: { key1: value1, key2: value2, ... }
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestGet(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const sql = getSql(context.env);
  const rows = await sql`SELECT key, value FROM settings`;
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return success(obj);
}

export async function onRequestPut(context) {
  const { response } = await requireAuth(context, ['admin', 'manager']);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || typeof body !== 'object') return error('ডাটা দিন', 400);

  const sql = getSql(context.env);
  // Update each key
  for (const [key, value] of Object.entries(body)) {
    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES (${key}, ${String(value)}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
  }

  // Return updated settings
  const rows = await sql`SELECT key, value FROM settings`;
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return success(obj, 'সেটিংস সেভ হয়েছে');
}
