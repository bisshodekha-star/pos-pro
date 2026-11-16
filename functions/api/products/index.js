/**
 * GET  /api/products            — list (supports ?q=search&category=X)
 * POST /api/products            — create new product
 *
 * Body for POST: { barcode, name, category, size, cost_price, sell_price, stock, low_stock, emoji }
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestGet(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const category = url.searchParams.get('category');
  const lowOnly = url.searchParams.get('low') === '1';

  const sql = getSql(context.env);

  let rows;
  if (q && category) {
    rows = await sql`
      SELECT * FROM products
      WHERE active = true AND category = ${category}
        AND (name ILIKE ${'%' + q + '%'} OR barcode ILIKE ${'%' + q + '%'})
      ORDER BY name
    `;
  } else if (q) {
    rows = await sql`
      SELECT * FROM products
      WHERE active = true
        AND (name ILIKE ${'%' + q + '%'} OR barcode ILIKE ${'%' + q + '%'})
      ORDER BY name
    `;
  } else if (category) {
    rows = await sql`
      SELECT * FROM products
      WHERE active = true AND category = ${category}
      ORDER BY name
    `;
  } else if (lowOnly) {
    rows = await sql`
      SELECT * FROM products
      WHERE active = true AND stock <= low_stock
      ORDER BY stock ASC
    `;
  } else {
    rows = await sql`SELECT * FROM products WHERE active = true ORDER BY name`;
  }

  return success(rows);
}

export async function onRequestPost(context) {
  const { user, response } = await requireAuth(context, ['admin', 'manager']);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !body.name || !body.barcode || !(body.sell_price > 0)) {
    return error('নাম, বারকোড ও বিক্রি দাম দিন', 400);
  }

  const sql = getSql(context.env);

  // Check duplicate barcode
  const dup = await sql`SELECT id FROM products WHERE barcode = ${body.barcode}`;
  if (dup.length > 0) {
    return error('এই বারকোড আগে থেকেই আছে', 400);
  }

  const rows = await sql`
    INSERT INTO products (barcode, name, category, size, cost_price, sell_price, stock, low_stock, emoji, active)
    VALUES (${body.barcode}, ${body.name}, ${body.category || 'অন্যান্য'}, ${body.size || null},
            ${Number(body.cost_price) || 0}, ${Number(body.sell_price) || 0},
            ${parseInt(body.stock) || 0}, ${parseInt(body.low_stock) || 20},
            ${body.emoji || '👕'}, true)
    RETURNING *
  `;

  return success(rows[0], 'পণ্য যোগ হয়েছে', 201);
}
