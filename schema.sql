-- ============================================================
--  POS Pro — Neon PostgreSQL Schema
--  Clothing Showroom POS (Bangladesh)
--  Run this in your Neon SQL Editor (one time setup)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
--  USERS (Admin / Manager / Cashier)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  username        VARCHAR(50)  UNIQUE NOT NULL,
  password_hash   TEXT         NOT NULL,   -- PBKDF2 hash
  password_salt   TEXT         NOT NULL,
  role            VARCHAR(20)  NOT NULL DEFAULT 'cashier'
                              CHECK (role IN ('admin','manager','cashier')),
  phone           VARCHAR(20),
  active          BOOLEAN      DEFAULT true,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
--  SHOP SETTINGS (key-value)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key             VARCHAR(60)  PRIMARY KEY,
  value           TEXT,
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
--  PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id              SERIAL PRIMARY KEY,
  barcode         VARCHAR(50)  UNIQUE NOT NULL,
  name            VARCHAR(200) NOT NULL,
  category        VARCHAR(50)  NOT NULL,
  size            VARCHAR(20),
  cost_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  sell_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock           INTEGER      NOT NULL DEFAULT 0,
  unit            VARCHAR(20)  NOT NULL DEFAULT 'pcs',
  low_stock       INTEGER      NOT NULL DEFAULT 20,
  emoji           VARCHAR(10)  DEFAULT '👕',
  active          BOOLEAN      DEFAULT true,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
--  CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  phone           VARCHAR(20),
  address         TEXT,
  due             NUMERIC(12,2) DEFAULT 0,
  total_purchase  NUMERIC(12,2) DEFAULT 0,
  bills_count     INTEGER      DEFAULT 0,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
--  SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  phone           VARCHAR(20),
  address         TEXT,
  categories      VARCHAR(200),
  balance         NUMERIC(12,2) DEFAULT 0,   -- we owe them
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
--  SALES (Bills / Invoices)
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id              SERIAL PRIMARY KEY,
  invoice_no      VARCHAR(30)  UNIQUE NOT NULL,
  customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name   VARCHAR(100),
  customer_phone  VARCHAR(20),
  cashier_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  cashier_name    VARCHAR(100),
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  item_discount   NUMERIC(12,2) DEFAULT 0,
  bill_discount   NUMERIC(12,2) DEFAULT 0,
  vat             NUMERIC(12,2) DEFAULT 0,
  sd              NUMERIC(12,2) DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid            NUMERIC(12,2) DEFAULT 0,
  due             NUMERIC(12,2) DEFAULT 0,
  change_given    NUMERIC(12,2) DEFAULT 0,
  payment_method  VARCHAR(20)  DEFAULT 'cash',
  total_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,  -- sum(qty x cost_price)
  net_profit      NUMERIC(12,2) NOT NULL DEFAULT 0,  -- (total - vat) - total_cost
  status          VARCHAR(20)  DEFAULT 'completed'
                              CHECK (status IN ('completed','held','cancelled')),
  note            TEXT,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ
);

-- ============================================================
--  SALE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_items (
  id              SERIAL PRIMARY KEY,
  sale_id         INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  product_id      INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name    VARCHAR(200),
  barcode         VARCHAR(50),
  qty             INTEGER      NOT NULL,
  unit_price      NUMERIC(12,2) NOT NULL,
  discount        NUMERIC(12,2) DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL,
  cost_price      NUMERIC(12,2) NOT NULL DEFAULT 0   -- unit cost at time of sale
);

-- ============================================================
--  TRANSACTIONS (Khata payments / collections / cancellations)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name   VARCHAR(100),
  type            VARCHAR(20)  NOT NULL
                              CHECK (type IN ('sale','sale_cancel','payment','collect','expense')),
  amount          NUMERIC(12,2) NOT NULL,
  sale_id         INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
--  EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id              SERIAL PRIMARY KEY,
  category        VARCHAR(50)  NOT NULL,
  description     VARCHAR(200),
  amount          NUMERIC(12,2) NOT NULL,
  expense_date    DATE         NOT NULL DEFAULT CURRENT_DATE,
  account         VARCHAR(10)  NOT NULL DEFAULT 'cash',   -- cash | bkash | nagad | rocket | bank
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
--  CASHIER SHIFTS
-- ============================================================
CREATE TABLE IF NOT EXISTS shifts (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name       VARCHAR(100),
  opening_cash    NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_cash    NUMERIC(12,2),
  cash_sales      NUMERIC(12,2) DEFAULT 0,
  cash_in         NUMERIC(12,2) DEFAULT 0,
  cash_out        NUMERIC(12,2) DEFAULT 0,
  expenses        NUMERIC(12,2) DEFAULT 0,
  status          VARCHAR(20)  DEFAULT 'open'
                              CHECK (status IN ('open','closed')),
  opened_at       TIMESTAMPTZ  DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  note            TEXT
);

-- ============================================================
--  CASH LEDGER (Cash / bKash / Nagad / Rocket / Bank)
--  amount: + money in, - money out
-- ============================================================
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

-- ============================================================
--  DAY-END CASH RECONCILIATION
-- ============================================================
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

-- ============================================================
--  RETURNS
-- ============================================================
CREATE TABLE IF NOT EXISTS returns (
  id              SERIAL PRIMARY KEY,
  sale_id         INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  invoice_no      VARCHAR(30),
  product_id      INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name    VARCHAR(200),
  qty             INTEGER      NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  reason          VARCHAR(200),
  processed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  processed_name  VARCHAR(100),
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
--  INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_barcode   ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active    ON products(active);
CREATE INDEX IF NOT EXISTS idx_customers_phone    ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_sales_customer     ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created      ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status       ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale    ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cust  ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date  ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date      ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_status      ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_ledger_account     ON cash_ledger(account);
CREATE INDEX IF NOT EXISTS idx_ledger_date        ON cash_ledger(entry_date DESC);

-- ============================================================
--  INVOICE NUMBER SEQUENCE (race-free generation)
--  Sales POST calls nextval('invoice_seq') — never produces
--  duplicates, even under concurrent requests.
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1001;

-- ============================================================
--  DEFAULT SETTINGS
-- ============================================================
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
ON CONFLICT (key) DO NOTHING;

-- ============================================================
--  DEFAULT ADMIN USER
--  The admin user is created automatically via POST /api/setup
--  (or the "প্রথমবার সেটআপ" button on the login screen).
--  Default credentials:
--     Username: admin
--     Password: admin123   (CHANGE IMMEDIATELY after first login!)
-- ============================================================

-- ============================================================
--  DONE.
--  Next steps:
--   1. Open the app → click "প্রথমবার সেটআপ" on login screen
--      (this creates the default admin user)
--   2. Login with admin / admin123
--   3. Click "ডেমো ডাটা লোড" button to insert demo products/customers/sales
-- ============================================================
