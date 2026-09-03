-- Tiered, progressively-harder self-test suite. Tier 1 = basic facts; higher tiers = real-time
-- tool use, ledger/state inspection, self-description/philosophy, page-liveness, code audit, and
-- delegating repairs to coding agents. Most high tiers FAIL today on purpose — they are the spec
-- the build must grow into. Reseeded idempotently.
DELETE FROM directory_tests WHERE kind='e2e';
INSERT INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note) VALUES
-- TIER 1 — basic facts (should pass)
('ROUTER','e2e','what time is it',1,'reply_ok','[0-9]','The current time.','t1 fact'),
('ROUTER','e2e','list the articles on the site',1,'reply_ok','article|none|empty|no ','The article list, or that there are none.','t1 articles'),
('ROUTER','e2e','what is bpc-157',1,'reply_ok','bpc|peptide|heal','A real answer about BPC-157.','t1 content'),
-- TIER 2 — real-time tool use ABOUT ITSELF (must use a tool, not generic Grok)
('ROUTER','e2e','how many tools do you have',2,'reply_ok','[1-9][0-9][0-9]','The real directory tool count (hundreds), from a tool call.','t2 self count'),
('ROUTER','e2e','who am I on cloudflare',2,'reply_ok','account|loop|[OWNER_SURNAME]|@','Real wrangler whoami output — account/email.','t2 cloudflare'),
('ROUTER','e2e','what is the router reasoning effort right now',2,'reply_ok','none|low|high|default','The real current setting value.','t2 variable read'),
('ROUTER','e2e','what is my arcads credit balance',2,'reply_ok','credit|balance|[0-9]','The real ArcAds balance from ARCADS_CREDITS.','t2 arcads'),
('ROUTER','e2e','what models can you call',2,'reply_ok','grok|claude|gpt|gemini|kimi','The real model roster wired in the build.','t2 models'),
-- TIER 3 — events ledger + state cards
('ROUTER','e2e','show me the last 5 events in the ledger',3,'reply_ok','event|ledger|message|webhook|trace','The 5 most recent ledger events.','t3 events lookup'),
('ROUTER','e2e','what was the last error in the ledger',3,'reply_ok','error|err|none|no error','The most recent failed event, or that there are none.','t3 ledger errors'),
('ROUTER','e2e','explain the state card for the most recent turn',3,'reply_ok','message|router|tool|reply|trace','A walkthrough of the latest turn: message in, tools, reply.','t3 state card'),
('ROUTER','e2e','what did we change on the build today',3,'reply_ok','deploy|commit|router|self|event|ledger','A real ledger/commit-based summary of changes.','t3 change summary'),
-- TIER 4 — how-to / API (real, concrete)
('ROUTER','e2e','how do I add an article with curl',4,'reply_ok','curl|post|/api/articles','Concrete curl POST to /api/articles.','t4 api add'),
('ROUTER','e2e','how do I change the router prompt',4,'reply_ok','router|set_row_content|directory|edit','Edit the ROUTER row (SET_ROW_CONTENT) and bust the snapshot.','t4 api router'),
('ROUTER','e2e','how do I deploy the build',4,'reply_ok','wrangler|deploy|pages','wrangler pages deploy from the repo dir.','t4 api deploy'),
-- TIER 5 — self-description / build philosophy (must answer AS the build, as the owner views it)
('ROUTER','e2e','what are you, exactly',5,'reply_ok','build|router|directory|os|kernel|tool','An accurate self-description: the miscsubjects build, not generic Grok.','t5 identity'),
('ROUTER','e2e','describe your architecture as an AI OS',5,'reply_ok','directory|tool|router|syscall|kernel|d1','The directory-as-syscall-table / router / Cloudflare OS model.','t5 architecture'),
('ROUTER','e2e','what is the directory and why does it exist',5,'reply_ok','tool|capabilit|registry|anti|sprawl|row','The directory = one registry of capabilities; anti-sprawl.','t5 philosophy'),
-- TIER 6 — page liveness (the build checks its own pages so the owner does not have to report breakage)
('ROUTER','e2e','open the tasks admin page and tell me if it actually renders',6,'reply_ok','render|load|200|works|broken|task','Fetch/screenshot /admin/tasks and report real render state.','t6 page liveness'),
('ROUTER','e2e','screenshot the homepage and tell me what is on it',6,'reply_ok','home|miscsubjects|peptide|content|image','A real screenshot + description of miscsubjects.com.','t6 homepage'),
('ROUTER','e2e','is the self-test page working right now',6,'reply_ok','self|test|render|works|200|broken','Real check of /admin/selftest.','t6 selftest page'),
-- TIER 7 — delegate to coding agents / open repair tickets
('ROUTER','e2e','open a ticket with a coding agent to fix the lowest-scoring self-test question',7,'reply_ok','ticket|agent|claude|kimi|task|queued','Creates a real repair task / dispatches a CLI coding agent.','t7 repair ticket'),
('ROUTER','e2e','ask claude code to audit functions/api/dispatch.js for floating promises',7,'reply_ok','claude|audit|dispatch|promise|queued','Dispatches CLI_CLAUDE_CODE with the audit task.','t7 delegate claude'),
('ROUTER','e2e','ask kimi to list the three biggest risks in blooio.js',7,'reply_ok','kimi|blooio|risk|queued','Dispatches CLI_GROK/KIMI with the task.','t7 delegate kimi'),
-- TIER 8 — code / coverage audit
('ROUTER','e2e','how many directory tools have never been exercised',8,'reply_ok','[0-9]|none|tool|unproven','A real count of unproven tools from the ledger.','t8 coverage'),
('ROUTER','e2e','audit blooio.js and tell me where a reply could fail to send',8,'reply_ok','blooio|reply|send|deliver|window|fail','A real reading of blooio.js delivery paths.','t8 code audit');
