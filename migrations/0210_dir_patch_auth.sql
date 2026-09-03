-- DIR_PATCH (edit a prompt/capability) self-calls the admin PATCH /api/directory/<KEY>, which
-- needs the terminal key — but its auth only set Content-Type, so it 401'd. Add the key so
-- "edit a prompt" actually works over GET ?invoke=DIR_PATCH&body=KEY|{"content":"..."}.
UPDATE directory SET auth = 'headers:{"Content-Type":"application/json","x-terminal-key":"$TERMINAL_KEY"}', updated_at = datetime('now') WHERE key = 'DIR_PATCH';
