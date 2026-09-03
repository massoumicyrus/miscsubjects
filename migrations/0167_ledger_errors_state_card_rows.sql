-- Make ROUTER diagnostic prompt references concrete rows.
INSERT INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank, updated_at)
VALUES
('LEDGER_ERRORS','fn','ledgerQuery','',
'# WHAT: Return the most recent ledger event whose own response starts with ERR.
# WHEN_TO_USE: the owner asks for the last error, recent errors, or why something failed.
# ARGS: none.
# EX: [LEDGER_ERRORS][/LEDGER_ERRORS]
["SELECT ts,key,action,status,trace_id,substr(request_preview,1,180) AS request,substr(response_preview,1,500) AS response FROM events WHERE response_preview LIKE ''ERR:%'' ORDER BY ts DESC LIMIT 1"]',
'ledger',1,1,20,datetime('now')),
('STATE_CARD','http','GET https://miscsubjects.com/api/cards?limit=$1','',
'# WHAT: Return assembled state cards from the ledger: message/input, tools, output, trace.
# WHEN_TO_USE: the owner asks for a state card or the most recent turn card.
# ARGS: $1 = optional limit, default 1.
# EX: [STATE_CARD]1[/STATE_CARD]',
'ledger',1,1,20,datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type,
  target=excluded.target,
  auth=excluded.auth,
  content=excluded.content,
  category=excluded.category,
  enabled=excluded.enabled,
  planner_visible=excluded.planner_visible,
  planner_rank=excluded.planner_rank,
  updated_at=excluded.updated_at;
