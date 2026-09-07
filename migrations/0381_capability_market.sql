-- 0381 — the capability market: rights, quotes, payment links, sales, settlements, resources,
-- leases, snapshots, claim commitments, claims, verifications, challenges, wants, mandates,
-- solicitations, offers, agreements. Every table is append-first: rows change state, never vanish.
CREATE TABLE IF NOT EXISTS market_rights (
  row_key TEXT PRIMARY KEY, entitlement_source TEXT NOT NULL, owner TEXT, delegation_allowed INTEGER DEFAULT 1, resale_allowed INTEGER DEFAULT 1, read_only INTEGER DEFAULT 1,
  approved_users_json TEXT, region TEXT, purpose TEXT, platform_terms_version TEXT, rate_limit TEXT, expires_at TEXT, revocation_source TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT
);
CREATE TABLE IF NOT EXISTS market_quotes (
  id TEXT PRIMARY KEY, row_key TEXT NOT NULL, resource_id TEXT, profile_id TEXT, marginal_cents INTEGER DEFAULT 0, capacity_cents INTEGER DEFAULT 0, verifier_cents INTEGER DEFAULT 0,
  settlement_cents INTEGER DEFAULT 0, risk_premium_cents INTEGER DEFAULT 0, collateral_cents INTEGER DEFAULT 0, total_cents INTEGER DEFAULT 0, expires_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_pay_links (
  id TEXT PRIMARY KEY, row_key TEXT NOT NULL, units INTEGER NOT NULL DEFAULT 1, unit_amount_cents INTEGER NOT NULL, currency TEXT DEFAULT 'usd', price_id TEXT, product_id TEXT, url TEXT, created_at TEXT NOT NULL, active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS market_sales (
  id TEXT PRIMARY KEY, source_id TEXT NOT NULL UNIQUE, stripe_session_id TEXT, payment_link_id TEXT, row_key TEXT NOT NULL, units INTEGER NOT NULL, amount_cents INTEGER DEFAULT 0, currency TEXT DEFAULT 'usd',
  buyer_phone_masked TEXT, buyer_email_masked TEXT, profile_id TEXT, fingerprint TEXT, token_delivered_via TEXT, delivered_at TEXT, finality_state TEXT, reversible_until TEXT, dispute_window_days INTEGER DEFAULT 0,
  fees_cents INTEGER DEFAULT 0, payout_date TEXT, refund_status TEXT DEFAULT 'none', created_at TEXT NOT NULL, raw_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_market_sales_profile ON market_sales(profile_id, created_at);
CREATE TABLE IF NOT EXISTS market_settlements (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, ref_id TEXT NOT NULL, rail TEXT NOT NULL, amount_cents INTEGER DEFAULT 0, fees_cents INTEGER DEFAULT 0, currency TEXT DEFAULT 'usd', finality_state TEXT,
  reversible_until TEXT, dispute_window_days INTEGER DEFAULT 0, chargeback_reserve_cents INTEGER DEFAULT 0, refund_policy TEXT, tax_treatment TEXT, payout_date TEXT, state TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_settlements_ref ON market_settlements(ref_id);
CREATE TABLE IF NOT EXISTS market_resources (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL, owner_profile_id TEXT, state TEXT NOT NULL DEFAULT 'available', snapshot_key TEXT, snapshot_body TEXT, snapshot_fields_json TEXT,
  collateral_cents INTEGER DEFAULT 0, risk_premium_cents INTEGER DEFAULT 0, quarantine_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_snapshots (
  id TEXT PRIMARY KEY, resource_id TEXT NOT NULL, lease_id TEXT, phase TEXT, state_hash TEXT NOT NULL, state_json TEXT, taken_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_leases (
  id TEXT PRIMARY KEY, resource_id TEXT NOT NULL, lessee_profile_id TEXT NOT NULL, fingerprint TEXT, state TEXT NOT NULL, exclusive INTEGER DEFAULT 1, reserved_from TEXT, expires_at TEXT NOT NULL, activated_at TEXT, ended_at TEXT,
  concurrency_limit INTEGER DEFAULT 1, usage_limit INTEGER DEFAULT 500, uses INTEGER DEFAULT 0, allowed_actions_json TEXT, forbidden_actions_json TEXT, spend_ceiling_cents INTEGER, collateral_cents INTEGER DEFAULT 0,
  pre_state_hash TEXT, post_state_hash TEXT, checkout_receipt TEXT, return_status TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_leases_resource ON market_leases(resource_id, state);
CREATE TABLE IF NOT EXISTS market_claim_commits (
  id TEXT PRIMARY KEY, claim_id TEXT, provider_profile_id TEXT, methodology_key TEXT NOT NULL, hypothesis TEXT, metric TEXT, cohort TEXT, exclusions TEXT, baseline TEXT, window_from TEXT, window_to TEXT,
  stopping_rule TEXT, method TEXT, control TEXT, ledger_event_id TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_claims (
  id TEXT PRIMARY KEY, provider_profile_id TEXT NOT NULL, statement TEXT NOT NULL, period_from TEXT, period_to TEXT, methodology_key TEXT NOT NULL, methodology_version INTEGER NOT NULL,
  evidence_receipts_json TEXT NOT NULL, dataset_commitment TEXT, evidence_grade TEXT NOT NULL, commit_id TEXT, preregistered INTEGER DEFAULT 0, value_json TEXT, state TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_verifications (
  id TEXT PRIMARY KEY, claim_id TEXT NOT NULL, verifier TEXT, methodology_key TEXT, methodology_version INTEGER, recomputed_json TEXT, result TEXT NOT NULL, detail TEXT, ledger_event_id TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_challenges (
  id TEXT PRIMARY KEY, claim_id TEXT NOT NULL, challenger TEXT, bond_cents INTEGER DEFAULT 0, evidence TEXT, window_ends_at TEXT, state TEXT NOT NULL, task_id TEXT, resolution TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_wants (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, text TEXT NOT NULL, public INTEGER DEFAULT 0, state TEXT NOT NULL, mandate_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_mandates (
  id TEXT PRIMARY KEY, want_id TEXT NOT NULL, profile_id TEXT NOT NULL, objective TEXT, acceptable_outcomes TEXT, budget_cents INTEGER NOT NULL, deadline TEXT, provider_classes_json TEXT, public INTEGER DEFAULT 0,
  allowed_actions_json TEXT, forbidden_actions_json TEXT, auto_execute_cents INTEGER DEFAULT 0, confirm_cents INTEGER DEFAULT 0, evidence_required TEXT, cancellation_terms TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_solicitations (
  id TEXT PRIMARY KEY, want_id TEXT NOT NULL, mandate_id TEXT NOT NULL, scope TEXT, budget_class TEXT, evidence_required TEXT, deadline TEXT, mode TEXT NOT NULL, targets_json TEXT, state TEXT NOT NULL, matches_json TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_offers (
  id TEXT PRIMARY KEY, solicitation_id TEXT NOT NULL, provider_profile_id TEXT NOT NULL, scope TEXT NOT NULL, method TEXT, price_cents INTEGER NOT NULL, timing TEXT, evidence_promised TEXT, composition TEXT NOT NULL,
  authority_grade TEXT, state TEXT NOT NULL, expires_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_agreements (
  id TEXT PRIMARY KEY, offer_id TEXT NOT NULL, want_id TEXT NOT NULL, buyer_profile_id TEXT NOT NULL, provider_profile_id TEXT NOT NULL, price_cents INTEGER NOT NULL, acceptance_json TEXT, task_id TEXT, settlement_id TEXT,
  authority_grade TEXT, claim_id TEXT, state TEXT NOT NULL, created_at TEXT NOT NULL
);
