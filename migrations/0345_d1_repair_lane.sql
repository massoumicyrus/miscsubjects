-- WT-0039: THE DIRECT-SQL BYPASS IS CLOSED, AND REPAIR GETS ITS OWN LANE.
--
-- D1_EXEC accepted any write to the content database, so `UPDATE work_tasks SET state='completed'`
-- closed a task without running one acceptance test or appending one audit row, and a write to
-- work_actions could edit the hash chain that exists to prove nothing was edited. That is now refused
-- at functions/_lib/governed_tables.js.
--
-- Refusing without offering anything would only push the next agent to a worse bypass: a bad row has
-- to be fixable without pretending the fix is work. D1_REPAIR is that lane. Same statement, same
-- tables — but it states why, and it lands on the audit chain as a `repair` action. The difference
-- between the two lanes is not permission (both need the owner's key), it is whether the write leaves
-- a record. Only one of them could be silent, and that one is closed.

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, enabled, sensitive, planner_visible, planner_rank, input_schema, updated_at, created_at)
VALUES (
  'D1_REPAIR', 'fn', 'd1Repair', '',
  '# WHAT: Repair a bad row in a governed table (work_tasks, work_actions, articles, article_slots) with a raw statement that cannot be silent — it requires a stated reason and appends a work_actions audit row naming the table, the reason and the row count.
# WHY THIS EXISTS: D1_EXEC refuses those four tables, because an UPDATE there could close a task with no acceptance test run and no audit row written. Repair is still real work, so it gets a lane that is on the record instead of a bypass that is not.
# WHEN_TO_USE: a row is genuinely wrong — a stuck lease, a mis-typed priority, a duplicated slot — and there is no task to submit evidence against. NOT for completing a task (POST /api/work/task/<id>/submit), NOT for writing an article (PUT /api/articles/<slug>).
# ARGS: $1 = reason, at least a dozen characters, written into the audit row. $2 = the full SQL. Inline literal values; double any single quotes.
# EX: [D1_REPAIR]clearing a lease held by a session that died mid-turn|UPDATE work_tasks SET lease_holder=NULL, lease_token=NULL WHERE id = ''WT-0039''[/D1_REPAIR]
["$1","$2"]',
  'd1', 1, 1, 1, 100, NULL, '2026-08-05T06:40:00Z', '2026-08-05T06:40:00Z'
);

-- D1_EXEC's own documentation must say where the four tables went, or the next agent reads a refusal
-- with no destination and goes looking for another way in.
UPDATE directory
   SET updated_at = '2026-08-05T06:40:00Z',
       content = '# WHAT: Run a non-SELECT D1 query (INSERT/UPDATE/DELETE).
# WHEN_TO_USE: writing data to D1.
# ARGS: $1 = the full SQL. Pipes and || are preserved; inline literal values and double any single quotes. No bound parameters — do not append ?|value, write the value inline.
# REFUSED TABLES: work_tasks, work_actions, articles, article_slots. Each has one write path that runs its invariants — POST /api/work/task/<id>/submit for a task, PUT /api/articles/<slug> for an article — and a raw statement here runs none of them. To fix a genuinely bad row use D1_REPAIR, which runs the same statement with a stated reason and an audit row.
# EX: [D1_EXEC]UPDATE directory SET category = ''content-ops'' WHERE key = ''VOXEL_EDIT''[/D1_EXEC]
["$1+"]'
 WHERE key = 'D1_EXEC';
