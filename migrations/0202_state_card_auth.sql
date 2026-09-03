UPDATE directory SET auth = 'headers:{"x-terminal-key":"$TERMINAL_KEY"}', updated_at = datetime('now') WHERE key = 'STATE_CARD';
