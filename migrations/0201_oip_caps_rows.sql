-- OIP v0.3 — OIP-Caps directory rows (loop-content-spine / DB).
-- Six fn verbs so ROUTER drives the capability/receipt loop from natural language.
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at) VALUES
('CAP_MINT', 'fn', 'capMint', '',
'# WHAT: Mint a scoped, short-lived, ledgered capability URL — delegated authority over exactly one row (or read/act tier), with TTL, use count, purpose, risk ceiling, and owner gate. Returns invoke_url + explain_url + fingerprint; the URL explains itself.
# WHEN_TO_USE: the owner says "mint a token/capability/link for <KEY>", "give a model a 10 minute key to X", "one-shot link for NOW".
# ARGS: $1=scope (row|act|read), $2=row key (for scope row), $3=ttl seconds (default 600), $4=max uses (default 1, 0=unlimited), $5=purpose (plain english), $6=risk_ceiling (low|high, default low), $7=owner_gate (0|1, default 0).
# EX: [CAP_MINT]row|NOW|600|1|demo for chatgpt[/CAP_MINT]
["$1","$2","$3","$4","$5","$6","$7"]', 'oip', 20, 1, 1, datetime('now')),
('CAP_EXPLAIN', 'fn', 'capExplain', '',
'# WHAT: Explain a capability: what it may invoke, verbs, expiry + remaining TTL, uses left, risk ceiling, owner gate, revocation, ledger trail. Accepts the token itself (sh.…) or its fingerprint (cap_…). Never echoes the raw token.
# WHEN_TO_USE: the owner asks "what can this token do", "explain this capability", "is cap_x still valid".
# ARGS: $1 = capability token or cap_ fingerprint.
# EX: [CAP_EXPLAIN]cap_1a2b3c4d5e6f7a8b[/CAP_EXPLAIN]
["$1"]', 'oip', 30, 1, 1, datetime('now')),
('CAP_REVOKE', 'fn', 'capRevoke', '',
'# WHAT: Revoke a capability by fingerprint — the URL dies immediately; further invokes are denied and ledgered.
# WHEN_TO_USE: the owner says "revoke that token", "kill cap_x", "cut that model off".
# ARGS: $1 = cap_ fingerprint.
# EX: [CAP_REVOKE]cap_1a2b3c4d5e6f7a8b[/CAP_REVOKE]
["$1"]', 'oip', 30, 1, 1, datetime('now')),
('OIP_RECEIPT', 'fn', 'oipReceipt', '',
'# WHAT: Read one invocation back as a receipt: full recorded request + response, lineage (replay_of/repairs/repaired_by), and the verbs that act on it. A receipt is a live replayable object, not history.
# WHEN_TO_USE: the owner asks "show the receipt for inv_x", "what happened in inv_x", "why did that fail".
# ARGS: $1 = invocation id (inv_…).
# EX: [OIP_RECEIPT]inv_wvitbmiym6[/OIP_RECEIPT]
["$1"]', 'oip', 20, 1, 1, datetime('now')),
('OIP_REPLAY', 'fn', 'oipReplay', '',
'# WHAT: Re-fire a past invocation with its recorded input. New receipt links replay_of to the old one.
# WHEN_TO_USE: the owner says "replay that", "run inv_x again", "re-fire it as it was".
# ARGS: $1 = invocation id (inv_…).
# EX: [OIP_REPLAY]inv_wvitbmiym6[/OIP_REPLAY]
["$1"]', 'oip', 20, 1, 1, datetime('now')),
('OIP_REPAIR', 'fn', 'oipRepair', '',
'# WHAT: Repair a failed invocation from its receipt: inspects the failure, derives or takes the corrected key+body, fires it linked (new receipt carries repairs, old receipt gains repaired_by). Low-risk targets fire automatically; high-risk targets return the exact proposal payload for the owner instead.
# WHEN_TO_USE: the owner says "repair that failed invocation", "fix inv_x with NOW", "make that call again but corrected".
# ARGS: $1 = failed invocation id, $2 = corrected row key (optional — derived from the failure when omitted), $3+ = corrected body (optional, may contain pipes).
# EX: [OIP_REPAIR]inv_6ximjestte|NOW|[/OIP_REPAIR]
["$1","$2","$3+"]', 'oip', 20, 1, 1, datetime('now'));
