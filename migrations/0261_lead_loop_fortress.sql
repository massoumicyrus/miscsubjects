-- Lead-loop qualification, suppression, compliance and concurrency gates.
ALTER TABLE leads ADD COLUMN enrich_claimed_at TEXT;

CREATE TABLE IF NOT EXISTS lead_suppressions (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  reason TEXT NOT NULL DEFAULT 'opt_out',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings (key,value,description,updated_at) VALUES
  ('outreach_postal_address','','Valid LeoResearch postal address required before any commercial email send.',datetime('now')),
  ('outreach_sending_domain_ready','0','Set to 1 only after the actual From domain passes SPF, DKIM and DMARC alignment checks.',datetime('now'));

UPDATE leads
SET status='rejected', notes=trim(COALESCE(notes,'') || ' review_rejected:fortress_preflight')
WHERE status='drafted' AND (
  score < 65 OR COALESCE(notes,'') NOT LIKE '%mx:ok%' OR length(trim(COALESCE(context,''))) < 40
);

UPDATE leads SET email=NULL, status='new', notes=trim(COALESCE(notes,'') || ' junk_email_removed:noreply')
WHERE lower(email) LIKE 'noreply@%' OR lower(email) LIKE 'no-reply@%';

UPDATE directory SET content=replace(replace(replace(replace(content,
  '- BPC-157 (recovery, gut, injury):','- BPC-157 research background:'),
  '- KPV (inflammation, tendon):','- KPV research background:'),
  '- GHK-Cu (skin, aesthetics):','- GHK-Cu research background:'),
  '- Tesamorelin (body composition):','- Tesamorelin research background:') ||
  '\n\nCOLD-COPY SAFETY: sell the operational offer, not clinical outcomes. Never say or imply the recipient uses peptides; never claim treatment, recovery, healing, efficacy, patient outcomes, or that a peptide is commonly used for anything. Every draft includes the store and: "If this is not relevant, reply no and I will not follow up."',
  updated_at=datetime('now') WHERE key='OUTREACH_DOSSIER';

UPDATE directory SET content='# WHAT: Verify whether the email domain publishes MX records using DNS-over-HTTPS. Tags mx:ok or mx:none. This verifies the domain, not the individual mailbox.\n# WHEN_TO_USE: after enrichment and before ICP scoring or drafting.\n# ARGS: $1=max leads (default 25, cap 50).\n# EX: [LEADS_VERIFY_MX]25[/LEADS_VERIFY_MX]\n["$1"]', updated_at=datetime('now') WHERE key='LEADS_VERIFY_MX';

UPDATE directory SET content='# WHAT: Grok drafts one review-only outreach email grounded in OUTREACH_DOSSIER and the business site. DOES NOT SEND. Hard-blocks unless email domain MX is verified, ICP score is at least 65, site context is sufficient, and recipient is not suppressed.\n# WHEN_TO_USE: only after enrichment, MX verification, and ICP scoring.\n# ARGS: $1=lead id, $2=brand (default LeoResearch).\n# EX: [LEADS_DRAFT_AI]131|LeoResearch[/LEADS_DRAFT_AI]\n["$1","$2"]', updated_at=datetime('now') WHERE key='LEADS_DRAFT_AI';

UPDATE directory SET content='# WHAT: Send one already-reviewed qualified lead draft.\n# WHEN_TO_USE: only after the owner reviewed the exact recipient, subject and body and explicitly approved it.\n# SAFETY: requires literal CONFIRM; mx:ok; ICP >=65; no suppression/duplicate; valid postal-address setting; proven aligned sending-domain setting.\n# ARGS: $1=CONFIRM, $2=lead id, $3=from local-part.\n# EX: [LEADS_SEND]CONFIRM|131|wholesale[/LEADS_SEND]\n["$1","$2","$3"]', updated_at=datetime('now') WHERE key='LEADS_SEND';

INSERT INTO directory_tests (key,kind,args,tier,expect_kind,expect_value,note) VALUES
 ('LEADS_DRAFT_AI','inverse','173|LeoResearch',4,'contains','icp_threshold_not_met','low-fit psychotherapist cannot enter copy review'),
 ('LEADS_SEND','inverse','NO|16|wholesale',4,'contains','explicit_confirmation_required','send stays owner-confirmation gated');
