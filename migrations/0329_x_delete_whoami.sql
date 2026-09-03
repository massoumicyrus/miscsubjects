INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,sensitive,enabled,planner_visible,planner_rank,created_at)
VALUES (
  'X_DELETE','fn','xDelete','',
  '# WHAT: Delete ONE tweet the account published (DELETE /2/tweets/:id, same OAuth1 creds as X_POST).
# WHEN_TO_USE: the owner directs a post to be removed, or a post that violated the format law must be retracted. Owner-directed only — never autonomous timeline pruning.
# ARGS: $1 = tweet id or full status URL
# RETURNS: {ok,deleted_id,response}
# EX: [X_DELETE]2080749124673302742[/X_DELETE]',
  '2026-07-24 00:00:00','x',1,1,1,64,'2026-07-24 00:00:00'
);
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,sensitive,enabled,planner_visible,planner_rank,created_at)
VALUES (
  'X_WHOAMI','fn','xWhoami','',
  '# WHAT: Report which X credentials are present and what X says about them (GET /2/users/me).
# WHEN_TO_USE: X_POST or X_DELETE returns 401/403 and you need the real cause instead of a bare "Unauthorized".
# ARGS: none
# RETURNS: {ok,status,creds_present:{...},response}
# EX: [X_WHOAMI][/X_WHOAMI]',
  '2026-07-24 00:00:00','x',0,1,1,65,'2026-07-24 00:00:00'
);
