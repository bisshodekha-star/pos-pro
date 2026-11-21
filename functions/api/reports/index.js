/**
 * GET /api/reports?type=dashboard|sales|profit
 *
 * dashboard: today's sales, bills count, total due, total sales, low stock, top products, category breakdown
 * sales:     date-range sales summary
 * profit:    profit/loss for a date range
 */
import { getSql } from '../../_shared/db.js';
import { requireAuth } from '../../_shared/auth.js';
import { json, error, success, parseBody } from '../../_shared/response.js';

export async function onRequestGet(context) {
  const { user, response } = await requireAuth(context);
  if (response) return response;

  const url = new URL(context.request.url);
  const type = url.searchParams.get('type') || 'dashboard';
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const sql = getSql(context.env);

  if (type === 'dashboard') {
    // Today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todaySales = await sql`
      SELECT COALESCE(SUM(total), 0)::numeric AS total, COUNT(*)::int AS bills
      FROM sales WHERE status = 'completed' AND completed_at >= ${todayStart.toISOString()} AND completed_at <= ${todayEnd.toISOString()}
    `;

    const totalDueRow = await sql`SELECT COALESCE(SUM(due), 0)::numeric AS total, COUNT(*)::int AS count FROM customers WHERE due > 0`;

    const totalSalesRow = await sql`SELECT COALESCE(SUM(total), 0)::numeric AS total FROM sales WHERE status = 'completed'`;

    const lowStock = await sql`SELECT id, name, stock, low_stock, emoji, category FROM products WHERE active = true AND stock <= low_stock ORDER BY stock ASC`;

    const topProducts = await sql`
      SELECT si.product_name, SUM(si.qty)::int AS qty, SUM(si.total)::numeric AS revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed'
      GROUP BY si.product_name
      ORDER BY revenue DESC
      LIMIT 5
    `;

    // Product breakdown (top 8 products + "অন্যান্য")
    const prodBreakdown = await sql`
      SELECT si.product_name AS name, SUM(si.total)::numeric AS revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed'
      GROUP BY si.product_name
      ORDER BY revenue DESC
    `;

    return success({
      todaySales: Number(todaySales[0].total),
      todayBills: todaySales[0].bills,
      totalDue: Number(totalDueRow[0].total),
      dueCount: totalDueRow[0].count,
      totalSales: Number(totalSalesRow[0].total),
      lowStock,
      topProducts,
      productBreakdown: prodBreakdown,
    });
  }

  if (type === 'sales') {
    const f = from || new Date().toISOString().slice(0, 10);
    const t = to || new Date().toISOString().slice(0, 10);
    const rows = await sql`
      SELECT DATE(completed_at) AS day,
             COUNT(*)::int AS bills,
             SUM(total)::numeric AS sales,
             SUM(due)::numeric AS due
      FROM sales
      WHERE status = 'completed'
        AND completed_at >= ${f}
        AND completed_at < ${t}::date + 1
      GROUP BY DATE(completed_at)
      ORDER BY day DESC
    `;
    const summary = rows.reduce((a, r) => ({
      bills: a.bills + r.bills,
      sales: a.sales + Number(r.sales),
      due: a.due + Number(r.due),
    }), { bills: 0, sales: 0, due: 0 });
    return success({ daily: rows, summary });
  }

  if (type === 'profit') {
    // Profit figures are private to the admin
    if (user.role !== 'admin') return error('এই কাজের অনুমতি নেই', 403);

    const f = from || new Date().toISOString().slice(0, 10);
    const t = to || new Date().toISOString().slice(0, 10);

    // Sales, VAT and COGS come from the invoices themselves (cost was frozen at sale time)
    const salesRow = await sql`
      SELECT COALESCE(SUM(total), 0)::numeric      AS revenue,
             COALESCE(SUM(vat), 0)::numeric        AS vat,
             COALESCE(SUM(total_cost), 0)::numeric AS cogs,
             COUNT(*)::int                         AS bills
      FROM sales
      WHERE status = 'completed'
        AND completed_at >= ${f} AND completed_at < ${t}::date + 1
    `;

    // Operating expenses (rent, salary, bills ...) — grouped by category
    const expRows = await sql`
      SELECT category, COALESCE(SUM(amount), 0)::numeric AS amount
      FROM expenses
      WHERE expense_date >= ${f} AND expense_date <= ${t}
      GROUP BY category
      ORDER BY amount DESC
    `;

    const revenue = Number(salesRow[0].revenue);            // total sales (VAT included)
    const vat = Number(salesRow[0].vat);                    // VAT collected (not ours)
    const netSales = revenue - vat;                         // sales without VAT
    const cogs = Number(salesRow[0].cogs);
    const grossProfit = netSales - cogs;
    const expenseList = expRows.map(r => ({ category: r.category, amount: Number(r.amount) }));
    const expenses = expenseList.reduce((a, r) => a + r.amount, 0);
    const netProfit = grossProfit - expenses;
    const margin = netSales > 0 ? Math.round(netProfit / netSales * 10000) / 100 : 0;
    const grossMargin = netSales > 0 ? Math.round(grossProfit / netSales * 10000) / 100 : 0;

    return success({
      bills: salesRow[0].bills,
      revenue, vat, netSales, cogs, grossProfit, grossMargin,
      expenses, expenseList, netProfit, margin,
    });
  }

  return error('অজানা রিপোর্ট টাইপ', 400);
}
