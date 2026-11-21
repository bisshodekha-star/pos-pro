/**
 * GET  /api/cashbook            — balance of every account + recent ledger entries
 *        ?account=cash|bkash|nagad|rocket|bank   (filter the entries list)
 * POST /api/cashbook
 *        { action: 'opening',  account, amount }                 set the opening balance of an account
 *        { action: 'transfer', from, to, amount, note? }         move money between two accounts
 *
 * Balance of an account = sum of all its ledger entries (+ in, - out).
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { error, success, parseBody } from '../../_shared/response.js';
import { ACCOUNTS, ledger } from '../../_shared/accounts.js';

export async function onRequestGet(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const sql = getSql(context.env);
  const url = new URL(context.request.url);
  const filter = url.searchParams.get('account');

  const balRows = await sql`
    SELECT account, COALESCE(SUM(amount), 0)::numeric AS balance
    FROM cash_ledger GROUP BY account
  `;
  const balances = Object.fromEntries(ACCOUNTS.map(a => [a, 0]));
  balRows.forEach(r => { balances[r.account] = Number(r.balance); });

  const entries = ACCOUNTS.includes(filter)
    ? await sql`
        SELECT id, account, entry_type, amount, entry_date::text AS entry_date, note, created_at::text AS created_at
        FROM cash_ledger WHERE account = ${filter} ORDER BY id DESC LIMIT 60`
    : await sql`
        SELECT id, account, entry_type, amount, entry_date::text AS entry_date, note, created_at::text AS created_at
        FROM cash_ledger ORDER BY id DESC LIMIT 60`;

  const total = Object.values(balances).reduce((a, b) => a + b, 0);
  return success({
    balances,
    total,
    entries: entries.map(e => ({ ...e, amount: Number(e.amount) })),
  });
}

export async function onRequestPost(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !body.action) return error('action দিন', 400);
  const sql = getSql(context.env);

  if (body.action === 'opening') {
    if (!ACCOUNTS.includes(body.account)) return error('অ্যাকাউন্ট ঠিক নেই', 400);
    const amount = Number(body.amount);
    if (isNaN(amount) || amount < 0) return error('সঠিক টাকার পরিমাণ দিন', 400);
    // one opening balance per account: replace the old one
    await sql`DELETE FROM cash_ledger WHERE account = ${body.account} AND entry_type = 'opening'`;
    await ledger(sql, { account: body.account, type: 'opening', amount, note: 'ওপেনিং ব্যালেন্স' });
    return success({ account: body.account, amount }, 'ওপেনিং ব্যালেন্স সেভ হয়েছে');
  }

  if (body.action === 'transfer') {
    const { from, to } = body;
    const amount = Number(body.amount);
    if (!ACCOUNTS.includes(from) || !ACCOUNTS.includes(to)) return error('অ্যাকাউন্ট ঠিক নেই', 400);
    if (from === to) return error('একই অ্যাকাউন্টে ট্রান্সফার হয় না', 400);
    if (!(amount > 0)) return error('টাকার পরিমাণ দিন', 400);
    const note = body.note || '';
    await ledger(sql, { account: from, type: 'transfer_out', amount: -amount, refType: 'transfer', note: `→ ${to}${note ? ' · ' + note : ''}` });
    await ledger(sql, { account: to, type: 'transfer_in', amount, refType: 'transfer', note: `← ${from}${note ? ' · ' + note : ''}` });
    return success({ from, to, amount }, 'ট্রান্সফার হয়েছে', 201);
  }

  return error('অজানা action', 400);
}
