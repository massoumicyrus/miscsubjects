-- LOCAL_BATTERY ran bare `pmset $1+` with no args → "Usage: pmset" exit 1 every time. The real
-- battery-status command is `pmset -g batt`.
UPDATE directory SET content = '# WHAT: read battery % and AC power state on the Mac. ARGS: none.
# EX: [LOCAL_BATTERY][/LOCAL_BATTERY]
{"cmd":"sh","args":["-lc","pmset -g batt"],"timeout":120000}', updated_at = datetime('now') WHERE key = 'LOCAL_BATTERY';
