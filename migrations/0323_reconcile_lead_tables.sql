-- Reconcile repo schema with production. These tables were created live by the
-- 2026-07 lead work whose creating migration files never rejoined the live line;
-- production had them, the repo did not. DDL matches production sqlite_master
-- exactly (plus IF NOT EXISTS so replay against production is a no-op).
CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT, name TEXT, segment TEXT, city TEXT, website TEXT, email TEXT, phone TEXT, source TEXT, status TEXT DEFAULT 'new', score INTEGER DEFAULT 0, draft TEXT, notes TEXT, address TEXT, context TEXT, enrich_claimed_at TEXT, UNIQUE(name, city));
CREATE TABLE IF NOT EXISTS lead_suppressions (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  reason TEXT NOT NULL DEFAULT 'opt_out',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
