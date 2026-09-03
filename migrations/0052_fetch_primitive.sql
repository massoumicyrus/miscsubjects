-- Migration 0052 — universal fetch primitive + fix LBL_GET/LBL_POST.
-- http rows URL-encode substituted vars, so a path arg like "v4/health" became
-- "v4%2Fhealth" and 404'd. fn rows substitute in json-string mode (no URL mangling),
-- so the URL keeps its slashes. WEB_GET/WEB_FETCH give the build a general window to
-- any URL/API; LBL_GET/LBL_POST become thin wrappers over the same fn.

INSERT INTO directory (key, type, target, auth, content, category, planner_rank, updated_at) VALUES
('WEB_GET', 'fn', 'httpFetch', '',
'# GET any URL and return its status + body (first 20000 chars). Arg: the full https URL (slashes and query string preserved). Full request/response logged. when_to_use: read any web page or public API — "look around the internet", check a doc, hit a third-party endpoint. Grok also has native web_search for open-ended search; use WEB_GET when you know the exact URL.
["GET","$1+","",""]',
'web', 40, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('WEB_FETCH', 'fn', 'httpFetch', '',
'# Call any URL with any method. Args: method|url|body|headers_json. body and headers_json optional. Full request/response logged (credentials redacted). when_to_use: POST/PUT/DELETE to any API, or GET with custom headers/auth. Example: POST|https://api.example.com/x|{"a":1}|{"Authorization":"Bearer XYZ"}
["$1","$2","$3","$4"]',
'web', 42, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LBL_GET', 'fn', 'httpFetch', '',
'# GET a path on the loop data platform (api.lbl.fyi, the loop-api-worker). Arg: the path after the host, e.g. "v4/health" or "2chat/contacts" (slashes preserved). Returns raw JSON + status. when_to_use: the owner asks for data from the loop platform / lbl.fyi. If a path needs auth (401), use WEB_FETCH with the right header, or ask the owner for the token.
["GET","https://api.lbl.fyi/$1+","",""]',
'loopdata', 45, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LBL_POST', 'fn', 'httpFetch', '',
'# POST to the loop data platform (api.lbl.fyi). Args: path|json_body. when_to_use: trigger/send something on the loop platform. For custom auth headers use WEB_FETCH.
["POST","https://api.lbl.fyi/$1","$2+",""]',
'loopdata', 46, strftime('%Y-%m-%dT%H:%M:%fZ','now'))

ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- Teach OPS + TERMINUS the web window.
UPDATE directory SET
  content = content || '

THE INTERNET: [WEB_GET]https://full/url[/WEB_GET] reads any URL; [WEB_FETCH]method|url|body|headers_json[/WEB_FETCH] for any method/auth. Grok web_search is for open-ended search; WEB_GET/WEB_FETCH for exact URLs and APIs.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key IN ('OPS','TERMINUS') AND content NOT LIKE '%THE INTERNET:%';
