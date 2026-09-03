INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at) VALUES ('ADD_ROW', 'fn', 'addRow', '', '["$1","$2","$3","$4","$5"]', '2026-06-05T14:30:00Z');
INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at) VALUES ('EDIT_ROW', 'fn', 'editRow', '', '["$1","$2","$3","$4","$5"]', '2026-06-05T14:30:00Z');
INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at) VALUES ('DEL_ROW', 'fn', 'delRow', '', '["$1"]', '2026-06-05T14:30:00Z');
INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at) VALUES ('DIRECTORY_GET', 'flow', '', '', 'D1_QUERY: SELECT key, type, target, auth, content, updated_at FROM directory WHERE key=''$1''', '2026-06-05T14:30:00Z');
