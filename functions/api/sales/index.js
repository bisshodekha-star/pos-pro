/**
 * GET  /api/sales   — list sales (supports ?from=&to=&customer=&status=&q=)
 * POST /api/sales   — create a new sale (complete bill or hold bill)
 *
 * Body for POST:
 * {
 *   items: [{ product_id, qty, unit_price, discount, product_name? }],
 *   customer: { id?, name?, phone? },
 *   bill_discount: number,
 *   paid: number,
 *   payment_method: 'cash' | 'bkash' | 'nagad' | 'card' | 'rocket' | 'bank',
 *   status: 'completed' | 'held',
 *   note: string,
 *   cashier_name: string  (from frontend)
 * }
 *
 * The server computes: subtotal, item_discount, vat, total, due, change_given
 * and updates product stock + customer due + transactions.
 *
 * Invoice number is generated via a PostgreSQL sequence — race-free.
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';
import { accountOf, ledger } from '../../_shared/accounts.js';

export async function onRequestGet(context) {
  const { user, response } = await requireAuth(context);
  if (response) return response;
  const isAdmin = user.role === 'admin';

  const url = new URL(context.request.url);
  const from = url.searchParams.get('from');   // YYYY-MM-DD
  const to = url.searchParams.get('to');
  const status = url.searchParams.get('status') || 'completed';
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 200, 500);

  const sql = getSql(context.env);

  let rows;
  if (from && to) {
    rows = await sql`
      SELECT id, invoice_no, customer_name, customer_phone, cashier_name,
             subtotal, item_discount, bill_discount, (item_discount + bill_discount) AS discount,
             vat, total, paid, due, change_given, payment_method, status,
             total_cost, net_profit,
             completed_at::text AS completed_at, created_at::text AS created_at
      FROM sales
      WHERE status = ${status}
        AND created_at >= ${from}::date
        AND created_at < ${to}::date + 1
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  } else {
    rows = await sql`
      SELECT id, invoice_no, customer_name, customer_phone, cashier_name,
             subtotal, item_discount, bill_discount, (item_discount + bill_discount) AS discount,
             vat, total, paid, due, change_given, payment_method, status,
             total_cost, net_profit,
             completed_at::text AS completed_at, created_at::text AS created_at
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

  // Ensure numeric values are numbers (Neon may return strings)
  filtered = filtered.map(s => {
    const out = {
      ...s,
      subtotal: parseFloat(s.subtotal) || 0,
      discount: parseFloat(s.discount) || 0,
      item_discount: parseFloat(s.item_discount) || 0,
      bill_discount: parseFloat(s.bill_discount) || 0,
      vat: parseFloat(s.vat) || 0,
      total: parseFloat(s.total) || 0,
      paid: parseFloat(s.paid) || 0,
      due: parseFloat(s.due) || 0,
      change_given: parseFloat(s.change_given) || 0,
      total_cost: parseFloat(s.total_cost) || 0,
      net_profit: parseFloat(s.net_profit) || 0,
    };
    // Profit is private: only the admin ever receives it
    if (!isAdmin) { delete out.total_cost; delete out.net_profit; }
    return out;
  });

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
  const settingsRows = await sql`SELECT key, value FROM settings WHERE key IN ('vat_percent','invoice_prefix','invoice_padding')`;
  const settings = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));

  // Generate invoice number via PostgreSQL sequence (race-free).
  // We try nextval('invoice_seq') — if the sequence doesn't exist yet
  // (older deployments), fall back to the legacy MAX+1 logic.
  const prefix = settings.invoice_prefix || 'INV-';
  const padding = parseInt(settings.invoice_padding) || 4;
  let nextNum;
  try {
    const seqRows = await sql`SELECT nextval('invoice_seq')::int AS n`;
    nextNum = seqRows[0].n;
    // If invoice_start is set and sequence hasn't been initialised high enough,
    // bump it. (nextval is monotonic — safe.)
  } catch (e) {
    // Legacy fallback: MAX(invoice_no) + 1
    const lastSale = await sql`
      SELECT invoice_no FROM sales
      WHERE invoice_no LIKE ${prefix + '%'}
      ORDER BY id DESC LIMIT 1
    `;
    nextNum = 1001;
    if (lastSale.length > 0) {
      const m = lastSale[0].invoice_no.match(/(\d+)$/);
      if (m) nextNum = parseInt(m[1]) + 1;
    }
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
        cost_price: 0,
      });
      continue;
    }

    const prods = await sql`SELECT id, name, barcode, sell_price, stock, category, cost_price FROM products WHERE id = ${it.product_id}`;
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
      cost_price: Number(p.cost_price) || 0,   // cost frozen at the time of sale
    });
  }

  const afterItemDiscount = subtotal - itemDiscount;
  const billDiscount = Math.max(0, Math.min(afterItemDiscount, Number(body.bill_discount) || 0));
  const taxable = afterItemDiscount - billDiscount;

  const vatPercent = parseFloat(settings.vat_percent) || 0;
  // VAT is inclusive (মূল্যের ভেতরে) — extract from taxable
  const vat = taxable * vatPercent / (100 + vatPercent);
  const total = taxable; // total already includes VAT
  // Profit for this invoice = sales without VAT - what the goods cost
  const totalCost = items.reduce((a, it) => a + it.qty * it.cost_price, 0);
  const netProfit = total - vat - totalCost;
  const paid = Number(body.paid) || 0;
  const due = status === 'held' ? total : Math.max(0, total - paid);
  const changeGiven = status === 'held' ? 0 : Math.max(0, paid - total);

  // Customer — auto-create if doesn't exist (for due tracking)
  let customerId = null;
  let customerName = body.customer?.name || null;
  let customerPhone = body.customer?.phone || null;

  if (body.customer?.phone) {
    const existing = await sql`SELECT id FROM customers WHERE phone = ${body.customer.phone} LIMIT 1`;
    if (existing.length > 0) {
      customerId = existing[0].id;
    } else if (body.customer?.name) {
      // Customer doesn't exist but has name+phone → CREATE them
      const newCust = await sql`
        INSERT INTO customers (name, phone)
        VALUES (${body.customer.name}, ${body.customer.phone})
        RETURNING id
      `;
      customerId = newCust[0].id;
    }
  }
  if (body.customer?.id) {
    customerId = body.customer.id;
  }

  // Cashier name: prefer client-sent value, fallback to JWT name or default.
  const cashierName = body.cashier_name || user.name || 'ক্যাশিয়ার';

  // Insert sale. cashier_id stays NULL in this single-password system.
  const sales = await sql`
    INSERT INTO sales (
      invoice_no, customer_id, customer_name, customer_phone,
      cashier_id, cashier_name,
      subtotal, item_discount, bill_discount, vat, total,
      total_cost, net_profit,
      paid, due, change_given, payment_method, status,
      completed_at, note
    ) VALUES (
      ${invoiceNo}, ${customerId}, ${customerName}, ${customerPhone},
      NULL, ${cashierName},
      ${subtotal}, ${itemDiscount}, ${billDiscount}, ${vat}, ${total},
      ${totalCost}, ${netProfit},
      ${paid}, ${due}, ${changeGiven}, ${body.payment_method || 'cash'}, ${status},
      ${status === 'completed' ? new Date().toISOString() : null}, ${body.note || null}
    )
    RETURNING *
  `;

  const sale = sales[0];

  // Insert sale items + update stock (only if completed)
  for (const it of items) {
    await sql`
      INSERT INTO sale_items (sale_id, product_id, product_name, barcode, qty, unit_price, discount, total, cost_price)
      VALUES (${sale.id}, ${it.product_id}, ${it.product_name}, ${it.barcode},
              ${it.qty}, ${it.unit_price}, ${it.discount}, ${it.total}, ${it.cost_price})
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

  // Cashbook: the money that actually came in goes to its account
  if (status === 'completed') {
    await ledger(sql, {
      account: accountOf(body.payment_method), type: 'sale',
      amount: total - due, refType: 'sale', refId: sale.id, note: invoiceNo,
    });
  }

  // Add transaction record
  if (status === 'completed') {
    await sql`
      INSERT INTO transactions (customer_id, customer_name, type, amount, sale_id, note)
      VALUES (${customerId}, ${customerName}, 'sale', ${total}, ${sale.id}, ${'বিক্রি: ' + invoiceNo})
    `;
  }

  // Profit is private: strip it from the response unless admin
  const saleOut = { ...sale };
  if (user.role !== 'admin') { delete saleOut.total_cost; delete saleOut.net_profit; }
  return success(
    {
      ...saleOut,
      items: user.role === 'admin' ? items : items.map(({ cost_price, ...rest }) => rest),
    },
    status === 'held' ? 'বিল হোল্ড করা হয়েছে' : 'বিল সম্পন্ন হয়েছে',
    201
  );
}
