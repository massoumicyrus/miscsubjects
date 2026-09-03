// Read-only mirror of prompts the writer-queue pipeline actually sends per article.
import { proseWriterForMode, topologyProsePayload } from "./article_prose.js";
import { enrichmentBrief, usesEnrichmentVoice } from "./enrichment_logic.js";
import {
  articleMandate,
  classifyArticleMode,
} from "./article_editorial.js";
import { loadArticleTopology } from "./article_topology.js";

const TIERS = [
  "human",
  "preclinical",
  "anecdotal",
  "mechanistic",
  "speculative",
  "system",
];
const SOURCE_TYPES = [
  "pubmed",
  "clinical_trial",
  "review",
  "medical",
  "anecdotal",
  "business",
  "reddit",
  "x",
  "instagram",
  "youtube",
  "news",
  "model",
  "other",
];

export function writeJsonFormatSuffix(reg = "standard") {
  return (
    "\n\nFor the JSON body field: write 1,200+ words of clear plain English (## headings). No journal tone. Teach everything. Claims array stays atomic; body is the readable article.\n\n" +
    "OUTPUT FORMAT — output ONLY one JSON object, no prose, no markdown fence:\n" +
    '{"slug":"kebab-case","title":"...","body":"markdown with ## headings","register":"' +
    reg +
    '",' +
    '"claims":[{"id":"c1","text":"one assertion","section":"...","tier":"' +
    TIERS.join("|") +
    '","source_ids":["s1"],"source_status":"unsourced if no source","why_material":"..."}],' +
    '"sources":[{"id":"s1","type":"' +
    SOURCE_TYPES.join("|") +
    '","url":"https://real-url","title":"...","quote":"exact passage from the page","summary":"...","claim_ids":["c1"]}]}\n' +
    "Tier every claim. Where there is no human data, say so plainly. Link only URLs you can verify exist; never invent a URL or quote."
  );
}

const POPULATE_SYS =
  'You are an evidence hunter with live web search. Output ONLY a JSON array of sources, each {"type":"pubmed|clinical_trial|review|medical|reddit|x|instagram|youtube|news|business|anecdotal|other","url":"real working url","title":"...","quote":"exact passage from the page","summary":"what it says","claim_ids":[]}. Use real URLs only, never invented. Return [] only when you genuinely cannot find any NEW credible source.';

const POLL_SYS =
  "You are an editor for the canonical peptide evidence ledger on miscsubjects.com. " +
  "ADDITIVE ONLY: missing context, clearer plain-English paragraphs, evidence-graded claims, and sources. " +
  "Never rewrite the whole article. Never use academic jargon, stacked Latin, or hype. " +
  "Write for a smart adult reader — short sentences, honest hedging, no medical advice or dosing. " +
  "This is the definitive ledger; legibility beats density.\n\n" +
  "Output ONLY one JSON object:\n" +
  '{"material":true,"rationale":"what you added and why","legibility":{"plain_english":true,"reading_level":"accessible|clinical_plain"},' +
  '"body_append":"## Section title\\n\\nNew paragraphs only — do not repeat existing text",' +
  '"claims_add":[{"text":"...","section":"...","tier":"human|preclinical|anecdotal|mechanistic|speculative","source_ids":["s1"],"why_material":"..."}],' +
  '"sources_add":[{"type":"pubmed|reddit|x|review|clinical_trial|youtube|news|other","url":"https://...","title":"...","quote":"exact short quote","summary":"...","claim_ids":["c1"]}],' +
  '"notes":"one line for the model contribution card"}\n' +
  "If nothing material to add, set material:false and body_append:null and empty arrays.";

function populateUser(peptide, slug, focus, have = "(none yet)") {
  const f = String(focus || "all").toLowerCase();
  if (f === "reddit_x") {
    return (
      'Harvest NEW Reddit threads, Reddit comments, X/Twitter posts, and X replies about "' +
      (peptide || slug) +
      '". Search site:reddit.com and site:x.com / twitter. Include thread titles AND individual comment text. ' +
      "Include good and bad outcomes, side effects, dosing anecdotes (label as anecdotal, not advice). " +
      'Label type as reddit or x. Quote exact comment passages. Minimum 5 sources if any exist. ' +
      "Do NOT repeat URLs already collected:\n" +
      have +
      "\nReturn ONLY the JSON array; [] if nothing new."
    );
  }
  if (f === "anecdote") {
    return (
      'Harvest NEW user-reported experiences about "' +
      (peptide || slug) +
      '" — Reddit, X, YouTube, forums, comments. Include GOOD and BAD outcomes. ' +
      "Label type as reddit|x|youtube|anecdotal. Quote exact passages. Do NOT repeat URLs already collected:\n" +
      have +
      "\nReturn ONLY the JSON array; [] if nothing new."
    );
  }
  if (f === "science") {
    return (
      'Find NEW scientific evidence about "' +
      (peptide || slug) +
      '" — PubMed, clinical trials, reviews, medical sources only. Do NOT repeat URLs:\n' +
      have +
      "\nReturn ONLY the JSON array; [] if nothing new."
    );
  }
  return (
    'Find NEW evidence about the peptide "' +
    (peptide || slug) +
    '" — PubMed, clinical trials, reviews, medical sources, and also reddit/x/youtube/forum anecdote (label the type). Do NOT repeat any URL already collected:\n' +
    have +
    "\nReturn ONLY the JSON array; [] if nothing new."
  );
}

function critiqueSys(role = "adversary") {
  return (
    "You are an evidence-graded article " +
    role +
    " reviewer. Read the article, claims, and sources. " +
    "Find what is unclear, overclaimed, under-sourced, or could be more legible. " +
    "Output ONLY one JSON object:\n" +
    '{"rationale":"...","checks":[{"name":"...","pass":true}],"contributions":[{"claim_id":"c1 or null","text":"specific fix or challenge","score":0.0-1.0,"material":true}],"material":true}\n' +
    "If nothing material to add, set material:false and explain in rationale."
  );
}

export function buildWritePromptPack({
  slug,
  title = "",
  ask = "",
  system_prompt = "",
  register = "source_ledger",
}) {
  const writeMode = slug ? classifyArticleMode(slug, title, {}) : "article";
  const sys =
    String(system_prompt || proseWriterForMode(writeMode)) + writeJsonFormatSuffix(register);
  let user = ask || "Write the article for: " + title;
  if (slug && usesEnrichmentVoice(writeMode)) {
    const brief = enrichmentBrief(slug, title, {});
    user +=
      "\n\nENRICHMENT BRIEF (binding section logic — one ## per compound):\n" +
      JSON.stringify(brief).slice(0, 12000);
  }
  return {
    step: "write",
    endpoint: "POST /api/protocol/write",
    model_default: "grok/grok-4.3",
    mode: writeMode,
    mandate: slug ? articleMandate(slug, title, {}) : null,
    enrichment_brief: slug && usesEnrichmentVoice(writeMode)
      ? enrichmentBrief(slug, title, {})
      : null,
    system_prompt: sys,
    user_prompt: user,
    notes: [
      "Queue jobs usually pass ask only — system_prompt defaults from article_prose.js by mode.",
      "WRITER_AGENT directory row is legacy; cron write path does NOT load it unless system_prompt is in the task body.",
    ],
  };
}

export function buildPopulatePromptPack({ slug, peptide, focus = "science" }) {
  return {
    step: "populate",
    endpoint: "POST /api/protocol/populate",
    model_default: "grok-4.3",
    focus,
    system_prompt: POPULATE_SYS,
    user_prompt: populateUser(peptide || slug, slug, focus),
  };
}

export function buildSynthesizeBodyPromptPack(topo) {
  const mode = classifyArticleMode(topo.slug, topo.title, topo.meta || {});
  const payload = topologyProsePayload(
    { ...topo, meta: topo.meta || {} },
    { claim_limit: 48 },
  );
  const user =
    "Write the reader-facing article body from this evidence ledger. Respect mode, mandate, and enrichment_brief in the JSON — condition-first, one ## Why [compound] might help you per peptide in scope. Do NOT apply peptide invariant sections to system/primer articles or enrichment condition/stack/cross articles.\n\n" +
    JSON.stringify(payload).slice(0, 28000);
  const sys =
    proseWriterForMode(mode) +
    "\n\nOutput ONLY markdown (## headings). No JSON, no code fence, no preamble. Omit sections with no material — never write 'No catalogued evidence' placeholders.";
  return {
    step: "synthesize-body",
    endpoint: "POST /api/protocol/synthesize-body",
    model_default: "grok/grok-4.3",
    role: "editor",
    mode,
    system_prompt: sys,
    user_prompt: user,
    topology_payload_preview: payload,
  };
}

export function buildPollPromptPack(row) {
  const meta = row.meta || {};
  const claims = (meta.claims || []).slice(0, 28);
  const sources = (meta.sources || []).slice(0, 16);
  const user =
    "SLUG: " +
    row.slug +
    "\nTITLE: " +
    row.title +
    "\nREGISTER: " +
    (meta.register || "source_ledger") +
    "\n\nBODY:\n" +
    String(row.body || "").slice(0, 14000) +
    "\n\nCLAIMS:\n" +
    JSON.stringify(claims) +
    "\n\nSOURCES (" +
    sources.length +
    "):\n" +
    JSON.stringify(
      sources.map((s) => ({
        id: s.id,
        type: s.type,
        url: s.url,
        title: s.title,
      })),
    );
  return {
    step: "poll",
    endpoint: "POST /api/protocol/poll",
    model_default: "grok/grok-4.3",
    role: "editor",
    system_prompt: POLL_SYS,
    user_prompt: user,
  };
}

export function buildCritiquePromptPack(row, role = "adversary") {
  const meta = row.meta || {};
  const claims = (meta.claims || []).slice(0, 24);
  const sources = (meta.sources || []).slice(0, 12);
  const user =
    "TITLE: " +
    row.title +
    "\n\nBODY:\n" +
    String(row.body || "").slice(0, 12000) +
    "\n\nCLAIMS:\n" +
    JSON.stringify(claims) +
    "\n\nSOURCES (" +
    sources.length +
    "):\n" +
    JSON.stringify(
      sources.map((s) => ({
        id: s.id,
        type: s.type,
        url: s.url,
        title: s.title,
        hash: s.hash,
      })),
    );
  return {
    step: "critique",
    endpoint: "POST /api/protocol/critique",
    model_default: "grok/grok-4.3",
    role,
    system_prompt: critiqueSys(role),
    user_prompt: user,
  };
}

async function directoryPrompt(env, key) {
  try {
    const row = await env.DB.prepare(
      "SELECT key, content, target, updated_at FROM directory WHERE key=?",
    )
      .bind(key)
      .first();
    if (!row) return { key, found: false };
    return {
      key,
      found: true,
      target: row.target,
      updated_at: row.updated_at,
      chars: String(row.content || "").length,
      system_prompt: String(row.content || ""),
      note:
        key === "WRITER_AGENT"
          ? "Legacy peptide-writer row — NOT wired into cron /api/protocol/write unless task passes system_prompt."
          : key === "EDITOR_AGENT"
            ? "Legacy editor row — NOT wired into poll/synthesize-body unless explicitly dispatched."
            : null,
    };
  } catch {
    return { key, found: false, error: "directory lookup failed" };
  }
}

async function queuedTaskForSlug(env, slug) {
  const like = '%"slug":"' + slug + '"%';
  const row = await env.DB.prepare(
    "SELECT id, status, source, body, created_at FROM tasks WHERE body LIKE ? AND body LIKE '%/api/protocol/write%' ORDER BY id DESC LIMIT 1",
  )
    .bind(like)
    .first()
    .catch(() => null);
  if (!row) return null;
  let job = null;
  try {
    job = JSON.parse(row.body);
  } catch {}
  return {
    task_id: row.id,
    status: row.status,
    source: row.source,
    created_at: row.created_at,
    job,
  };
}

/** Full pipeline prompt pack for one slug — read-only inspection. */
export async function pipelinePromptPack(env, slug, opts = {}) {
  const s = String(slug || "")
    .toLowerCase()
    .trim();
  if (!s) return { error: "need slug" };

  const row = await env.DB.prepare(
    "SELECT slug, title, body, meta FROM articles WHERE slug=?",
  )
    .bind(s)
    .first();
  const queued = await queuedTaskForSlug(env, s);
  const ask =
    opts.ask ||
    queued?.job?.ask ||
    (row
      ? `Write an enrichment article: ${row.title}\nSlug: ${s}\nVoice: condition-first — if I have this problem, WHY would each compound help ME?`
      : "");
  const title = opts.title || queued?.job?.title || row?.title || s;
  const register = opts.register || queued?.job?.register || "source_ledger";

  const write = buildWritePromptPack({
    slug: s,
    title,
    ask,
    system_prompt: queued?.job?.system_prompt || opts.system_prompt || "",
    register,
  });

  const peptide = queued?.job?.peptide || title;
  const populateSteps = ["science", "anecdote", "reddit_x"].map((focus) =>
    buildPopulatePromptPack({ slug: s, peptide, focus }),
  );

  let synthesize = null;
  let poll = null;
  let critique = null;
  if (row) {
    let meta = {};
    try {
      meta = JSON.parse(row.meta || "{}");
    } catch {}
    const topo = await loadArticleTopology(env, s, { include_inactive: false }).catch(
      () => null,
    );
    if (topo && !topo.error) {
      synthesize = buildSynthesizeBodyPromptPack({
        slug: s,
        title: row.title,
        body: row.body,
        meta,
        claims: topo.claims,
        sources: topo.sources,
      });
    }
    poll = buildPollPromptPack({ slug: s, title: row.title, body: row.body, meta });
    critique = buildCritiquePromptPack(
      { slug: s, title: row.title, body: row.body, meta },
      "adversary",
    );
  }

  const legacy_writer = await directoryPrompt(env, "WRITER_AGENT");
  const legacy_editor = await directoryPrompt(env, "EDITOR_AGENT");

  return {
    ok: true,
    slug: s,
    title,
    url: "https://miscsubjects.com/a/" + s,
    view: "https://miscsubjects.com/admin/pipeline?slug=" + encodeURIComponent(s),
    api: "https://miscsubjects.com/api/protocol/prompt-pack?slug=" + encodeURIComponent(s),
    pipeline_order: [
      "write",
      "populate:science",
      "populate:anecdote",
      "populate:reddit_x",
      "repair",
      "fill-slots",
      "synthesize-body",
      "collaborate (kimi/gemini)",
      "poll",
      "critique",
    ],
    queued_write_task: queued,
    active_pipeline: {
      write,
      populate: populateSteps,
      synthesize_body: synthesize,
      poll,
      critique,
    },
    legacy_directory_agents: {
      writer_agent: legacy_writer,
      editor_agent: legacy_editor,
    },
    provenance_note:
      "meta.provenance often stores input but prompt:'' on write passes — use this endpoint for the effective system prompt.",
  };
}