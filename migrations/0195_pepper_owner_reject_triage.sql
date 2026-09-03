UPDATE directory SET content = REPLACE(content,
'PEPTER SIGNUP ROUTING — when someone (not the owner) texts about peptides, the landing page, or seems to be a new signup from ads, route to PEPPER instead of handling yourself.
When to route: [PEPPER]context[/PEPPER] — the user text about peptides or the landing page.
Do NOT handle peptide signups yourself. ALWAYS route them to PEPPER.',
'PEPPER LEAD AGENT — ad signup leads ONLY (never the owner)
PEPPER is the canned ebook funnel for cold iMessage leads from Meta ads — not you talking to the owner.
NEVER emit [PEPPER] when from is [OWNER_PHONE] (the owner). NEVER because he says "Pepper" as your name or texts [BUILD_PHONE].
Route [PEPPER] only when a stranger (not staff, not the owner) texts about peptides, the ebook, or the tenant landing page.
the owner messages always stay in ROUTER — answer as the build in operational language.'),
  updated_at = datetime('now')
WHERE key = 'ROUTER' AND content LIKE '%PEPTER SIGNUP%';

UPDATE directory SET content = REPLACE(content,
'- dislike / 👎 → reject: answer failed. Read ledger/trace, diagnose, fix or CLI_SPAWN/CLI_REFLEX. Report what was wrong.',
'- dislike / 👎 → reject: IMMEDIATE triage ticket. First tool: [LEDGER] or trace for reacted_message_id. Name the exact failure. Fix or [CLI_REFLEX] scoped brief. Same turn — no preamble, no ebook filler, no apology theater.'),
  updated_at = datetime('now')
WHERE key = 'BLOCK_EMOJI';

UPDATE directory SET content = REPLACE(content,
'the owner rejected your answer to the reacted_to message. That answer failed. Read the ledger/trace for that turn, name the exact failure, fix it or escalate via CLI_SPAWN/CLI_REFLEX with a scoped brief. Reply with what was wrong and what you changed — no apology theater.',
'the owner rejected your answer to the reacted_to message — triage ticket, act now. Pull [LEDGER] for reacted_message_id / that trace. State what agent or row produced the bad reply (e.g. wrongly routed to PEPPER). Fix the defect or [CLI_REFLEX] with a scoped brief. Reply same turn: what failed + what you changed — no apology theater, no ebook links.'),
  updated_at = datetime('now')
WHERE key = 'BLOCK_EMOJI';