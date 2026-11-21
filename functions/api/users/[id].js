/**
 * PUT    /api/users/:id   — update user (admin only)
 *   Body: { name?, role?, phone?, active?, password? }
 * DELETE /api/users/:id   — delete user (admin only, cannot delete self)
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth, hashPassword } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestPut(context) {
  const { user, response } = await requireAuth(context, ['admin']);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body) return error('ডাটা দিন', 400);

  const sql = getSql(context.env);
  const id = context.params.id;

  const cur = await sql`SELECT * FROM users WHERE id = ${id}`;
  if (cur.length === 0) return error('ইউজার পাওয়া যায়নি', 404);

  const u = cur[0];
  let hash = u.password_hash;
  let salt = u.password_salt;
  if (body.password && body.password.length >= 4) {
    const h = await hashPassword(body.password);
    hash = h.hash;
    salt = h.salt;
  }

  const rows = await sql`
    UPDATE users SET
      name = ${body.name ?? u.name},
      role = ${body.role ?? u.role},
      phone = ${body.phone ?? u.phone},
      active = ${body.active ?? u.active},
      password_hash = ${hash},
      password_salt = ${salt}
    WHERE id = ${id}
    RETURNING id, name, username, role, phone, active
  `;

  return success(rows[0], 'ইউজার আপডেট হয়েছে');
}

export async function onRequestDelete(context) {
  const { user, response } = await requireAuth(context, ['admin']);
  if (response) return response;

  // Self-delete protection: in single-password mode user.sub is 'pos-user'
  // (a string), not a numeric user ID, so the comparison below will not
  // match. When real multi-user login is enabled, user.sub becomes a
  // numeric ID and this check works as intended.
  const routeId = String(context.params.id);
  const userSub = String(user.sub);
  if (userSub && /^\d+$/.test(routeId) && /^\d+$/.test(userSub) && routeId === userSub) {
    return error('নিজেকে মুছতে পারবেন না', 400);
  }

  const sql = getSql(context.env);
  await sql`DELETE FROM users WHERE id = ${context.params.id}`;
  return success(null, 'ইউজার মুছে ফেলা হয়েছে');
}
