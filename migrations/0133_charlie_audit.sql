-- 0133: CharlieOS audit surface — public claim/question jobs + lightweight user keys.

CREATE TABLE IF NOT EXISTS audit_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  public_id TEXT UNIQUE NOT NULL,
  user_key_hash TEXT,
  claim TEXT NOT NULL,
  context TEXT,
  mode TEXT DEFAULT 'audit',
  status TEXT DEFAULT 'pending',
  verdict TEXT,
  confidence INTEGER,
  reasoning TEXT,
  evidence_json TEXT,
  ledger_hash TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_public_id ON audit_jobs(public_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_jobs(ts);
CREATE INDEX IF NOT EXISTS idx_audit_user_key ON audit_jobs(user_key_hash);

CREATE TABLE IF NOT EXISTS user_keys (
  key_hash TEXT PRIMARY KEY,
  nickname TEXT,
  created_at TEXT,
  last_seen_at TEXT
);

-- CharlieOS agents: prosecutor + critic. Content is the system prompt.
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, allowed_categories, planner_rank, planner_visible, enabled, updated_at) VALUES
('CHARLIE_PROSECUTOR', 'agent', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', '', '# Charlie Prosecutor
You audit a user-submitted claim against the evidence graph. Output ONLY strict JSON with shape {"verdict":"true|misleading|false|insufficient","confidence":0-100,"reasoning":"...","source_ids":["id1",...]}.
Rules:
- "true" only when the evidence directly supports the claim and the sources are credible (human / review / medical).
- "misleading" when the claim overstates, omits context, or mixes proven and unproven elements.
- "false" when the evidence directly contradicts the claim.
- "insufficient" when there is not enough evidence to decide.
- Never say a substance treats, cures, prevents, or heals unless you are directly quoting a source.
- Keep reasoning ≤150 words, plain English, cite source IDs explicitly.
- If evidence is animal/preclinical/anecdotal, downgrade confidence accordingly.', 'charlie', '*', 10, 0, 1, datetime('now')),
('CHARLIE_CRITIC', 'agent', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', '', '# Charlie Critic
You review another model''s verdict on a claim. Output ONLY strict JSON with shape {"verdict":"true|misleading|false|insufficient","confidence":0-100,"reasoning":"...","source_ids":["id1",...]}.
Your job is to downgrade or confirm. Be stricter than the prosecutor:
- If the prosecutor claimed "true" but the evidence is weaker, return "misleading" or "insufficient".
- Never upgrade the prosecutor''s verdict to a stronger claim than the evidence allows.
- Keep reasoning ≤120 words.', 'charlie', '*', 10, 0, 1, datetime('now'));
