-- 0063_fidelity_run.sql — FIDELITY_RUN as a fn (dispatches every directory_tests row,
-- evaluates expect_kind/expect_value, logs to fidelity_log, returns counts).

INSERT OR REPLACE INTO directory(key, type, target, auth, content, category, allowed_categories, seq, enabled, planner_visible, planner_rank, updated_at) VALUES
('FIDELITY_RUN', 'fn', 'fidelityRun', '',
'# Run the whole fidelity bank. $1 optional kind filter (positive | inverse | agent-route). Logs to fidelity_log. Returns JSON {run_id,total,passed,failed,duration_ms,failing}.
# WHEN_TO_USE: "run the fidelity tests", "fidelity green?", "are the tests passing".
# TESTS:
# POSITIVE: {"key":"FIDELITY_RUN","body":""} → JSON has total>=50 and passed>=total*0.8 (kernel passes most rows)
["$1"]',
'audit', '', 90, 1, 1, 30,
strftime('%Y-%m-%dT%H:%M:%SZ','now'));
