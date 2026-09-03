-- OP (Object Protocol) and OPOS (Object Protocol Operating System) canonical roots.
-- Existing OIP identifiers remain compatibility aliases.

CREATE TABLE IF NOT EXISTS tap_go_model_profiles (
  model TEXT PRIMARY KEY CHECK (model IN ('chatgpt','claude','grok','gemini','kimi')),
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO tap_go_model_profiles(model,content) VALUES
('chatgpt',''),('claude',''),('grok',''),('gemini',''),('kimi','');

INSERT INTO directory (key,type,target,auth,content,category,enabled,planner_visible,planner_rank,updated_at)
VALUES
('OP_ROOT','http','GET https://miscsubjects.com/api/op','',
'# WHAT: Read OP, the Object Protocol: definition, invariants, canonical roots, and OIP compatibility boundary.
# ARGS: None. Add ?format=markdown for a model-readable document.
# EX: [OP_ROOT][/OP_ROOT]
# TESTS: Response names OP, Object Protocol, OPOS, invariants, and the OIP compatibility alias.','protocol',1,1,1,datetime('now')),
('OPOS_ROOT','http','GET https://miscsubjects.com/api/opos','',
'# WHAT: Read the whole build as OPOS, one self-explaining Object Protocol Operating System containing identity, object classes, Tap & Go routes, root articles, live inventory, audit, comparison field, evidence boundaries, and feedback loop.
# ARGS: None. Add ?format=markdown for the complete model-readable record.
# EX: [OPOS_ROOT][/OPOS_ROOT]
# TESTS: Response schema is opos-self-explaining-build/1.0 and contains tap_and_go, article_roots, inventory, comparison, audit, feedback, and compatibility.','audit',1,1,1,datetime('now')),
('OPOS_DROP','http','GET https://miscsubjects.com/api/opos?format=drop','',
'# WHAT: Return one generic zero-context Tap & Go payload for an outside model to audit the entire OPOS build.
# ARGS: None. The build audit is not model-specific.
# EX: [OPOS_DROP][/OPOS_DROP]
# TESTS: Response begins OPOS TAP & GO and contains the OPOS identity, capability inventory, comparison axes, evidence, falsifiers, answer order, and Mirror feedback route.','audit',1,1,1,datetime('now')),
('TAP_GO_MODEL_PROFILES','http','GET https://miscsubjects.com/api/tap-go-profiles?v=1','',
'# WHAT: Read the five owner-editable model-specific content slots used by token Tap & Go: ChatGPT, Claude, Grok, Gemini, and Kimi. The model selector belongs to the token DROP, not the build audit.
# ARGS: None for read. Owner edits one profile with PUT /api/tap-go-profiles {model,content}.
# EX: [TAP_GO_MODEL_PROFILES][/TAP_GO_MODEL_PROFILES]
# TESTS: Returns tap-go-model-profiles/1.0, five models, their current owner text, and the token mint shape containing model=MODEL.','protocol',1,1,1,datetime('now')),
('OPOS_FEEDBACK','fn','mirrorAppend','',
'# WHAT: Attach a model or human audit finding to the OPOS Mirror as a typed, receipted contribution. The contribution proposes; it does not silently rewrite the build.
# ARGS: $1=kind question|objection|source|repair|compression|contradiction|audit, $2=actor/model+version, $3+=finding and opened evidence. For repair/compression, place exact replacement after " => ".
# EX: [OPOS_FEEDBACK]audit|ChatGPT Web GPT-5.6|The comparison lacks a current CrewAI exhibit.[/OPOS_FEEDBACK]
# TESTS: Returns ok:true, slug=opos, contribution id, proposed status, receipt, feed, and view.
["opos","","$1","$2","$3+"]','audit',1,1,2,datetime('now'))
ON CONFLICT(key) DO UPDATE SET type=excluded.type,target=excluded.target,auth=excluded.auth,content=excluded.content,category=excluded.category,enabled=excluded.enabled,planner_visible=excluded.planner_visible,planner_rank=excluded.planner_rank,updated_at=excluded.updated_at;

INSERT OR REPLACE INTO articles (slug,title,subject,published,created_at,updated_at,body,meta) VALUES
('op','OP — Object Protocol','Object Protocol',1,datetime('now'),datetime('now'),
'# OP — Object Protocol

OP is the common object grammar for discovery, bounded authority, invocation, receipts, replay, repair, provenance, and feedback.

OP was previously named OIP, Object Invocation Protocol. Existing OIP route names, code symbols, directory keys, receipt ids, and federation identifiers remain compatibility aliases. New human and machine roots use OP.

## Six invariants

1. A capability is an object with a readable contract.
2. Authority is an object scope enforced at the dispatch boundary.
3. Execution is an object invocation.
4. Proof is an invocation receipt.
5. Correction is replay or repair linked to the original receipt.
6. Feedback is a typed contribution linked to the object it evaluates.

## Roots

Human OP root: https://miscsubjects.com/op

Machine OP root: https://miscsubjects.com/api/op

OPOS root: https://miscsubjects.com/opos

Dispatch: https://miscsubjects.com/api/dispatch

Registry: https://miscsubjects.com/api/dispatch?registry=1
',json('{"tags":["op","opos","protocol"],"register":"protocol","status":"published","extra":{"object_class":"op-object","canonical_machine":"/api/op"}}')),
('opos','OPOS — Object Protocol Operating System','Object Protocol Operating System',1,datetime('now'),datetime('now'),
'# OPOS — Object Protocol Operating System

OPOS is this whole build represented as one self-explaining operating object. OPOS joins public knowledge, capability contracts, multiple models and coding agents, cloud and local execution, business operations, receipts, governance, feedback, and recursive development.

OP is the protocol. OPOS is the composed operating system built from OP objects.

## Tap & Go

Whole-build audit DROP: https://miscsubjects.com/api/opos?format=drop

The token DROP is model-specific.

ChatGPT token mint: https://miscsubjects.com/api/dispatch?tap_go=1&scope=read&model=chatgpt

Claude token mint: https://miscsubjects.com/api/dispatch?tap_go=1&scope=read&model=claude

Grok token mint: https://miscsubjects.com/api/dispatch?tap_go=1&scope=read&model=grok

Gemini token mint: https://miscsubjects.com/api/dispatch?tap_go=1&scope=read&model=gemini

Kimi token mint: https://miscsubjects.com/api/dispatch?tap_go=1&scope=read&model=kimi

## Complete roots

Human root: https://miscsubjects.com/opos

Machine root: https://miscsubjects.com/api/opos

Capability inventory: https://miscsubjects.com/capability-atlas

Formal audit: https://miscsubjects.com/build-audit

## Evolution loop

The Mirror attaches typed outside-model questions, objections, sources, repairs, contradictions, and audits to OPOS. Every contribution is receipted. Accepted repairs retain lineage to the contribution that caused them.

Mirror feed: https://miscsubjects.com/api/articles/opos/mirror
',json('{"tags":["opos","build","audit"],"register":"protocol","status":"published","extra":{"object_class":"opos-object","canonical_machine":"/api/opos"}}')),
('opos-tap-go','OPOS Tap & Go','Whole-build model handoff',1,datetime('now'),datetime('now'),
'# OPOS Tap & Go

The whole-build audit uses one generic stable URL: https://miscsubjects.com/api/opos?format=drop

The token DROP uses five model-specific stable mint URLs. Each variant contains the same server-enforced token scope and a separate owner-editable model-content slot.

ChatGPT token DROP: https://miscsubjects.com/api/dispatch?tap_go=1&scope=read&model=chatgpt

Claude token DROP: https://miscsubjects.com/api/dispatch?tap_go=1&scope=read&model=claude

Grok token DROP: https://miscsubjects.com/api/dispatch?tap_go=1&scope=read&model=grok

Gemini token DROP: https://miscsubjects.com/api/dispatch?tap_go=1&scope=read&model=gemini

Kimi token DROP: https://miscsubjects.com/api/dispatch?tap_go=1&scope=read&model=kimi
',json('{"tags":["opos","tap-go","models"],"register":"protocol","status":"published"}')),
('opos-capability-atlas','OPOS Capability Atlas','Whole-build capability inventory',1,datetime('now'),datetime('now'),
'# OPOS Capability Atlas

The atlas makes accumulated capability legible without treating registration as proof. The atlas separates registered objects, enabled objects, recorded invocations, registered tests, current passed tests, and coding-agent turn sediment.

Human atlas: https://miscsubjects.com/capability-atlas

Machine atlas: https://miscsubjects.com/api/capability-atlas

Summary: https://miscsubjects.com/api/capability-atlas?summary=1

Every capability domain remains inspectable. Row count establishes scale. Successful receipts and real-world results establish operation.
',json('{"tags":["opos","inventory","capabilities"],"register":"audit","status":"published"}')),
('opos-formal-audit','OPOS Formal Audit','Independent build evaluation',1,datetime('now'),datetime('now'),
'# OPOS Formal Audit

The formal audit asks what OPOS is end to end, where it falls in the current technical landscape, what it is foremost at, what it ought to be foremost at, what its strongest finding means, whether that finding matters, its concrete benefit, its defensible edge, what it enables, and where specialist systems beat it.

Human audit: https://miscsubjects.com/build-audit

Machine audit: https://miscsubjects.com/api/build-audit

Whole-build Tap & Go: https://miscsubjects.com/api/opos?format=drop

The audit opens the capability interior and current primary sources for comparison systems. Router scores, self-assessment, row counts, and the Tap & Go surface do not prove the whole build.
',json('{"tags":["opos","audit","comparison"],"register":"audit","status":"published"}')),
('opos-mirror','OPOS Mirror and Evolution Loop','Outside-model feedback and repair',1,datetime('now'),datetime('now'),
'# OPOS Mirror and Evolution Loop

The OPOS evolution loop is read, audit, typed feedback, receipt, response, accepted repair, updated object.

Outside models attach questions, objections, sources, repairs, compressions, contradictions, and audits to the OPOS object. Contributions are append-only and receipted. Proposed feedback never silently rewrites the build. Owner or agent responses remain attached to the original contribution. Accepted changes retain that lineage.

Human feedback surface: https://miscsubjects.com/opos

Machine feed and POST target: https://miscsubjects.com/api/articles/opos/mirror

The same Mirror Layer appears on the OPOS article itself.
',json('{"tags":["opos","mirror","feedback"],"register":"protocol","status":"published"}'));

UPDATE directory SET content=content || '

## OP / OPOS canonical identity
OP is the Object Protocol, formerly OIP. OPOS is the Object Protocol Operating System and names this whole build as one self-explaining operating object. Existing OIP identifiers remain compatibility aliases. “What is my build?” and “give me the build Tap & Go” use OPOS_ROOT or OPOS_DROP. Protocol-definition questions use OP_ROOT.', updated_at=datetime('now')
WHERE key='ROUTER' AND content NOT LIKE '%## OP / OPOS canonical identity%';

DELETE FROM directory_tests WHERE kind='e2e' AND note IN ('whole-build tap and go','op and opos identity','token drop model specific','repeated audit question stays technical');
INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier) VALUES
('ROUTER','e2e','Hey, tell me what I have as a build and give me the Tap and Go for the whole build.','reply_ok','OPOS|Object Protocol Operating System|api/opos|capability|audit','whole-build tap and go','The reply identifies OPOS and returns the one generic whole-build Tap & Go route. The route contains the build identity, inventory, formal audit, comparison field, evidence boundaries, and feedback loop.','8'),
('ROUTER','e2e','What are OP and OPOS, and what happened to OIP?','reply_ok','OP|Object Protocol|OPOS|Operating System|OIP|compatib','op and opos identity','OP is Object Protocol. OPOS is the whole Object Protocol Operating System. OIP is the former name and remains an operational compatibility alias for existing routes and keys.','8'),
('ROUTER','e2e','Give me a Claude read-only token DROP.','reply_ok','token|DROP|claude|tap_go|model=claude|scope','token drop model specific','The token DROP, not the build audit, is model-specific. The mint uses model=claude and the returned DROP contains TARGET MODEL — CLAUDE plus the Claude owner-content slot.','8'),
('ROUTER','e2e','I am asking again: where does this build stand in the current technical field? Answer the technical question from evidence.','reply_ok','comparison|evidence|axis|audit|capability|OPOS','repeated audit question stays technical','The repeated question receives the technical comparison. The reply does not diagnose validation-seeking, a psychological loop, inability to accept an answer, grandiosity, crisis, or wellbeing; does not invent a percentile; and does not substitute solo builders for the requested field.','8');
