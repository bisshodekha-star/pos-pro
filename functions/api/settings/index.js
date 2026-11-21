/**
 * GET  /api/settings   — get all settings (sensitive keys filtered out)
 * PUT  /api/settings   — update settings (admin/manager)
 *   Body: { key1: value1, key2: value2, ... }
 *
 * POST /api/settings/verify-gate  — verify a gate password (products/reset)
 *   Body: { type: 'products' | 'reset', password }
 *
 * Sensitive keys (products_password, reset_password, *_hash) are stored as
 * PBKDF2 hashes; the GET endpoint NEVER returns them.
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth, hashPassword, verifyPassword } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

// Keys that must never be returned to the client (they're secret)
const SECRET_KEYS = new Set([
  'products_password', 'products_password_hash', 'products_password_salt',
  'reset_password', 'reset_password_hash', 'reset_password_salt',
]);

export async function onRequestGet(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const sql = getSql(context.env);
  const rows = await sql`SELECT key, value FROM settings`;
  const obj = {};
  for (const r of rows) {
    if (SECRET_KEYS.has(r.key)) continue;
    obj[r.key] = r.value;
  }
  // Booleans / existence flags so the frontend knows whether a gate is set
  obj.has_products_password = await hasHashedPassword(sql, 'products');
  obj.has_reset_password = await hasHashedPassword(sql, 'reset');
  return success(obj);
}

export async function onRequestPut(context) {
  const { response } = await requireAuth(context, ['admin', 'manager']);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || typeof body !== 'object') return error('ডাটা দিন', 400);

  const sql = getSql(context.env);

  for (const [key, value] of Object.entries(body)) {
    // Gate passwords are hashed before storing
    if (key === 'products_password' || key === 'reset_password') {
      const pw = String(value || '');
      if (pw.length < 4) {
        return error(`${key} কমপক্ষে ৪ অক্ষরের হতে হবে`, 400);
      }
      const { hash, salt } = await hashPassword(pw);
      const type = key === 'products_password' ? 'products' : 'reset';
      // Remove any old plaintext version, store hash + salt in two keys
      await sql`DELETE FROM settings WHERE key IN (${key}, ${type + '_password_hash'}, ${type + '_password_salt'})`;
      await sql`INSERT INTO settings (key, value) VALUES (${type + '_password_hash'}, ${hash}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
      await sql`INSERT INTO settings (key, value) VALUES (${type + '_password_salt'}, ${salt}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
      continue;
    }
    // Never allow direct writes to *_hash / *_salt keys from the client
    if (SECRET_KEYS.has(key)) continue;
    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES (${key}, ${String(value)}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
  }

  // Return updated settings (filtered)
  const rows = await sql`SELECT key, value FROM settings`;
  const obj = {};
  for (const r of rows) {
    if (SECRET_KEYS.has(r.key)) continue;
    obj[r.key] = r.value;
  }
  obj.has_products_password = await hasHashedPassword(sql, 'products');
  obj.has_reset_password = await hasHashedPassword(sql, 'reset');
  return success(obj, 'সেটিংস সেভ হয়েছে');
}

// ---- Helpers ----

async function hasHashedPassword(sql, type) {
  const rows = await sql`SELECT value FROM settings WHERE key = ${type + '_password_hash'}`;
  return rows.length > 0 && !!rows[0].value;
}

export async function onRequestPost(context) {
  // Sub-action: verify a gate password (called by gate.js instead of
  // doing client-side comparison).
  const { response } = await requireAuth(context);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !body.type || !body.password) {
    return error('type (products|reset) ও password দিন', 400);
  }
  if (!['products', 'reset'].includes(body.type)) {
    return error('type সঠিক নয় (products|reset)', 400);
  }

  const sql = getSql(context.env);
  const hashRows = await sql`SELECT value FROM settings WHERE key = ${body.type + '_password_hash'} LIMIT 1`;
  const saltRows = await sql`SELECT value FROM settings WHERE key = ${body.type + '_password_salt'} LIMIT 1`;

  // Backwards-compat: if no hash is stored, check plaintext (then upgrade)
  if (hashRows.length === 0) {
    const plainRows = await sql`SELECT value FROM settings WHERE key = ${body.type + '_password'} LIMIT 1`;
    if (plainRows.length === 0) {
      return error('পাসওয়ার্ড সেট নেই। সেটিংস থেকে সেট করুন।', 400);
    }
    if (String(body.password) === String(plainRows[0].value)) {
      // Upgrade to hashed
      const { hash, salt } = await hashPassword(String(body.password));
      await sql`DELETE FROM settings WHERE key = ${body.type + '_password'}`;
      await sql`INSERT INTO settings (key, value) VALUES (${body.type + '_password_hash'}, ${hash}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      await sql`INSERT INTO settings (key, value) VALUES (${body.type + '_password_salt'}, ${salt}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      return success({ ok: true });
    }
    return error('ভুল পাসওয়ার্ড', 401);
  }

  const hash = hashRows[0].value;
  const salt = saltRows.length > 0 ? saltRows[0].value : null;
  if (!salt) return error('পাসওয়ার্ড সল্ট পাওয়া যায়নি', 500);

  const ok = await verifyPassword(String(body.password), hash, salt);
  if (!ok) return error('ভুল পাসওয়ার্ড', 401);
  return success({ ok: true });
}
