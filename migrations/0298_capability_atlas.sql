
INSERT OR REPLACE INTO directory
  (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes)
VALUES (
  'CAPABILITY_ATLAS','http','GET https://miscsubjects.com/api/capability-atlas','',
  '# WHAT: Read the public capability archaeology atlas joining every current directory contract with recorded invocation evidence, registered tests, capability domains, and aggregate coding-agent turn/file-change sediment. It separates registered, invoked, tested, and disabled states so the build interior can be audited without treating row count as proof.
# ARGS: None. Add ?summary=1 to omit the full capability array.
# EX: [CAPABILITY_ATLAS][/CAPABILITY_ATLAS]
# TESTS: GET /api/capability-atlas returns miscsubjects-capability-atlas/1.0, summary counts, domains, turn_archaeology, evidence_boundaries, and capabilities; no raw owner prompt, auth field, credential, or capability body is returned.
[""]',
  datetime('now'),'audit','audit,directory,governance,protocol',981,1,1,4,
  '{"type":"object","properties":{},"additionalProperties":false}',
  '[]',0,'http',''
);

DELETE FROM directory_tests
WHERE kind='e2e' AND note='audit capability interior, not only link surface';

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'The link protocol is only a tiny visible facet. Show an outside auditor the vast ability accumulated under the surface across directory capabilities and thousands of coding-agent turns without pretending every registered row is proven working.',
  'reply_ok',
  'CAPABILITY_ATLAS|capability atlas|registered|invoked|tested|coding-agent turns|domains|evidence',
  'audit capability interior, not only link surface',
  'Use CAPABILITY_ATLAS. Report current capability contracts by domain, recorded invocation evidence, registered/passed tests, and aggregate coding-agent turn/file-change sediment. Keep registered, invoked, tested and disabled states distinct; do not expose private prompts or call row count proof of working ability.',
  8
);
