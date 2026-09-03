-- A REPORT TO THE OWNER IS SENT WHEN THERE IS EVIDENCE IT ARRIVED, NOT WHEN THE API SAID ok.
--
-- 2026-08-05, reported twice: "I have still not received an email to me that I requested." Two sends
-- had returned {ok:true, messageId:"<...>"} and nothing landed. Neither response was a lie and neither
-- was a receipt — env.EMAIL.send() accepted the message, which is all ok:true has ever meant.
--
-- The worst case is specifically the owner-addressed send. /api/email/send BCCs both owner addresses on
-- every outbound message, so a normal send always has him as a witness; it deliberately skips that
-- injection when the recipient already is an owner inbox. So the one class of message whose entire
-- purpose is to reach him was the only class with no second copy and no way to tell delivered from
-- dropped. "Sent" was unfalsifiable — the same shape as the Apps Script health payload.
--
-- OWNER_REPORT sends to build@miscsubjects.com, whose MX points at Cloudflare Email Routing with a
-- worker that ledgers every inbound message and forwards it on. The message must leave Cloudflare and
-- cross the public internet, its arrival is written where the function reads it back, and the last hop
-- is a routing forward rather than a fresh send. The owner BCC rides the same envelope, so he gets it
-- twice by two independent paths. The return value is a ledger row id or an explicit failure.

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
