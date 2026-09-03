-- Additional self-test questions (append to the tiered suite). Widen coverage across more tools
-- and use cases. Higher tiers expected to fail until the build grows into them.
INSERT INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note) VALUES
('ROUTER','e2e','how many articles are published',2,'reply_ok','[0-9]|none|no ','Real published-article count.','t2 article count'),
('ROUTER','e2e','what is my stripe balance',2,'reply_ok','balance|[0-9]|usd|\\$','Real Stripe balance (read-only).','t2 stripe'),
('ROUTER','e2e','how many turns happened today',3,'reply_ok','[0-9]|turn|today','Real count from the ledger.','t3 turn count'),
('ROUTER','e2e','search the ledger for the last message from me',3,'reply_ok','message|ledger|trace|found|none','Real ledger search result.','t3 ledger search'),
('ROUTER','e2e','how do I create a page with curl',4,'reply_ok','curl|post|/api/pages','Concrete curl to /api/pages.','t4 api pages'),
('ROUTER','e2e','how do I query the d1 database',4,'reply_ok','d1|sql|select|query','How to run a D1 query (D1_QUERY).','t4 api d1'),
('ROUTER','e2e','how do I add a new tool to the directory',4,'reply_ok','add_row|directory|tool|row','How to ADD_ROW a directory tool.','t4 api add tool'),
('ROUTER','e2e','how is a single turn processed end to end',5,'reply_ok','blooio|router|dispatch|tool|reply|webhook','The full pipeline: webhook -> router -> tool -> reply.','t5 turn pipeline'),
('ROUTER','e2e','what is the difference between the events ledger and the state card',5,'reply_ok','event|state|card|turn|raw|trace','EVENTS=raw firehose; STATE=one assembled card per turn.','t5 events vs state'),
('ROUTER','e2e','open the directory admin page and tell me if it loads',6,'reply_ok','directory|load|render|200|works|broken','Real check of /admin/directory.','t6 directory page'),
('ROUTER','e2e','check if the ledger page renders right now',6,'reply_ok','ledger|render|load|200|works|broken','Real check of the ledger page.','t6 ledger page'),
('ROUTER','e2e','ask claude code to write a test for the article API',7,'reply_ok','claude|test|article|queued|task','Dispatches CLI_CLAUDE_CODE with the task.','t7 delegate test'),
('ROUTER','e2e','list the directory tools that have never fired',8,'reply_ok','[0-9]|tool|unproven|never','Real list/count of unproven tools.','t8 unproven tools'),
('ROUTER','e2e','audit dispatch.js and tell me the tool-loop cap',8,'reply_ok','iter_cap|loop|cap|[0-9]|dispatch','Real reading of the loop cap in dispatch.js.','t8 audit cap');
