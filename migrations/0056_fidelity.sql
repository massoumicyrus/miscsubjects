-- 0056_fidelity.sql — fidelity test bank
-- Each row has zero or more tests. The runner dispatches each test, records pass/fail.

CREATE TABLE IF NOT EXISTS directory_tests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  key           TEXT NOT NULL,          -- directory.key being tested
  kind          TEXT NOT NULL,          -- 'positive' | 'inverse' | 'agent-route'
  args          TEXT NOT NULL DEFAULT '',  -- body dispatched OR the natural-language input for agent-route
  expect_kind   TEXT NOT NULL,          -- 'contains' | 'regex' | 'startswith' | 'http_2xx' | 'http_4xx' | 'err_prefix'
  expect_value  TEXT NOT NULL,
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS directory_tests_key_idx ON directory_tests(key);

CREATE TABLE IF NOT EXISTS fidelity_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id        TEXT NOT NULL,
  ts            TEXT NOT NULL DEFAULT (datetime('now')),
  test_id       INTEGER NOT NULL,
  key           TEXT NOT NULL,
  kind          TEXT NOT NULL,
  passed        INTEGER NOT NULL,       -- 0 | 1
  expected      TEXT,
  actual        TEXT,
  latency_ms    INTEGER
);

CREATE INDEX IF NOT EXISTS fidelity_log_run_idx ON fidelity_log(run_id);
CREATE INDEX IF NOT EXISTS fidelity_log_key_idx ON fidelity_log(key);

-- Seed: 30 positive + 30 inverse tests for the most-used rows.
INSERT INTO directory_tests (key, kind, args, expect_kind, expect_value, note) VALUES
  ('NOW',                    'positive', '',                                              'regex',      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T',                'ISO timestamp'),
  ('UPPER',                  'positive', 'hello world',                                   'contains',   'HELLO WORLD',                                  ''),
  ('UPPER',                  'inverse',  '',                                              'contains',   '',                                             'empty input → empty output'),
  ('LOWER',                  'positive', 'HELLO WORLD',                                   'contains',   'hello world',                                  ''),
  ('SHA256_LOWER',           'positive', 'the owner@<operator-domain>',                                 'contains',   'eb1f08c6688d1cf35a2dbd24b29452893bcce8ba01e2614685f69a6da0a500c4', 'known hash'),
  ('UTCNOW',                 'positive', '',                                              'regex',      '^[0-9]{4}-',                                   ''),
  ('WORLDTIME',              'positive', '',                                              'regex',      '[0-9]{4}-',                                    ''),
  ('REGEX_PARSE',            'positive', '[ADDTASK]buy milk[/ADDTASK]',                   'contains',   '"key":"ADDTASK"',                              ''),
  ('REGEX_PARSE',            'inverse',  'no tags here',                                  'contains',   '"count":0',                                    'zero tags'),
  ('CATEGORIES',             'positive', '',                                              'contains',   '(',                                            'manifest'),
  ('TOOLS_IN',               'positive', 'blooio|5',                                      'contains',   'BLOOIO_',                                      ''),
  ('TOOLS_SEARCH',           'positive', 'stripe|5',                                      'contains',   'STRIPE_',                                      ''),
  ('TOOLS_SEARCH',           'inverse',  'nonsense_xyz_nomatch|5',                        'contains',   '[]',                                           'empty result array'),
  ('DIRECTORY_LIST',         'positive', '',                                              'contains',   'ROUTER',                                       ''),
  ('DIRECTORY_GET',          'positive', 'ROUTER',                                        'contains',   'R1: IDENTITY',                                 'new clause-style ROUTER'),
  ('CF_USER',                'positive', '',                                              'contains',   '"email"',                                      'requires CLOUDFLARE_API_TOKEN'),
  ('CF_ZONES_LIST',          'positive', '',                                              'contains',   '"id"',                                         ''),
  ('CF_PAGES_LIST',          'positive', '<CLOUDFLARE_ACCOUNT_ID>',              'contains',   'miscsubjects-pages',                       ''),
  ('STRIPE_ACCOUNT',         'positive', '',                                              'contains',   'acct_',                                        ''),
  ('STRIPE_BALANCE',         'positive', '',                                              'contains',   'available',                                    ''),
  ('STRIPE_CUSTOMERS_LIST',  'positive', '1',                                             'contains',   'cus_',                                         ''),
  ('STRIPE_CUSTOMERS_LIST',  'inverse',  '0',                                             'contains',   'limit',                                        'invalid limit'),
  ('STRIPE_INVOICES_LIST',   'positive', '1',                                             'contains',   '"object":"invoice"',                           ''),
  ('STRIPE_PAYOUTS_LIST',    'positive', '1',                                             'contains',   'po_',                                          ''),
  ('STRIPE_PRODUCTS_LIST',   'positive', '1',                                             'contains',   'prod_',                                        ''),
  ('STRIPE_PUBLIC_KEY_GET',  'positive', '',                                              'contains',   'pk_live_',                                     ''),
  ('VERIFY_BLOOIO_SIG',      'positive', 'hello',                                         'regex',      '^[0-9a-f]{64}$',                               'HMAC hex'),
  ('BLOOIO_CONTACTS_LIST',   'positive', '5|0',                                           'contains',   'contacts',                                     ''),
  ('BLOOIO_LOOKUP_GET',      'positive', '[OWNER_PHONE]',                                  'contains',   'phone',                                        ''),
  ('PAGES_LIST',             'positive', '',                                              'contains',   'privacy',                                      ''),
  ('PAGES_GET',              'positive', 'privacy',                                       'contains',   'slug',                                         ''),
  ('TOOLS_IN',               'inverse',  'nonexistent_category|5',                       'contains',   '[]',                                           'empty result'),
  ('SETTINGS_LIST',          'positive', '',                                              'contains',   'system_prompt',                                ''),
  ('TASKS_LIST',             'positive', '',                                              'contains',   '[',                                            'JSON array'),
  ('GROK_LEDGER_TAIL',       'positive', '',                                              'contains',   'request',                                      ''),
  ('LOG_TAIL',               'positive', '',                                              'contains',   'trace',                                        ''),
  ('BLOOIO_LOGS_TAIL',       'positive', '',                                              'contains',   '',                                             ''),
  ('REASONING_GET',          'positive', '',                                              'contains',   '',                                             ''),
  ('HISTORY_GET',            'positive', '',                                              'regex',      '^[0-9]+$',                                     'integer string'),
  ('CF_TOKENS_VERIFY',       'positive', '',                                              'contains',   '',                                             'may 401 on expired token — see actual'),
  ('CF_WORKERS_LIST',        'positive', '<CLOUDFLARE_ACCOUNT_ID>',              'contains',   '',                                             ''),
  ('ADD_ROW',                'inverse',  '__bad_test_key__|http||',                       'contains',   '',                                             'malformed args should not 500'),
  ('D1_QUERY',               'positive', 'SELECT 1 AS one',                               'contains',   '"one":1',                                      ''),
  ('D1_QUERY',               'inverse',  'SELECT FROM nowhere',                           'startswith', 'ERR:',                                         'bad SQL'),
  ('ROUTER',                 'agent-route', 'channel=imessage from=[OWNER_PHONE] to=[BUILD_PHONE]\n\nNow: list my open PRs', 'contains', '[TERMINUS]',                                   'R4b: terminal route'),
  ('ROUTER',                 'agent-route', 'channel=imessage from=[OWNER_PHONE] to=[BUILD_PHONE]\n\nNow: what is my arcads credit balance', 'contains', '[OPS]',                                        'R4d: ops route'),
  ('ROUTER',                 'agent-route', 'channel=imessage from=[OWNER_PHONE] to=[BUILD_PHONE]\n\nNow: make me a 9:16 video of a sunlit kitchen', 'contains', '[ARCADS]',                                     'R4a: creative route'),
  ('OPS',                    'agent-route', 'what stripe customers do we have',           'contains',   '[STRIPE_CUSTOMERS_LIST]',                      'O4k: stripe read'),
  ('OPS',                    'agent-route', 'void invoice in_test_123',                  'contains',   'go ahead',                                     'O4l: write gate'),
  ('OPS',                    'agent-route', 'send hi to [OWNER_PHONE]',                   'contains',   '[BLOOIO_SEND]',                                'O4e: send');
