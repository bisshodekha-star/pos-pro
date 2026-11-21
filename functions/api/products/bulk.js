/**
 * POST /api/products/bulk   — bulk insert/update products from Excel upload
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestPost(context) {
  const { user, response } = await requireAuth(context);
  if (response) return response;

  const body = await parseBody(context.request);
  if (!body || !Array.isArray(body.products) || body.products.length === 0) {
    return error('products অ্যারে দিন (অন্তত একটি পণ্য)', 400);
  }

  const sql = getSql(context.env);
  let inserted = 0, updated = 0, skipped = 0;
  const errors = [];

  for (let i = 0; i < body.products.length; i++) {
    const p = body.products[i];

    if (!p.name || !p.barcode) {
      skipped++;
      errors.push(`সারি ${i + 2}: নাম বা বারকোড নেই`);
      continue;
    }

    // Convert to numbers — handle string, number, Bengali numerals
    const sellPrice = parseFloat(String(p.sell_price).replace(/[^\d.-]/g, '')) || 0;
    if (sellPrice <= 0) {
      skipped++;
      errors.push(`সারি ${i + 2}: বিক্রি দাম সঠিক নয় (${p.name})`);
      continue;
    }

    const costPrice = parseFloat(String(p.cost_price).replace(/[^\d.-]/g, '')) || 0;
    const stock = parseInt(String(p.stock).replace(/[^\d-]/g, '')) || 0;
    const lowStock = parseInt(String(p.alert_qty || p.low_stock).replace(/[^\d-]/g, '')) || 20;

    const barcode = String(p.barcode).trim();
    const name = String(p.name).trim();
    const category = String(p.category || 'অন্যান্য').trim();
    const size = p.size ? String(p.size).trim() : null;
    const unit = String(p.unit || 'pcs').trim();
    const emoji = p.emoji || '👕';

    try {
      // Check if barcode exists
      const existing = await sql`SELECT id FROM products WHERE barcode = ${barcode}`;
      if (existing.length > 0) {
        // Update — send values as STRINGS
        await sql`
          UPDATE products SET
            name = ${name},
            category = ${category},
            size = ${size},
            cost_price = ${String(costPrice.toFixed(2))},
            sell_price = ${String(sellPrice.toFixed(2))},
            stock = ${String(stock)},
            unit = ${unit},
            low_stock = ${String(lowStock)},
            emoji = ${emoji},
            active = true,
            updated_at = NOW()
          WHERE barcode = ${barcode}
        `;
        updated++;
      } else {
        // Insert — send values as STRINGS
        await sql`
          INSERT INTO products (barcode, name, category, size, cost_price, sell_price, stock, unit, low_stock, emoji, active)
          VALUES (
            ${barcode},
            ${name},
            ${category},
            ${size},
            ${String(costPrice.toFixed(2))},
            ${String(sellPrice.toFixed(2))},
            ${String(stock)},
            ${unit},
            ${String(lowStock)},
            ${emoji},
            true
          )
        `;
        inserted++;
      }
    } catch (e) {
      skipped++;
      errors.push(`সারি ${i + 2}: ${e.message} (${p.name})`);
    }
  }

  return success(
    { inserted, updated, skipped, total: body.products.length, errors: errors.slice(0, 20) },
    `${inserted}টি নতুন, ${updated}টি আপডেট, ${skipped}টি বাদ` + (errors.length > 20 ? ` (${errors.length - 20}টি আরও error)` : ''),
    201
  );
}
