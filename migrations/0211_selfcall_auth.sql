-- Class fix: http rows that self-call authed miscsubjects endpoints (article set/create, page
-- edit, settings, sheets sync, dispatch) carried no terminal key, so they 401'd — "set an
-- article slot" etc. silently failed. Add the key. (Public GET rows get it too; harmless — the
-- endpoint ignores it, and redactReq redacts it from the ledger.)
UPDATE directory SET auth = 'headers:{"x-terminal-key":"$TERMINAL_KEY"}', updated_at = datetime('now')
  WHERE key IN ('ARTICLES','ART_GET','DIR_GET','DIR_LIST','DURABLE_WORKER','PAGES_CREATE','PAGES_DELETE','PAGES_PUT','PAGE_GET','PANEL','PROVIDERS','SET_GET','SHEETS_SYNC_MASTER','SNAPSHOT_META');
UPDATE directory SET auth = 'headers:{"Content-Type":"application/json","x-terminal-key":"$TERMINAL_KEY"}', updated_at = datetime('now')
  WHERE key IN ('ART_PATCH','PAGE_PATCH','SET_PUT');
