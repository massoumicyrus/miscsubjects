-- 0216: OIP article review loop rows.
-- One row seeds review tasks. One row runs one bounded review tick through PROTOCOL_RUN.

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, allowed_categories, planner_visible, planner_rank, enabled, updated_at) VALUES
('OIP_REVIEW_SEED', 'http', 'POST https://miscsubjects.com/api/protocol/oip-seed', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}', '# WHAT: Queue OIP article clarity review tasks. Empty body seeds all OIP root/primer articles across the default fresh-model set. Raw JSON body may pass {"slugs":["oip"],"models":["grok/grok-4.3"]}.
# WHEN_TO_USE: start or refill the recursive OIP article review queue.
# ARGS: $1+ optional raw JSON body
# EX: [OIP_REVIEW_SEED]{"slugs":["oip"],"models":["grok/grok-4.3"]}[/OIP_REVIEW_SEED]
$1+', 'protocol', NULL, 1, 1, 1, datetime('now')),
('OIP_ARTICLE_REVIEW', 'fn', 'protocolRun', '', '# WHAT: Run one OIP article review tick. Claims the next tasks.source=oip-review row, asks a fresh model to score machine JSON clarity and English clarity, stores OIP_ARTICLE_REVIEW in the ledger, and closes or reopens the task.
# WHEN_TO_USE: cron or manual trigger to advance the recursive OIP documentation review loop one step.
# ARGS: none
# EX: [OIP_ARTICLE_REVIEW][/OIP_ARTICLE_REVIEW]
["oip-review"]', 'protocol', NULL, 1, 1, 1, datetime('now'));
