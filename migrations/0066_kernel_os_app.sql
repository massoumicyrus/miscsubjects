-- 0066_kernel_os_app.sql — pipe-safe write rows for the Kernel OS iPhone app (/app).
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('SET_ROW_CONTENT','fn','setRowContent','','# Set a directory row content (pipe-safe). Args: key|content
["$1","$2+"]','util',70,0,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('SAVE_FLOW','fn','saveFlowRow','','# Create or replace a flow row from DSL (pipe-safe). Args: key|dsl
["$1","$2+"]','flow',70,0,1,datetime('now'));
