-- Work order (pre-v0.3, surfaced in STATE.md 2026-07-01): STATE_CARD called
-- GET https://miscsubjects.com/api/cards?limit=$1 with an EMPTY auth column → unauthorized.
-- Give it the same terminal-key header auth as LOCAL_EXEC.
UPDATE directory SET auth = 'headers:{"x-terminal-key":"$TERMINAL_KEY"}', updated_at = datetime('now') WHERE key = 'STATE_CARD';
