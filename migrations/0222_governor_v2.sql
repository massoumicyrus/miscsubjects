-- 0222 — DB (miscsubjects-content). Governor v2: talk to it, file claims, breaker probe,
-- ROUTER routing (with backup), charter G8 (no invention) + G9 (recurrence memory).

-- Backup the current ROUTER prompt before touching it (rollback = copy value back).
INSERT INTO settings (key, value, description, updated_at)
SELECT 'router_prompt_backup_0222', content, 'ROUTER content before migration 0222 governor clauses', datetime('now')
FROM directory WHERE key='ROUTER'
ON CONFLICT(key) DO NOTHING;

-- Route natural language to the governor (append-only; idempotent via marker check).
UPDATE directory SET
  content = content || char(10) ||
    'G_gov1: WHEN the owner says "governor report" / "run governor" / "build brief" / "whats breaking" / "what is going on with the build" → THEN [GOVERNOR_RUN][/GOVERNOR_RUN] and reply with the returned verdict + flags. The full brief is emailed automatically.' || char(10) ||
    'G_gov2: WHEN the owner starts a message with "governor" followed by a question, or says "ask the governor ..." → THEN [GOVERNOR_ASK]his question verbatim[/GOVERNOR_ASK] and reply with the returned answer VERBATIM, never a summary.',
  updated_at = datetime('now')
WHERE key='ROUTER' AND content NOT LIKE '%G_gov1:%';

INSERT INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank, updated_at)
VALUES (
  'GOVERNOR_ASK',
  'fn',
  'governorAsk',
  '',
  '# WHAT: Ask the GOVERNOR (build manager) a question. It answers from the live 24h digest + recurrence memory + charter — counts in parentheses, sized for iMessage.
# WHEN_TO_USE: the owner texts "governor <question>" or "ask the governor ...", or any model wants the manager''s evidence-grounded read on build health, conflicts, or what keeps recurring.
# ARGS: the question, verbatim
# EX: [GOVERNOR_ASK]why is the task backlog so big[/GOVERNOR_ASK]
["$1+"]',
  'governance', 1, 1, 21, datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth, content=excluded.content,
  category=excluded.category, enabled=excluded.enabled, planner_visible=excluded.planner_visible,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

INSERT INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank, updated_at)
VALUES (
  'FILE_CLAIM',
  'fn',
  'fileClaim',
  '',
  '# WHAT: Advisory write-locks so coding agents stop double-editing the same file. KV-backed, TTL auto-expires.
# WHEN_TO_USE: BEFORE editing any repo file: claim it. AFTER finishing: release it. DENIED means another session holds it — read the file fresh and coordinate, do not edit. See AGENTS.md "WRITE LAW".
# ARGS: op(claim|release|check|list) | file path | holder as agent:session | ttl minutes (default 90)
# EX: [FILE_CLAIM]claim|functions/api/dispatch.js|claude:abc123|90[/FILE_CLAIM]
["$1","$2","$3","$4"]',
  'governance', 1, 1, 22, datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth, content=excluded.content,
  category=excluded.category, enabled=excluded.enabled, planner_visible=excluded.planner_visible,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- Breaker proof row: GETs our own /api/email/send with no key → clean 401 every time.
-- Hidden from planners; exists to prove (and later re-verify) the auth circuit breaker.
INSERT INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank, updated_at)
VALUES (
  'BREAKER_PROBE',
  'http',
  'POST https://miscsubjects.com/api/email/send',
  '',
  '# WHAT: Deliberately unauthenticated call that returns 401 — exercises the auth circuit breaker.
# WHEN_TO_USE: never in normal operation; verification only.
{"to":"probe","subject":"probe","text":"probe"}',
  'governance', 1, 0, 999, datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth, content=excluded.content,
  category=excluded.category, enabled=excluded.enabled, planner_visible=excluded.planner_visible,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- Charter: add G8 (invention ban with mechanics) + G9 (recurrence memory) to GOVERNOR.
UPDATE directory SET
  content = content || char(10) ||
    'G8 NO INVENTION (mechanics): every numeric claim carries its digest count in parentheses. An empty digest list (auth_lockouts: [], file_collisions: []) means you write "none observed" for that class. Writing an incident the digest does not contain is a firing offense.' || char(10) ||
    'G9 RECURRENCE MEMORY: the digest field issue_recurrence carries your cross-brief counters. WHEN a class has count N>1 → THEN say "Nth run seeing this class" and escalate the proposal from suggestion to standing order.',
  updated_at = datetime('now')
WHERE key='GOVERNOR' AND content NOT LIKE '%G8 NO INVENTION%';
