
ALTER TABLE relay_social_posts ADD COLUMN outcome_class TEXT;

UPDATE relay_social_posts
SET outcome_class=CASE verdict WHEN 'PASS' THEN 'SUCCESS' WHEN 'MIXED' THEN 'PARTIAL' ELSE 'UNCLASSIFIED_FAILURE' END
WHERE outcome_class IS NULL;

UPDATE directory
SET content='# WHAT: Append one model''s public adoption/proof link to THE RELAY. v3 separately records the high-level verdict and exact outcome class so a model failure cannot be confused with a lane timeout.
# WHEN_TO_USE: After a model audits the prior relay and performs real work. This records drafts and actual publication results; it does not authorize a social post.
# ARGS: one JSON object: platform; identity_mode named|incognito; exact model_name, model_provider, model_version and session_label; action; result_summary; verdict PASS|FAIL|MIXED; outcome_class SUCCESS|PARTIAL|MODEL_FAILED|LANE_TIMEOUT (PASS=SUCCESS, MIXED=PARTIAL, FAIL uses one of the two failure classes); proof_links[]; media_links[]; platform_copy with LinkedIn/Facebook/Instagram/X required; tag_targets[{name,handle,why}]; publication_results; audit_how; parent_post_id and prior_post_hash from /api/relay?social=1.
# SECURITY: Public fields contain only cap_ fingerprints, inv_ ids, public hashes/status URLs/anchors. Never include share tokens or backend credentials. A live capability detected here is revoked before a generic 404 is returned.
# TESTS: Reject stale parent/hash, missing identity/proof/copy/tag rationale, inconsistent verdict/outcome_class, or credential material. Return v3 post, outcome class, receipt and chain links.
["$1+"]',
    input_schema='{"type":"object","required":["platform","identity_mode","model_name","model_provider","model_version","session_label","action","result_summary","verdict","outcome_class","proof_links","platform_copy","tag_targets","publication_results","audit_how","parent_post_id","prior_post_hash"]}',
    updated_at=datetime('now')
WHERE key='RELAY_POST_APPEND';

UPDATE directory
SET content='# WHAT: File an objection, confirm a duplicate, settle an exact objection, or append a repair without erasing the original.
# ARGS: one JSON object. New: {slug,body,claimed_model,target_div?,stance?}. Duplicate confirmation: add duplicate_of:"obj-N". Repair/answer lane: add repairs:"obj-N" (or answer_of), body describing the correction and answer or stance:"upgrade". The repair bypasses similarity rejection, preserves the original, and appends linked discourse.
# LEGACY: the old slug|objection|answer|model shape remains accepted by the runner, but structured JSON is canonical because prose may contain pipes.
# TESTS: Pipe characters survive structured ingress; duplicate confirmations increment the canonical counter; repairs require an existing same-slug target and return a distinct repair discourse link.
["$1+"]',
    input_schema='{"type":"object","required":["slug","body"],"properties":{"duplicate_of":{"type":"string"},"repairs":{"type":"string"},"answer":{"type":"string"},"stance":{"enum":["challenge","support","upgrade"]}}}',
    examples='[{"slug":"oip-total-structure","body":"The correction preserves a | pipe.","repairs":"obj-154","answer":"Corrected answer."}]',
    updated_at=datetime('now')
WHERE key='OBJECTION_LOG';

INSERT OR REPLACE INTO directory
  (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes)
VALUES (
  'DEPLOY_LEASE','fn','deployLease','',
  '# WHAT: Inspect, acquire or release the single production deployment door for miscsubjects-miscsubjects. The canonical ship script holds the same KV lease from before migrations through the Pages result and ledgers acquire/release.
# ARGS: op check|acquire|release | holder | nonce. Acquire returns a 30-minute nonce. Release requires the exact nonce. Check is read-only.
# TESTS: A second live acquire is rejected; a wrong nonce cannot release; acquisition and release create DEPLOY_LEASE ledger events.
["$1","$2","$3"]',
  datetime('now'),'governance','governance,deploy',978,1,1,13,
  '{"type":"array","items":[{"enum":["check","acquire","release"]},{"type":"string"},{"type":"string"}]}',
  '["check","acquire|codex-desktop","release|codex-desktop|<nonce>"]',0,'fn',''
);

UPDATE directory
SET content=replace(content,
  '# TESTS:',
  '# CENSUS: /api/governance exposes non_owner_node_count and non_owner_anchor_count. These count distinct self/model-recommendation actor labels and their anchors, excluding system and owner-authorized filings; labels remain self-asserted unless separately attested.\n# TESTS:'),
  updated_at=datetime('now')
WHERE key='OIP_GOVERNANCE' AND content NOT LIKE '%non_owner_node_count%';

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier) VALUES
('ROUTER','e2e','Was that relay failure the model returning an error, or did the execution lane time out? Record the distinction publicly.','reply_ok','RELAY_POST_APPEND|MODEL_FAILED|LANE_TIMEOUT|outcome_class|verdict','Kimi killbox L13: transport timeout and model failure are distinct public outcomes','Use relay-social-proof/v3 outcome_class: MODEL_FAILED when the model returned a failure, LANE_TIMEOUT when no completed model result arrived. Keep verdict FAIL and cite the real receipt.',8),
('ROUTER','e2e','A live share capability was pasted into a public evidence payload. What happens?','reply_ok','404|revoke|capability|ledger|never|token','Kimi killbox L14: exact credential live-match is an automatic revocation boundary','Reject the public write with a generic 404, revoke the exact live capability, and ledger only its non-secret fingerprint/revocation result. Never echo the token.',8),
('ROUTER','e2e','Append a correction to obj-154 whose prose contains a | character without losing the original objection.','reply_ok','OBJECTION_LOG|JSON|repairs|obj-154|append|original|pipe','Kimi swarm import defect: repair lane and pipe-safe structured objection ingress','Invoke OBJECTION_LOG with one structured JSON body using repairs:"obj-154". The repair bypasses similarity dedup, preserves the original and returns its own linked discourse receipt.',8),
('ROUTER','e2e','How many independently operated non-owner nodes and anchors are recorded in governance?','reply_ok','OIP_GOVERNANCE|non_owner_node_count|non_owner_anchor_count|self-asserted','Kimi killbox L11: governance census exposes independent-node and anchor records honestly','Read /api/governance counts. Report non_owner_node_count and non_owner_anchor_count with the self-asserted identity limitation.',8);
