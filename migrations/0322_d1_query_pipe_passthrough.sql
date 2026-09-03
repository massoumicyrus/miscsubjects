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
