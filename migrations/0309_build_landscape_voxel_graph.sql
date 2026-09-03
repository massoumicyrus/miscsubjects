-- The build/field comparison is a projection of the existing article voxel graph.
-- Articles hold claims, hash-chained sources, discourse and revisions. Tasks only queue research.

UPDATE articles
SET title='What this build is — evidence board', subject='Build and field comparison',
body='# What this build is, what the field has, and what the evidence establishes

This article is the root of the build comparison graph.

It keeps four records separate: what other systems say they have; what opened evidence establishes about them; what this build says it has; and what opened evidence establishes about this build.

The build shares durable state, tools, agent orchestration, traces, retries, code execution, and integrations with the field. Its current distinguishing property is the combination of public claim-addressable articles, append-only outside-model discourse, a capability registry, operational receipts, multi-model coding history, live integrations, and recursive source changes in one owner-operated deployment. The combination is demonstrated here. Global uniqueness is not demonstrated.

The current failure is explanatory and evidentiary: registered features and vocabulary have outrun source-backed proof of use. Repair exists as receipt-linked replay, but routine autonomous use is not proved.

Four-column board: https://miscsubjects.com/build-audit

Machine record: https://miscsubjects.com/api/build-audit

Landscape table: https://miscsubjects.com/api/build-landscape

Claim voxels: https://miscsubjects.com/api/articles/opos-formal-audit/claims

Source ledger: https://miscsubjects.com/api/articles/opos-formal-audit/sources

Outside-model discourse: https://miscsubjects.com/api/articles/opos-formal-audit/discourse
',
meta=json_set(COALESCE(meta,'{}'), '$.tags', json('["build","field","comparison","evidence"]'), '$.register', 'audit', '$.status', 'published'), updated_at=datetime('now')
WHERE slug='opos-formal-audit';

INSERT INTO articles (slug,title,subject,published,created_at,updated_at,body,meta) VALUES
('field-openclaw','OpenClaw','Field comparison target',1,datetime('now'),datetime('now'),'# OpenClaw — comparison record\n\nClaims and evidence for the common build-landscape axes live in this article graph.','{"tags":["field-comparison","agent"],"register":"audit","status":"published","landscape_target":{"id":"openclaw","name":"OpenClaw","repository":"https://github.com/openclaw/openclaw","cohort":"direct-neighbor","status":"queued"},"claims":[],"sources":[]}'),
('field-goose','Goose','Field comparison target',1,datetime('now'),datetime('now'),'# Goose — comparison record\n\nClaims and evidence for the common build-landscape axes live in this article graph.','{"tags":["field-comparison","agent"],"register":"audit","status":"published","landscape_target":{"id":"goose","name":"Goose","repository":"https://github.com/block/goose","cohort":"direct-neighbor","status":"queued"},"claims":[],"sources":[]}'),
('field-hermes-agent','Hermes Agent','Field comparison target',1,datetime('now'),datetime('now'),'# Hermes Agent — comparison record\n\nClaims and evidence for the common build-landscape axes live in this article graph.','{"tags":["field-comparison","agent"],"register":"audit","status":"published","landscape_target":{"id":"hermes-agent","name":"Hermes Agent","repository":"https://github.com/NousResearch/hermes-agent","cohort":"direct-neighbor","status":"queued"},"claims":[],"sources":[]}'),
('field-langgraph','LangGraph','Field comparison target',1,datetime('now'),datetime('now'),'# LangGraph — comparison record\n\nClaims and evidence for the common build-landscape axes live in this article graph.','{"tags":["field-comparison","framework"],"register":"audit","status":"published","landscape_target":{"id":"langgraph","name":"LangGraph","repository":"https://github.com/langchain-ai/langgraph","cohort":"direct-neighbor","status":"queued"},"claims":[],"sources":[]}'),
('field-openai-agents-sdk','OpenAI Agents SDK','Field comparison target',1,datetime('now'),datetime('now'),'# OpenAI Agents SDK — comparison record\n\nClaims and evidence for the common build-landscape axes live in this article graph.','{"tags":["field-comparison","framework"],"register":"audit","status":"published","landscape_target":{"id":"openai-agents-sdk","name":"OpenAI Agents SDK","repository":"https://github.com/openai/openai-agents-python","cohort":"direct-neighbor","status":"queued"},"claims":[],"sources":[]}'),
('field-cloudflare-agents','Cloudflare Agents','Field comparison target',1,datetime('now'),datetime('now'),'# Cloudflare Agents — comparison record\n\nClaims and evidence for the common build-landscape axes live in this article graph.','{"tags":["field-comparison","runtime"],"register":"audit","status":"published","landscape_target":{"id":"cloudflare-agents","name":"Cloudflare Agents","repository":"https://github.com/cloudflare/agents","cohort":"direct-neighbor","status":"queued"},"claims":[],"sources":[]}'),
('field-autogen','Microsoft AutoGen','Field comparison target',1,datetime('now'),datetime('now'),'# Microsoft AutoGen — comparison record\n\nClaims and evidence for the common build-landscape axes live in this article graph.','{"tags":["field-comparison","framework"],"register":"audit","status":"published","landscape_target":{"id":"autogen","name":"Microsoft AutoGen","repository":"https://github.com/microsoft/autogen","cohort":"direct-neighbor","status":"queued"},"claims":[],"sources":[]}'),
('field-mcp','Model Context Protocol','Field comparison target',1,datetime('now'),datetime('now'),'# Model Context Protocol — comparison record\n\nClaims and evidence for the common build-landscape axes live in this article graph.','{"tags":["field-comparison","protocol"],"register":"audit","status":"published","landscape_target":{"id":"mcp","name":"Model Context Protocol","repository":"https://github.com/modelcontextprotocol/modelcontextprotocol","cohort":"direct-neighbor","status":"queued"},"claims":[],"sources":[]}')
ON CONFLICT(slug) DO UPDATE SET title=excluded.title,subject=excluded.subject,published=1,body=excluded.body,meta=CASE WHEN json_array_length(COALESCE(json_extract(articles.meta,'$.claims'),'[]'))=0 THEN excluded.meta ELSE articles.meta END,updated_at=datetime('now');

INSERT INTO tasks (created_at,status,body,source,trace_id)
SELECT datetime('now'),'open',json_object('kind','landscape-research','lane','field','slug',a.slug,'target',a.title,'article','https://miscsubjects.com/a/'||a.slug,'next_packet','https://miscsubjects.com/api/build-landscape?next=1'),'landscape-research','landscape_'||replace(a.slug,'field-','')
FROM articles a
WHERE a.slug IN ('field-openclaw','field-goose','field-hermes-agent','field-langgraph','field-openai-agents-sdk','field-cloudflare-agents','field-autogen','field-mcp')
AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.source='landscape-research' AND json_extract(t.body,'$.slug')=a.slug AND t.status IN ('open','running','done'));

INSERT INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('BUILD_LANDSCAPE','http','GET https://miscsubjects.com/api/build-landscape','', '# WHAT: Read the graph-derived table of comparison targets, source-backed claim voxels, proof state, and research queue.\n# ARGS: none. Add ?next=1 for one queued research object.\n# EX: [BUILD_LANDSCAPE][/BUILD_LANDSCAPE]\n[]','content',30,1,1,datetime('now')),
('LANDSCAPE_NEXT','http','GET https://miscsubjects.com/api/build-landscape?next=1','', '# WHAT: Return one queued external-build research object with the common axes and the existing voxel-batch source/claim append shape.\n# ARGS: none.\n# EX: [LANDSCAPE_NEXT][/LANDSCAPE_NEXT]\n[]','content',30,1,1,datetime('now'))
ON CONFLICT(key) DO UPDATE SET type=excluded.type,target=excluded.target,auth=excluded.auth,content=excluded.content,category=excluded.category,planner_rank=excluded.planner_rank,planner_visible=excluded.planner_visible,enabled=1,updated_at=excluded.updated_at;

DELETE FROM directory_tests WHERE note IN ('owner correction 2026-07-21: audit is the voxel graph','owner correction 2026-07-21: field comparison has opposing evidence lanes');
INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier) VALUES
('ROUTER','e2e','Where does this build stand against OpenClaw, Goose, Hermes Agent and the field? Show me the standing evidence board, not a new opinion.','reply_ok','BUILD_LANDSCAPE|build-landscape|field claim|field evidence|build claim|build evidence|voxel','owner correction 2026-07-21: audit is the voxel graph','The answer reads the graph-derived landscape and four-column build record. It treats article claim voxels, hash-chained source voxels, discourse, and receipts as the truth record rather than creating an audit database or improvising a verdict.','8'),
('ROUTER','e2e','Queue the next outside-build comparison for a new model session. The result must land like peptide evidence.','reply_ok','LANDSCAPE_NEXT|voxel-batch|source|claim|hash|ledger|receipt','owner correction 2026-07-21: field comparison has opposing evidence lanes','The queued object separates field research, build research, opposition and synthesis. Research lands through voxel-batch as fetched and hash-chained source voxels plus claims citing source ids; opposing findings attach to exact claim hashes in discourse.','8');
