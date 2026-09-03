-- OIP v0.8.1 — composite trail rows are high-risk wrappers because their effective
-- risk is the maximum risk of their recorded steps. Runtime still gates every step.
UPDATE directory
SET sensitive = 1,
    content = '# WHAT: Name a sequence of past invocations as an authority-preserving TRAIL. Stores each step''s object key and recorded input in the current owner/capability/tenant namespace.
# ARGS: name|inv_ID1,inv_ID2,... (2-20 receipt ids, oldest first, comma-separated)
# EX: [TRAIL_SAVE]morning-report|inv_abc123,inv_def456[/TRAIL_SAVE]
# PRECONDITIONS: caller may read every source receipt; caller scope permits every source object; every source receipt belongs to the same authority namespace
# EFFECTS: writes one namespaced trail record to KV; stores the exact recorded step inputs
# POSTCONDITIONS: result names the namespace, maximum step risk, and saved receipt ids; no step is executed
# SAFE: false
# IDEMPOTENT: true
# TESTS: foreign receipt -> ERR:trail:receipt_denied. Mixed authority -> ERR:trail:mixed_authority_namespaces. TRAIL_ steps are refused.
["$1","$2"]',
    updated_at = datetime('now')
WHERE key = 'TRAIL_SAVE';

UPDATE directory
SET sensitive = 1,
    content = '# WHAT: Run a named authority-preserving TRAIL. Every recorded step is re-authorized under the current caller, consumes that caller''s use budget, and produces a receipt linked to the original invocation.
# ARGS: name (the trail name given to TRAIL_SAVE)
# EX: [TRAIL_RUN]morning-report[/TRAIL_RUN]
# PRECONDITIONS: trail exists in the current authority namespace; current credential independently permits every step; all ancestor, tenant, risk, owner-gate, fixed-body, and use-budget checks pass
# EFFECTS: executes steps sequentially until the first denial or failed result; each executed step may produce its declared effects
# POSTCONDITIONS: every executed step has a new receipt with replay_of lineage; execution stops at the first failure; ok=true only when every step succeeds
# SAFE: false
# IDEMPOTENT: false
# TESTS: TRAIL_RUN-only token cannot execute a NOW step. Revoked ancestor stops before execution. Failed step stops later steps.
["$1"]',
    updated_at = datetime('now')
WHERE key = 'TRAIL_RUN';

UPDATE directory
SET content = '# WHAT: List saved trails in the current owner/capability/tenant authority namespace.
# ARGS: (none)
# EX: [TRAIL_LIST][/TRAIL_LIST]
# PRECONDITIONS: current invocation has a verified owner or recorded capability context
# EFFECTS: reads namespaced trail metadata only; does not expose recorded step inputs
# POSTCONDITIONS: returns only trail names, step counts, maximum risk, and creation timestamps from the caller namespace
# SAFE: true
# IDEMPOTENT: true
# TESTS: caller sees only its own namespace; missing authority fails closed.
[]',
    updated_at = datetime('now')
WHERE key = 'TRAIL_LIST';
