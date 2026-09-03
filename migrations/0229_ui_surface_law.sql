-- UI surface verification law + probe fn row
INSERT OR IGNORE INTO directory (key, type, target, auth, category, planner_rank, enabled, content)
VALUES (
  'UI_SURFACE_PROBE', 'fn', 'uiSurfaceProbe', '', 'build', 5, 1,
  '# WHAT: Compare operator-visible fetch vs agent fetch — ledgered mismatch.
# ARGS: $1=url; optional $2=marker|marker
# EX: [UI_SURFACE_PROBE]/admin/marketing[/UI_SURFACE_PROBE]
["$1+"]'
);

INSERT OR REPLACE INTO settings (key, value, description, updated_at)
VALUES (
  'operator_surface_law',
  'OPERATOR SURFACE LAW: verified = operator browser HTML at live URL. Terminal-key-only is not verification. Run UI_SURFACE_PROBE before claiming ship. Marketing routes to LEDGER source=marketing.',
  'Binding verification law for agents',
  datetime('now')
);