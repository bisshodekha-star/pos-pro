/**
 * POST /api/reset   — wipe ALL data and reset to defaults
 * Body: { confirm: true }
 *
 * Admin-only. Wipes every business-data table including cash_ledger
 * (a previous bug left cash_ledger untouched, so balances survived reset).
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestPost(context) {
  const { response } = await requireAuth(context, ['admin']);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !body.confirm) {
    return error('নিশ্চিত করতে confirm: true পাঠান', 400);
  }

  const sql = getSql(context.env);

  // Delete all data in correct order (respecting foreign keys)
  await sql`DELETE FROM sale_items`;
  await sql`DELETE FROM transactions`;
  await sql`DELETE FROM returns`;
  await sql`DELETE FROM cash_reconciliations`;
  await sql`DELETE FROM cash_ledger`;
  await sql`DELETE FROM sales`;
  await sql`DELETE FROM expenses`;
  await sql`DELETE FROM shifts`;
  await sql`DELETE FROM customers`;
  await sql`DELETE FROM suppliers`;
  await sql`DELETE FROM products`;

  // Reset settings to defaults (but keep password hashes)
  const savedProductsHash = await sql`SELECT value FROM settings WHERE key = 'products_password_hash'`;
  const savedProductsSalt = await sql`SELECT value FROM settings WHERE key = 'products_password_salt'`;
  const savedResetHash = await sql`SELECT value FROM settings WHERE key = 'reset_password_hash'`;
  const savedResetSalt = await sql`SELECT value FROM settings WHERE key = 'reset_password_salt'`;
  await sql`DELETE FROM settings`;
  await sql`
    INSERT INTO settings (key, value) VALUES
      ('shop_name',         'রহমান ফ্যাশন শোরুম'),
      ('shop_address',      ''),
      ('shop_phone',        ''),
      ('shop_phone2',       ''),
      ('shop_email',        ''),
      ('shop_logo',         ''),
      ('receipt_header',    'আপনার বিশ্বাসই আমাদের সম্পদ'),
      ('receipt_footer',    '3 দিনের মধ্যে রিটার্ন গ্রহণযোগ্য (বিলসহ)'),
      ('printer_size',      '80'),
      ('print_logo',        'true'),
      ('vat_percent',       '0'),
      ('sd_percent',        '0'),
      ('round_off',         'false'),
      ('invoice_prefix',    'INV-'),
      ('invoice_start',     '1001'),
      ('invoice_padding',   '4'),
      ('low_stock_default', '20'),
      ('currency',          '৳'),
      ('bkash_number',      ''),
      ('nagad_number',      ''),
      ('rocket_number',     ''),
      ('payment_methods',   'cash,bkash,nagad'),
      ('max_discount_cashier','10'),
      ('session_timeout_min','30'),
      ('allow_hold_bill',   'true')
  `;
  // Restore password hashes
  if (savedProductsHash.length > 0 && savedProductsHash[0].value) {
    await sql`INSERT INTO settings (key, value) VALUES ('products_password_hash', ${savedProductsHash[0].value})`;
    if (savedProductsSalt.length > 0 && savedProductsSalt[0].value) {
      await sql`INSERT INTO settings (key, value) VALUES ('products_password_salt', ${savedProductsSalt[0].value})`;
    }
  }
  if (savedResetHash.length > 0 && savedResetHash[0].value) {
    await sql`INSERT INTO settings (key, value) VALUES ('reset_password_hash', ${savedResetHash[0].value})`;
    if (savedResetSalt.length > 0 && savedResetSalt[0].value) {
      await sql`INSERT INTO settings (key, value) VALUES ('reset_password_salt', ${savedResetSalt[0].value})`;
    }
  }

  // Reset invoice sequence to start fresh
  try { await sql`SELECT setval('invoice_seq', 1000, false)`; } catch {}

  return success({ reset: true }, 'সম্পূর্ণ সফটওয়্যার রিসেট হয়েছে');
}
