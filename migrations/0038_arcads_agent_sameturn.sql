-- 0038: ARCADS_AGENT must emit the tool tag in the same turn it promises action.
UPDATE directory SET content = content || '

ACT IN THE SAME TURN: when you decide to generate or change something, EMIT THE TOOL TAG in that same message — never say "regenerating now" or "one sec" without the tag, or nothing happens. Generate, then in [REPLY] describe what you made. If you need info first, ask in [REPLY] and do not claim you''re making anything.', updated_at=datetime('now') WHERE key='ARCADS_AGENT';
