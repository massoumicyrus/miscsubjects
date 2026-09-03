-- 0065_computer_use.sql — semantic computer-use rows (accessibility-based), the gap
-- vs blind DESKTOP_CLICK/TYPE. All run osascript via the Mac bridge (runner=mac).

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,runner,planner_rank,planner_visible,enabled,updated_at) VALUES
('LOCAL_APPS','http','POST https://agent.cannibal.capital/exec','headers:{"x-terminal-key":"$TERMINAL_KEY"}','# WHAT: List running GUI apps on the Mac (foreground processes).
# WHEN_TO_USE: "what apps are open", "list running apps", "what is running on my mac"
# ARGS: none
{"cmd":"osascript","args":["-e","tell application \"System Events\" to get name of every process whose background only is false"],"timeout":15000}','computer','mac',55,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,runner,planner_rank,planner_visible,enabled,updated_at) VALUES
('LOCAL_FRONTMOST','http','POST https://agent.cannibal.capital/exec','headers:{"x-terminal-key":"$TERMINAL_KEY"}','# WHAT: Name of the frontmost (active) app on the Mac.
# WHEN_TO_USE: "what app is in front", "what am I looking at", "frontmost app"
# ARGS: none
{"cmd":"osascript","args":["-e","tell application \"System Events\" to get name of first process whose frontmost is true"],"timeout":15000}','computer','mac',55,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,runner,planner_rank,planner_visible,enabled,updated_at) VALUES
('LOCAL_WINDOWS','http','POST https://agent.cannibal.capital/exec','headers:{"x-terminal-key":"$TERMINAL_KEY"}','# WHAT: List window titles of the frontmost app.
# WHEN_TO_USE: "what windows are open", "list windows of the front app"
# ARGS: none
{"cmd":"osascript","args":["-e","tell application \"System Events\" to tell (first process whose frontmost is true) to get name of windows"],"timeout":15000}','computer','mac',55,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,runner,planner_rank,planner_visible,enabled,updated_at) VALUES
('LOCAL_ACTIVATE','http','POST https://agent.cannibal.capital/exec','headers:{"x-terminal-key":"$TERMINAL_KEY"}','# WHAT: Bring an app to the front (focus it).
# WHEN_TO_USE: "open X", "switch to X", "focus X" (X = app name)
# ARGS: app name (e.g. Safari)
{"cmd":"osascript","args":["-e","tell application \"$1+\" to activate"],"timeout":15000}','computer','mac',55,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,runner,planner_rank,planner_visible,enabled,updated_at) VALUES
('LOCAL_KEYSTROKE','http','POST https://agent.cannibal.capital/exec','headers:{"x-terminal-key":"$TERMINAL_KEY"}','# WHAT: Type text into the focused field on the Mac (System Events keystroke).
# WHEN_TO_USE: "type X", "enter X into the focused field"
# ARGS: the text to type
{"cmd":"osascript","args":["-e","tell application \"System Events\" to keystroke \"$1+\""],"timeout":15000}','computer','mac',55,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,runner,planner_rank,planner_visible,enabled,updated_at) VALUES
('LOCAL_KEYCODE','http','POST https://agent.cannibal.capital/exec','headers:{"x-terminal-key":"$TERMINAL_KEY"}','# WHAT: Send a macOS key code to the focused app (36=return 53=esc 48=tab 123-126=arrows).
# WHEN_TO_USE: "press enter", "hit escape", "press the down arrow"
# ARGS: key code number
{"cmd":"osascript","args":["-e","tell application \"System Events\" to key code $1+"],"timeout":15000}','computer','mac',55,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,runner,planner_rank,planner_visible,enabled,updated_at) VALUES
('LOCAL_UI_SNAPSHOT','http','POST https://agent.cannibal.capital/exec','headers:{"x-terminal-key":"$TERMINAL_KEY"}','# WHAT: Accessibility snapshot of the frontmost window — role+name+description of each top-level UI element. Semantic, not pixels. The basis for LOCAL_UI_CLICK.
# WHEN_TO_USE: "what is on screen", "list the buttons", "snapshot the UI" — run before clicking by name
# ARGS: none
{"cmd":"osascript","args":["-e","tell application \"System Events\" to tell (first process whose frontmost is true) to get {role, name, description} of every UI element of front window"],"timeout":20000}','computer','mac',55,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,runner,planner_rank,planner_visible,enabled,updated_at) VALUES
('LOCAL_UI_CLICK','http','POST https://agent.cannibal.capital/exec','headers:{"x-terminal-key":"$TERMINAL_KEY"}','# WHAT: Click a UI element by NAME in the frontmost app (semantic, not blind x/y). Pair with LOCAL_UI_SNAPSHOT to find names.
# WHEN_TO_USE: "click the X button", "press X" where X is an on-screen element name
# ARGS: element name
{"cmd":"osascript","args":["-e","tell application \"System Events\" to tell (first process whose frontmost is true) to click (first UI element of front window whose name is \"$1+\")"],"timeout":15000}','computer','mac',55,1,1,datetime('now'));
