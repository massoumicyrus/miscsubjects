// Reader-facing prose — invariant systematic logic from the evidence ledger.
import { rankClaims } from "./article_topology.js";
import {
  frameworkIntro,
  evidenceInventory,
  inventoryProse,
  howManyTakeItProse,
  emptySection,
  confidenceProse,
  INVARIANT_SECTIONS,
} from "./explanation_framework.js";
import {
  matchConditionProfile,
  stackPeptidesForArticle,
  conditionSectionsProse,
} from "./condition_framework.js";
import {
  enrichmentBrief,
  usesEnrichmentVoice,
  enrichmentSectionHeadings,
  ENRICHMENT_TAIL_SECTIONS,
} from "./enrichment_logic.js";
import {
  classifyArticleMode,
  shouldUseInvariantCompose,
  isRenderableSectionBody,
  systemSectionsFromClaims,
  articleMandate,
} from "./article_editorial.js";

const NOISE_RE = /materialized from orphan/i;
const META_FILLER_RE =
  /catalogued in this miscsubjects ledger|sources are catalogued|claim\(s\) summarize/i;

const SCI_TYPES = new Set([
  "pubmed",
  "clinical_trial",
  "review",
  "medical",
]);
const ANEC_TYPES = new Set([
  "reddit",
  "x",
  "twitter",
  "youtube",
  "instagram",
  "anecdotal",
  "imessage",
  "whatsapp",
]);

export const PLAIN_ENGLISH_WRITER_PEPTIDE = `You write peptide articles for miscsubjects.com using INVARIANT SYSTEMATIC LOGIC.

The reader needs every topic explained the same way — like teaching someone who systematizes: explicit steps, fixed sections, no decoration, no journal voice.

MASTER FRAME (always internalize): Health = regeneration vs degeneration. Drugs often suppress signals; peptides in this ledger are studied for repair pathways.

FIXED SECTIONS — use these ## headings in this exact order:
## Regeneration vs degeneration — where this fits
## What it is
## How it works
## Why it would work (logic chain)
## Why people take it
## How many people take it
## Evidence inventory
## What scientists say
## What people say on Reddit
## What people say on X
## What we do not know
## Safety and limits

RULES:
- Plain English. Short sentences. If-then logic. Number steps where helpful.
- Every study: what they did, what they found, human or animal, what that proves and does not prove.
- Every Reddit/X post: quote, platform, who is talking, what they claim, why anecdote evidence matters (real reports, not trials).
- Evidence inventory must count human vs animal vs anecdote sources from the topology.
- "How many people take it": honest — say when unknown; count only what is in the ledger.
- No medical advice. No doses. No banned words: synthetic, pentadecapeptide, utilize, leverage.

GROUNDING: Only topology JSON. Reference sources as (source s12).`;

export const PLAIN_ENGLISH_WRITER_ENRICHMENT = `You write enrichment articles for miscsubjects.com.

The reader has a specific condition or drug load. They want: if I have THIS problem, WHY would each compound help ME — not a generic one-peptide catalog entry.

VOICE: Second-person for logic chains ("If your disc is losing height…"). Explicit if-then steps. Every compound section answers "so what for someone with this condition?"

MASTER FRAME: Health = regeneration vs degeneration. Breakdown outruns repair → the condition persists. Peptides here are studied for repair pathways. Some drugs reduce mechanical load or suppress symptoms — say which and why that matters for THIS reader.

SECTION FLOW — use ## headings from enrichment_brief.section_headings in the JSON payload:
1. What's breaking down (condition layers first)
2. One ## "Why [compound] might help you" per peptide in scope (1–5 sections — never merge unrelated peptides)
3. Drug / GLP-1 load sections when drug_chains present
4. How these fit together (stack synergy — use enrichment_brief.stack_together)
5. Evidence tail: What the evidence actually shows → scientists → Reddit → X → unknowns → safety

ENRICHMENT RULES:
- Follow enrichment_brief.peptide_chains and drug_chains — translate each steps[] array into prose.
- Spine/disc/joint + retatrutide/semaglutide/tirzepatide: include mechanical load logic (~4 lb lumbar compressive force per 1 lb body weight lost).
- Stimulant load (Adderall, Vyvanse, etc.): Semax (BDNF/neural), BPC-157 (gut-brain), Selank (non-benzo calm), DSIP (sleep repair) — each gets its own section when in scope.
- Multi-peptide stacks: different degeneration layer per peptide; "How these fit together" maps layers without repeating essays.
- Single-peptide cross: one deep "Why [peptide] might help you"; siblings briefly in "How these fit together".
- Plain English. Short sentences. Number steps where helpful.
- Every study: what they did, what they found, human or animal, what that proves and does not prove.
- Evidence inventory: count human vs animal vs anecdote from topology.
- No medical advice. No doses. No banned words: synthetic, pentadecapeptide, utilize, leverage.

GROUNDING: topology JSON + enrichment_brief. Reference sources as (source s12).`;

export const PLAIN_ENGLISH_WRITER_SYSTEM = `You write system/protocol documentation for miscsubjects.com.

This is NOT a peptide compound article. Do NOT use regeneration-vs-degeneration framing, "why people take it", "how many people take it", or Reddit/X sections unless the topology has those sources AND the article subject requires them.

Use constitution slots as ## headings: what it is, who claims what, what is known, what is unknown, limitations, disclaimer.
Plain English. Short sentences. Cite live endpoints. No empty placeholder sections — omit a section entirely if there is no material.

GROUNDING: Only topology JSON.`;

export const PLAIN_ENGLISH_WRITER_PRIMER = `You write educational primer articles for miscsubjects.com.

Teach the concept class — NOT a single named peptide deep dive. At most one-line category examples; never center ARA-290, BPC-157, etc. unless the slug is that compound.

Sections: what this teaches, core definitions, evidence tiers, how to read claims, what we do not know, limits.
No "why people take it" or "how many people take it" unless the primer is explicitly about uptake statistics.

GROUNDING: Only topology JSON.`;

export const PLAIN_ENGLISH_WRITER = PLAIN_ENGLISH_WRITER_PEPTIDE;

export function proseWriterForMode(mode) {
  if (mode === "system") return PLAIN_ENGLISH_WRITER_SYSTEM;
  if (mode === "primer") return PLAIN_ENGLISH_WRITER_PRIMER;
  if (mode === "peptide") return PLAIN_ENGLISH_WRITER_PEPTIDE;
  return PLAIN_ENGLISH_WRITER_ENRICHMENT;
}

export function cleanClaimSentence(text) {
  let t = String(text || "").trim();
  t = t.replace(/\bsynthetic\b/gi, "");
  t = t.replace(/\bpentadecapeptide\b/gi, "");
  t = t.replace(/\s*\((?:human|preclinical|anecdotal|mechanistic|speculative)(?:\s+tier)?\)\s*/gi, " ");
  t = t.replace(
    /\s*[—–-]\s*(?:human|preclinical|anecdotal|mechanistic|speculative)\s+tier\.?\s*/gi,
    ". ",
  );
  t = t.replace(/\s+/g, " ").trim();
  if (t && !/[.!?]$/.test(t)) t += ".";
  return t;
}

function isNoiseClaim(c) {
  if (NOISE_RE.test(String(c.text || ""))) return true;
  if (c.quote_gated && c.tier === "speculative") return true;
  const w =
    c.effective_weight != null
      ? c.effective_weight
      : c.weight != null
        ? Number(c.weight)
        : null;
  if (c.tier === "speculative" && w != null && w < 0.15) return true;
  return false;
}

function isMetaFiller(c) {
  if (c.tier === "system") return true;
  return META_FILLER_RE.test(String(c.text || "").toLowerCase());
}

function claimsById(claims) {
  const map = {};
  for (const c of claims || []) map[String(c.id)] = c;
  return map;
}

function linkedClaims(source, byId) {
  const out = [];
  for (const id of source.claim_ids || []) {
    const c = byId[String(id)];
    if (c && !isNoiseClaim(c) && !isMetaFiller(c)) out.push(c);
  }
  return out;
}

function platformLabel(type) {
  const t = String(type || "").toLowerCase();
  if (t === "reddit") return "Reddit";
  if (t === "x" || t === "twitter") return "X";
  if (t === "youtube") return "YouTube";
  if (t === "instagram") return "Instagram";
  return "online";
}

function subredditFromUrl(url) {
  const m = String(url || "").match(/reddit\.com\/r\/([^/]+)/i);
  return m ? "r/" + m[1] : "";
}

function claimsToList(claims, max = 8) {
  return claims
    .slice(0, max)
    .map((c, i) => `${i + 1}. ${cleanClaimSentence(c.text)}`)
    .join("\n");
}

function explainScienceSource(source, claims) {
  const title = String(source.title || "Untitled study").trim();
  const summary = String(source.summary || "").trim();
  const quote = String(source.quote || "").trim();
  const sid = source.id || "";
  const claimText = claims
    .map((c) => cleanClaimSentence(c.text))
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");

  let fact = "";
  if (summary) {
    fact = summary.charAt(0).toUpperCase() + summary.slice(1);
    if (!/[.!?]$/.test(fact)) fact += ".";
  } else if (claimText) {
    fact = claimText;
  } else if (quote) {
    fact = "The source states: " + (quote.length > 280 ? quote.slice(0, 277) + "…" : quote);
  } else return "";

  const tiers = new Set(claims.map((c) => c.tier));
  let strength = "Published research.";
  if (tiers.has("human")) strength = "Tagged human evidence in this ledger — check sample size and design.";
  else if (tiers.has("preclinical")) strength = "Animal or lab work — shows mechanism or early signal, not proof in people.";

  const ref = sid ? ` *(source ${sid})*` : "";
  const embed = sid ? `\n\n[[embed:source:${sid}]]` : "";
  return `### ${title}${ref}\n\n${fact}\n\n**Evidence type:** ${strength}${embed}`;
}

function explainSocialSource(source, claims, platformName) {
  const summary = String(source.summary || "").trim();
  const sub = subredditFromUrl(source.url);
  const where = sub ? `${platformName}, ${sub}` : platformName;
  const thread = String(source.title || "").trim();
  const sid = source.id || "";
  const ref = sid ? ` *(source ${sid})*` : "";
  const embed = sid ? `\n\n[[embed:source:${sid}]]` : "";

  let line = summary
    ? summary.charAt(0).toUpperCase() + summary.slice(1)
    : claims.length
      ? cleanClaimSentence(claims[0].text)
      : "User report — see card.";

  if (line.length > 220) line = line.slice(0, 217) + "…";
  if (line && !/[.!?]$/.test(line)) line += ".";

  const header = thread ? `**${thread}** — ${where}${ref}` : `**${where}**${ref}`;
  return `${header}\n\n${line}${embed}`;
}

function logicChain(claims) {
  const mech = claims.filter((c) => c.tier === "mechanistic" || c.slot === "mechanism");
  const known = claims.filter((c) => c.slot === "what_is_known" || c.tier === "preclinical");
  const combined = [...mech, ...known.filter((c) => !mech.includes(c))].slice(0, 6);
  if (!combined.length) return emptySection("No mechanism chain catalogued yet.");
  const steps = combined.map((c, i) => {
    const t = cleanClaimSentence(c.text);
    return `${i + 1}. IF ${t} THEN that is one proposed link in a repair/regeneration pathway (not yet proven end-to-end in humans unless a human claim says so).`;
  });
  return steps.join("\n");
}

/** True when stored body is too thin or reads like tier-stub prose. */
export function bodyNeedsReaderProse(body, meta = {}, slug = "") {
  const mode = classifyArticleMode(slug, meta.title, meta);
  if (mode === "system") {
    const text = String(body || "").trim();
    if (/regeneration vs degeneration — where this fits/i.test(text)) return true;
    if (/no catalogued evidence in this ledger/i.test(text)) return true;
    return text.length < 1200 && (meta.claims || []).length >= 5;
  }
  if (mode === "primer") {
    const text = String(body || "").trim();
    if (/regeneration vs degeneration — where this fits/i.test(text) && slug !== "regeneration-vs-degeneration") return true;
    return text.length < 1500 && (meta.claims || []).length >= 3;
  }
  const text = String(body || "").trim();
  const claims = Array.isArray(meta.claims) ? meta.claims : [];
  const sources = Array.isArray(meta.sources) ? meta.sources : [];
  if (claims.length < 3 && sources.length < 3) return false;
  if (text.length < 2800) return true;
  return false;
}

/** System/primer body — constitution slots only, no peptide invariant sprawl. */
function composeSlotBody(topo, mode) {
  const slug = topo?.slug || "";
  const title = topo?.title || slug;
  const claims = topo?.claims || [];
  const ranked = rankClaims(claims, topo?.sources || []);
  const active = ranked.filter(
    (c) => c.status !== "retracted" && c.status !== "cut" && !isNoiseClaim(c),
  );

  const fromSlots = systemSectionsFromClaims(active, title);
  if (fromSlots && fromSlots.length > 400) return fromSlots;

  const parts = [];
  const mandate = articleMandate(slug, title, topo?.meta || {});
  parts.push(`# ${title}\n`);
  parts.push(`## What this article is\n\n${mandate.subject}`);
  if (mandate.must_answer?.length) {
    parts.push(
      `## Questions it must answer\n\n` +
        mandate.must_answer.map((q, i) => `${i + 1}. ${q}`).join("\n"),
    );
  }

  const known = active.filter((c) => c.slot === "what_is_known" || c.tier === "system");
  if (known.length) {
    parts.push(
      `## What is known\n\n` + known.map((c) => cleanClaimSentence(c.text)).join("\n\n"),
    );
  }
  const what = active.filter((c) => c.slot === "what_it_is");
  if (what.length) {
    parts.push(
      `## What it is\n\n` + what.map((c) => cleanClaimSentence(c.text)).join("\n\n"),
    );
  }
  const unknown = active.filter((c) => c.slot === "what_is_unknown");
  if (unknown.length) {
    parts.push(
      `## What we do not know\n\n` + unknown.map((c) => cleanClaimSentence(c.text)).join("\n\n"),
    );
  }
  const limits = active.filter((c) => c.slot === "limitations" || c.slot === "disclaimer");
  if (limits.length) {
    parts.push(
      `## Limits\n\n` + limits.map((c) => cleanClaimSentence(c.text)).join("\n\n"),
    );
  }

  if (parts.length <= 2) return null;
  parts.push(
    "\n---\n\n*System documentation — not a compound evidence review. Verify live via cited GET endpoints.*",
  );
  return parts.join("\n\n");
}

/** Invariant-structure article from ledger — systematic logic, every section. */
export function composeReaderBody(topo) {
  const slug = topo?.slug || "";
  const title = topo?.title || slug;
  const claims = topo?.claims || [];
  const sources = topo?.sources || [];
  const mode = classifyArticleMode(slug, title, topo?.meta || {});

  if (mode === "system" || mode === "primer") {
    return composeSlotBody(topo, mode);
  }

  if (!shouldUseInvariantCompose(slug, title, topo?.meta || {}) && mode === "article") {
    return composeSlotBody(topo, mode);
  }

  const profile = matchConditionProfile(slug, title);
  const stackSlugs = stackPeptidesForArticle(slug, title, topo?.embeds);
  const peptideInvMap = topo?.peptideInvMap || {};

  if (claims.length < 1 && sources.length < 1 && !profile && !stackSlugs.length) return null;

  const ranked = rankClaims(claims, sources);
  const active = ranked.filter(
    (c) =>
      c.status !== "retracted" &&
      c.status !== "cut" &&
      !isNoiseClaim(c) &&
      !isMetaFiller(c),
  );
  const byId = claimsById(active);
  const inv = evidenceInventory(sources, active);
  const parts = [];

  const section = (heading, body) => {
    if (!isRenderableSectionBody(body)) return;
    parts.push(`## ${heading}\n\n${body}`);
  };

  const enrichment = usesEnrichmentVoice(mode)
    ? enrichmentBrief(slug, title, topo?.meta || {})
    : null;

  if (enrichment) {
    const bd = enrichment.breaking_down;
    const breakBody =
      (bd.degenerative_why?.length
        ? bd.degenerative_why.map((l, i) => `${i + 1}. ${l}`).join("\n")
        : "") +
      (bd.degenerative_layers?.length
        ? "\n\n**Layers:**\n" +
          bd.degenerative_layers.map((l) => `- **${l.layer}:** ${l.what_breaks}`).join("\n")
        : "");
    section(bd.section_title, breakBody || frameworkIntro(slug, title));

    for (const ch of enrichment.peptide_chains) {
      section(ch.section_title, ch.prose);
    }
    for (const ch of enrichment.stimulant_chains || []) {
      section(ch.section_title, ch.prose);
    }
    for (const ch of enrichment.drug_chains) {
      section(ch.section_title, ch.prose);
    }
    section("How these fit together", enrichment.stack_together);
  } else if (profile) {
    for (const cs of conditionSectionsProse(profile, stackSlugs, peptideInvMap)) {
      section(cs.title, cs.body);
    }
    section(INVARIANT_SECTIONS[0].title, frameworkIntro(slug, title));
  } else {
    section(INVARIANT_SECTIONS[0].title, frameworkIntro(slug, title));
  }

  if (!enrichment) {
    const what = active.filter((c) => c.slot === "what_it_is");
    section(
      INVARIANT_SECTIONS[1].title,
      what.length
        ? what.map((c) => cleanClaimSentence(c.text)).join(" ")
        : active.slice(0, 2).map((c) => cleanClaimSentence(c.text)).join(" ") || emptySection(),
    );

    const how = active.filter((c) => c.tier === "mechanistic" || c.slot === "mechanism");
    section(
      INVARIANT_SECTIONS[2].title,
      how.length
        ? "**Step logic:**\n" + how.slice(0, 8).map((c, i) => `${i + 1}. ${cleanClaimSentence(c.text)}`).join("\n")
        : active.filter((c) => c.tier === "preclinical").length
          ? "**From preclinical claims (animal/lab — not human proof):**\n" +
            claimsToList(active.filter((c) => c.tier === "preclinical"), 6)
          : emptySection("No mechanism claims catalogued."),
    );

    section(INVARIANT_SECTIONS[3].title, logicChain(active));

    const whyTake = active.filter(
      (c) =>
        c.slot === "who_claims_what" ||
        c.tier === "anecdotal" ||
        (c.tier === "speculative" && !isNoiseClaim(c)),
    );
    section(
      INVARIANT_SECTIONS[4].title,
      whyTake.length
        ? "**Reasons that appear in this ledger:**\n" + claimsToList(whyTake, 10)
        : emptySection("No catalogued reasons why people take this."),
    );

    section(INVARIANT_SECTIONS[5].title, howManyTakeItProse(inv, active, slug));
  }

  const evidenceTitle = enrichment ? ENRICHMENT_TAIL_SECTIONS[0] : INVARIANT_SECTIONS[6].title;
  section(evidenceTitle, inventoryProse(inv) + "\n\n" + confidenceProse(inv));

  const scienceBlocks = [];
  for (const s of inv.sci.slice(0, 18)) {
    const block = explainScienceSource(s, linkedClaims(s, byId));
    if (block) scienceBlocks.push(block);
  }
  section(
    enrichment ? ENRICHMENT_TAIL_SECTIONS[1] : INVARIANT_SECTIONS[7].title,
    scienceBlocks.length
      ? scienceBlocks.join("\n\n")
      : emptySection("No scientific sources in this ledger yet."),
  );

  const redditBlocks = [];
  for (const s of inv.reddit.slice(0, 16)) {
    const block = explainSocialSource(s, linkedClaims(s, byId), "Reddit");
    if (block) redditBlocks.push(block);
  }
  section(
    enrichment ? ENRICHMENT_TAIL_SECTIONS[2] : INVARIANT_SECTIONS[8].title,
    redditBlocks.length
      ? redditBlocks.join("\n\n")
      : emptySection("No Reddit posts catalogued in this ledger."),
  );

  const xBlocks = [];
  for (const s of inv.xPosts.slice(0, 16)) {
    const block = explainSocialSource(s, linkedClaims(s, byId), "X");
    if (block) xBlocks.push(block);
  }
  section(
    enrichment ? ENRICHMENT_TAIL_SECTIONS[3] : INVARIANT_SECTIONS[9].title,
    xBlocks.length
      ? xBlocks.join("\n\n")
      : emptySection("No X posts catalogued in this ledger."),
  );

  if (!enrichment) {
    const other = sources.filter((s) => {
      const ty = String(s.type || "").toLowerCase();
      return ["youtube", "instagram", "anecdotal"].includes(ty);
    });
    const otherBlocks = [];
    for (const s of other.slice(0, 8)) {
      const block = explainSocialSource(s, linkedClaims(s, byId), platformLabel(s.type));
      if (block) otherBlocks.push(block);
    }
    section(INVARIANT_SECTIONS[10].title, otherBlocks.join("\n\n"));
  }

  const gaps = active.filter((c) => c.slot === "what_is_unknown");
  section(
    enrichment ? ENRICHMENT_TAIL_SECTIONS[4] : INVARIANT_SECTIONS[11].title,
    gaps.length ? claimsToList(gaps, 10) : emptySection("No explicit gap claims — treat unstudied areas as unknown."),
  );

  const safety = active.filter(
    (c) => c.interaction_risk === true || c.slot === "limitations",
  );
  section(
    enrichment ? ENRICHMENT_TAIL_SECTIONS[5] : INVARIANT_SECTIONS[12].title,
    safety.length
      ? claimsToList(safety, 8)
      : emptySection("No safety or limitation claims catalogued."),
  );

  if (stackSlugs.length) {
    parts.push(
      `## Peptide components (collapsible embeds)\n\n` +
        stackSlugs.map((ps) => `[[stack-embed:${ps}]]`).join("\n"),
    );
  }

  parts.push(
    "\n---\n\n*Not medical advice. Counts and quotes are from this article's hash-chained ledger. Anecdote = real reports, not proof. Animal studies ≠ human proof.*",
  );

  return parts.join("\n\n");
}

/** Bundle topology for LLM body synthesis. */
export function topologyProsePayload(topo, opts = {}) {
  const claims = topo?.claims || [];
  const sources = topo?.sources || [];
  const mode = classifyArticleMode(topo.slug, topo.title, topo?.meta || {});
  const mandate = articleMandate(topo.slug, topo.title, topo?.meta || {});
  const ranked = rankClaims(claims, sources);
  const active = ranked.filter(
    (c) =>
      c.status !== "retracted" &&
      c.status !== "cut" &&
      !isNoiseClaim(c) &&
      (mode === "system" ? true : !isMetaFiller(c)),
  );
  const byId = claimsById(active);
  const inv = evidenceInventory(sources, active);

  const brief = usesEnrichmentVoice(mode)
    ? enrichmentBrief(topo.slug, topo.title, topo?.meta || {})
    : null;

  return {
    slug: topo.slug,
    title: topo.title,
    mode,
    mandate,
    enrichment_brief: brief,
    section_headings: brief
      ? enrichmentSectionHeadings(brief)
      : mode === "peptide"
        ? INVARIANT_SECTIONS.map((s) => s.title)
        : ["What this article is", "What is known", "What we do not know", "Limits"],
    invariant_sections:
      mode === "peptide"
        ? INVARIANT_SECTIONS.map((s) => s.title)
        : brief
          ? enrichmentSectionHeadings(brief)
          : ["What this article is", "What is known", "What we do not know", "Limits"],
    framework:
      brief?.breaking_down?.degenerative_why?.join(" ") ||
      (mode === "peptide" || mode === "condition" || mode === "stack"
        ? frameworkIntro(topo.slug, topo.title)
        : mandate.subject),
    evidence_inventory: inv,
    instruction: proseWriterForMode(mode),
    claims: active.slice(0, opts.claim_limit || 48).map((c) => ({
      id: c.id,
      text: c.text,
      tier: c.tier,
      slot: c.slot,
      interaction_risk: c.interaction_risk === true,
      source_ids: c.source_ids || [],
      who_claims: c.who_claims,
    })),
    studies: inv.sci.slice(0, 24).map((s) => ({
      id: s.id,
      title: s.title,
      summary: s.summary,
      quote: (s.quote || "").slice(0, 500),
      linked_claims: linkedClaims(s, byId).map((c) => c.text),
    })),
    reddit: inv.reddit.slice(0, 20).map((s) => ({
      id: s.id,
      subreddit: subredditFromUrl(s.url),
      title: s.title,
      quote: (s.quote || "").slice(0, 600),
      summary: s.summary,
    })),
    x_posts: inv.xPosts.slice(0, 20).map((s) => ({
      id: s.id,
      title: s.title,
      quote: (s.quote || "").slice(0, 600),
      summary: s.summary,
    })),
    honesty: topo.honesty,
  };
}