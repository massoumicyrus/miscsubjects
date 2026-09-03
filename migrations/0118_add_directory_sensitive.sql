-- Add sensitive flag to directory rows for watch-rule gating.
ALTER TABLE directory ADD COLUMN sensitive INTEGER DEFAULT 0;
