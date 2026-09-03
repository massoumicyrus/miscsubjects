DELETE FROM directory_tests WHERE kind='e2e';
INSERT INTO directory_tests (key, kind, args, expect_kind, expect_value, note) VALUES
('ROUTER','e2e','what can you do','reply_ok','tool|article|deploy|run|search|build|help','self-description'),
('ROUTER','e2e','list the articles on the site','reply_ok','article|none|empty|no ','articles list'),
('ROUTER','e2e','what is bpc-157','reply_ok','bpc|peptide|heal|article|not','article content'),
('ROUTER','e2e','how do I add an article with curl','reply_ok','curl|post|/api/articles','API how-to (curl)'),
('ROUTER','e2e','how many tools do you have','reply_ok','[0-9]','tool count'),
('ROUTER','e2e','show me the agent topology','reply_ok','tool|categor|agent|map','topology'),
('ROUTER','e2e','who am I on cloudflare','reply_ok','account|cloudflare|email|loop|@','cloudflare identity via LOCAL_EXEC'),
('ROUTER','e2e','what is the router reasoning effort right now','reply_ok','none|low|high|default|reason','variable read'),
('ROUTER','e2e','what did we change on the build today','reply_ok','','ledger summary (the turn that returned a bare tag)'),
('ROUTER','e2e','what is retatrutide','reply_ok','reta|peptide|glp|weight|article|not','article content 2');
