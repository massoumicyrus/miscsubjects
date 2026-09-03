-- Protocol poison-pill cleanup: failed protocol tasks get quarantined after three tries.
UPDATE directory
SET content = '# WHAT: Run one protocol tick for a role. $1=role (writer|reviewer|source_hunt|oip-review|writer-queue|...). Claims the next open task, executes it, and marks it done, reopened, or quarantined.
# WHEN_TO_USE: cron or manual trigger to advance one protocol pipeline step.
# ARGS: $1=role (default writer)
# EX: [PROTOCOL_RUN]oip-review[/PROTOCOL_RUN]
# TESTS: A protocol task that fails three times must end with tasks.status=''quarantined'', tasks.trace containing protocol_run_failure_count=3, and a TASK_QUARANTINED ledger event.
["$1"]',
    updated_at = datetime('now')
WHERE key = 'PROTOCOL_RUN';

DELETE FROM directory_tests WHERE kind='e2e' AND note='t5 protocol poison-pill quarantine';
INSERT INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note) VALUES
('ROUTER', 'e2e', 'what happens when the same protocol task fails three times', 5, 'reply_ok', 'quarantined|three|failure|task|ledger', 'The build says repeated protocol task failures are quarantined after three tries and recorded in the ledger.', 't5 protocol poison-pill quarantine');
