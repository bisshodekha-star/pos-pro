/**
 * GET  /api/expenses  — list (supports ?from=&to=)
 * POST /api/expenses  — create { category, description, amount, expense_date }
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';
import { cleanAccount, ledger } from '../../_shared/accounts.js';

export async function onRequestGet(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const url = new URL(context.request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const sql = getSql(context.env);
  let rows;
  if (from && to) {
    rows = await sql`
      SELECT * FROM expenses
      WHERE expense_date >= ${from} AND expense_date <= ${to}
      ORDER BY expense_date DESC, id DESC
    `;
  } else {
    rows = await sql`SELECT * FROM expenses ORDER BY expense_date DESC, id DESC LIMIT 200`;
  }

  const total = rows.reduce((a, e) => a + Number(e.amount), 0);
  return success({ expenses: rows, total });
}

export async function onRequestPost(context) {
  const { user, response } = await requireAuth(context);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !body.category || !(body.amount > 0)) {
    return error('ক্যাটাগরি ও টাকার পরিমাণ দিন', 400);
  }

  const sql = getSql(context.env);
  const account = cleanAccount(body.account);
  const expenseDate = body.expense_date || new Date().toISOString().slice(0, 10);
  // created_by stays NULL in this single-password system (no real user ID).
  const rows = await sql`
    INSERT INTO expenses (category, description, amount, expense_date, account, created_by)
    VALUES (${body.category}, ${body.description || null}, ${Number(body.amount)},
            ${expenseDate}, ${account},
            NULL)
    RETURNING *
  `;

  // Cashbook: money goes out of the chosen account
  await ledger(sql, {
    account, type: 'expense', amount: -Number(body.amount),
    refType: 'expense', refId: rows[0].id, date: expenseDate,
    note: body.description || body.category,
  });

  return success(rows[0], 'খরচ যোগ হয়েছে', 201);
}
