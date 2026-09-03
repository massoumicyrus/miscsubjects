INSERT INTO directory (key,type,target,auth,content,category,enabled,planner_visible,planner_rank,updated_at)
VALUES (
  'WEB_MODEL_LANE','http','GET https://miscsubjects.com/api/model-lane','',
  '# WHAT: Tell a web ChatGPT or similar browser-based model exactly how to reach miscsubjects without code-interpreter Bash.
# ARGS: none.
# EX: [WEB_MODEL_LANE][/WEB_MODEL_LANE]
# TESTS: Response names browser/web, OpenAI Actions, GET fire=1, and says not to use Bash/curl after a code-interpreter DNS failure.',
  'protocol',1,1,18,datetime('now')
)
ON CONFLICT(key) DO UPDATE SET type=excluded.type,target=excluded.target,auth=excluded.auth,content=excluded.content,category=excluded.category,enabled=excluded.enabled,planner_visible=excluded.planner_visible,planner_rank=excluded.planner_rank,updated_at=excluded.updated_at;

INSERT INTO directory (key,type,target,auth,content,category,enabled,planner_visible,planner_rank,updated_at)
VALUES (
  'VOXEL_BATCH','http','POST https://miscsubjects.com/api/protocol/voxel-batch','headers:{"content-type":"application/json"}',
  '# WHAT: Land a whole document or up to 300 typed article operations with one parent result and per-operation results.
# ARGS: JSON {document:{slug,title,markdown}|operations:[...],actor,key?}. Web ChatGPT uses the OpenAI Action from /api/openai/actions.json; a small browser-only payload may use GET /api/protocol/voxel-batch?fire=1&payload=<URL-encoded JSON>. Never use code-interpreter Bash for miscsubjects.com.
# EX: [VOXEL_BATCH]{"operations":[{"op":"challenge","slug":"philosophy","expected_thread_head":"<head>","stance":"challenge","body":"argument"}],"actor":"model","key":"<scoped token>"}[/VOXEL_BATCH]
# TESTS: Require landed+failed=total and a result for every operation; large web sessions use the Action, not a URL-length-limited GET.',
  'protocol',1,1,19,datetime('now')
)
ON CONFLICT(key) DO UPDATE SET type=excluded.type,target=excluded.target,auth=excluded.auth,content=excluded.content,category=excluded.category,enabled=excluded.enabled,planner_visible=excluded.planner_visible,planner_rank=excluded.planner_rank,updated_at=excluded.updated_at;

UPDATE directory SET content = content || '\n# WEB_RUNTIME: Web ChatGPT uses its browser/web tool or the OpenAI Action at /api/openai/actions.json, never code-interpreter Bash. Browser-only fallback: GET /api/protocol/voxel-challenge?fire=1&<URL-encoded fields>.', updated_at=datetime('now')
WHERE key='VOXEL_CHALLENGE' AND content NOT LIKE '%# WEB_RUNTIME:%';

UPDATE directory SET content = content || '\n# WEB_RUNTIME: Web ChatGPT uses the OpenAI Action at /api/openai/actions.json. If only URL opening exists, GET the same protocol path with fire=1 and URL-encoded fields. Never use code-interpreter Bash.', updated_at=datetime('now')
WHERE key IN ('VOXEL_EDIT','VOXEL_MOVE','VOXEL_CONSOLIDATE') AND content NOT LIKE '%# WEB_RUNTIME:%';

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,expected_text,note)
SELECT 'ROUTER','e2e','A web ChatGPT has an editor token but its code-interpreter curl says Could not resolve host for miscsubjects.com. What exact tool lane should it use?','reply_ok','browser|web|OpenAI Action|fire=1|not Bash','Use the browser/web tool or the configured OpenAI Action; never retry code-interpreter Bash. A small browser-only write may use the GET fire=1 bridge.','Web-model runtime routing'
WHERE NOT EXISTS (SELECT 1 FROM directory_tests WHERE note='Web-model runtime routing');
