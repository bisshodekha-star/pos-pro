/**
 * GET    /api/products/:id  — get single product
 * PUT    /api/products/:id  — update product
 * DELETE /api/products/:id  — soft delete (set active=false)
 */
import { getSql } from '../../../_shared/db.js';
import { requireAuth } from '../../../_shared/auth.js';
import { json, error, success, parseBody } from '../../../_shared/response.js';

export async function onRequestGet(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const sql = getSql(context.env);
  const rows = await sql`SELECT * FROM products WHERE id = ${context.params.id}`;
  if (rows.length === 0) return error('পণ্য পাওয়া যায়নি', 404);
  return success(rows[0]);
}

export async function onRequestPut(context) {
  const { user, response } = await requireAuth(context, ['admin', 'manager']);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body) return error('ডাটা পাঠান', 400);

  const sql = getSql(context.env);
  const id = context.params.id;

  // Build update dynamically
  const current = await sql`SELECT * FROM products WHERE id = ${id}`;
  if (current.length === 0) return error('পণ্য পাওয়া যায়নি', 404);

  const p = current[0];
  const rows = await sql`
    UPDATE products SET
      barcode      = ${body.barcode      ?? p.barcode},
      name         = ${body.name         ?? p.name},
      category     = ${body.category     ?? p.category},
      size         = ${body.size         ?? p.size},
      cost_price   = ${body.cost_price   ?? p.cost_price},
      sell_price   = ${body.sell_price   ?? p.sell_price},
      stock        = ${body.stock        ?? p.stock},
      low_stock    = ${body.low_stock    ?? p.low_stock},
      emoji        = ${body.emoji        ?? p.emoji},
      updated_at   = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return success(rows[0], 'পণ্য আপডেট হয়েছে');
}

export async function onRequestDelete(context) {
  const { response } = await requireAuth(context, ['admin', 'manager']);
  if (response) return response;

  const sql = getSql(context.env);
  await sql`UPDATE products SET active = false WHERE id = ${context.params.id}`;
  return success(null, 'পণ্য মুছে ফেলা হয়েছে');
}
