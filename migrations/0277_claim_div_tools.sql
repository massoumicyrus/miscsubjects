-- First-class rows for the four public claim/DIV operations. The endpoint remains the
-- single implementation; these rows make the operations visible and linkable in Directory.
INSERT INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank, updated_at)
VALUES
('VOXEL_EDIT','http','POST https://miscsubjects.com/api/protocol/voxel-edit','headers:{"content-type":"application/json"}',
'# WHAT: Replace one current article DIV or claim DIV and append its provenance chain.
# ARGS: JSON {slug,div_id,expected_hash,text,actor?,key?}; claim DIV ids are claim:<claim_id>.
# EX: [VOXEL_EDIT]{"slug":"philosophy","div_id":"claim:c1","expected_hash":"<current>","text":"replacement","key":"<scoped token>"}[/VOXEL_EDIT]
# TESTS: Read /api/articles/<slug>/claims/<claim-id>, send its current content_hash, require ok:true plus a stable link; stale hashes return 409 and write nothing.
["$1+"]','content',1,1,20,datetime('now')),
('VOXEL_MOVE','http','POST https://miscsubjects.com/api/protocol/voxel-move','headers:{"content-type":"application/json"}',
'# WHAT: Move one body DIV up or down while preserving its identity and chain.
# ARGS: JSON {slug,div_id,direction,expected_order,actor?,key?}.
# EX: [VOXEL_MOVE]{"slug":"philosophy","div_id":"d3","direction":"up","expected_order":3,"key":"<scoped token>"}[/VOXEL_MOVE]
# TESTS: Read /voxels, move with current order, require ok:true and the same div id at its new order; stale order returns 409.
["$1+"]','content',1,1,20,datetime('now')),
('VOXEL_CONSOLIDATE','http','POST https://miscsubjects.com/api/protocol/voxel-consolidate','headers:{"content-type":"application/json"}',
'# WHAT: Consolidate two or more body DIVs or claim DIVs without deleting absorbed identities or chains.
# ARGS: JSON {slug,div_ids,expected_hashes,text?,rationale?,actor?,key?}; do not mix body and claim DIV ids.
# EX: [VOXEL_CONSOLIDATE]{"slug":"philosophy","div_ids":["claim:c1","claim:c2"],"expected_hashes":["<h1>","<h2>"],"key":"<scoped token>"}[/VOXEL_CONSOLIDATE]
# TESTS: Require target active, absorbed status consolidated, both chains readable, and stable links resolving after the write.
["$1+"]','content',1,1,20,datetime('now')),
('VOXEL_CHALLENGE','http','POST https://miscsubjects.com/api/protocol/voxel-challenge','headers:{"content-type":"application/json"}',
'# WHAT: Post one model argument against or in support of an article DIV or claim DIV; returns the public widget link.
# ARGS: JSON {slug,expected_thread_head,target_div?,expected_hash?,stance,body,actor}; no token is required to contribute.
# EX: [VOXEL_CHALLENGE]{"slug":"philosophy","expected_thread_head":"obj-1","target_div":"claim:c1","expected_hash":"<current>","stance":"challenge","body":"argument","actor":"model"}[/VOXEL_CHALLENGE]
# TESTS: Missing/stale thread head refuses without a write; current head creates one discourse row and returns /i/discourse/<id>.
["$1+"]','content',1,1,20,datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type,target=excluded.target,auth=excluded.auth,content=excluded.content,
  category=excluded.category,enabled=excluded.enabled,planner_visible=excluded.planner_visible,
  planner_rank=excluded.planner_rank,updated_at=excluded.updated_at;
