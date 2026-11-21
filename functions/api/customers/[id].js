/**
 * GET    /api/customers/:id   — get single customer (with recent transactions)
 * PUT    /api/customers/:id   — update
 * DELETE /api/customers/:id   — delete (only if no due/bills)
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestGet(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const sql = getSql(context.env);
  const id = context.params.id;

  const cust = await sql`SELECT * FROM customers WHERE id = ${id}`;
  if (cust.length === 0) return error('কাস্টমার পাওয়া যায়নি', 404);

  const txns = await sql`
    SELECT * FROM transactions
    WHERE customer_id = ${id}
    ORDER BY created_at DESC LIMIT 50
  `;

  return success({ ...cust[0], transactions: txns });
}

export async function onRequestPut(context) {
  const { response } = await requireAuth(context, ['admin', 'manager']);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body) return error('ডাটা দিন', 400);

  const sql = getSql(context.env);
  const id = context.params.id;
  const cur = await sql`SELECT * FROM customers WHERE id = ${id}`;
  if (cur.length === 0) return error('কাস্টমার পাওয়া যায়নি', 404);

  const c = cur[0];
  const rows = await sql`
    UPDATE customers SET
      name = ${body.name ?? c.name},
      phone = ${body.phone ?? c.phone},
      address = ${body.address ?? c.address},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return success(rows[0], 'কাস্টমার আপডেট হয়েছে');
}

export async function onRequestDelete(context) {
  const { response } = await requireAuth(context, ['admin', 'manager']);
  if (response) return response;

  const sql = getSql(context.env);
  const id = context.params.id;
  const c = await sql`SELECT due, bills_count FROM customers WHERE id = ${id}`;
  if (c.length === 0) return error('কাস্টমার পাওয়া যায়নি', 404);
  if (Number(c[0].due) > 0) return error('বাকি থাকলে মুছতে পারবেন না', 400);

  await sql`DELETE FROM customers WHERE id = ${id}`;
  return success(null, 'কাস্টমার মুছে ফেলা হয়েছে');
}
