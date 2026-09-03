-- De-sprawl Tier 1: drop pure catalog-dump rows that no agent/flow routes to.
-- GAPI_* (442): raw Google REST catalog; real Google use is covered by GOOGLE_* rows.
-- GITHUB_* (46): MCP duplicates of the GH_* / exec path.
-- Referenced from outside their own families: 0 places (verified against directory.snapshot.json).
-- Reversible: deleted rows are preserved in directory.snapshot.json (committed) and can be re-inserted.
DELETE FROM directory WHERE key GLOB 'GAPI_*';
DELETE FROM directory WHERE key GLOB 'GITHUB_*';
