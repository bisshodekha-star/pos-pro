/**
 * GET  /api/returns   — list returns
 * POST /api/returns   — process a return by barcode
 *   Body: { barcode, qty, reason?, sale_id? }
 *   - Looks up the product by barcode
 *   - Records the return (product snapshot + amount = sell_price × qty, for record only)
 *   - Restores product stock
 *
 * Note: "amount" is stored for historical record (পণ্যের মূল্য = sell_price × qty),
 * NOT as a refund tracker. Whether money is actually refunded to the customer
 * is a business decision the shop owner makes manually.
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

  // Accept either { barcode, qty } or { product_id, qty } (legacy)
  const barcode = body?.barcode ? String(body.barcode).trim() : null;
  const productId = body?.product_id ? Number(body.product_id) : null;
  const qty = parseInt(body?.qty);

  if (!barcode && !productId) {
    return error('বারকোড দিন', 400);
  }
  if (!qty || qty < 1) {
    return error('পরিমাণ সঠিক নয় (অন্তত ১)', 400);
  }

  const sql = getSql(context.env);

  // Lookup the product
  let product = null;
  if (barcode) {
    const rows = await sql`SELECT id, name, barcode, sell_price FROM products WHERE barcode = ${barcode} LIMIT 1`;
    if (rows.length > 0) product = rows[0];
  } else if (productId) {
    const rows = await sql`SELECT id, name, barcode, sell_price FROM products WHERE id = ${productId} LIMIT 1`;
    if (rows.length > 0) product = rows[0];
  }
  if (!product) {
    return error('এই বারকোডে কোনো পণ্য পাওয়া যায়নি', 404);
  }

  // Look up the sale (optional) — used for invoice_no + customer_name
  let invoiceNo = null;
  let customerId = null;
  let customerName = null;
  if (body.sale_id) {
    const s = await sql`SELECT invoice_no, customer_id, customer_name FROM sales WHERE id = ${body.sale_id}`;
    if (s.length > 0) {
      invoiceNo = s[0].invoice_no;
      customerId = s[0].customer_id;
      customerName = s[0].customer_name;
    }
  }

  // "amount" is the goods value being returned (sell_price × qty),
  // stored for record only — NOT a refund tracker.
  const sellPrice = Number(product.sell_price) || 0;
  const amount = Math.round(sellPrice * qty * 100) / 100;

  // processed_by stays NULL in single-password mode
  const processedName = user.name || body.cashier_name || 'ক্যাশিয়ার';

  const rows = await sql`
    INSERT INTO returns (sale_id, invoice_no, product_id, product_name, qty, amount, reason, processed_by, processed_name)
    VALUES (${body.sale_id || null}, ${invoiceNo}, ${product.id}, ${product.name},
            ${qty}, ${amount}, ${body.reason || null},
            NULL, ${processedName})
    RETURNING *
  `;

  // Restore stock
  await sql`UPDATE products SET stock = stock + ${qty} WHERE id = ${product.id}`;

  // Return a friendly summary so the frontend can show a toast
  return success(
    {
      ...rows[0],
      barcode: product.barcode,
      sell_price: sellPrice,
    },
    `রিটার্ন প্রসেস হয়েছে — ${product.name} × ${qty} (মূল্য ${amount})`,
    201
  );
}
