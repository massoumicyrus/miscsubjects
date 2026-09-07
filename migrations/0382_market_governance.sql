-- 0382 — market governance: node record, trust policies, privacy budgets and aggregate queries,
-- solicitation deliveries, bonds and escrow holds. Append-first, like 0381.
CREATE TABLE IF NOT EXISTS market_nodes (
  id TEXT PRIMARY KEY, domain TEXT NOT NULL, agent_id TEXT, public_jwk_json TEXT, facets_json TEXT, kernel_hash TEXT, note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_trust_policies (
  profile_id TEXT PRIMARY KEY, verifier_set_json TEXT, accepted_methods_json TEXT, minimum_grade TEXT, max_evidence_age_days INTEGER, conflict_policy TEXT, appeal_policy TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_privacy_budgets (
  buyer TEXT NOT NULL, dataset TEXT NOT NULL, budget INTEGER NOT NULL, spent INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (buyer, dataset)
);
CREATE TABLE IF NOT EXISTS market_aggregate_queries (
  id TEXT PRIMARY KEY, buyer TEXT NOT NULL, dataset TEXT NOT NULL, fingerprint TEXT NOT NULL, filters_json TEXT, cohort_size INTEGER, cohort_hash TEXT, members_json TEXT, result_json TEXT, refused TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_agg_buyer ON market_aggregate_queries(buyer, dataset, created_at);
CREATE TABLE IF NOT EXISTS market_deliveries (
  id TEXT PRIMARY KEY, solicitation_id TEXT NOT NULL, target TEXT NOT NULL, channel TEXT, status TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_holds (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, ref_id TEXT NOT NULL, party TEXT, amount_cents INTEGER NOT NULL, rail TEXT, provider_ref TEXT, state TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
