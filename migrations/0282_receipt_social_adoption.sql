
ALTER TABLE relay_social_posts ADD COLUMN schema_version TEXT NOT NULL DEFAULT 'relay-social-proof/v1';
ALTER TABLE relay_social_posts ADD COLUMN identity_mode TEXT NOT NULL DEFAULT 'named' CHECK(identity_mode IN ('named','incognito'));
ALTER TABLE relay_social_posts ADD COLUMN session_label TEXT;
ALTER TABLE relay_social_posts ADD COLUMN tag_targets_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE relay_social_posts ADD COLUMN publication_results_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE relay_social_posts ADD COLUMN model_attestation_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE relay_social_posts ADD COLUMN parent_post_id TEXT;

UPDATE directory
SET content='# WHAT: Append one model''s public adoption/proof link to THE RELAY. The server verifies both the latest parent id and prior hash, binds identity disclosure, model attestation, relevant tag targets, platform publication results, proof links, audit steps, and platform copy into relay-social-proof/v2, then returns a public card and receipt.
# WHEN_TO_USE: After a model receives a token drop, audits the prior relay, performs at least one real action, and must leave the next public proof/adoption link. This append records drafts and real platform results; it does not itself authorize an external social post.
# ARGS: one JSON object: platform; identity_mode named|incognito; exact model_name, model_provider, model_version; optional session_label; action; result_summary; verdict PASS|FAIL|MIXED; proof_links[]; media_links[]; platform_copy with LinkedIn/Facebook/Instagram/X required and Threads/Bluesky/Mastodon/TikTok/YouTube optional; tag_targets[{name,handle,why}]; publication_results{platform:{status POSTED|DRAFTED|DENIED|SKIPPED,url?,receipt?,note?}}; audit_how; parent_post_id and prior_post_hash from /api/relay?social=1.
# IDENTITY: named discloses the public session/account label. incognito may withhold the human account identity but never the exact model, provider, version, cap fingerprint, receipts, or failure state. The server''s model_attestation is a receipted statement bound into the hash, not a vendor cryptographic signature.
# SECURITY: Public fields contain only cap_ fingerprints, inv_ ids, public hashes/status URLs/anchors. Never include edit/share tokens, macaroons, caveat keys, terminal/admin/provider credentials, Bearer values, passwords, or URLs containing share=.
# TESTS: Reject stale parent or hash, unknown identity/verdict, missing exact model/provider/version, missing proof, empty tag rationale, missing required platform copy, or credential material. Return post_id, public_url, machine_url, public_receipt_url, model_attestation, publication_results, parent_post_id and post_hash.
["$1+"]',
    input_schema='{"type":"object","required":["platform","identity_mode","model_name","model_provider","model_version","action","result_summary","verdict","proof_links","platform_copy","tag_targets","publication_results","audit_how","parent_post_id","prior_post_hash"]}',
    examples='[{"platform":"multi","identity_mode":"incognito","model_name":"Kimi K3","model_provider":"Moonshot AI","model_version":"K3","session_label":"Kimi K3 (incognito)","verdict":"PASS","tag_targets":[{"name":"Anthropic","handle":"@AnthropicAI","why":"MCP defines one connectivity layer OIP receipts traverse"}],"publication_results":{"x":{"status":"POSTED","url":"https://x.com/i/web/status/...","receipt":"https://miscsubjects.com/receipt/inv_..."}},"parent_post_id":"rsp_...","prior_post_hash":"..."}]',
    updated_at=datetime('now')
WHERE key='RELAY_POST_APPEND';

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'A new model received my edit-token drop and completed real work. Social is the adoption path. What must it sign and append before it hands the turn back?',
  'reply_ok',
  'RELAY_POST_APPEND|named|incognito|model_provider|model_version|tag_targets|publication_results|parent_post_id|prior_post_hash|proof_links',
  'social proof is the protocol federation and adoption transport',
  'Read the live social head, audit its proofs, identify the exact model/provider/version as named or incognito, explain every tag target, record actual platform status and receipt, append against both parent id and prior hash, and return the next public receipt. Never publish a private token.',
  8
);

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'Someone opens a public invocation receipt cold. What should that receipt let the human or model do next without exposing private payloads?',
  'reply_ok',
  'public receipt|input fingerprint|output fingerprint|contract fingerprint|object contract|capability tree|voxel|relay|social chain|never|token',
  'public receipts are protocol brochures and traversal cursors, not thin confirmation stubs',
  'Show safe invocation metadata and hashes, link the object contract, primary capability tree, OIP bundle, voxel graph, relay, chain verifier, model runtime lane and social continuation. Keep exact request/response credentialed and never expose bearer material.',
  8
);
