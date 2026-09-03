-- LOCAL_READ's auth column was stored double-escaped: headers:{\"x-terminal-key\":\"$TERMINAL_KEY\"}
-- applyAuth JSON.parses the headers spec → "Expected property name or '}' at position 1" on every call.
-- Store the clean form LOCAL_EXEC uses.
UPDATE directory SET auth = 'headers:{"x-terminal-key":"$TERMINAL_KEY"}', updated_at = datetime('now') WHERE key = 'LOCAL_READ';
