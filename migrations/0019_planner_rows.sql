-- Seed the kernel-callable planner rows. Two-stage tool selection:
--   1. agent emits [CATEGORIES][/CATEGORIES] → gets category manifest
--   2. agent emits [TOOLS_IN]blooio|30[/TOOLS_IN] → gets candidate tools
--   3. agent emits the chosen [BLOOIO_SEND]...[/BLOOIO_SEND]
-- TOOLS_SEARCH adds free-text candidate lookup for the same purpose.

INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at, category, planner_visible, planner_rank) VALUES
('CATEGORIES','fn','listCategories','','# Return JSON [{category,tools}] of planner-visible tool categories. Use as stage 1 of tool selection: pick the category that matches the task before asking for tools in it.
[]','2026-06-09T22:45:00Z','directory',1,5),

('TOOLS_IN','fn','listToolsInCategory','','# Return JSON [{key,type,docs}] of planner-visible tools in $1. $1=category, $2=limit (default 30, max 100). Use as stage 2 of tool selection after CATEGORIES.
["$1","$2"]','2026-06-09T22:45:00Z','directory',1,5),

('TOOLS_SEARCH','fn','searchTools','','# Return JSON [{key,type,category,docs}] of planner-visible tools matching $1 (free-text LIKE over key+category+content). $2=limit (default 20, max 100). Use when no category is obvious.
["$1","$2"]','2026-06-09T22:45:00Z','directory',1,5);
