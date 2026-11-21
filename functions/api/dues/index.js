/**
 * GET  /api/dues      — list all customers with due > 0
 * POST /api/dues      — collect a payment { customer_id, amount, note }
 *
 * Collecting reduces customer.due and adds a 'collect' transaction.
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';
import { cleanAccount, ledger } from '../../_shared/accounts.js';

export async function onRequestGet(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const sql = getSql(context.env);
  const rows = await sql`
    SELECT id, name, phone, due, updated_at
    FROM customers
    WHERE due > 0
    ORDER BY updated_at DESC
  `;

  const totalDue = rows.reduce((a, c) => a + Number(c.due), 0);
  return success({ customers: rows, totalDue, count: rows.length });
}

export async function onRequestPost(context) {
  const { user, response } = await requireAuth(context);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !body.customer_id || !(body.amount > 0)) {
    return error('কাস্টমার ও টাকার পরিমাণ দিন', 400);
  }

  const sql = getSql(context.env);
  const id = body.customer_id;
  const amount = Number(body.amount);

  const cust = await sql`SELECT name, phone, due FROM customers WHERE id = ${id}`;
  if (cust.length === 0) return error('কাস্টমার পাওয়া যায়নি', 404);

  if (amount > Number(cust[0].due)) {
    return error('বাকির চেয়ে বেশি আদায় হয় না', 400);
  }

  await sql`
    UPDATE customers SET due = due - ${amount}, updated_at = NOW()
    WHERE id = ${id}
  `;

  await sql`
    INSERT INTO transactions (customer_id, customer_name, type, amount, note)
    VALUES (${id}, ${cust[0].name}, 'collect', ${amount}, ${body.note || 'বাকি আদায়'})
  `;

  // Cashbook: money collected goes to the chosen account (default: cash)
  await ledger(sql, {
    account: cleanAccount(body.account), type: 'collection',
    amount, refType: 'customer', refId: Number(id), note: 'বাকি আদায়: ' + cust[0].name,
  });

  return success({ collected: amount, remaining: Number(cust[0].due) - amount }, 'আদায় সফল');
}
