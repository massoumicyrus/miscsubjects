
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, enabled, sensitive, planner_visible, planner_rank, input_schema, updated_at, created_at)
VALUES (
  'OWNER_REPORT', 'fn', 'ownerReport', '',
  '# WHAT: Send a report to the owner and prove it arrived. Returns the inbound ledger row id that witnessed the message crossing the internet, or an explicit not_witnessed failure. Never reports a send on faith.
# WHY: two owner reports came back {ok:true, messageId} and never landed. ok:true from the send API means Cloudflare accepted the message, nothing more. Owner-addressed sends are the one class with no BCC witness, so "sent" could not be distinguished from "dropped".
# HOW: addressed to build@miscsubjects.com, which routes through Cloudflare Email Routing to a worker that ledgers the arrival and forwards it to the owner. Owner BCC rides the same envelope, so he receives it twice by two independent paths.
# WHEN_TO_USE: every report, inventory, digest or answer addressed to the owner. Use EMAIL_SEND_TRACKED for outreach to third parties instead.
# ARGS: $1 = subject (the [OWNER REPORT] prefix is added). $2 = body text. $3 = seconds to wait for the ledger row (default 30, max 60; observed round trip is about 25s).
# EX: [OWNER_REPORT]six tasks closed, both articles live|Links first: https://miscsubjects.com/a/tesofensine ...[/OWNER_REPORT]
["$1","$2","$3"]',
  'email', 1, 0, 1, 35, NULL, '2026-08-05T08:50:00Z', '2026-08-05T08:50:00Z'
);
