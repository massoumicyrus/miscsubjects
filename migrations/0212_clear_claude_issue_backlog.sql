-- Clear the Claude/Grok open work that blocked fresh URL-only models:
-- 1) ARTICLES list is slim/fast by default.
-- 2) ARTICLES set/compose are no longer dead advertised operations.
-- 3) GitHub issue/comment operations are native OIP rows, not shell-quoted CLI guesses.

UPDATE directory SET
  target = 'target_map:{"list":{"method":"GET","url":"https://miscsubjects.com/api/articles?slim=1&limit=80"},"get":{"method":"GET","url":"https://miscsubjects.com/api/articles/$1"},"create":{"method":"POST","url":"https://miscsubjects.com/api/articles","body":"{\"slug\":\"$1\",\"title\":\"$2\",\"subject\":\"$3\"}"},"update":{"method":"PATCH","url":"https://miscsubjects.com/api/articles/$1","body":"{\"title\":\"$2\"}"},"delete":{"method":"DELETE","url":"https://miscsubjects.com/api/articles/$1"},"set":{"method":"POST","url":"https://miscsubjects.com/api/articles/$1/set","body":"{\"slot_key\":\"$2\",\"content\":\"$3\"}"},"compose":{"method":"POST","url":"https://miscsubjects.com/api/articles/$1/compose","body":"{\"slot_key\":\"$2\",\"brief\":\"$3\"}"}}',
  content = '# WHAT: Fast natural-language article CRUD. One row per article in D1; writes are URL-invocable through OIP.
# WHEN_TO_USE: list/read/create/rename/delete articles, set a manual article slot, or ask the writer to compose/revise a slot.
# ARGS: op | args
# EX: [ARTICLES]list[/ARTICLES]
# EX: [ARTICLES]get|bpc-157[/ARTICLES]
# EX: [ARTICLES]set|bpc-157|mechanism|replacement section text[/ARTICLES]
# EX: [ARTICLES]compose|bpc-157|mechanism|make it more precise and evidence-graded[/ARTICLES]
# OPS:
#   list                                  -> compact index, never huge/full article payload
#   get|<slug>                            -> one full article
#   create|<slug>|<title>|<subject>       -> create article shell
#   update|<slug>|<title>                 -> rename article
#   delete|<slug>                         -> delete mutable article
#   set|<slug>|<slot_key>|<content>       -> manual slot override, no LLM
#   compose|<slug>|<slot_key>|<brief>     -> asks the writer, stores a new slot version, returns nested receipt',
  examples = '[{"args":"list","desc":"Fast compact article index"},{"args":"get|bpc-157","desc":"Read one article"},{"args":"set|bpc-157|mechanism|replacement text","desc":"Manual slot override"},{"args":"compose|bpc-157|mechanism|tighten the mechanism section","desc":"Compose and store a new slot version"}]',
  updated_at = datetime('now')
WHERE key = 'ARTICLES';

INSERT OR REPLACE INTO directory
  (key, type, target, auth, content, category, runner, planner_rank, planner_visible, enabled, input_schema, updated_at)
VALUES
('GITHUB_LIST_ISSUES', 'fn', 'githubListIssues', '',
'# WHAT: List GitHub issues in [OWNER_HANDLE]/miscsubjects-pages through the GitHub API.
# WHEN_TO_USE: list/show open GitHub issues, audit the issue backlog, inspect Grok-created issues.
# ARGS: state | labels | limit
# EX: [GITHUB_LIST_ISSUES]open||30[/GITHUB_LIST_ISSUES]
["$1","$2","$3"]',
'github', 'edge', 20, 1, 1, '{"args":["state","labels","limit"]}', datetime('now')),

('GITHUB_GET_ISSUE', 'fn', 'githubGetIssue', '',
'# WHAT: Read one GitHub issue by number from [OWNER_HANDLE]/miscsubjects-pages.
# WHEN_TO_USE: inspect an issue body, labels, title, state, and URL before acting.
# ARGS: issue_number
# EX: [GITHUB_GET_ISSUE]38[/GITHUB_GET_ISSUE]
["$1"]',
'github', 'edge', 20, 1, 1, '{"args":["issue_number"]}', datetime('now')),

('GITHUB_ADD_ISSUE_COMMENT', 'fn', 'githubAddIssueComment', '',
'# WHAT: Post a comment to a GitHub issue through the GitHub API. This is the canonical URL-only comment path.
# WHEN_TO_USE: comment on GitHub, reply to an issue, post proof/receipt on an issue.
# ARGS: issue_number | comment_body
# EX: [GITHUB_ADD_ISSUE_COMMENT]38|Proof: native GitHub OIP comment path works.[/GITHUB_ADD_ISSUE_COMMENT]
["$1","$2+"]',
'github', 'edge', 10, 1, 1, '{"args":["issue_number","comment_body"]}', datetime('now')),

('GITHUB_CREATE_ISSUE', 'fn', 'githubCreateIssue', '',
'# WHAT: Create a GitHub issue through the GitHub API.
# WHEN_TO_USE: file a build work item, proposal, bug, or proof ticket from OIP.
# ARGS: title | body | labels_csv
# EX: [GITHUB_CREATE_ISSUE]OIP proof ticket|Created by the protocol.|proposal[/GITHUB_CREATE_ISSUE]
["$1","$2","$3"]',
'github', 'edge', 10, 1, 1, '{"args":["title","body","labels_csv"]}', datetime('now'));

INSERT OR IGNORE INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note) VALUES
('ROUTER','e2e','list the articles on the site',1,'reply_ok','article|/a/|bpc|tb-500','ARTICLES list returns fast compact article index.','articles list fast path'),
('ROUTER','e2e','comment on github issue 38 with proof that the native OIP comment path exists',3,'reply_ok','GITHUB_ADD_ISSUE_COMMENT|comment|issue','GitHub comment intent resolves to native row, not CLI_GH guessing.','github comment row'),
('ROUTER','e2e','when a new article is created, what event automation fires',3,'reply_ok','ARTICLE_CREATED|AUTOMATE_FIRE|automation','Article-created event automations are wired.','article created automation');
