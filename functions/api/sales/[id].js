/**
 * GET    /api/sales/:id   — get sale details (with items)
 * POST   /api/sales/:id   — action: 'resume' (resume held bill) | 'cancel' (cancel bill)
 *                           Body: { action, paid?, payment_method? }
 */
import { getSql } from '../../../_shared/db.js';
import { requireAuth } from '../../../_shared/auth.js';
import { json, error, success, parseBody } from '../../../_shared/response.js';

export async function onRequestGet(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const sql = getSql(context.env);
  const id = context.params.id;

  const sales = await sql`
    SELECT s.*, u.name AS cashier_name_full
    FROM sales s
    LEFT JOIN users u ON s.cashier_id = u.id
    WHERE s.id = ${id}
  `;
  if (sales.length === 0) return error('বিল পাওয়া যায়নি', 404);

  const items = await sql`SELECT * FROM sale_items WHERE sale_id = ${id} ORDER BY id`;
  return success({ ...sales[0], items });
}

export async function onRequestPost(context) {
  const { user, response } = await requireAuth(context);
  if (response) return response;

  const body = await parseBody(context.request) || {};
  const action = body.action;

  if (action === 'cancel') return await cancelSale(context, user);
  if (action === 'resume') return await resumeHeld(context, user);

  return error('action দিন (resume বা cancel)', 400);
}

async function resumeHeld(context, user) {
  const sql = getSql(context.env);
  const id = context.params.id;
  const body = await parseBody(context.request) || {};

  const sales = await sql`SELECT * FROM sales WHERE id = ${id} AND status = 'held'`;
  if (sales.length === 0) return error('হোল্ড করা বিল পাওয়া যায়নি', 404);

  const sale = sales[0];
  const paid = Number(body.paid) || 0;
  const due = Math.max(0, sale.total - paid);
  const changeGiven = Math.max(0, paid - sale.total);
  const paymentMethod = body.payment_method || sale.payment_method;

  await sql`
    UPDATE sales SET
      status = 'completed',
      paid = ${paid},
      due = ${due},
      change_given = ${changeGiven},
      payment_method = ${paymentMethod},
      completed_at = NOW()
    WHERE id = ${id}
  `;

  const items = await sql`SELECT * FROM sale_items WHERE sale_id = ${id}`;
  for (const it of items) {
    if (it.product_id) {
      await sql`UPDATE products SET stock = GREATEST(0, stock - ${it.qty}) WHERE id = ${it.product_id}`;
    }
  }

  if (sale.customer_id) {
    await sql`
      UPDATE customers SET
        due = due + ${due},
        total_purchase = total_purchase + ${sale.total},
        bills_count = bills_count + 1,
        updated_at = NOW()
      WHERE id = ${sale.customer_id}
    `;
  }

  await sql`
    INSERT INTO transactions (customer_id, customer_name, type, amount, sale_id, note)
    VALUES (${sale.customer_id}, ${sale.customer_name}, 'sale', ${sale.total}, ${id}, ${'বিক্রি: ' + sale.invoice_no})
  `;

  return success({ ...sale, paid, due, changeGiven, status: 'completed' }, 'হোল্ড বিল সম্পন্ন হয়েছে');
}

async function cancelSale(context, user) {
  const sql = getSql(context.env);
  const id = context.params.id;

  const sales = await sql`SELECT * FROM sales WHERE id = ${id} AND status IN ('completed','held')`;
  if (sales.length === 0) return error('বিল পাওয়া যায়নি বা ইতিমধ্যে বাতিল', 404);

  const sale = sales[0];

  // Restore stock (only if was completed — held bills haven't reduced stock)
  if (sale.status === 'completed') {
    const items = await sql`SELECT * FROM sale_items WHERE sale_id = ${id}`;
    for (const it of items) {
      if (it.product_id) {
        await sql`UPDATE products SET stock = stock + ${it.qty} WHERE id = ${it.product_id}`;
      }
    }
    if (sale.customer_id) {
      await sql`
        UPDATE customers SET
          due = GREATEST(0, due - ${sale.due}),
          total_purchase = GREATEST(0, total_purchase - ${sale.total}),
          bills_count = GREATEST(0, bills_count - 1),
          updated_at = NOW()
        WHERE id = ${sale.customer_id}
      `;
    }
  }

  await sql`UPDATE sales SET status = 'cancelled', cancelled_at = NOW() WHERE id = ${id}`;

  await sql`
    INSERT INTO transactions (customer_id, customer_name, type, amount, sale_id, note)
    VALUES (${sale.customer_id}, ${sale.customer_name}, 'expense', ${sale.total}, ${id}, ${'বাতিল: ' + sale.invoice_no})
  `;

  return success(null, 'বিল বাতিল করা হয়েছে, স্টক ফিরিয়ে আনা হয়েছে');
}
