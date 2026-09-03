-- The Good Conscience Law: MAY_ACT = authority AND evidence AND conscience.
-- Runner in functions/_lib/conscience_law.js; halt check in functions/api/dispatch.js runFn.

CREATE TABLE IF NOT EXISTS conscience_verdicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  version TEXT NOT NULL,
  job TEXT NOT NULL,
  verdict TEXT NOT NULL,             -- ACCEPT | REFUSE | ESCALATE | HALT
  violated_clause TEXT,              -- GC1..GC8, required for anything but ACCEPT
  prohibited_consequence TEXT,
  causal_contribution TEXT,
  evidence TEXT,
  notes TEXT
);

INSERT OR REPLACE INTO directory (key, type, category, target, auth, content, planner_rank, planner_visible, enabled, sensitive, updated_at, created_at)
VALUES
  ('CONSCIENCE_GATE', 'fn', 'governance', 'conscienceGate', '',
'# WHAT: The Good Conscience Law — the veto between "can execute" and "will execute". MAY_ACT = authority AND evidence AND conscience; logical economics optimizes only among MAY_ACT=true actions. Empty body returns the constitution (build-conscience@1.0.0, clauses GC1-GC8). A REFUSE/ESCALATE/HALT verdict is rejected unless it names the violated clause, the prohibited consequence, the job''s direct causal contribution, and evidence — refusal binds to a named clause, never to free moralizing. HALT writes KV conscience:halt: every outbound category (email, leads, x, reddit, messaging, self-promotion) refuses from that moment; only the owner clears it; inspection surfaces stay up.
# WHEN_TO_USE: before the build accepts any job or takes any consequential outbound action; when work smells like it violates the floor; "should the build do this at all".
# SAFETY: money, efficiency, owner instruction, or customer demand never compensate for a conscience failure. Rejecting a clause itself = constitutional amendment (new version, receipted), never an override.
# ARGS: $1 = empty (list clauses) OR JSON {job, verdict:ACCEPT|REFUSE|ESCALATE|HALT, violated_clause?, prohibited_consequence?, causal_contribution?, evidence?, notes?}
# EX: [CONSCIENCE_GATE][/CONSCIENCE_GATE]
"$1"', 30, 1, 1, 0, datetime('now'), datetime('now'));
