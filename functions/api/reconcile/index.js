/**
 * Day-End Cash Reconciliation (Cash account only)
 *
 * GET  /api/reconcile?date=YYYY-MM-DD
 *      Expected Balance = Opening Balance + Income - Expenses
 *      Returns the numbers + any reconciliation already saved for that day
 *      + the last 30 saved reconciliations.
 *
 * POST /api/reconcile   { date, counted, note? }
 *      Saves the reconciliation. If counted != expected, a "Cash Adjustment"
 *      entry for the difference is added to the cash ledger automatically.
 *      Re-running a date replaces its old adjustment.
 *
 * Ledger rules for a day D (cash account):
 *   opening  = every entry dated before D  +  an 'opening' entry dated D
 *   income   = + entries on D  (sales, collections, transfers in)
 *   expenses = - entries on D  (expenses, transfers out, cancelled bills)
 *   adjustments of D are NOT part of expected (they are the result of counting)
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { error, success, parseBody } from '../../_shared/response.js';
import { ledger } from '../../_shared/accounts.js';

function validDate(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d || ''); }

async function compute(sql, date) {
  const openRow = await sql`
    SELECT COALESCE(SUM(amount), 0)::numeric AS v FROM cash_ledger
    WHERE account = 'cash'
      AND (entry_date < ${date}::date OR (entry_date = ${date}::date AND entry_type = 'opening'))
  `;
  const dayRows = await sql`
    SELECT entry_type, COALESCE(SUM(amount), 0)::numeric AS v
    FROM cash_ledger
    WHERE account = 'cash' AND entry_date = ${date}::date
      AND entry_type NOT IN ('opening', 'adjustment')
    GROUP BY entry_type
  `;
  const income = {}, spent = {};
  let incomeTotal = 0, expenseTotal = 0;
  dayRows.forEach(r => {
    const v = Number(r.v);
    if (v >= 0) { income[r.entry_type] = v; incomeTotal += v; }
    else { spent[r.entry_type] = -v; expenseTotal += -v; }
  });
  const opening = Number(openRow[0].v);
  return { date, opening, income: incomeTotal, expenses: expenseTotal, incomeBreakdown: income, expenseBreakdown: spent,
           expected: opening + incomeTotal - expenseTotal };
}

export async function onRequestGet(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const sql = getSql(context.env);
  const url = new URL(context.request.url);
  const date = url.searchParams.get('date') || new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10);
  if (!validDate(date)) return error('তারিখ ঠিক নেই', 400);

  const calc = await compute(sql, date);
  const saved = await sql`SELECT id, rec_date::text AS rec_date, opening, income, expenses, expected, counted, difference, note, created_at::text AS created_at FROM cash_reconciliations WHERE rec_date = ${date}::date`;
  const history = await sql`
    SELECT id, rec_date::text AS rec_date, expected, counted, difference, created_at::text AS created_at
    FROM cash_reconciliations ORDER BY rec_date DESC LIMIT 30
  `;
  const num = r => r && ({ ...r, opening: Number(r.opening), income: Number(r.income), expenses: Number(r.expenses),
                          expected: Number(r.expected), counted: Number(r.counted), difference: Number(r.difference) });
  return success({
    ...calc,
    saved: num(saved[0]) || null,
    history: history.map(h => ({ ...h, expected: Number(h.expected), counted: Number(h.counted), difference: Number(h.difference) })),
  });
}

export async function onRequestPost(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !validDate(body.date)) return error('তারিখ ঠিক নেই', 400);
  const counted = Number(body.counted);
  if (body.counted === '' || body.counted === null || isNaN(counted) || counted < 0) {
    return error('গুনে পাওয়া ক্যাশের পরিমাণ দিন', 400);
  }

  const sql = getSql(context.env);

  // Re-doing a day: remove the old adjustment first so numbers stay correct
  const old = await sql`SELECT id FROM cash_reconciliations WHERE rec_date = ${body.date}::date`;
  if (old.length) {
    await sql`DELETE FROM cash_ledger WHERE ref_type = 'reconciliation' AND ref_id = ${old[0].id}`;
  }

  const c = await compute(sql, body.date);
  const difference = Math.round((counted - c.expected) * 100) / 100;

  let rec;
  if (old.length) {
    rec = await sql`
      UPDATE cash_reconciliations SET opening = ${c.opening}, income = ${c.income}, expenses = ${c.expenses},
             expected = ${c.expected}, counted = ${counted}, difference = ${difference},
             note = ${body.note || null}, created_at = NOW()
      WHERE id = ${old[0].id} RETURNING *`;
  } else {
    rec = await sql`
      INSERT INTO cash_reconciliations (rec_date, opening, income, expenses, expected, counted, difference, note)
      VALUES (${body.date}, ${c.opening}, ${c.income}, ${c.expenses}, ${c.expected}, ${counted}, ${difference}, ${body.note || null})
      RETURNING *`;
  }

  // Automatic Cash Adjustment entry for any difference (+ excess / - shortage)
  if (difference !== 0) {
    await ledger(sql, {
      account: 'cash', type: 'adjustment', amount: difference,
      refType: 'reconciliation', refId: rec[0].id, date: body.date,
      note: difference > 0 ? 'ক্যাশ অ্যাডজাস্টমেন্ট (বেশি)' : 'ক্যাশ অ্যাডজাস্টমেন্ট (কম)',
    });
  }

  return success({ ...c, counted, difference, adjusted: difference !== 0 }, 'দিনের ক্যাশ হিসাব মেলানো হয়েছে', 201);
}
