
UPDATE directory SET content =
'# WHAT: Run any gh (GitHub CLI) command with the owner''s auth on the Mac.
# WHEN_TO_USE: "comment on the repo", "post a github comment", "open an issue", "list my PRs", "gh <args>", "check github actions". Needs the Mac online + gh authed.
# ARGS: the gh arguments verbatim (everything after "gh").
# EX: [CLI_GH]issue comment 1 --repo [OWNER_HANDLE]/miscsubjects-pages --body "posted via the protocol"[/CLI_GH]
{"cmd":"sh","args":["-lc","gh $1+"],"timeout":120000}', updated_at = datetime('now') WHERE key = 'CLI_GH';

UPDATE directory SET content =
'# WHAT: Edit a directory row (a prompt or capability) by KEY. json_body is a JSON object with any of {type,target,auth,content,category,enabled,planner_visible,planner_rank}.
# WHEN_TO_USE: "edit a prompt", "edit a capability", "change a tool", "update the ROUTER prompt", "edit a directory row".
# ARGS: key | json_body
# EX: [DIR_PATCH]ROUTER|{"content":"new prompt text"}[/DIR_PATCH]
$2+', updated_at = datetime('now') WHERE key = 'DIR_PATCH';

UPDATE directory SET content =
'# WHAT: Set a directory row''s content (pipe-safe; replaces the whole content field).
# WHEN_TO_USE: "replace a prompt''s content", "set the content of a row". For small edits prefer DIR_PATCH.
# ARGS: key | content
# EX: [SET_ROW_CONTENT]ROUTER|new full content here[/SET_ROW_CONTENT]
["$1","$2+"]', updated_at = datetime('now') WHERE key = 'SET_ROW_CONTENT';
