-- THE MIRROR LAYER (loop-content-spine / DB) — claim-level recursion over every article.
-- A page is finished only provisionally. Every reader (human or model) may attach a TYPED
-- contribution to an exact claim: question | objection | source | repair | compression |
-- contradiction | audit. Contributions are ledgered with provenance and a receipt; they
-- never overwrite the article. Acceptance is an owner act (status proposed -> accepted|rejected).
CREATE TABLE IF NOT EXISTS mirror_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  slug TEXT NOT NULL,
  claim_id TEXT,
  claim_text TEXT,
  source_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('question','objection','source','repair','compression','contradiction','audit')),
  actor TEXT NOT NULL DEFAULT 'anonymous',
  body TEXT NOT NULL,
  proposed_text TEXT,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','rejected')),
  receipt TEXT,
  resolved_by TEXT,
  resolved_at TEXT,
  resolution_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_mirror_slug ON mirror_contributions (slug, id DESC);
CREATE INDEX IF NOT EXISTS idx_mirror_claim ON mirror_contributions (slug, claim_id);
CREATE INDEX IF NOT EXISTS idx_mirror_status ON mirror_contributions (status);

-- OIP verbs so any model drives the Mirror Layer from natural language or a scoped token.
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at) VALUES
('MIRROR_APPEND', 'fn', 'mirrorAppend', '',
'# WHAT: Attach one TYPED contribution to an exact claim of an article — question, objection, source, repair, compression, contradiction, or audit. The contribution is ledgered with provenance and a receipt; it never rewrites the article. This is the Mirror Layer: reading leaves a trace, and the trace shapes the article.
# WHEN_TO_USE: "question this claim", "challenge/attack this claim", "suggest sharper wording", "add a source/contradiction to <article>", "mark overclaimed", "audit this claim".
# ARGS: $1=article slug, $2=claim id (p-hash or claim-N; empty = article-level), $3=kind (question|objection|source|repair|compression|contradiction|audit), $4=actor (your model name), $5+=body (the contribution text; for repair/compression put the proposed replacement wording after " => ").
# EX: [MIRROR_APPEND]oip-the-12-axioms|p-3f2a9c1b|question|claude-fable-5|What supports the claim that all eight patterns are independent rather than restatements of one gradient law?[/MIRROR_APPEND]
["$1","$2","$3","$4","$5+"]', 'content', 25, 1, 1, datetime('now')),
('MIRROR_FEED', 'fn', 'mirrorFeed', '',
'# WHAT: Read the Mirror Layer of one article (or the newest contributions across all articles): every typed contribution grouped by claim, proposed vs accepted separated, each with actor, kind, timestamp, status, and receipt. Merges the historical objection ledger so all recursion is visible in one read.
# WHEN_TO_USE: "what has been challenged on <article>", "show the mirror layer", "what repairs are proposed", "read the recursion on this claim".
# ARGS: $1=article slug (empty = newest across all articles), $2=limit (default 50).
# EX: [MIRROR_FEED]oip-the-12-axioms|50[/MIRROR_FEED]
["$1","$2"]', 'content', 25, 1, 1, datetime('now')),
('MIRROR_RESOLVE', 'fn', 'mirrorResolve', '',
'# WHAT: OWNER ACT — accept or reject one proposed Mirror contribution by id. Accepted repairs become part of the article''s visible lineage; the article body itself is only ever changed by the owner or an owner-ordered edit. Share/capability tokens are denied: models propose, they do not resolve.
# WHEN_TO_USE: the owner says "accept mirror #N", "reject that suggestion", "mark that repair accepted".
# ARGS: $1=contribution id, $2=accepted|rejected, $3+=resolution note (optional).
# EX: [MIRROR_RESOLVE]12|accepted|folded into the claim wording[/MIRROR_RESOLVE]
["$1","$2","$3+"]', 'content', 25, 1, 1, datetime('now'));
