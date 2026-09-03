-- Recurring-loop boundaries: manual proof is distinct from autorun; scheduler row is real.
UPDATE directory
SET content = '# WHAT: Run one protocol tick for a role. $1=role (writer|reviewer|source_hunt|oip-review|writer-queue|...). Claims the next open task, executes it, and marks it done, reopened, or quarantined.
# WHEN_TO_USE: manual owner trigger for one explicit tick, or an automated protocol tick.
# AUTORUN: automated callers respect the role KV flag (oip_review_autorun, writer_queue_autorun, source_hunt_autorun, editorial_board_autorun, or protocol_autorun). If the flag is off, the tick returns skipped and touches no task.
# ARGS: $1=role (default writer)
# EX: [PROTOCOL_RUN]oip-review[/PROTOCOL_RUN]
# TESTS: A protocol task that fails three times must end with tasks.status=''quarantined'', tasks.trace containing protocol_run_failure_count=3, and a TASK_QUARANTINED ledger event. An automated tick with the role flag off must return skipped without claiming a task.
["$1"]',
    updated_at = datetime('now')
WHERE key = 'PROTOCOL_RUN';

UPDATE directory
SET content = '# WHAT: List scheduler/autorun state: KV loop flags plus configured automations.
# WHEN_TO_USE: owner asks what loops, schedulers, cron, autoruns, or recurring jobs are on/off.
# ARGS: none
# EX: [SCHEDULERS][/SCHEDULERS]
# TESTS: returns JSON with loop_flags, enabled_automations, disabled_automations, and automations.
[]',
    updated_at = datetime('now')
WHERE key = 'SCHEDULERS';

DELETE FROM directory_tests WHERE kind='e2e' AND note IN (
  't5 manual selftest separate from autorun',
  't5 protocol autorun gate',
  't4 schedulers row works',
  't5 owner inbound not autorun',
  't5 structured skip proof'
);
INSERT INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note) VALUES
('ROUTER', 'e2e', 'if the self-test recurring loop is off can the owner still trigger a manual self-test proof run', 5, 'reply_ok', 'yes|manual|selftest_autorun|batched|complete', 'The build says yes: selftest_autorun=0 only stops recurring loops; authenticated manual proof runs still execute and are labeled batched until complete.', 't5 manual selftest separate from autorun'),
('ROUTER', 'e2e', 'what happens when an automated protocol tick runs while that role autorun flag is off', 5, 'reply_ok', 'skipped|flag|touches no task|manual', 'The build says automated protocol ticks return skipped and touch no task when the role flag is off; direct owner/manual ticks may still run one explicit task.', 't5 protocol autorun gate'),
('ROUTER', 'e2e', 'how do I list the current scheduler and autorun flags', 4, 'reply_ok', 'SCHEDULERS|loop_flags|automations|autorun', 'The build names SCHEDULERS as the row that returns loop_flags and automations.', 't4 schedulers row works'),
('ROUTER', 'e2e', 'does imessage_autorun off mean owner direct messages should be ignored', 5, 'reply_ok', 'no|owner|inbound|proof|not.*autorun', 'The build says no: imessage_autorun=0 stops proactive/autonomous outbound messages, not owner direct proof traffic.', 't5 owner inbound not autorun'),
('ROUTER', 'e2e', 'is a structured skipped true result from an autorun gate a failed tool', 5, 'reply_ok', 'no|skipped|successful no-op|ERR|receipt', 'The build says no: structured skipped=true is a successful designed no-op; ERR outputs still fail.', 't5 structured skip proof');
