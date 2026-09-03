-- VOXEL_BATCH described a JSON body but contained documentation only. stripDocs therefore
-- produced an empty HTTP body and every receipted dispatch failed after authentication.
UPDATE directory
SET content = rtrim(content) || char(10) || '$1+',
    updated_at = datetime('now')
WHERE key = 'VOXEL_BATCH'
  AND trim(content) NOT LIKE '%$1+';

INSERT INTO directory_tests
  (key, kind, args, expect_kind, expect_value, note, expected_text, tier)
SELECT
  'VOXEL_BATCH', 'shape',
  '{"document":{"slug":"contract-shape-only","title":"Shape only","markdown":"# Shape only"},"actor":"test"}',
  'shape', 'document|contract-shape-only|markdown',
  'VOXEL_BATCH forwards the caller JSON body through its HTTP row',
  'The shaped HTTP request contains the exact document object; the documentation is not mistaken for the executable template.',
  8
WHERE NOT EXISTS (
  SELECT 1 FROM directory_tests
  WHERE note = 'VOXEL_BATCH forwards the caller JSON body through its HTTP row'
);
