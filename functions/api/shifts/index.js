/**
 * GET  /api/shifts   — list shifts (current first)
 *   ?current=1  → only the open shift for current user
 * POST /api/shifts   — open or close a shift
 *   Body: { action: 'open'|'close', opening_cash?, closing_cash?, note? }
 *
 * NOTE: This is a single-password system (no real user IDs).
 * All shifts are tracked under user_id IS NULL.
 * SQL NULL semantics: `user_id = NULL` is never true — must use `IS NULL`.
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestGet(context) {
  const { user, response } = await requireAuth(context);
  if (response) return response;

  const sql = getSql(context.env);
  const url = new URL(context.request.url);

  if (url.searchParams.get('current') === '1') {
    const rows = await sql`
      SELECT * FROM shifts
      WHERE user_id IS NULL AND status = 'open'
      ORDER BY opened_at DESC LIMIT 1
    `;
    return success(rows[0] || null);
  }

  const rows = await sql`
    SELECT * FROM shifts ORDER BY opened_at DESC LIMIT 50
  `;
  return success(rows);
}

export async function onRequestPost(context) {
  const { user, response } = await requireAuth(context);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !body.action) return error('action দিন (open বা close)', 400);

  const sql = getSql(context.env);

  if (body.action === 'open') {
    // Check if already has an open shift (single-user system)
    const open = await sql`
      SELECT id FROM shifts
      WHERE user_id IS NULL AND status = 'open'
    `;
    if (open.length > 0) {
      return error('আপনার ইতিমধ্যে একটি খোলা শিফট আছে', 400);
    }

    const rows = await sql`
      INSERT INTO shifts (user_id, user_name, opening_cash)
      VALUES (NULL, ${body.user_name || 'ক্যাশিয়ার'}, ${Number(body.opening_cash) || 0})
      RETURNING *
    `;
    return success(rows[0], 'শিফট খোলা হয়েছে', 201);
  }

  if (body.action === 'close') {
    const open = await sql`
      SELECT * FROM shifts
      WHERE user_id IS NULL AND status = 'open'
      ORDER BY opened_at DESC LIMIT 1
    `;
    if (open.length === 0) {
      return error('কোনো খোলা শিফট নেই', 400);
    }

    const shift = open[0];
    // Compute cash sales since shift opened (single-user system)
    const cashRow = await sql`
      SELECT COALESCE(SUM(total - due), 0)::numeric AS cash_sales
      FROM sales
      WHERE cashier_id IS NULL
        AND status = 'completed'
        AND completed_at >= ${shift.opened_at}
        AND payment_method = 'cash'
    `;

    const expRow = await sql`
      SELECT COALESCE(SUM(amount), 0)::numeric AS expenses
      FROM expenses
      WHERE created_by IS NULL
        AND created_at >= ${shift.opened_at}
    `;

    const closingCash = Number(body.closing_cash) || (
      Number(shift.opening_cash) + Number(cashRow[0].cash_sales) - Number(expRow[0].expenses)
    );

    const rows = await sql`
      UPDATE shifts SET
        status = 'closed',
        closing_cash = ${closingCash},
        cash_sales = ${Number(cashRow[0].cash_sales)},
        expenses = ${Number(expRow[0].expenses)},
        closed_at = NOW(),
        note = ${body.note || null}
      WHERE id = ${shift.id}
      RETURNING *
    `;

    return success(rows[0], 'শিফট বন্ধ হয়েছে');
  }

  return error('অজানা action', 400);
}
