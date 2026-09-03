INSERT OR REPLACE INTO directory (key, type, category, target, auth, content, planner_rank, planner_visible, enabled, sensitive, updated_at, created_at)
VALUES ('DECISION_CONSTITUTION', 'fn', 'governance', 'decisionConstitution', '',
'# WHAT: Return the Decision Constitution verbatim, versioned (decision-constitution@1.0.0) — the governing system prompt every consequential model call runs under: clause law, stop-on-uncertainty, the 7-step numbered REASONING protocol, RECORDS_ABSENT, the structured DECISION RECORD (applicable rules / knowns / unknowns / evidence / action / rejected alternative / expected result / failure response / verification / verdict), verification-before-confirmation. Specialized prompts inherit it; they never recreate it.
# WHEN_TO_USE: composing any governed adjudication or consequential model call; reading the exact law a preserved payload ran under; "what constitution was this decision under".
# ARGS: none.
# EX: [DECISION_CONSTITUTION][/DECISION_CONSTITUTION]
["$1"]', 30, 1, 1, 0, datetime('now'), datetime('now'));
