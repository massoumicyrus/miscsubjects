-- 0075_presets.sql — saved system-prompt presets for the workbench. Name + kind + prompt.
CREATE TABLE IF NOT EXISTS presets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'text',   -- text | image | video
  system_prompt TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

INSERT INTO presets (name,kind,system_prompt,created_at,updated_at) VALUES
('Rewrite — plainer & sharper','text','Rewrite the article below so a normal person reads it easily and wants to keep going. Keep every fact and every real study. RULES: never use treats, cures, prevents, reverses, fixes, heals, replaces, "safe alternative", "natural alternative", "clinically proven", synthetic. Frame: a drug or condition wears down a specific tissue; a peptide has published research on that same tissue; the reader connects it. Label evidence animal vs human. Define any jargon in plain words first. One idea per sentence.',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('Adversarial critique','text','You are a hostile editor. Tear the article below apart. List, as bullets: what is weak, what is unclear, what is boring, what reads like a treatment claim or risks compliance, and what is missing. Be specific and brutal. End with the 3 highest-leverage fixes.',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('New conditions — brainstorm','text','Read the article below. Suggest 8-15 OTHER health conditions, injuries, aging processes, or drug side effects that map to the SAME tissue or pathway, where a peptide has published research on that tissue. For each: one line — condition, the tissue, why it fits. Prefer large, emotionally intense, visually transformable audiences. No treatment claims.',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('Column ideas — what to measure','text','Given the article below and that this is a market-mapping data board, suggest 8-12 new MEASURABLE columns worth adding (e.g. monthly search volume, cost-per-click, TikTok views, Reddit mentions, commercial intent). For each: column name, what it measures, where the data comes from (which API or source), and why it would change which content gets made first.',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('Ad concept — before/after','text','From the article below, write a peptide-free ad concept. Output: before_state (3-4 vivid lines), after_state (3-4 lines), four angles (transformation, curiosity, frustration, identity). NEVER name a peptide, show a vial, or make a treatment claim. Sell the transformation, not the mechanism.',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('Video creative — AI script','text','From the article below, write a 20-40 second AI-video script: a before -> after transformation a normal person feels instantly. No on-screen text until a single end card. NEVER name a peptide, show a vial, or make a treatment claim. Give: scene-by-scene shots, the end card line, and a b-roll list.',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('Image creative — before/after still','image','Photorealistic, emotionally clear before/after still for an ad. No text, no product, no vial, no clinical setting. Warm natural light. Subject and transformation come from the input.',strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now'));
