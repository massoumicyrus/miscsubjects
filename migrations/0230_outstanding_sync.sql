INSERT OR REPLACE INTO directory
  (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at)
VALUES
  (
    'OUTSTANDING_SYNC_EMAIL',
    'fn',
    'outstandingSync',
    '',
    '# WHAT: Build one unified outstanding-sync report and email it: every open GitHub issue, open/running task inventory, Kimi CLI/Desktop sync state, and historical recurring problem classes.
# WHEN_TO_USE: The owner asks to sync GitHub issues, tasks, Kimi, model work, outstanding work, or wants everything sent by email.
# ARGS: mode. blank/force = send email + short iMessage notice. dry = collect only, no send.
# EX: [OUTSTANDING_SYNC_EMAIL]force[/OUTSTANDING_SYNC_EMAIL]
["$1"]',
    'sync',
    NULL,
    230,
    1,
    1,
    230,
    datetime('now')
  );
