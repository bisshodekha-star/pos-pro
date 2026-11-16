/**
 * GET  /api/sales   — list sales (supports ?from=&to=&customer=&status=&q=)
 * POST /api/sales   — create a new sale (complete bill or hold bill)
 *
 * Body for POST:
 * {
 *   items: [{ product_id, qty, unit_price, discount }],
 *   customer: { id?, name?, phone? },
 *   bill_discount: number,
 *   paid: number,
 *   payment_method: 'cash' | 'bkash' | 'nagad' | 'card',
 *   status: 'completed' | 'held',
 *   note: string,
 *   cashier_name: string  (from frontend)
 * }
 *
 * The server computes: subtotal, item_discount, vat, total, due, change_given
 * and updates product stock + customer due + transactions.
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestGet(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const url = new URL(context.request.url);
  const from = url.searchParams.get('from');   // YYYY-MM-DD
  const to = url.searchParams.get('to');
  const status = url.searchParams.get('status') || 'completed';
  const q = (url.searchParams.get('q') || '').trim();
  const limit = parseInt(url.searchParams.get('limit')) || 200;

  const sql = getSql(context.env);

  let rows;
  if (from && to) {
    rows = await sql`
      SELECT id, invoice_no, customer_name, customer_phone, cashier_name,
             subtotal, item_discount, bill_discount, (item_discount + bill_discount) AS discount,
             total, paid, due, payment_method, status,
             completed_at, created_at
      FROM sales
      WHERE status = ${status}
        AND created_at >= ${from}
        AND created_at < ${to}::date + 1
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  } else {
    rows = await sql`
      SELECT id, invoice_no, customer_name, customer_phone, cashier_name,
             subtotal, item_discount, bill_discount, (item_discount + bill_discount) AS discount,
             total, paid, due, payment_method, status,
             completed_at, created_at
      FROM sales
      WHERE status = ${status}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }

  // Filter by search query in memory (name/phone/invoice)
  let filtered = rows;
  if (q) {
    const ql = q.toLowerCase();
    filtered = rows.filter(r =>
      (r.customer_name || '').toLowerCase().includes(ql) ||
      (r.customer_phone || '').includes(q) ||
      (r.invoice_no || '').toLowerCase().includes(ql)
    );
  }

  return success(filtered);
}

export async function onRequestPost(context) {
  const { user, response } = await requireAuth(context);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return error('বিলে অন্তত একটি পণ্য দিন', 400);
  }

  const sql = getSql(context.env);
  const status = body.status === 'held' ? 'held' : 'completed';

  // Fetch settings (vat, invoice prefix, etc.)
  const settingsRows = await sql`SELECT key, value FROM settings WHERE key IN ('vat_percent','invoice_prefix','invoice_start','invoice_padding')`;
  const settings = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));

  // Generate invoice number
  const prefix = settings.invoice_prefix || 'INV-';
  const padding = parseInt(settings.invoice_padding) || 4;
  const lastSale = await sql`
    SELECT invoice_no FROM sales
    WHERE invoice_no LIKE ${prefix + '%'}
    ORDER BY id DESC LIMIT 1
  `;
  let nextNum = parseInt(settings.invoice_start) || 1001;
  if (lastSale.length > 0) {
    const m = lastSale[0].invoice_no.match(/(\d+)$/);
    if (m) nextNum = parseInt(m[1]) + 1;
  }
  const invoiceNo = prefix + String(nextNum).padStart(padding, '0');

  // Compute totals from actual product data (don't trust client prices fully)
  let subtotal = 0;
  let itemDiscount = 0;
  const items = [];

  for (const it of body.items) {
    if (!it.product_id) {
      // Manual item (no barcode) — use provided price
      const lineTotal = (Number(it.unit_price) || 0) * (parseInt(it.qty) || 1);
      const disc = Number(it.discount) || 0;
      subtotal += lineTotal;
      itemDiscount += disc;
      items.push({
        product_id: null,
        product_name: it.product_name || 'কাস্টম আইটেম',
        barcode: null,
        qty: parseInt(it.qty) || 1,
        unit_price: Number(it.unit_price) || 0,
        discount: disc,
        total: lineTotal - disc,
      });
      continue;
    }

    const prods = await sql`SELECT id, name, barcode, sell_price, stock, category FROM products WHERE id = ${it.product_id}`;
    if (prods.length === 0) {
      return error(`পণ্য পাওয়া যায়নি (ID: ${it.product_id})`, 400);
    }
    const p = prods[0];
    const unitPrice = Number(it.unit_price) || Number(p.sell_price);
    const qty = parseInt(it.qty) || 1;
    const lineTotal = unitPrice * qty;
    const disc = Number(it.discount) || 0;
    subtotal += lineTotal;
    itemDiscount += disc;
    items.push({
      product_id: p.id,
      product_name: p.name,
      barcode: p.barcode,
      qty,
      unit_price: unitPrice,
      discount: disc,
      total: lineTotal - disc,
    });
  }

  const afterItemDiscount = subtotal - itemDiscount;
  const billDiscount = Math.max(0, Math.min(afterItemDiscount, Number(body.bill_discount) || 0));
  const taxable = afterItemDiscount - billDiscount;

  const vatPercent = parseFloat(settings.vat_percent) || 0;
  // VAT is inclusive (মূল্যের ভেতরে) — extract from taxable
  const vat = taxable * vatPercent / (100 + vatPercent);
  const total = taxable; // total already includes VAT
  const paid = Number(body.paid) || 0;
  const due = status === 'held' ? total : Math.max(0, total - paid);
  const changeGiven = status === 'held' ? 0 : Math.max(0, paid - total);

  // Customer
  let customerId = null;
  let customerName = body.customer?.name || null;
  let customerPhone = body.customer?.phone || null;

  if (body.customer?.phone) {
    const existing = await sql`SELECT id FROM customers WHERE phone = ${body.customer.phone} LIMIT 1`;
    if (existing.length > 0) {
      customerId = existing[0].id;
    }
  }
  if (body.customer?.id) {
    customerId = body.customer.id;
  }

  // Insert sale
  const sales = await sql`
    INSERT INTO sales (
      invoice_no, customer_id, customer_name, customer_phone,
      cashier_id, cashier_name,
      subtotal, item_discount, bill_discount, vat, total,
      paid, due, change_given, payment_method, status,
      completed_at, note
    ) VALUES (
      ${invoiceNo}, ${customerId}, ${customerName}, ${customerPhone},
      ${user.sub ? parseInt(user.sub) : null}, ${user.name || body.cashier_name || 'ক্যাশিয়ার'},
      ${subtotal}, ${itemDiscount}, ${billDiscount}, ${vat}, ${total},
      ${paid}, ${due}, ${changeGiven}, ${body.payment_method || 'cash'}, ${status},
      ${status === 'completed' ? new Date().toISOString() : null}, ${body.note || null}
    )
    RETURNING *
  `;

  const sale = sales[0];

  // Insert sale items + update stock (only if completed)
  for (const it of items) {
    await sql`
      INSERT INTO sale_items (sale_id, product_id, product_name, barcode, qty, unit_price, discount, total)
      VALUES (${sale.id}, ${it.product_id}, ${it.product_name}, ${it.barcode},
              ${it.qty}, ${it.unit_price}, ${it.discount}, ${it.total})
    `;
    if (status === 'completed' && it.product_id) {
      await sql`UPDATE products SET stock = GREATEST(0, stock - ${it.qty}) WHERE id = ${it.product_id}`;
    }
  }

  // Update customer due + total purchase
  if (status === 'completed' && customerId) {
    await sql`
      UPDATE customers SET
        due = due + ${due},
        total_purchase = total_purchase + ${total},
        bills_count = bills_count + 1,
        updated_at = NOW()
      WHERE id = ${customerId}
    `;
  }

  // Add transaction record
  if (status === 'completed') {
    await sql`
      INSERT INTO transactions (customer_id, customer_name, type, amount, sale_id, note)
      VALUES (${customerId}, ${customerName}, 'sale', ${total}, ${sale.id}, ${'বিক্রি: ' + invoiceNo})
    `;
  }

  return success(
    {
      ...sale,
      items,
    },
    status === 'held' ? 'বিল হোল্ড করা হয়েছে' : 'বিল সম্পন্ন হয়েছে',
    201
  );
}
