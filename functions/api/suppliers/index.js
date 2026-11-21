/**
 * GET  /api/suppliers  — list suppliers (supports ?q=search)
 * POST /api/suppliers  — create { name, phone, address, categories, balance }
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestGet(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim();

  const sql = getSql(context.env);
  let rows;
  if (q) {
    rows = await sql`
      SELECT * FROM suppliers
      WHERE name ILIKE ${'%' + q + '%'} OR phone ILIKE ${'%' + q + '%'}
      ORDER BY name
    `;
  } else {
    rows = await sql`SELECT * FROM suppliers ORDER BY name`;
  }

  const totalDue = rows.reduce((a, s) => a + Number(s.balance), 0);
  return success({ suppliers: rows, totalDue });
}

export async function onRequestPost(context) {
  const { response } = await requireAuth(context, ['admin', 'manager']);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !body.name) return error('নাম দিন', 400);

  const sql = getSql(context.env);
  const rows = await sql`
    INSERT INTO suppliers (name, phone, address, categories, balance)
    VALUES (${body.name}, ${body.phone || null}, ${body.address || null},
            ${body.categories || null}, ${Number(body.balance) || 0})
    RETURNING *
  `;

  return success(rows[0], 'সাপ্লায়ার যোগ হয়েছে', 201);
}
