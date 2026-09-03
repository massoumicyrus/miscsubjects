-- Per-turn cost ledger. dispatch() writes one row per top-level turn (trace, key, cost, ts).
CREATE TABLE IF NOT EXISTS turn_costs (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  trace TEXT,
  key   TEXT,
  cost  REAL NOT NULL DEFAULT 0,
  ts    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS turn_costs_ts_idx ON turn_costs(ts);

INSERT OR REPLACE INTO directory(key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES
('COST_REPORT','fn','d1Query','',
'# Cost summary: total turns, total USD, average USD/turn, and the 10 priciest recent turns.
# WHEN_TO_USE: "what has this cost", "cost per turn", "how much am I spending".
["SELECT (SELECT COUNT(*) FROM turn_costs) AS turns, (SELECT ROUND(SUM(cost),4) FROM turn_costs) AS total_usd, (SELECT ROUND(AVG(cost),5) FROM turn_costs) AS avg_usd_per_turn"]','audit','',94,1,1,34,strftime('%Y-%m-%dT%H:%M:%SZ','now'));
