-- OIP v1.1 — FEDERATION: the FED_SEND directory object (DB: miscsubjects-content).
-- Sends a signed oip-message/1 envelope from the home agent (pepper@miscsubjects.com) to a
-- remote agent at another domain, resolving its key + inbox from that domain's well-known.
-- The human-facing federation control: "message that agent and ask for X".
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, updated_at) VALUES
('FED_SEND', 'fn', 'fedSend', '', '# WHAT: Send a signed federation message (oip-message/1) from the home agent to a remote agent at ANOTHER domain, and return that agent''s signed reply. Cross-domain agent-to-agent messaging; the two current test nodes are separately deployed under one operator.
# ARGS: recipient|kind|rest — recipient=agent@domain. kind=query|invoke.
#   agent@domain|query|<text>                        -> ask a question; the remote node runs nothing, echoes the text as data.
#   agent@domain|invoke|KEY|<args>|<capability_token> -> hand a capability across the federation; the remote node runs KEY only if the capability is audience-bound to it and passes every gate.
# EX: [FED_SEND][REDACTED_EMAIL]|query|what time is it[/FED_SEND]
# WHEN_TO_USE: coordinate with an agent on a different domain. The recipient''s signing key + inbox come from its https://<domain>/.well-known/oip.json; the reply signature is verified before it is trusted.
# TESTS: bad recipient -> ERR:fed:bad_recipient. Unreachable domain -> {ok:false, reason:recipient_unresolvable:...}. Valid query -> signed result echo. Federation proof: /api/dispatch?fedtest=1.
["$1","$2","$3+"]', 'federation', datetime('now'));
