-- Remove the reply-whitelist tool. Owner requested no whitelist gating.
-- Stale KV keys (whitelist_enabled, whitelist_numbers) can be deleted from the Workers KV
-- namespace if they were ever set; they are no longer read by code.
DELETE FROM directory WHERE key = 'WHITELIST';
