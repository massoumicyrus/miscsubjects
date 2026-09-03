-- 0029: JCI_LOADER_SNIPPET removed — the loader is embedded (commented) in every peptide page
-- and documented in README; it was never meant to be dispatched.
DELETE FROM directory WHERE key='JCI_LOADER_SNIPPET';
