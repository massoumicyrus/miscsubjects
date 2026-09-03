-- D1_EXEC takes raw SQL. Preserve pipes inside SQL by using $1+.
UPDATE directory
SET content = '# WHAT: Run a non-SELECT D1 query (INSERT/UPDATE/DELETE).
# WHEN_TO_USE: writing data to D1.
# ARGS: $1 = SQL. Pipes inside SQL are preserved.
# EX: [D1_EXEC]UPDATE directory SET content = ? WHERE key = ?|new content|ROUTER[/D1_EXEC]
["$1+"]'
WHERE key = 'D1_EXEC';
