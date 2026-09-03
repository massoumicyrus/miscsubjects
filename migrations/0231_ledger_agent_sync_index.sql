CREATE INDEX IF NOT EXISTS events_legacy_action_idx
ON events(legacy_table, legacy_id, action);
