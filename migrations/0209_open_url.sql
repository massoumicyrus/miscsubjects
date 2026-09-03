-- Simplicity fix from the transcript: "open a browser and search X" made a model guess
-- LOCAL_EXEC shell syntax and fail. OPEN_URL is the one obvious canonical call — opens a URL
-- in the default browser on the Mac (a new tab). No Accessibility needed (it's just `open`).
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at) VALUES
('OPEN_URL', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# WHAT: Open a URL in the default browser on the owner''s Mac (a new tab). No Accessibility needed.
# WHEN_TO_USE: "open a browser", "open this website", "pull up <site>", "search YouTube/Google for X" (pass the search URL).
# ARGS: the URL (a page or a search URL like https://www.youtube.com/results?search_query=lofi)
# EX: [OPEN_URL]https://www.youtube.com/results?search_query=lofi[/OPEN_URL]
{"cmd":"sh","args":["-lc","open \"$1\""]}', 'device', 20, 1, 1, datetime('now'));
