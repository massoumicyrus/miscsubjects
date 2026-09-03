-- 0128: Archive the stale pepper backlog so the open queue only contains real work.
-- The archived rows stay in the tasks table (status='archived') for audit/ledger purposes.
UPDATE tasks SET status = 'archived', trace = COALESCE(trace, '') || ' | archived by migration 0128'
WHERE status = 'open' AND source = 'pepper' AND id < 200;
