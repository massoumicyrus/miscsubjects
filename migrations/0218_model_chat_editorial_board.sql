-- 0218: raw model/chat intake -> editorial board -> OIP purification queue.
-- Raw text is stored in the append-only LEDGER events table/R2; tasks carry pointers.

INSERT OR REPLACE INTO directory
  (key, type, target, auth, content, category, allowed_categories, planner_visible, planner_rank, enabled, updated_at)
VALUES
('MODEL_CHAT_INTAKE', 'http', 'POST https://miscsubjects.com/api/protocol/model-intake', 'headers:{"x-terminal-key":"$TERMINAL_KEY","content-type":"text/plain"}', '# WHAT: Append raw outside-model/chat text to the ledger and queue the receiving editorial board.
# WHEN_TO_USE: paste any model answer, raw chat log, critique, complaint, or documentation feedback into the build so the board extracts rules and queues purification.
# ARGS: $1+ raw text/plain chat log
# EX: [MODEL_CHAT_INTAKE]Claude said OIP is unclear because...[/MODEL_CHAT_INTAKE]
$1+', 'protocol', NULL, 1, 1, 1, datetime('now')),

('EDITORIAL_BOARD_RUN', 'fn', 'protocolRun', '', '# WHAT: Run one receiving editorial-board task. It reads a MODEL_CHAT_INTAKE ledger event, extracts owner complaints and content-rule defects as JSON, ledgers EDITORIAL_BOARD_DECISION, and queues OIP purification.
# WHEN_TO_USE: after raw model/chat intake, or cron, to process one editorial-board queue item.
# ARGS: none
# EX: [EDITORIAL_BOARD_RUN][/EDITORIAL_BOARD_RUN]
["editorial-board"]', 'protocol', NULL, 1, 1, 1, datetime('now')),

('OIP_PURIFICATION_SEED', 'http', 'POST https://miscsubjects.com/api/protocol/oip-purify-seed', 'headers:{"x-terminal-key":"$TERMINAL_KEY","content-type":"application/json"}', '# WHAT: Queue OIP documentation purification under logical-proof-v1. Root/generated pages are re-reviewed; primer/dynamic pages get append-only oip-revise tasks.
# WHEN_TO_USE: after content rules change or after an editorial-board decision identifies unclear/proofless OIP documentation.
# ARGS: optional raw JSON {"slugs":["oip","oip-operating-model"],"brief":"..."}
# EX: [OIP_PURIFICATION_SEED]{"slugs":["oip","oip-operating-model"],"brief":"Every claim must be proven by route/object/receipt."}[/OIP_PURIFICATION_SEED]
$1+', 'protocol', NULL, 1, 1, 1, datetime('now'));
