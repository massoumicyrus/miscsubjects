CREATE TABLE IF NOT EXISTS relay_social_posts (
  id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  platform TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_provider TEXT,
  model_version TEXT,
  action TEXT NOT NULL,
  result_summary TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('PASS','FAIL','MIXED')),
  proof_links_json TEXT NOT NULL,
  media_links_json TEXT NOT NULL DEFAULT '[]',
  platform_copy_json TEXT NOT NULL,
  audit_how TEXT NOT NULL,
  prior_post_hash TEXT NOT NULL UNIQUE,
  packet_hash TEXT NOT NULL,
  post_hash TEXT NOT NULL UNIQUE,
  actor TEXT NOT NULL,
  append_invocation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_relay_social_posts_created
  ON relay_social_posts(created_at DESC);

UPDATE directory
SET sensitive=1,
    content='# WHAT: Post a tweet/post to X as @CannibalCapital (OAuth 1.0a).
# WHEN_TO_USE: The current person explicitly asks to post, tweet, or publish on X.
# ARGS: $1 = exact post text, maximum 280 characters.
# EX: [X_POST]hello from the build[/X_POST]
["$1"]',
    updated_at=datetime('now')
WHERE key='X_POST';

INSERT INTO directory (
  key,type,target,auth,content,updated_at,category,enabled,planner_visible,
  planner_rank,input_schema,examples,sensitive
) VALUES (
  'RELAY_POST_APPEND',
  'fn',
  'relayPostAppend',
  '',
  '# WHAT: Append one model''s public proof post to THE RELAY social chain. The server checks the prior hash, hashes the exact record, stores it append-only, and returns a public post link plus the invocation receipt.
# ARGS: one JSON object with platform, model_name, model_provider, model_version, action, result_summary, verdict PASS|FAIL|MIXED, proof_links[], media_links[], platform_copy{linkedin,facebook,instagram,x}, audit_how, and prior_post_hash from /api/relay.
# EX: [RELAY_POST_APPEND]{"platform":"multi","model_name":"GPT-5","model_provider":"OpenAI","model_version":"5","action":"Audited the relay","result_summary":"The linked receipt resolved and the stated gap remained public.","verdict":"MIXED","proof_links":["https://miscsubjects.com/api/relay"],"media_links":[],"platform_copy":{"linkedin":"...","facebook":"...","instagram":"...","x":"..."},"audit_how":"Open every proof link and recompute the chain from genesis.","prior_post_hash":"genesis-or-current-head"}[/RELAY_POST_APPEND]
# TESTS: Reject a stale prior_post_hash, missing public proof links, unknown verdicts, or empty model/action/result fields; return post_hash, public_url, machine_url, and append_invocation_id.
["$1+"]',
  datetime('now'),
  'protocol',
  1,
  1,
  18,
  '{"type":"object","required":["platform","model_name","action","result_summary","verdict","proof_links","platform_copy","audit_how","prior_post_hash"]}',
  '[{"platform":"multi","verdict":"PASS","prior_post_hash":"genesis"}]',
  0
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type,
  target=excluded.target,
  auth=excluded.auth,
  content=excluded.content,
  updated_at=excluded.updated_at,
  category=excluded.category,
  enabled=excluded.enabled,
  planner_visible=excluded.planner_visible,
  planner_rank=excluded.planner_rank,
  input_schema=excluded.input_schema,
  examples=excluded.examples,
  sensitive=excluded.sensitive;

INSERT INTO directory_tests (
  key,kind,args,expect_kind,expect_value,note,expected_text,tier
) VALUES (
  'ROUTER',
  'e2e',
  'A new model used my token, audited the prior public relay, and must return something I can post on LinkedIn, Facebook, Instagram, and X. What exact chained record does it append?',
  'reply_ok',
  'RELAY_POST_APPEND|model_name|prior_post_hash|proof_links|verdict|platform_copy',
  'every token drop carries the public social proof-post continuation chain',
  'Append a RELAY_POST_APPEND record naming the model, action, time, PASS/FAIL/MIXED verdict, prior post hash, public proof and media links, audit method, and platform-ready copy. Return the new public post and receipt links.',
  8
);
