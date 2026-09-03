-- 0102: agent-callable ledger tools. The owner wants agents to be able to REST-call
-- both the state CARDS and the raw EVENTS, not just the turns view (LEDGER, already exists).
-- CARDS = one state card per isolated event (message + every raw payload/step + reply),
-- by trace/card id. EVENTS = the raw chronological row-per-call log, text search.
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,planner_visible,planner_rank,enabled,updated_at) VALUES
('CARDS','http','GET https://miscsubjects.com/admin/ledger?cards=1&limit=10&card_id=$1','',
'# Read the STATE CARDS. One card per isolated event: the inbound message (plain text), the reply (plain text), the agent system prompt, and every tool/CLI/file/http step with its raw payload in/out — each classified. Every card has a trace id (card_id) and a content hash, and is REST-callable.
# INVOKE: [CARDS][/CARDS] for the latest, or [CARDS]<card_id>[/CARDS] (e.g. t_dzncmzck or cc_42) for one card.',
'log',NULL,1,100,1,'2026-06-18T00:00:00.000Z'),
('EVENTS','http','GET https://miscsubjects.com/admin/ledger?data=1&limit=20&q=$1','',
'# Read the raw EVENTS log — one row per call, newest first, chronological. Each row: source, key, action, status, request/response preview, trace id, step. $1 optional = text to search across key/action/payload.
# INVOKE: [EVENTS][/EVENTS] for the latest, or [EVENTS]<search text>[/EVENTS].',
'log',NULL,1,100,1,'2026-06-18T00:00:00.000Z');
