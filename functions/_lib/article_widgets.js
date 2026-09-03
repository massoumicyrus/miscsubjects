// In-article native platform embeds (horizontal strips + source map).
import { renderPlatformCard } from "./widgets/rail-platform.js";
import { evidenceInventory } from "./explanation_framework.js";

const SCI = new Set(["pubmed", "clinical_trial", "review", "medical"]);
const ANEC = new Set([
  "reddit",
  "x",
  "twitter",
  "youtube",
  "instagram",
  "anecdotal",
  "imessage",
  "whatsapp",
]);

function subredditFromUrl(url) {
  const m = String(url || "").match(/reddit\.com\/r\/([^/]+)/i);
  return m ? "r/" + m[1] : "";
}

/** Ledger source → pretty widget descriptor. */
export function sourceToWidget(source, articleSlug) {
  const ty = String(source.type || "").toLowerCase();
  const base = {
    url: source.url,
    hash: source.hash,
    ts: source.accessed_at,
    ledger_url: `/api/articles/${articleSlug}/sources`,
    source_id: source.id,
  };

  if (ty === "reddit") {
    return {
      type: "reddit",
      ...base,
      subreddit: subredditFromUrl(source.url),
      title: source.title,
      text: source.quote || source.summary,
      author: "Reddit",
    };
  }
  if (ty === "x" || ty === "twitter") {
    return {
      type: "x",
      ...base,
      author: "X",
      handle: "@post",
      text: source.quote || source.summary,
    };
  }
  if (ty === "youtube") {
    return {
      type: "youtube",
      ...base,
      title: source.title,
      description: source.quote || source.summary,
      channel: "YouTube",
    };
  }
  if (ty === "instagram") {
    return {
      type: "instagram",
      ...base,
      caption: source.quote || source.summary,
      author: "Instagram",
    };
  }
  if (ty === "imessage" || ty === "whatsapp") {
    const quote = String(source.quote || source.summary || "").trim();
    if (!quote) return null;
    return {
      type: ty === "whatsapp" ? "whatsapp" : "imessage",
      id: source.title || "Message",
      subtitle: source.id,
      messages: [{ from: "them", text: quote.slice(0, 500) }],
    };
  }
  if (SCI.has(ty)) {
    return {
      type: "source",
      source_type: ty,
      ...base,
      title: source.title,
      quote: source.quote,
      summary: source.summary,
      slug: articleSlug,
    };
  }
  if (ANEC.has(ty)) {
    return {
      type: "source",
      source_type: "anecdotal",
      ...base,
      title: source.title,
      quote: source.quote,
      summary: source.summary,
      slug: articleSlug,
    };
  }
  return null;
}

export function buildWidgetStrips(sources, articleSlug, opts = {}) {
  const maxAnec = opts.maxAnecdote || 12;
  const maxSci = opts.maxScience || 10;
  const anecdote = [];
  const reddit = [];
  const xPosts = [];
  const science = [];
  for (const s of sources || []) {
    const w = sourceToWidget(s, articleSlug);
    if (!w) continue;
    const ty = String(s.type || "").toLowerCase();
    if (SCI.has(ty)) science.push(w);
    else if (ty === "reddit") {
      reddit.push(w);
      anecdote.push(w);
    } else if (ty === "x" || ty === "twitter") {
      xPosts.push(w);
      anecdote.push(w);
    } else if (ANEC.has(ty)) anecdote.push(w);
  }
  return {
    anecdote: anecdote.slice(0, maxAnec),
    reddit: reddit.slice(0, maxAnec),
    x: xPosts.slice(0, maxAnec),
    science: science.slice(0, maxSci),
  };
}

export function evidenceStatWidgets(meta) {
  const claims = meta.claims || [];
  const sources = meta.sources || [];
  const inv = evidenceInventory(sources, claims);
  const human = inv.claims_human || 0;
  const pre = inv.claims_preclinical || 0;
  const social = (inv.reddit_posts || 0) + (inv.x_posts || 0);
  const raw =
    human * 0.12 + pre * 0.04 + (inv.claims_anecdotal || 0) * 0.015 +
    Math.min((inv.studies_catalogued || 0) * 0.025, 0.25);
  const conf = Math.round(Math.min(0.95, raw) * 100);

  const stats = [];
  if (inv.studies_catalogued) stats.push({ type: "stat", value: inv.studies_catalogued, label: "Studies" });
  if (human) stats.push({ type: "stat", value: human, label: "Human claims" });
  if (pre) stats.push({ type: "stat", value: pre, label: "Preclinical claims" });
  if (social) stats.push({ type: "stat", value: social, label: "Social posts" });
  if (conf) stats.push({ type: "stat", value: conf, label: "Ledger confidence" });
  return stats;
}

const STRIP_LABELS = {
  science: "Studies",
  reddit: "Reddit",
  x: "X",
};

export function buildNativeStrips(sources, opts = {}) {
  const maxSci = opts.maxScience || 14;
  const maxSocial = opts.maxSocial || 14;
  const science = [];
  const reddit = [];
  const xPosts = [];
  for (const s of sources || []) {
    const ty = String(s.type || "").toLowerCase();
    if (SCI.has(ty)) science.push(s);
    else if (ty === "reddit") reddit.push(s);
    else if (ty === "x" || ty === "twitter") xPosts.push(s);
  }
  return {
    science: science.slice(0, maxSci),
    reddit: reddit.slice(0, maxSocial),
    x: xPosts.slice(0, maxSocial),
  };
}

/** Instagram-style horizontal strip of native platform cards (X / Reddit / PubMed). */
export function renderNativeStrip(kind, sources, slug) {
  if (!Array.isArray(sources) || !sources.length) return "";
  const label = STRIP_LABELS[kind] || kind;
  const slides = sources
    .map((s) => `<div class="ig-scroll-slide">${renderPlatformCard(s, slug)}</div>`)
    .join("");
  return (
    `<section class="ig-scroll-wrap ig-scroll-${kind}" aria-label="${label} posts">` +
    `<div class="ig-scroll-label">${label} <span class="ig-scroll-hint">swipe →</span></div>` +
    `<div class="ig-scroll" tabindex="0" role="region" aria-label="${label} evidence, scroll horizontally">` +
    `<div class="ig-scroll-track">${slides}</div></div></section>`
  );
}

/** Inline native platform cards keyed by source id (X / Reddit / PubMed).
 * LAZY: a card is only built when the body actually references its id
 * (render() does map[id] lookups for [[embed:source:ID]] markers). This keeps
 * per-request render cost O(embeds used), not O(total sources) — so an article
 * with 100+ sources costs the same to render as one with 10, and the Worker
 * CPU limit is never hit by ledger size. No source is dropped; unreferenced
 * sources stay in the ledger/bundle/JSON, they just aren't pre-rendered. */
export function buildInlineEmbedMap(sources, slug) {
  const map = {};
  for (const s of sources || []) {
    const id = s?.id;
    if (!id) continue;
    let cached;
    Object.defineProperty(map, String(id), {
      enumerable: true,
      configurable: true,
      get() {
        if (cached === undefined) {
          cached = `<div class="embed-inline">${renderPlatformCard(s, slug)}</div>`;
        }
        return cached;
      },
    });
  }
  return map;
}

/** Map ledger source id → vault-style widget descriptor for inline peppering. */
export function buildSourceWidgetMap(sources, articleSlug) {
  const map = {};
  for (const s of sources || []) {
    const id = s?.id;
    if (!id) continue;
    const w = sourceToWidget(s, articleSlug);
    if (w) map[String(id)] = w;
  }
  return map;
}