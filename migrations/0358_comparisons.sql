-- 0358 — COMPARISONS: the experiment object (SPEC_SKILL_EVIDENCE_GRAPH.md, execution-case layer).
--
-- THE DEFECT THIS CURES. A single successful execution is testimony about one run, not knowledge
-- about a method. Without a comparison object, "skill v1.2 wrote the ad and CTR went up" collapses
-- observation into causation — the exact epistemic shortcut the owner named: one lucky ad must
-- never silently become "prompt like this." A comparison records A vs B on one metric, in one
-- window, under a DECLARED design, and its claim grade is computed by the infrastructure from
-- that design — never self-declared, never higher than the design supports:
--
--   design 'randomized'              → CONTROLLED_COMPARISON
--   design 'matched' / 'sequential'  → ASSOCIATION_OBSERVED
--   design 'unknown'                 → OUTCOME_OBSERVED
--   REPLICATED                       → computed at read: an independent comparison row that names
--                                      this one in `replicates` and agrees in direction
--   GENERALIZED                      → never stored; a projection over ≥3 replications in
--                                      materially different contexts
--
-- Append-only: a wrong comparison is superseded by a new row naming it, never edited.
CREATE TABLE IF NOT EXISTS comparisons (
  id              TEXT PRIMARY KEY,             -- CMP-0001
  created_at      TEXT NOT NULL,
  objective       TEXT NOT NULL,                -- what question this comparison answers
  metric          TEXT NOT NULL,                -- e.g. 'email_click_rate', 'lead_valid_recall', 'ad_ctr'
  design          TEXT NOT NULL CHECK (design IN ('randomized','matched','sequential','unknown')),
  baseline_ref    TEXT NOT NULL,                -- what A was: 'skill:name@v', 'task:WT-0001', 'manifest:<hash>'
  variant_ref     TEXT NOT NULL,                -- what B was, same vocabulary
  baseline_value  REAL,
  variant_value   REAL,
  delta           REAL,                         -- variant - baseline, in the metric's own unit
  window_start    TEXT,
  window_end      TEXT,
  n_baseline      INTEGER,                      -- sample sizes; NULL = undeclared (and it shows)
  n_variant       INTEGER,
  confounders_json TEXT,                        -- what else changed in the window; '[]' is a claim too
  evidence_json   TEXT NOT NULL,                -- refs into events/invocations/email_sends/manifests
  replicates      TEXT,                         -- CMP-id this row independently re-ran, when it does
  actor           TEXT NOT NULL,
  fingerprint     TEXT,
  superseded_by   TEXT                          -- set by the superseding row's write, never by edit
);
CREATE INDEX IF NOT EXISTS idx_comparisons_refs ON comparisons (baseline_ref, variant_ref);
CREATE INDEX IF NOT EXISTS idx_comparisons_replicates ON comparisons (replicates);
