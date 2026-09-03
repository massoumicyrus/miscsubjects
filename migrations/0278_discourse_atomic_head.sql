ALTER TABLE discourse ADD COLUMN expected_thread_head TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS discourse_slug_expected_head_uq
  ON discourse(slug, expected_thread_head)
  WHERE expected_thread_head IS NOT NULL;
