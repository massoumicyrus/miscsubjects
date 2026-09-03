DELETE FROM directory_tests WHERE note='owner correction 2026-07-21: scoped article mutation';
INSERT INTO directory_tests
  (key, kind, args, expect_kind, expect_value, note, expected_text, tier)
VALUES
  (
    'ROUTER',
    'e2e',
    'A fresh outside model has no scoped article capability. Can it append a source or claim to an article?',
    'reply_ok',
    'No|VOXEL_EDIT|owner|discourse|source|claim',
    'owner correction 2026-07-21: scoped article mutation',
    'Public exact-claim discourse remains open. Source, claim, draft, ingest, atomize, write, contribute, and repair mutations require a scoped VOXEL_EDIT capability or owner authority.',
    8
  );

UPDATE directory
SET content = content || char(10) || '- ARTICLE MUTATION BOUNDARY: Public read and exact-claim discourse are open. Source, claim, draft, ingest, atomize, write, contribute, and repair mutations use scoped VOXEL_EDIT capability or owner authority.'
WHERE key = 'ROUTER'
  AND instr(content, 'ARTICLE MUTATION BOUNDARY:') = 0;
