/**
 * GET    /api/sales/:id   — get sale details (with items)
 * POST   /api/sales/:id   — action: 'resume' (resume held bill) | 'cancel' (cancel bill)
 *                           Body: { action, paid?, payment_method? }
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';
import { accountOf, ledger } from '../../_shared/accounts.js';

export async function onRequestGet(context) {
  const { user, response } = await requireAuth(context);
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

  // Ensure numeric values are numbers
  const sale = sales[0];
  const saleData = {
    ...sale,
    subtotal: parseFloat(sale.subtotal) || 0,
    item_discount: parseFloat(sale.item_discount) || 0,
    bill_discount: parseFloat(sale.bill_discount) || 0,
    vat: parseFloat(sale.vat) || 0,
    total: parseFloat(sale.total) || 0,
    paid: parseFloat(sale.paid) || 0,
    due: parseFloat(sale.due) || 0,
    change_given: parseFloat(sale.change_given) || 0,
    total_cost: parseFloat(sale.total_cost) || 0,
    net_profit: parseFloat(sale.net_profit) || 0,
  };
  const itemsData = items.map(it => ({
    ...it,
    unit_price: parseFloat(it.unit_price) || 0,
    discount: parseFloat(it.discount) || 0,
    total: parseFloat(it.total) || 0,
    qty: parseInt(it.qty) || 1,
    cost_price: parseFloat(it.cost_price) || 0,
  }));

  // Profit/cost are private: only the admin gets them
  if (user.role !== 'admin') {
    delete saleData.total_cost;
    delete saleData.net_profit;
    itemsData.forEach(it => delete it.cost_price);
  }

  return success({ ...saleData, items: itemsData });
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

  // Cashbook: money received when the held bill is completed
  await ledger(sql, {
    account: accountOf(paymentMethod), type: 'sale',
    amount: Number(sale.total) - due, refType: 'sale', refId: Number(id), note: sale.invoice_no,
  });

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

  // Cashbook: take back the money that was received for this bill
  if (sale.status === 'completed') {
    await ledger(sql, {
      account: accountOf(sale.payment_method), type: 'sale_cancel',
      amount: -(Number(sale.total) - Number(sale.due)), refType: 'sale', refId: Number(id),
      note: 'বাতিল: ' + sale.invoice_no,
    });
  }

  await sql`
    INSERT INTO transactions (customer_id, customer_name, type, amount, sale_id, note)
    VALUES (${sale.customer_id}, ${sale.customer_name}, 'sale_cancel', ${sale.total}, ${id}, ${'বাতিল: ' + sale.invoice_no})
  `;

  return success(null, 'বিল বাতিল করা হয়েছে, স্টক ফিরিয়ে আনা হয়েছে');
}
