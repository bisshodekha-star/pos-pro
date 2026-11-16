/**
 * GET  /api/auth/check-setup  — returns { needsSetup: true/false }
 * POST /api/auth/setup        — creates first admin user (only if no users exist)
 *
 * This handles the "first run" case when the database is empty.
 */
import { getSql } from '../../_shared/db.js';
import { hashPassword } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestGet(context) {
  const sql = getSql(context.env);
  const rows = await sql`SELECT COUNT(*)::int AS count FROM users`;
  const count = rows[0]?.count || 0;
  return success({ needsSetup: count === 0 });
}

export async function onRequestPost(context) {
  const sql = getSql(context.env);

  // Safety: only allow setup if no users exist
  const existing = await sql`SELECT COUNT(*)::int AS count FROM users`;
  if (existing[0]?.count > 0) {
    return error('সেটআপ ইতিমধ্যে সম্পন্ন হয়েছে। লগইন করুন।', 400);
  }

  const body = await parseBody(context.request);
  // Use provided credentials OR defaults
  const name = body?.name || 'অ্যাডমিন';
  const username = body?.username || 'admin';
  const password = body?.password || 'admin123';

  if (password.length < 4) {
    return error('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে', 400);
  }

  const { hash, salt } = await hashPassword(password);

  const users = await sql`
    INSERT INTO users (name, username, password_hash, password_salt, role)
    VALUES (${name}, ${username}, ${hash}, ${salt}, 'admin')
    RETURNING id, name, username, role
  `;

  return success(
    {
      id: users[0].id,
      name: users[0].name,
      username: users[0].username,
      role: users[0].role,
    },
    'সেটআপ সম্পন্ন! এখন লগইন করুন।'
  );
}
