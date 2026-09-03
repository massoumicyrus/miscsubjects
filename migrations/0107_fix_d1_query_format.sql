UPDATE directory SET content = '# WHAT: Run a SELECT query on the D1 database.
# WHEN_TO_USE: any read operation on D1 tables.
# ARGS: $1 = SQL query. Subsequent args are bound parameters.
# EX: [D1_QUERY]SELECT * FROM directory WHERE key = ?[/D1_QUERY]
["$1","$2+"]'
WHERE key = 'D1_QUERY';

UPDATE directory SET content = '# WHAT: Run a non-SELECT D1 query (INSERT/UPDATE/DELETE).
# WHEN_TO_USE: writing data to D1.
# ARGS: $1 = SQL. Subsequent args are bound parameters.
# EX: [D1_EXEC]UPDATE directory SET content = ? WHERE key = ?[/D1_EXEC]
["$1","$2+"]'
WHERE key = 'D1_EXEC';
