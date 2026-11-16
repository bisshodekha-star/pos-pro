/**
 * POST /api/seed   — load demo data (products, customers, suppliers, expenses, some sales)
 * POST /api/seed?reset=1  — wipe & reload (admin only)
 *
 * Useful for client demos. Safe to call multiple times (uses ON CONFLICT).
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestPost(context) {
  const { user, response } = await requireAuth(context, ['admin', 'manager']);
  if (response) return response;

  const sql = getSql(context.env);
  const url = new URL(context.request.url);
  const reset = url.searchParams.get('reset') === '1';

  if (reset) {
    await sql`DELETE FROM sale_items`;
    await sql`DELETE FROM transactions`;
    await sql`DELETE FROM returns`;
    await sql`DELETE FROM sales`;
    await sql`DELETE FROM expenses`;
    await sql`DELETE FROM customers`;
    await sql`DELETE FROM suppliers`;
    await sql`DELETE FROM products WHERE barcode LIKE '89%'`;
  }

  // ---- Products ----
  const products = [
    { barcode: '8901001', name: 'ফর্মাল শার্ট', category: 'শার্ট', size: 'L',  cost: 1000, sell: 1500, stock: 45, emoji: '👔' },
    { barcode: '8901002', name: 'জিন্স প্যান্ট', category: 'প্যান্ট', size: '32', cost: 1100, sell: 1650, stock: 30, emoji: '👖' },
    { barcode: '8901003', name: 'কটন পাঞ্জাবি', category: 'পাঞ্জাবি', size: 'L', cost: 1250, sell: 1850, stock: 22, emoji: '🧥' },
    { barcode: '8901004', name: 'কাতান শাড়ি',   category: 'শাড়ি', size: 'ফ্রি', cost: 2300, sell: 3200, stock: 12, emoji: '🥻' },
    { barcode: '8901005', name: 'থ্রি-পিস (আনস্টিচ)', category: 'থ্রি-পিস', size: 'ফ্রি', cost: 1700, sell: 2400, stock: 18, emoji: '👗' },
    { barcode: '8901006', name: 'বাচ্চাদের টি-শার্ট', category: 'বাচ্চাদের', size: '৮-১০', cost: 290, sell: 450, stock: 60, emoji: '👕' },
    { barcode: '8901007', name: 'পোলো টি-শার্ট', category: 'শার্ট', size: 'XL', cost: 420, sell: 650, stock: 8,  emoji: '👕' },
    { barcode: '8901008', name: 'লুঙ্গি (গার্মেন্টস)', category: 'লুঙ্গি', size: 'ফ্রি', cost: 350, sell: 550, stock: 25, emoji: '🩳' },
    { barcode: '8901009', name: 'নারীদের কুর্তি', category: 'কুর্তি', size: 'M', cost: 480, sell: 750, stock: 35, emoji: '👚' },
    { barcode: '8901010', name: 'শীতের জ্যাকেট', category: 'জ্যাকেট', size: 'L', cost: 1800, sell: 2600, stock: 15, emoji: '🧥' },
    { barcode: '8901011', name: 'টাই (সিল্ক)', category: 'টাই', size: 'ফ্রি', cost: 120, sell: 250, stock: 40, emoji: '👔' },
    { barcode: '8901012', name: 'বেল্ট (চামড়া)', category: 'বেল্ট', size: 'ফ্রি', cost: 180, sell: 350, stock: 5, emoji: '🩹' },
  ];

  for (const p of products) {
    await sql`
      INSERT INTO products (barcode, name, category, size, cost_price, sell_price, stock, low_stock, emoji, active)
      VALUES (${p.barcode}, ${p.name}, ${p.category}, ${p.size}, ${p.cost}, ${p.sell}, ${p.stock}, 20, ${p.emoji}, true)
      ON CONFLICT (barcode) DO UPDATE SET
        name = EXCLUDED.name, sell_price = EXCLUDED.sell_price, stock = EXCLUDED.stock
    `;
  }

  // ---- Customers ----
  const customers = [
    { name: 'রহিম মিয়া', phone: '01712345678', address: 'মিরপুর, ঢাকা' },
    { name: 'করিম আলী', phone: '01811223344', address: 'মোহাম্মদপুর, ঢাকা' },
    { name: 'সালমা বেগম', phone: '01955667788', address: 'গুলশান, ঢাকা' },
    { name: 'জামাল হোসেন', phone: '01819876543', address: 'উত্তরা, ঢাকা' },
    { name: 'নাসিমা খাতুন', phone: '01733445566', address: 'বনানী, ঢাকা' },
    { name: 'ফারুক আহমেদ', phone: '01612345678', address: 'ধানমন্ডি, ঢাকা' },
    { name: 'তানিয়া ইসলাম', phone: '01512345678', address: 'মিরপুর, ঢাকা' },
  ];

  for (const c of customers) {
    await sql`
      INSERT INTO customers (name, phone, address)
      VALUES (${c.name}, ${c.phone}, ${c.address})
      ON CONFLICT DO NOTHING
    `;
  }

  // Set some dues on customers
  await sql`
    UPDATE customers SET due = 260, updated_at = NOW() WHERE phone = '01712345678' AND due = 0
  `;
  await sql`
    UPDATE customers SET due = 190, updated_at = NOW() WHERE phone = '01819876543' AND due = 0
  `;
  await sql`
    UPDATE customers SET due = 95, updated_at = NOW() WHERE phone = '01733445566' AND due = 0
  `;

  // ---- Suppliers ----
  const suppliers = [
    { name: 'ঢাকা গার্মেন্টস', phone: '02-1234567', categories: 'শার্ট, প্যান্ট', balance: 22000 },
    { name: 'ইসলামপুর কাপড় হাউজ', phone: '02-7654321', categories: 'শাড়ি, থ্রি-পিস', balance: 18500 },
    { name: 'নিউ ফ্যাশন', phone: '02-9876543', categories: 'পাঞ্জাবি, টি-শার্ট', balance: 9000 },
  ];

  for (const s of suppliers) {
    await sql`
      INSERT INTO suppliers (name, phone, categories, balance)
      VALUES (${s.name}, ${s.phone}, ${s.categories}, ${s.balance})
      ON CONFLICT DO NOTHING
    `;
  }

  // ---- Expenses ----
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const expenses = [
    { category: 'ভাড়া', description: 'দোকান ভাড়া', amount: 5000, date: today },
    { category: 'বিল', description: 'বিদ্যুৎ বিল', amount: 1250, date: yesterday },
    { category: 'নাস্তা', description: 'চায়ের দোকান', amount: 280, date: today },
  ];
  for (const e of expenses) {
    await sql`
      INSERT INTO expenses (category, description, amount, expense_date, created_by)
      VALUES (${e.category}, ${e.description}, ${e.amount}, ${e.date}, ${parseInt(user.sub)})
    `;
  }

  // ---- Some recent sales (last 3 days) ----
  const settingsRows = await sql`SELECT value FROM settings WHERE key = 'invoice_prefix'`;
  const prefix = settingsRows[0]?.value || 'INV-';

  const salesToInsert = [
    { daysAgo: 0, items: [['8901001', 1]], cust: 'রহিম মিয়া', paid: 1500 },
    { daysAgo: 0, items: [['8901003', 1], ['8901006', 2]], cust: 'সালমা বেগম', paid: 2600 },
    { daysAgo: 0, items: [['8901004', 1]], cust: 'তানিয়া ইসলাম', paid: 3200 },
    { daysAgo: 1, items: [['8901002', 1]], cust: 'করিম আলী', paid: 1650 },
    { daysAgo: 1, items: [['8901005', 1]], cust: null, paid: 2400 },
    { daysAgo: 2, items: [['8901001', 2], ['8901007', 1]], cust: 'ফারুক আহমেদ', paid: 3600 },
  ];

  let invNum = 1001;
  for (const s of salesToInsert) {
    const date = new Date(Date.now() - s.daysAgo * 86400000);
    date.setHours(10 + invNum % 8, 30, 0, 0);
    const invNo = prefix + String(invNum++).padStart(4, '0');

    let subtotal = 0;
    const itemsData = [];
    for (const [code, qty] of s.items) {
      const prods = await sql`SELECT id, name, sell_price FROM products WHERE barcode = ${code}`;
      if (prods.length === 0) continue;
      const p = prods[0];
      const lt = Number(p.sell_price) * qty;
      subtotal += lt;
      itemsData.push({ product_id: p.id, product_name: p.name, barcode: code, qty, unit_price: Number(p.sell_price), total: lt });
    }
    if (itemsData.length === 0) continue;

    const paid = s.paid;
    const due = Math.max(0, subtotal - paid);
    const custRow = s.cust ? await sql`SELECT id FROM customers WHERE name = ${s.cust} LIMIT 1` : [];
    const customerId = custRow.length > 0 ? custRow[0].id : null;

    const inserted = await sql`
      INSERT INTO sales (invoice_no, customer_id, customer_name, cashier_id, cashier_name,
                        subtotal, item_discount, bill_discount, vat, total, paid, due, change_given,
                        payment_method, status, completed_at)
      VALUES (${invNo}, ${customerId}, ${s.cust}, ${parseInt(user.sub)}, ${user.name},
              ${subtotal}, 0, 0, 0, ${subtotal}, ${paid}, ${due}, ${Math.max(0, paid - subtotal)},
              'cash', 'completed', ${date.toISOString()})
      RETURNING id
    `;

    for (const it of itemsData) {
      await sql`
        INSERT INTO sale_items (sale_id, product_id, product_name, barcode, qty, unit_price, discount, total)
        VALUES (${inserted[0].id}, ${it.product_id}, ${it.product_name}, ${it.barcode},
                ${it.qty}, ${it.unit_price}, 0, ${it.total})
      `;
      // Reduce stock
      await sql`UPDATE products SET stock = GREATEST(0, stock - ${it.qty}) WHERE id = ${it.product_id}`;
    }

    if (customerId) {
      await sql`
        UPDATE customers SET
          total_purchase = total_purchase + ${subtotal},
          due = due + ${due},
          bills_count = bills_count + 1
        WHERE id = ${customerId}
      `;
    }
  }

  const prodCount = await sql`SELECT COUNT(*)::int AS c FROM products WHERE active = true`;
  const custCount = await sql`SELECT COUNT(*)::int AS c FROM customers`;
  const saleCount = await sql`SELECT COUNT(*)::int AS c FROM sales WHERE status = 'completed'`;

  return success({
    products: prodCount[0].c,
    customers: custCount[0].c,
    sales: saleCount[0].c,
  }, 'ডেমো ডাটা লোড হয়েছে', 201);
}
