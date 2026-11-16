/**
 * POST /api/auth/login
 * Body: { username, password }
 * Sets pos_token cookie, returns user info
 */
import { getSql } from '../../_shared/db.js';
import { verifyPassword, signJwt, withAuthCookie } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestPost(context) {
  const body = await parseBody(context.request);
  if (!body || !body.username || !body.password) {
    return error('ইউজারনেম ও পাসওয়ার্ড দিন', 400);
  }

  const sql = getSql(context.env);
  const users = await sql`
    SELECT id, name, username, password_hash, password_salt, role, phone, active
    FROM users WHERE username = ${body.username} LIMIT 1
  `;

  if (users.length === 0) {
    return error('ভুল ইউজারনেম বা পাসওয়ার্ড', 401);
  }

  const user = users[0];
  if (!user.active) {
    return error('এই অ্যাকাউন্ট নিষ্ক্রিয় আছে', 403);
  }

  const ok = await verifyPassword(body.password, user.password_hash, user.password_salt);
  if (!ok) {
    return error('ভুল ইউজারনেম বা পাসওয়ার্ড', 401);
  }

  const token = await signJwt(
    {
      sub: String(user.id),
      name: user.name,
      username: user.username,
      role: user.role,
    },
    context.env
  );

  const userData = {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    phone: user.phone,
  };

  const res = success(userData, 'লগইন সফল');
  return withAuthCookie(res, token);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
