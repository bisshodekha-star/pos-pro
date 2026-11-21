-- ============================================================
--  POS Pro — PHASE 1 MIGRATION  (run ONCE in Neon SQL Editor)
--  Safe to re-run: every statement uses IF NOT EXISTS.
-- ============================================================

-- ---------- 1. Profit tracking (per invoice) ----------
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) NOT NULL DEFAULT 0;  -- unit cost at time of sale
ALTER TABLE sales      ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12,2) NOT NULL DEFAULT 0;  -- sum(qty x cost_price)
ALTER TABLE sales      ADD COLUMN IF NOT EXISTS net_profit NUMERIC(12,2) NOT NULL DEFAULT 0;  -- (total - vat) - total_cost

-- Back-fill OLD invoices using the product's current cost price
-- (only rows that are still 0, so new invoices are never overwritten)
UPDATE sale_items si
   SET cost_price = p.cost_price
  FROM products p
 WHERE si.product_id = p.id AND si.cost_price = 0;

UPDATE sales s
   SET total_cost = x.c
  FROM (SELECT sale_id, SUM(qty * cost_price) AS c FROM sale_items GROUP BY sale_id) x
 WHERE x.sale_id = s.id AND s.total_cost = 0;

UPDATE sales
   SET net_profit = total - COALESCE(vat, 0) - total_cost
 WHERE net_profit = 0 AND total > 0;

-- ---------- 2. Multi-account cashbook ----------
-- Which account an expense was paid from
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS account VARCHAR(10) NOT NULL DEFAULT 'cash';

-- One ledger for all 5 accounts. amount: + money in, - money out.
CREATE TABLE IF NOT EXISTS cash_ledger (
  id          SERIAL PRIMARY KEY,
  account     VARCHAR(10)  NOT NULL
              CHECK (account IN ('cash','bkash','nagad','rocket','bank')),
  entry_type  VARCHAR(20)  NOT NULL
              CHECK (entry_type IN ('opening','sale','sale_cancel','collection',
                                    'expense','transfer_in','transfer_out','adjustment')),
  amount      NUMERIC(12,2) NOT NULL,
  entry_date  DATE         NOT NULL DEFAULT ((NOW() AT TIME ZONE 'Asia/Dhaka')::date),
  ref_type    VARCHAR(20),
  ref_id      INTEGER,
  note        TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON cash_ledger(account);
CREATE INDEX IF NOT EXISTS idx_ledger_date    ON cash_ledger(entry_date DESC);

-- ---------- 3. Day-end cash reconciliation ----------
CREATE TABLE IF NOT EXISTS cash_reconciliations (
  id          SERIAL PRIMARY KEY,
  rec_date    DATE         UNIQUE NOT NULL,
  opening     NUMERIC(12,2) NOT NULL DEFAULT 0,
  income      NUMERIC(12,2) NOT NULL DEFAULT 0,
  expenses    NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected    NUMERIC(12,2) NOT NULL DEFAULT 0,
  counted     NUMERIC(12,2) NOT NULL DEFAULT 0,
  difference  NUMERIC(12,2) NOT NULL DEFAULT 0,   -- counted - expected
  note        TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ---------- 4. transactions.type allows 'sale_cancel' ----------
-- Old installs only allow ('sale','payment','collect','expense').
-- Add 'sale_cancel' so cancelSale can record a proper cancellation
-- instead of mislabelling it as an 'expense'.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('sale','sale_cancel','payment','collect','expense'));

-- ---------- 5. Invoice sequence (race-free invoice number generation) ----------
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1001;
