-- 0011_stripe_tools.sql
-- Seed every Stripe primitive as a directory row.
-- auth = basic:STRIPE_SECRET_KEY → HTTP Basic with username = secret key, empty password.
-- POST bodies are application/x-www-form-urlencoded (content prefix `form:`).
-- Reference any row by its KEY: POST /api/dispatch {"key":"STRIPE_INVOICES_LIST","body":"5"}.

INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at) VALUES
  -- ─── account + balance ──────────────────────────────────────────────────────
  ('STRIPE_ACCOUNT',          'http', 'GET https://api.stripe.com/v1/account', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_BALANCE',          'http', 'GET https://api.stripe.com/v1/balance', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_BALANCE_TX_LIST',  'http', 'GET https://api.stripe.com/v1/balance_transactions?limit=$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),

  -- ─── customers ──────────────────────────────────────────────────────────────
  ('STRIPE_CUSTOMERS_LIST',   'http', 'GET https://api.stripe.com/v1/customers?limit=$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_CUSTOMER_GET',     'http', 'GET https://api.stripe.com/v1/customers/$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_CUSTOMER_SEARCH',  'http', 'GET https://api.stripe.com/v1/customers/search?query=$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_CUSTOMER_CREATE',  'http', 'POST https://api.stripe.com/v1/customers', 'basic:STRIPE_SECRET_KEY', 'form:email=$1&name=$2&phone=$3', '2026-06-09T18:00:00Z'),
  ('STRIPE_CUSTOMER_UPDATE',  'http', 'POST https://api.stripe.com/v1/customers/$1', 'basic:STRIPE_SECRET_KEY', 'form:email=$2&name=$3&phone=$4', '2026-06-09T18:00:00Z'),
  ('STRIPE_CUSTOMER_DELETE',  'http', 'DELETE https://api.stripe.com/v1/customers/$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),

  -- ─── products + prices ──────────────────────────────────────────────────────
  ('STRIPE_PRODUCTS_LIST',    'http', 'GET https://api.stripe.com/v1/products?limit=$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_PRODUCT_GET',      'http', 'GET https://api.stripe.com/v1/products/$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_PRODUCT_CREATE',   'http', 'POST https://api.stripe.com/v1/products', 'basic:STRIPE_SECRET_KEY', 'form:name=$1&description=$2', '2026-06-09T18:00:00Z'),
  ('STRIPE_PRICES_LIST',      'http', 'GET https://api.stripe.com/v1/prices?limit=$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_PRICE_GET',        'http', 'GET https://api.stripe.com/v1/prices/$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_PRICE_CREATE',     'http', 'POST https://api.stripe.com/v1/prices', 'basic:STRIPE_SECRET_KEY', 'form:product=$1&unit_amount=$2&currency=$3', '2026-06-09T18:00:00Z'),

  -- ─── invoices ───────────────────────────────────────────────────────────────
  ('STRIPE_INVOICES_LIST',    'http', 'GET https://api.stripe.com/v1/invoices?limit=$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_INVOICE_GET',      'http', 'GET https://api.stripe.com/v1/invoices/$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_INVOICE_CREATE',   'http', 'POST https://api.stripe.com/v1/invoices', 'basic:STRIPE_SECRET_KEY', 'form:customer=$1&collection_method=send_invoice&days_until_due=$2&description=$3', '2026-06-09T18:00:00Z'),
  ('STRIPE_INVOICE_UPDATE',   'http', 'POST https://api.stripe.com/v1/invoices/$1', 'basic:STRIPE_SECRET_KEY', 'form:description=$2', '2026-06-09T18:00:00Z'),
  ('STRIPE_INVOICE_FINALIZE', 'http', 'POST https://api.stripe.com/v1/invoices/$1/finalize', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_INVOICE_SEND',     'http', 'POST https://api.stripe.com/v1/invoices/$1/send', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_INVOICE_PAY',      'http', 'POST https://api.stripe.com/v1/invoices/$1/pay', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_INVOICE_VOID',     'http', 'POST https://api.stripe.com/v1/invoices/$1/void', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_INVOICE_MARK_UNCOLLECTIBLE', 'http', 'POST https://api.stripe.com/v1/invoices/$1/mark_uncollectible', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_INVOICE_DELETE',   'http', 'DELETE https://api.stripe.com/v1/invoices/$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),

  -- ─── invoice items ──────────────────────────────────────────────────────────
  ('STRIPE_INVOICE_ITEMS_LIST', 'http', 'GET https://api.stripe.com/v1/invoiceitems?customer=$1&limit=$2', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_INVOICE_ITEM_CREATE','http', 'POST https://api.stripe.com/v1/invoiceitems', 'basic:STRIPE_SECRET_KEY', 'form:customer=$1&amount=$2&currency=$3&description=$4', '2026-06-09T18:00:00Z'),
  ('STRIPE_INVOICE_ITEM_DELETE','http', 'DELETE https://api.stripe.com/v1/invoiceitems/$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),

  -- ─── charges ────────────────────────────────────────────────────────────────
  ('STRIPE_CHARGES_LIST',     'http', 'GET https://api.stripe.com/v1/charges?limit=$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_CHARGE_GET',       'http', 'GET https://api.stripe.com/v1/charges/$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),

  -- ─── payment_intents ────────────────────────────────────────────────────────
  ('STRIPE_PI_LIST',          'http', 'GET https://api.stripe.com/v1/payment_intents?limit=$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_PI_GET',           'http', 'GET https://api.stripe.com/v1/payment_intents/$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_PI_CREATE',        'http', 'POST https://api.stripe.com/v1/payment_intents', 'basic:STRIPE_SECRET_KEY', 'form:amount=$1&currency=$2&customer=$3&description=$4', '2026-06-09T18:00:00Z'),

  -- ─── payment_links ──────────────────────────────────────────────────────────
  ('STRIPE_PAYMENT_LINKS_LIST', 'http', 'GET https://api.stripe.com/v1/payment_links?limit=$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_PAYMENT_LINK_CREATE','http', 'POST https://api.stripe.com/v1/payment_links', 'basic:STRIPE_SECRET_KEY', 'form:line_items[0][price]=$1&line_items[0][quantity]=$2', '2026-06-09T18:00:00Z'),

  -- ─── subscriptions ──────────────────────────────────────────────────────────
  ('STRIPE_SUBSCRIPTIONS_LIST', 'http', 'GET https://api.stripe.com/v1/subscriptions?limit=$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_SUBSCRIPTION_GET',   'http', 'GET https://api.stripe.com/v1/subscriptions/$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_SUBSCRIPTION_CANCEL','http', 'DELETE https://api.stripe.com/v1/subscriptions/$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),

  -- ─── payouts + refunds ──────────────────────────────────────────────────────
  ('STRIPE_PAYOUTS_LIST',     'http', 'GET https://api.stripe.com/v1/payouts?limit=$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_PAYOUT_GET',       'http', 'GET https://api.stripe.com/v1/payouts/$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_REFUNDS_LIST',     'http', 'GET https://api.stripe.com/v1/refunds?limit=$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),
  ('STRIPE_REFUND_CREATE',    'http', 'POST https://api.stripe.com/v1/refunds', 'basic:STRIPE_SECRET_KEY', 'form:charge=$1&amount=$2', '2026-06-09T18:00:00Z'),

  -- ─── events ─────────────────────────────────────────────────────────────────
  ('STRIPE_EVENTS_LIST',      'http', 'GET https://api.stripe.com/v1/events?limit=$1', 'basic:STRIPE_SECRET_KEY', '', '2026-06-09T18:00:00Z'),

  -- ─── one-shot: create + finalize + send invoice + SMS the hosted URL ────────
  ('SEND_INVOICE_VIA_BLOOIO', 'fn', 'stripeSendInvoice', '', '["$1","$2","$3","$4","$5"]', '2026-06-09T18:00:00Z');
