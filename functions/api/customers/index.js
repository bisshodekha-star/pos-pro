/**
 * GET  /api/customers  — list (supports ?q=search&due=1 for due-only)
 * POST /api/customers  — create
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestGet(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const dueOnly = url.searchParams.get('due') === '1';

  const sql = getSql(context.env);
  let rows;
  if (q) {
    rows = await sql`
      SELECT * FROM customers
      WHERE name ILIKE ${'%' + q + '%'} OR phone ILIKE ${'%' + q + '%'}
      ORDER BY name
    `;
  } else if (dueOnly) {
    rows = await sql`
      SELECT * FROM customers WHERE due > 0
      ORDER BY due DESC
    `;
  } else {
    rows = await sql`SELECT * FROM customers ORDER BY name`;
  }

  return success(rows);
}

export async function onRequestPost(context) {
  const { response } = await requireAuth(context);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !body.name) return error('নাম দিন', 400);

  const sql = getSql(context.env);
  const rows = await sql`
    INSERT INTO customers (name, phone, address)
    VALUES (${body.name}, ${body.phone || null}, ${body.address || null})
    RETURNING *
  `;

  return success(rows[0], 'কাস্টমার যোগ হয়েছে', 201);
}
