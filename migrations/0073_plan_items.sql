CREATE TABLE IF NOT EXISTS plan_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  text        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',   -- open | doing | done
  owner       TEXT NOT NULL DEFAULT 'the owner',  -- the owner | build | model
  lane        TEXT NOT NULL DEFAULT 'next',   -- in_motion | needs_you | next
  note        TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plan_lane ON plan_items(lane, status);

INSERT INTO plan_items (text, status, owner, lane, note, created_at, updated_at) VALUES
('Enrich all 199 articles with real PubMed studies', 'doing', 'build', 'in_motion', 'workflow wf_628b6feb-0dd; 122/199 at last check', strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('Council group chat: 4 models live (Llama, Qwen, Grok, GPT)', 'doing', 'build', 'in_motion', 'POST /api/council; "council on" in group', strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('Bind GEMINI_API_KEY to miscsubjects-miscsubjects Pages project', 'open', 'the owner', 'needs_you', 'paste key -> wrangler pages secret put, or Cloudflare dashboard env var', strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('Give group chat id + 2nd Blooio number (or text the webhook once)', 'open', 'the owner', 'needs_you', 'webhook https://miscsubjects.com/blooio; needed to make council live in the group', strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('Connect IG/TikTok/YouTube accounts for posting (OAuth)', 'open', 'the owner', 'needs_you', 'required before any auto-publishing; account access only you have', strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('Decide channel priority: SEO vs paid vs outreach', 'open', 'the owner', 'needs_you', 'peptide paid ads are platform-risky; SEO compounds; outreach is compliance-gated', strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('Competitor-intel scraper (Apify/Bright Data) -> top peptide content board', 'open', 'build', 'next', 'track TikTok/IG/YouTube top posts + peptide sites; store in content_items type=competitor', strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('Auto-distribution: render articles -> social posting API (Phyllo/upload-post)', 'open', 'build', 'next', 'IG 100/day, TikTok 25/day, YouTube ~6/day caps', strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('Lead engine: Apollo (data) + Smartlead/Instantly (send), compliance-gated', 'open', 'build', 'next', 'health outreach is regulated; education-first, no treatment claims', strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('SEO build: drug-class + condition landing pages from the matrix', 'open', 'build', 'next', 'the only channel that compounds without platform risk', strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now'));
