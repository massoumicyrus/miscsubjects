-- 0374: every sheet is an object with its own link and a visibility of its own.
-- private (default): reads and writes need the build authority or a token scoped sheet:<id>.
-- public: anyone may read it at /sheet/<id> and GET /api/sheets/<id>/...; writes still need authority.
ALTER TABLE user_sheets ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
