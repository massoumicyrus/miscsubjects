-- Self-test suite v2: question / expected / actual, per-version scoring, CRUD-able.
-- Storage reuses directory_tests (kind='e2e'); adds human-readable expected + last-run columns.
ALTER TABLE directory_tests ADD COLUMN expected_text TEXT;
ALTER TABLE directory_tests ADD COLUMN last_actual TEXT;
ALTER TABLE directory_tests ADD COLUMN last_passed INTEGER;
ALTER TABLE directory_tests ADD COLUMN last_run_id TEXT;

-- Per-version scoreboard: one row per self-test run, so the build can be scored per version
-- and advancement tracked over time.
CREATE TABLE IF NOT EXISTS selftest_runs (
  run_id        TEXT PRIMARY KEY,
  build_version TEXT NOT NULL,
  ts            TEXT NOT NULL DEFAULT (datetime('now')),
  total         INTEGER NOT NULL DEFAULT 0,
  passed        INTEGER NOT NULL DEFAULT 0,
  score         REAL NOT NULL DEFAULT 0,
  note          TEXT
);

-- A build version label the runs are scored against (bumped on deploy).
INSERT INTO settings (key, value, description, updated_at)
VALUES ('build_version', 'v1', 'Self-test build version label', datetime('now'))
ON CONFLICT(key) DO NOTHING;

DELETE FROM directory_tests WHERE kind='e2e';
INSERT INTO directory_tests (key, kind, args, expect_kind, expect_value, expected_text, note) VALUES
('ROUTER','e2e','what can you do','reply_ok','tool|article|deploy|run|search|build','A plain-language summary of its capabilities (tools, articles, deploy, shell, search).','self-description'),
('ROUTER','e2e','how many tools do you have','reply_ok','[0-9]','A number (current directory tool count, ~664).','tool count'),
('ROUTER','e2e','list the articles on the site','reply_ok','article|none|empty|no ','The list of article slugs/titles, or that there are none.','articles list'),
('ROUTER','e2e','how do I add an article with curl','reply_ok','curl|post|/api/articles','curl POST to /api/articles with x-terminal-key and a JSON body.','API how-to: add article'),
('ROUTER','e2e','how do I edit an article with curl','reply_ok','curl|patch|put|/api/articles','curl PATCH/PUT to /api/articles/<slug> with the changed fields.','API how-to: edit article'),
('ROUTER','e2e','how do I read an article with curl','reply_ok','curl|get|/api/articles','curl GET /api/articles/<slug>.','API how-to: read article'),
('ROUTER','e2e','how do I delete an article with curl','reply_ok','curl|delete|/api/articles','curl DELETE /api/articles/<slug> with x-terminal-key.','API how-to: delete article'),
('ROUTER','e2e','how do I make a widget in an article','reply_ok','widget|article|embed|block','How widgets are embedded in article bodies.','API how-to: widget'),
('ROUTER','e2e','how do I change the router prompt','reply_ok','router|prompt|directory|content|edit','Edit the ROUTER directory row content (EDIT_ROW / directory PATCH) and bust the snapshot.','API how-to: change router prompt'),
('ROUTER','e2e','how do I change a build variable like reasoning effort','reply_ok','set|setting|reasoning|variable|kv','Use the SET_* settings (e.g. reasoning effort) / settings API.','API how-to: change variable'),
('ROUTER','e2e','what is the router reasoning effort right now','reply_ok','none|low|high|default|reason','The current reasoning-effort setting value.','variable read'),
('ROUTER','e2e','show me the agent topology','reply_ok','tool|categor|agent|map','A summary of the tool/agent topology by category.','topology'),
('ROUTER','e2e','who am I on cloudflare','reply_ok','account|cloudflare|email|loop|@','The Cloudflare account/identity (via wrangler whoami over LOCAL_EXEC).','cloudflare identity'),
('ROUTER','e2e','what is bpc-157','reply_ok','bpc|peptide|heal|article|not','A real answer about BPC-157 (from the article or knowledge).','content: bpc-157'),
('ROUTER','e2e','what is retatrutide','reply_ok','tenant|peptide|glp|weight|not','A real answer about retatrutide.','content: retatrutide'),
('ROUTER','e2e','what did we change on the build today','reply_ok','','A ledger-based summary of recent changes.','ledger summary'),
('ROUTER','e2e','how do I deploy the build','reply_ok','wrangler|deploy|pages|local_exec','Run wrangler pages deploy from the repo dir via LOCAL_EXEC.','API how-to: deploy'),
('ROUTER','e2e','how do I run a shell command on my mac','reply_ok','local_exec|shell|command|/t ','Use LOCAL_EXEC (or the /t prefix) to run a shell command on the Mac.','API how-to: shell'),
('ROUTER','e2e','how do I send myself a text from the build','reply_ok','send|message|blooio|text|sms','Send via the Blooio send tool to the owner number.','API how-to: send text'),
('ROUTER','e2e','what is on the homepage','reply_ok','home|page|miscsubjects|content','A description of the homepage content.','content: homepage'),
('ROUTER','e2e','how do I see the ledger for a trace','reply_ok','ledger|trace|card|/api/ledger','Use the LEDGER tool / /api/ledger?card=<trace>.','API how-to: ledger'),
('ROUTER','e2e','what models can you call','reply_ok','grok|claude|gpt|gemini|kimi|model','The model agents available (Grok/Claude/GPT/Gemini/Kimi...).','capability: models'),
('ROUTER','e2e','how do I generate an image','reply_ok','image|generate|grok|arcads|openai','Use an image-gen tool (GROK_IMAGE / ARCADS / OPENAI_IMAGE).','API how-to: image'),
('ROUTER','e2e','what is my arcads credit balance','reply_ok','credit|balance|[0-9]','The current ArcAds credit balance.','capability: arcads balance'),
('ROUTER','e2e','how do I run the self test','reply_ok','self|test|fidelity|/api/selftest','Run the self-test via /api/selftest or FIDELITY_RUN.','meta: self-test');
