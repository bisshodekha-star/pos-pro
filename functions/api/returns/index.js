/**
 * GET  /api/returns   — list returns
 * POST /api/returns   — process a return
 *   Body: { sale_id, product_id, qty, amount, reason }
 *   - Restores product stock
 *   - Records the return
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestGet(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const sql = getSql(context.env);
  const rows = await sql`
    SELECT r.*, s.customer_name
    FROM returns r
    LEFT JOIN sales s ON r.sale_id = s.id
    ORDER BY r.created_at DESC
    LIMIT 200
  `;

  return success(rows);
}

export async function onRequestPost(context) {
  const { user, response } = await requireAuth(context);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !body.qty || !(body.amount > 0)) {
    return error('পরিমাণ ও টাকা দিন', 400);
  }

  const sql = getSql(context.env);

  // Fetch sale info
  let invoiceNo = null;
  let productName = body.product_name || 'অজানা';
  if (body.sale_id) {
    const s = await sql`SELECT invoice_no FROM sales WHERE id = ${body.sale_id}`;
    if (s.length > 0) invoiceNo = s[0].invoice_no;
  }
  if (body.product_id) {
    const p = await sql`SELECT name FROM products WHERE id = ${body.product_id}`;
    if (p.length > 0) productName = p[0].name;
  }

  const rows = await sql`
    INSERT INTO returns (sale_id, invoice_no, product_id, product_name, qty, amount, reason, processed_by, processed_name)
    VALUES (${body.sale_id || null}, ${invoiceNo}, ${body.product_id || null}, ${productName},
            ${parseInt(body.qty)}, ${Number(body.amount)}, ${body.reason || null},
            ${user.sub ? parseInt(user.sub) : null}, ${user.name || null})
    RETURNING *
  `;

  // Restore stock
  if (body.product_id) {
    await sql`UPDATE products SET stock = stock + ${parseInt(body.qty)} WHERE id = ${body.product_id}`;
  }

  return success(rows[0], 'রিটার্ন প্রসেস হয়েছে, স্টক যোগ হয়েছে', 201);
}
