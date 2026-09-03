-- 0275: Ledger spend tail — surfaces cost_in_usd_ticks from xAI responses + grok-cli SPEND rows.
UPDATE directory SET content = '# Last N ledger rows with token/cost when present.
# Args: N (default 20). Shows source=grok API calls (cost from response_json.usage.cost_in_usd_ticks)
# and source=grok-cli SPEND rows (Grok Build / Cursor turns).
LEDGER_QUERY: SELECT id, ts, source, key, action,
  CASE
    WHEN source = ''grok'' AND json_extract(response_json, ''$.usage.cost_in_usd_ticks'') IS NOT NULL
      THEN printf(''$%.6f'', CAST(json_extract(response_json, ''$.usage.cost_in_usd_ticks'') AS REAL) / 10000000000.0)
    WHEN source = ''grok-cli'' AND action = ''spend'' AND json_extract(response_json, ''$.cost_usd_ticks'') IS NOT NULL
      THEN printf(''$%.6f (est=%s)'', CAST(json_extract(response_json, ''$.cost_usd_ticks'') AS REAL) / 10000000000.0, json_extract(response_json, ''$.cost_estimated''))
    ELSE NULL
  END AS cost_usd,
  substr(COALESCE(request_preview, request_json), 1, 120) AS req
FROM events
WHERE source IN (''grok'', ''grok-cli'') AND action IN (''chat_completion'', ''agent'', ''spend'')
ORDER BY ts DESC LIMIT COALESCE(NULLIF(''$1'',''''), 20)'
WHERE key = 'GROK_LEDGER_TAIL';

INSERT OR IGNORE INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank)
VALUES (
  'GROK_SPEND_SUMMARY',
  'flow',
  'LEDGER_QUERY',
  '',
  '# Grok/xAI spend rollup — last 7 days by source+key.
# No args.
LEDGER_QUERY: SELECT source, key,
  COUNT(*) AS calls,
  SUM(CASE WHEN source = ''grok'' THEN CAST(json_extract(response_json, ''$.usage.cost_in_usd_ticks'') AS REAL) ELSE CAST(json_extract(response_json, ''$.cost_usd_ticks'') AS REAL) END) / 10000000000.0 AS cost_usd
FROM events
WHERE ts >= datetime(''now'', ''-7 days'')
  AND ((source = ''grok'' AND json_extract(response_json, ''$.usage.cost_in_usd_ticks'') IS NOT NULL)
    OR (source = ''grok-cli'' AND action = ''spend'' AND json_extract(response_json, ''$.cost_usd_ticks'') IS NOT NULL))
GROUP BY source, key
ORDER BY cost_usd DESC',
  'log',
  1,
  1,
  50
);