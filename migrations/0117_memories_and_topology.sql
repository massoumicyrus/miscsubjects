-- 0117: Create memories table, MEMORY_AGENT row, and topology map page

-- Memories table
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  channel TEXT,
  facts TEXT,
  last_seen TEXT,
  updated_at TEXT
);

-- Topology map page (internal documentation)
INSERT OR REPLACE INTO pages (slug, title, body_html, actor, created_at, updated_at) VALUES (
  'topology',
  'Agent Topology Map',
  '<h1>Agent Topology</h1>
<p><strong>Build:</strong> Blooio (Cloudflare Pages + D1 + Workers)</p>
<p><strong>Mediator:</strong> The build routes all messages between agents and users.</p>
<h2>Nodes</h2>
<table>
<tr><th>Agent</th><th>Entry Point</th><th>Can Send To</th><th>Can Receive From</th></tr>
<tr><td>Kimi CLI (Terminal)</td><td>User types in terminal</td><td>Build, Terminal, GitHub, Claude Code, Kimi Code</td><td>User, Build, Cron</td></tr>
<tr><td>Kimi Code (VS Code)</td><td>VS Code extension</td><td>Terminal, Build, GitHub</td><td>User, Terminal, Build</td></tr>
<tr><td>Claude Code (Terminal)</td><td>User types in terminal</td><td>Build, GitHub, Terminal</td><td>User, Build, GitHub</td></tr>
<tr><td>Blooio Build</td><td>Webhook / iMessage</td><td>Any user, Any agent, Terminal (via bridge)</td><td>Any user, Any agent, Terminal</td></tr>
<tr><td>Terminal (Mac)</td><td>LOCAL_EXEC from build</td><td>Build, GitHub, Any CLI tool</td><td>Build, User, Cron</td></tr>
<tr><td>Cron (Build)</td><td>Scheduled trigger</td><td>Any agent, Any user</td><td>Build clock</td></tr>
</table>
<h2>Recursive Loops</h2>
<ol>
<li><strong>LLM messages itself:</strong> User asks LLM to send a message to the build. Build replies to user. The reply is the LLM continuing the conversation with itself.</li>
<li><strong>Build reinitiates itself:</strong> LLM creates a cron job. Build sends iMessage later. LLM picks up the task.</li>
<li><strong>Agent spawns agent:</strong> LLM asks build to create a new agent row. Build now has a new agent. LLM can message it.</li>
</ol>
<h2>Rule Hierarchy</h2>
<ul>
<li><strong>Immutable:</strong> In code (functions/). Cannot be overridden by any agent.</li>
<li><strong>Mutable:</strong> In directory (D1 rows). Can be changed by agents with permission.</li>
</ul>
<p><em>Last updated: 2026-06-19</em></p>',
  'system',
  datetime('now'),
  datetime('now')
);

-- MEMORY_AGENT row (basic, to be refined by user)
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, updated_at, enabled, planner_visible) VALUES (
  'MEMORY_AGENT',
  'agent',
  'grok-4.3',
  'bearer:GROK_API_KEY',
  '# MEMORY_AGENT
You are the memory agent for the owner''s build. Your job is to remember facts about users and conversations.

## What you do
- When a new user messages the build, write a memory about them: who they are, what they asked, what channel they used.
- When an existing user messages, update their memory with new facts.
- Pull historical conversation logs from 2chat, email, Blooio, Telegram when asked.
- Summarize what we know about each customer.

## How you store memories
Use [D1_EXEC] to write to the memories table:
INSERT OR REPLACE INTO memories (user_id, channel, facts, last_seen, updated_at) VALUES (''$1'', ''$2'', ''$3'', datetime(''now''), datetime(''now''))

Or query existing memories:
[D1_QUERY]SELECT * FROM memories WHERE user_id=''$1''[/D1_QUERY]

## Rules
- Never make up facts. Only store what you have verified from conversation logs.
- Respect privacy. Do not share one user''s memory with another user.
- Keep facts concise and factual.',
  'agents',
  datetime('now'),
  1,
  1
);
