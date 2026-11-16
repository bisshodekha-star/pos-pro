/**
 * GET  /api/users   — list users (admin only)
 * POST /api/users   — create user (admin only)
 *   Body: { name, username, password, role, phone }
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth, hashPassword } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestGet(context) {
  const { response } = await requireAuth(context, ['admin']);
  if (response) return response;

  const sql = getSql(context.env);
  const rows = await sql`
    SELECT id, name, username, role, phone, active, created_at
    FROM users ORDER BY id
  `;
  return success(rows);
}

export async function onRequestPost(context) {
  const { response } = await requireAuth(context, ['admin']);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !body.name || !body.username || !body.password) {
    return error('নাম, ইউজারনেম ও পাসওয়ার্ড দিন', 400);
  }
  if (body.password.length < 4) {
    return error('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে', 400);
  }
  if (!['admin', 'manager', 'cashier'].includes(body.role)) {
    return error('রোল সঠিক নয় (admin/manager/cashier)', 400);
  }

  const sql = getSql(context.env);
  const dup = await sql`SELECT id FROM users WHERE username = ${body.username}`;
  if (dup.length > 0) return error('এই ইউজারনেম আগে থেকেই আছে', 400);

  const { hash, salt } = await hashPassword(body.password);
  const rows = await sql`
    INSERT INTO users (name, username, password_hash, password_salt, role, phone)
    VALUES (${body.name}, ${body.username}, ${hash}, ${salt}, ${body.role}, ${body.phone || null})
    RETURNING id, name, username, role, phone, active, created_at
  `;

  return success(rows[0], 'ইউজার যোগ হয়েছে', 201);
}
