/**
 * accounts.js — the 5 cashbook accounts + cash ledger helpers
 */
export const ACCOUNTS = ['cash', 'bkash', 'nagad', 'rocket', 'bank'];

/** Map a payment method (as used on bills) to a cashbook account */
export function accountOf(method) {
  const m = String(method || 'cash').toLowerCase();
  if (m === 'card') return 'bank';          // card payments settle into the bank
  return ACCOUNTS.includes(m) ? m : 'cash';
}

/** Validate an account name coming from the client (falls back to cash) */
export function cleanAccount(a) {
  const x = String(a || 'cash').toLowerCase();
  return ACCOUNTS.includes(x) ? x : 'cash';
}

/**
 * Add one entry to the cash ledger. amount: + in, - out.
 * Never throws — a ledger problem must not break a sale/expense that already succeeded.
 */
export async function ledger(sql, { account, type, amount, refType = null, refId = null, note = null, date = null }) {
  const amt = Math.round((Number(amount) || 0) * 100) / 100;
  if (!amt) return;
  try {
    if (date) {
      await sql`INSERT INTO cash_ledger (account, entry_type, amount, entry_date, ref_type, ref_id, note)
                VALUES (${account}, ${type}, ${amt}, ${date}, ${refType}, ${refId}, ${note})`;
    } else {
      await sql`INSERT INTO cash_ledger (account, entry_type, amount, ref_type, ref_id, note)
                VALUES (${account}, ${type}, ${amt}, ${refType}, ${refId}, ${note})`;
    }
  } catch (e) {
    console.error('ledger insert failed', e.message);
  }
}
