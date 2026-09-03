-- 0067_resident_agents.sql — resident agent registry + control rows.
-- The AgentDO (sibling Worker) upserts this table; AGENT_LIST reads it; the cockpit polls it.
CREATE TABLE IF NOT EXISTS agents (
  id          TEXT PRIMARY KEY,
  goal        TEXT,
  brain       TEXT,
  status      TEXT,
  steps       INTEGER,
  last_action TEXT,
  created     TEXT,
  updated     TEXT
);

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('AGENT_SPAWN','fn','agentSpawn','','# Spawn a resident agent that loops on a goal until done (durable, survives Mac sleep). Args: goal|brain|maxSteps
["$1","$2","$3"]','agent',42,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('AGENT_LIST','fn','agentList','','# List resident agents and their live status. Args: none
[]','agent',42,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('AGENT','fn','agentOp','','# Control a resident agent. Args: op(status|send|pause|resume|kill|events)|id|msg
["$1","$2","$3+"]','agent',42,1,1,datetime('now'));
