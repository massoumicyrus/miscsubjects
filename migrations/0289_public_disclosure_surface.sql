-- Public, immutable, secret-scanned defensive-publication artifact surface.
INSERT OR REPLACE INTO directory
  (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes)
VALUES (
  'DISCLOSURE_GET','http','GET https://miscsubjects.com/disclosure/$1','',
  '# WHAT: Read a versioned public defensive-publication artifact from the disclosure archive. Text is scanned for bearer/credential material at read time; binary artifacts are admitted only after local render/hash/credential review. Keys are immutable and public.
# ARGS: $1 = public disclosure path returned by a publication manifest, for example 2026-07-17/operation-killbox-v1.1/specification.md.
# TESTS: Unknown paths and traversal return 404; text containing credential material returns a generic 404; successful responses include immutable caching, CORS, nosniff and sandbox headers.
["$1"]',
  datetime('now'),'protocol','protocol,content-provenance,public-anchors',979,1,1,14,
  '{"type":"string","pattern":"^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,500}$"}',
  '["2026-07-17/operation-killbox-v1.1/specification.md"]',0,'http',''
);

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'Give a cold lawyer the exact public files and machine ledger for the Kimi killbox defensive publication without exposing the swarm token.',
  'reply_ok',
  'DISCLOSURE_GET|disclosure|specification.md|docx|territory-ledger|manifest|never|token',
  'patent-strategy claims are public, explicit, downloadable and safe while raw swarm credentials remain private',
  'Return the versioned /disclosure manifest, canonical Markdown, DOCX and territory-ledger JSON. Never expose the raw swarm capability, plan, transcript, or private archive.',
  8
);
