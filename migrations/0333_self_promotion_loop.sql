-- Self-promotion loop: audience classes as data, the allocation runner, and org discovery.
-- Documented publicly at /a/outreach-machinery; governed by the self-promotion skill.
-- Additive only — no peptide-loop row or gate changes.

CREATE TABLE IF NOT EXISTS promo_classes (
  key TEXT PRIMARY KEY,            -- kebab-case class key; leads.segment carries it
  name TEXT NOT NULL,              -- plain-English class name
  loss TEXT NOT NULL,              -- the loss this class bears today
  mechanism TEXT NOT NULL,         -- which capability here reduces it
  artifact TEXT NOT NULL,          -- the single strongest live URL to show them
  thesis TEXT NOT NULL,            -- the one sentence that earns a reply
  objection TEXT NOT NULL,         -- the counter-argument they raise first
  fit INTEGER NOT NULL,            -- 0-100
  fit_reason TEXT NOT NULL,
  prior REAL NOT NULL DEFAULT 0.05,-- declared constant, NOT a measured response rate
  last_contact_ts TEXT,            -- novelty is computed against this
  derived_from TEXT,               -- inv_ ids of the model passes that produced the class
  updated_at TEXT NOT NULL
);

INSERT OR REPLACE INTO directory (key, type, category, target, auth, content, planner_rank, planner_visible, enabled, sensitive, updated_at, created_at)
VALUES
  ('PROMO_CLASSES', 'fn', 'self-promotion', 'promoClasses', '',
'# WHAT: Read the audience-class table — the starting logic of the self-promotion loop, as data. Each row: the loss the class bears, the mechanism here that reduces it, the strongest artifact to show them, the reply-earning thesis, their first objection, fit 0-100 with reason, prior, last contact.
# WHEN_TO_USE: before any allocation, draft, or outreach plan for the build itself; "who would care about this".
# ARGS: $1 = class key (optional; empty = all, fit desc).
# EX: [PROMO_CLASSES][/PROMO_CLASSES]
["$1"]', 40, 1, 1, 0, datetime('now'), datetime('now')),

  ('OUTREACH_ALLOCATE', 'fn', 'self-promotion', 'outreachAllocate', '',
'# WHAT: The delta equation of the self-promotion loop. Per class: priority = fit x novelty x permission x (1 - saturation) x prior; volume = clamp(round(cap x priority/sum), 0, class cap). Novelty counts published artifacts newer than the class''s last contact — zero new material means zero volume. Returns the full arithmetic (policy version, every term, volumes, selected lead ids). SENDS NOTHING, DRAFTS NOTHING — the invocation receipt is the ledger record of the decision.
# WHEN_TO_USE: whenever something ships or before planning any outreach wave for the build; "who should hear about this today".
# SAFETY: computation only. Drafting stays behind LEADS_DRAFT_AI gates; sending stays behind LEADS_SEND CONFIRM.
# ARGS: $1 = daily cap override (may only LOWER the policy cap of 10).
# EX: [OUTREACH_ALLOCATE]10[/OUTREACH_ALLOCATE]
["$1"]', 40, 1, 1, 0, datetime('now'), datetime('now')),

  ('LEADS_DISCOVER_ORG', 'fn', 'self-promotion', 'leadsDiscoverOrg', '',
'# WHAT: SCRAPER 5 — organization discovery for a promo class via live web search. Finds real organizations with verifiable official sites and inserts them as leads (segment = class key, source = org-research), deduped on name+city. Emails are NEVER guessed here: LEADS_ENRICH finds them on the organization''s own site or the row ends no_email.
# WHEN_TO_USE: populating a promo class with real organizations before enrichment; "find AI assurance firms".
# ARGS: $1 = promo class key (must exist in promo_classes), $2 = free-text query, $3 = count (default 12, cap 20).
# EX: [LEADS_DISCOVER_ORG]ai-assurance|AI audit and assurance firms|12[/LEADS_DISCOVER_ORG]
["$1","$2","$3"]', 40, 1, 1, 0, datetime('now'), datetime('now'));
