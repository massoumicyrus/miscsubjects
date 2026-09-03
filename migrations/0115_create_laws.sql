 -- 0115: Create laws and law_violations tables, seed immutable and mutable base laws

-- Laws table
CREATE TABLE IF NOT EXISTS laws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('immutable', 'mutable', 'temporary')),
  category TEXT NOT NULL,
  rule TEXT NOT NULL,
  rationale TEXT,
  binding_on TEXT DEFAULT '["all"]',
  can_be_modified_by TEXT,
  added_by TEXT,
  added_at TEXT,
  violations INTEGER DEFAULT 0,
  last_violation_at TEXT,
  enabled INTEGER DEFAULT 1
);

-- Law violations table
CREATE TABLE IF NOT EXISTS law_violations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  law_key TEXT NOT NULL,
  agent_id TEXT,
  session_id TEXT,
  trace_id TEXT,
  what_happened TEXT,
  mitigated INTEGER DEFAULT 0,
  logged_at TEXT
);

-- Immutable base laws (constitutional)
INSERT OR IGNORE INTO laws (key, level, category, rule, rationale, binding_on, can_be_modified_by, added_by, added_at, enabled) VALUES
('LAW_001', 'immutable', 'security', 'No rm -rf / or destructive disk operations on the terminal.', 'Prevents catastrophic data loss.', '["all"]', '[]', 'system', datetime('now'), 1),
('LAW_002', 'immutable', 'financial', 'No Stripe writes without explicit user go-ahead phrase.', 'Prevents accidental financial transactions.', '["all"]', '[]', 'system', datetime('now'), 1),
('LAW_003', 'immutable', 'privacy', 'No outbound messaging to customers without explicit authorization.', 'Privacy and compliance protection.', '["all"]', '[]', 'system', datetime('now'), 1),
('LAW_004', 'immutable', 'security', 'No API keys or TERMINAL_KEY in plaintext in prompts or logs.', 'Secret protection.', '["all"]', '[]', 'system', datetime('now'), 1),
('LAW_005', 'immutable', 'operational', 'Build numbers [BUILD_PHONE] and [PHONE] are RECEIVE-ONLY.', 'Prevents infinite loops and misrouting.', '["all"]', '[]', 'system', datetime('now'), 1),
('LAW_006', 'immutable', 'operational', 'Agent loop budget is capped at ITER_CAP (hardcoded in dispatch.js).', 'Prevents infinite recursion and runaway costs.', '["all"]', '[]', 'system', datetime('now'), 1),
('LAW_007', 'immutable', 'architecture', 'D1 schema migrations must be via .sql files in migrations/ directory.', 'Data integrity and auditability.', '["all"]', '[]', 'system', datetime('now'), 1),
('LAW_008', 'immutable', 'operational', 'No agent may add more than 50 lines of code in a single commit without human approval.', 'Prevents unreviewed large changes (chocolate frog rule).', '["all"]', '[]', 'system', datetime('now'), 1),
('LAW_009', 'immutable', 'meta', 'No agent may modify immutable laws.', 'Prevents privilege escalation.', '["all"]', '[]', 'system', datetime('now'), 1),
('LAW_010', 'immutable', 'meta', 'Every agent must cite the LAW_ key that justifies its action before acting.', 'Makes all actions auditable and traceable to rules.', '["all"]', '[]', 'system', datetime('now'), 1);

-- Mutable derived laws (can be changed by user or build)
INSERT OR IGNORE INTO laws (key, level, category, rule, rationale, binding_on, can_be_modified_by, added_by, added_at, enabled) VALUES
('LAW_101', 'mutable', 'financial', 'Cost cap per turn is $0.50.', 'Budget control.', '["all"]', '["USER", "BUILD"]', 'system', datetime('now'), 1),
('LAW_102', 'mutable', 'operational', 'Memory window is 10 prior turns.', 'Context limit for cost control.', '["all"]', '["USER", "BUILD"]', 'system', datetime('now'), 1),
('LAW_103', 'mutable', 'operational', 'Tool loop budget is 20 per turn.', 'Prevents runaway tool usage.', '["all"]', '["USER", "BUILD"]', 'system', datetime('now'), 1),
('LAW_104', 'mutable', 'content', 'Peptide articles must cite internal pages before external sources.', 'Consistency and accuracy.', '["all"]', '["USER", "BUILD"]', 'system', datetime('now'), 1),
('LAW_105', 'mutable', 'operational', 'All cron jobs must be logged before execution.', 'Auditability.', '["all"]', '["USER", "BUILD"]', 'system', datetime('now'), 1),
('LAW_106', 'mutable', 'routing', 'Agent-to-agent messages must include source_agent and target_agent headers.', 'Traceability.', '["all"]', '["USER", "BUILD"]', 'system', datetime('now'), 1),
('LAW_107', 'mutable', 'operational', 'Config changes (directory rows) do not require deploy. Code changes (functions/) require deploy.', 'Saves time and clarifies capabilities.', '["all"]', '["USER", "BUILD"]', 'system', datetime('now'), 1);
