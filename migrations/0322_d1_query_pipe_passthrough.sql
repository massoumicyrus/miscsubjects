-- Ledger audit 2026-07-22: the single largest systemic failure class was SQL truncated by the
-- dispatch pipe-split. D1_QUERY used the template ["$1"] — only the text before the first "|"
-- reached the database, so any SELECT containing "|" or "||" (concatenation, string literals,
-- bitwise) executed a truncated fragment and returned a D1 syntax error. Hundreds of failures.
-- Fix: pass the whole SQL through with ["$1+"] (args rejoined with "|"), matching how D1_EXEC and
-- the voxel rows already work. D1_QUERY takes no bind parameters, so full passthrough is correct.
UPDATE directory
SET content =
'# WHAT: Run a SELECT query on the D1 database.
# WHEN_TO_USE: any read operation on D1 tables.
# ARGS: $1 = the full SQL SELECT. Pipes and || are preserved now; inline literal values and double any single quotes. No bound parameters.
# EX: [D1_QUERY]SELECT * FROM directory WHERE key = ''ROUTER''[/D1_QUERY]
["$1+"]',
    updated_at = datetime('now')
WHERE key = 'D1_QUERY';

-- D1_EXEC already passed the whole body as SQL (["$1+"]) but its EX advertised a ?|value|value
-- bind-parameter shape that the template does not honor, so callers following the example jammed
-- the params into the SQL and hit "unrecognized token". Correct the doc to inline-value usage.
UPDATE directory
SET content =
'# WHAT: Run a non-SELECT D1 query (INSERT/UPDATE/DELETE).
# WHEN_TO_USE: writing data to D1.
# ARGS: $1 = the full SQL. Pipes and || are preserved; inline literal values and double any single quotes. No bound parameters — do not append ?|value, write the value inline.
# EX: [D1_EXEC]UPDATE directory SET category = ''content-ops'' WHERE key = ''VOXEL_EDIT''[/D1_EXEC]
["$1+"]',
    updated_at = datetime('now')
WHERE key = 'D1_EXEC';
