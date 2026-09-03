-- A workbook tab list ordered only by creation date cannot be arranged. MiscOS is the surface the
-- owner operates from and must sit first regardless of when it was made (owner order 2026-09-02).
-- Default 100 leaves every existing sheet where it is; lower sorts earlier.
ALTER TABLE user_sheets ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 100;
