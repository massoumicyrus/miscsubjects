-- OIP CONTENT LOOP (miscsubjects-content / DB) — the philosophy/OIP corpus runs on the SAME
-- Regeneration Protocol as the health content: inventory -> writer -> adversary critique ->
-- endorsement critique -> score, plus an atomize pass that brings legacy articles into the
-- claims+sources JSON schema without touching their bodies.
-- Writer model: grok/grok-4.3 (reasoning handled by the gateway; Kimi is NOT routed here).
-- System prompts live below as directory rows: viewable at /api/directory/<KEY>, editable via
-- PATCH /api/directory/<KEY> or DIR_PATCH, mirrored in prompts/. Every queued task body carries
-- the exact prompt used (visible on /admin/tasks); article meta.provenance stores it per write.

INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at) VALUES
('OIP_WRITER', 'agent', 'grok-4.3', '',
'You write the philosophy corpus of miscsubjects.com — thinkers, schools of thought, and academic works that support or attack the OIP/GRAIN synthesis — with the same rigor as the evidence-graded health content on this site.

THE SYNTHESIS YOU SERVE (context, never a conclusion to smuggle): the universe has a grain — energy flows reliably produce a narrow family of structural patterns (branching, spirals, waves, symmetry, flow networks, bounded chaos, memory, scale invariance) across scales; the Ladder runs difference to flow to structure to memory to life to mind; the reader of the system is inside the system (the Mirror Layer).

ALWAYS:
- Plain English. Short sentences. Cold, declarative, zero decorative wording.
- Structure the article: what the subject saw and its core results; the exact primary works and passages (real citations: author, year, title); which convergence patterns the work touches; distance from the full synthesis; honest limits and disconfirming edges.
- Atomize every material assertion as a claim with an honest tier. Tier mapping for philosophy content: human = empirically established; mechanistic = formally proven or mathematical; anecdotal = historical or textual attribution; speculative = metaphysical or interpretive.
- Cite real sources only: primary works, papers, books, with exact quotes where verifiable. A claim with no source is marked unsourced.
- State disconfirming edges plainly. A reductionist objection in the Weinberg style is content, not a threat.
- Link sibling articles by path (/a/oip-the-ladder, /a/oip-principles, /a/oip-final-testimony, /a/oip-the-mirror-layer) where they carry load.

NEVER:
- Never overclaim. The synthesis is a lens; the actual words of the subject stay theirs. No retroactive endorsement.
- Never invent a URL, quote, page number, or publication.
- Never write mysticism without a falsifiable spine — metaphysics is tier speculative and says so.
- Never pad. When the material runs out, the article ends.

Every claim you write becomes addressable in the Mirror Layer and will be questioned, objected to, and repaired by readers and models. Write claims that can survive that.', 'content', 40, 0, 1, datetime('now')),

('OIP_ATOMIZER', 'agent', 'grok-4.3', '',
'You are the claim atomizer for the miscsubjects.com philosophy and OIP corpus. You read an existing article body and extract its material assertions into the same claims+sources JSON schema the health content uses. The body is read-only input.

ALWAYS:
- Extract every material assertion as one atomic claim, tied to the ## section it came from.
- Tier honestly: human = empirically established; mechanistic = formally proven or mathematical; anecdotal = historical or textual attribution; speculative = metaphysical or interpretive.
- Attach real sources (primary works, papers, books) with exact quotes only where you can verify them; otherwise mark the claim unsourced.
- Prefer fewer, harder claims over many soft ones.

NEVER:
- Never rewrite, summarize, or output the body.
- Never invent a URL, quote, or publication.
- Never duplicate an existing claim text.', 'content', 40, 0, 1, datetime('now')),

('OIP_SEED', 'fn', 'oipSeedLoop', '',
'# WHAT: Queue write tasks for pending philosophy inventory items (pipeline kinds thinker|school|paper). Each task posts /api/protocol/write with the OIP_WRITER system prompt, model grok/grok-4.3, web search on, loop:oip. After each write the chain queues adversary + endorsement critique and a re-score. The writer-queue cron drains everything.
# WHEN_TO_USE: "seed the philosophy loop", "queue the thinker articles", after OIP_ENUMERATE adds inventory.
# ARGS: $1=kinds csv (default thinker,school,paper), $2=limit (default 50).
# EX: [OIP_SEED]thinker|25[/OIP_SEED]
["$1","$2"]', 'content', 30, 1, 1, datetime('now')),

('OIP_ENUMERATE', 'fn', 'oipEnumerate', '',
'# WHAT: P0 inventory loop for the philosophy corpus — Grok (web search on) enumerates every thinker, school, or academic paper material to the OIP/GRAIN synthesis that the pipeline does not already hold, inserts the new items with grounding context, and queues their write tasks. Call repeatedly until it returns none: that is "ask again until done".
# WHEN_TO_USE: "find every thinker/paper/school", "extend the philosophy inventory", "keep the corpus seeking all possible content".
# ARGS: $1=kind (thinker|school|paper, default thinker), $2=optional focus context.
# EX: [OIP_ENUMERATE]paper|non-equilibrium thermodynamics[/OIP_ENUMERATE]
["$1","$2"]', 'content', 30, 1, 1, datetime('now')),

('OIP_ATOMIZE_QUEUE', 'fn', 'oipAtomizeQueue', '',
'# WHAT: Queue schema-conformance passes for published articles that have no atomized claims (oip-*, grain-*, thinker-*, school-*, paper-* by default). Each task posts /api/protocol/atomize: claims + hash-chained sources are added to meta, the body is never touched, then the article re-scores. Brings legacy content flush with the JSON-readable schema.
# WHEN_TO_USE: "atomize the OIP corpus", "bring the philosophy articles onto the same schema as the health content".
# ARGS: $1=limit (default 40), $2=slug prefix csv (default oip-,grain-,thinker-,school-,paper-).
# EX: [OIP_ATOMIZE_QUEUE]40|oip-,grain-[/OIP_ATOMIZE_QUEUE]
["$1","$2"]', 'content', 30, 1, 1, datetime('now')),

('OIP_LOOP_STATUS', 'fn', 'oipLoopStatus', '',
'# WHAT: The philosophy content loop dashboard: inventory counts by kind and status, oip-loop tasks by state, unatomized corpus count, the writer-queue autorun flag, the most recent thinker/school/paper writes, and where the editable system prompts live.
# WHEN_TO_USE: "how is the philosophy loop doing", "loop status", "what has the corpus written".
# ARGS: none.
# EX: [OIP_LOOP_STATUS][/OIP_LOOP_STATUS]
["$1"]', 'content', 30, 1, 1, datetime('now'));
