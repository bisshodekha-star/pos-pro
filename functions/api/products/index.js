/**
 * GET  /api/products            — list (supports ?q=search&category=X)
 * POST /api/products            — create new product
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

  // Ensure numeric values are proper numbers (Neon may return strings)
  rows = rows.map(p => ({
    ...p,
    cost_price: parseFloat(p.cost_price) || 0,
    sell_price: parseFloat(p.sell_price) || 0,
    stock: parseInt(p.stock) || 0,
    low_stock: parseInt(p.low_stock) || 20,
  }));

  return success(rows);
}

export async function onRequestPost(context) {
  const { user, response } = await requireAuth(context);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !body.name || !body.barcode) {
    return error('নাম ও বারকোড দিন', 400);
  }

  // Convert to proper numbers
  const costPrice = parseFloat(body.cost_price) || 0;
  const sellPrice = parseFloat(body.sell_price) || 0;
  const stock = parseInt(body.stock) || 0;
  const lowStock = parseInt(body.low_stock) || 20;

  if (sellPrice <= 0) {
    return error('বিক্রি দাম 0 এর বেশি হতে হবে', 400);
  }

  const sql = getSql(context.env);

  // Check duplicate barcode
  const dup = await sql`SELECT id FROM products WHERE barcode = ${String(body.barcode)}`;
  if (dup.length > 0) {
    return error('এই বারকোড আগে থেকেই আছে', 400);
  }

  // Insert — send all values as STRINGS to avoid Neon HTTP numeric issues
  // PostgreSQL will implicitly cast strings to numeric/int
  const rows = await sql`
    INSERT INTO products (barcode, name, category, size, cost_price, sell_price, stock, unit, low_stock, emoji, active)
    VALUES (
      ${String(body.barcode)},
      ${String(body.name)},
      ${String(body.category || 'অন্যান্য')},
      ${body.size ? String(body.size) : null},
      ${String(costPrice.toFixed(2))},
      ${String(sellPrice.toFixed(2))},
      ${String(stock)},
      'pcs',
      ${String(lowStock)},
      ${String(body.emoji || '👕')},
      true
    )
    RETURNING *
  `;

  // Ensure response values are numbers
  const p = rows[0];
  const product = {
    ...p,
    cost_price: parseFloat(p.cost_price) || 0,
    sell_price: parseFloat(p.sell_price) || 0,
    stock: parseInt(p.stock) || 0,
    low_stock: parseInt(p.low_stock) || 20,
  };

  return success(product, 'পণ্য যোগ হয়েছে', 201);
}
