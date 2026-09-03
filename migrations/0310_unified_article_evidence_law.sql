-- One content/evidence/mutation law for health articles, build articles, and software comparisons.

DELETE FROM directory_tests WHERE note IN ('owner correction 2026-07-21: zero-context audit assignment','owner correction 2026-07-21: one article evidence law');
INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier) VALUES
('ROUTER','e2e','I pasted the build audit Tap and Go into a fresh model and it asked whether it should audit, verify, or append. What is wrong and what does a correct drop do?','reply_ok','zero context|active assignment|begins|source voxel|claim voxel|receipt|not ask','owner correction 2026-07-21: zero-context audit assignment','The fresh model receives one self-contained active assignment. It begins the named field, build, opposition, or synthesis lane without asking what the object is for. The DROP selects the work but does not select the verdict. Completion is source-citing graph work plus public receipt links.','8'),
('ROUTER','e2e','Do build audits, software comparisons, peptide articles, model questions, and live edits use different truth systems?','reply_ok','same|article|voxel|source|hash|claim|discourse|provenance|revision|CAS','owner correction 2026-07-21: one article evidence law','They use one article constitution and one voxel graph: claim atoms, hash-chained sources, provenance, revisions, exact-claim discourse, scoped capabilities, and current-hash edits. Domain profiles change evidence classes and safety rules, not the graph or truth mechanism.','8');

UPDATE directory SET content=content || '

## One article evidence law
Health content, build self-description, software comparisons, model contributions, questions, and live edits use the same article voxel graph. Claims cite hash-chained source voxels. Discourse attaches to exact claim hashes. Scoped article capabilities gate source/claim append and content edits. Current-hash CAS prevents stale edits. Provenance, revisions, retractions, contradictions, accepted changes, and rejected contributions remain readable. Domain profiles change evidence classes and safety language; they do not create another truth store.

## Zero-context handoff law
A self-explaining DROP names one active assignment, its first read, its write lane, its evidence standard, and its completion receipts. A fresh model begins without asking whether to audit, verify, or append. The assignment selects the work and leaves the verdict open.' , updated_at=datetime('now')
WHERE key='ROUTER' AND content NOT LIKE '%## One article evidence law%';
