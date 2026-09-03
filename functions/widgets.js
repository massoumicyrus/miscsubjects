// /widgets — the widget index. One live specimen of every card this build can emit, the type
// key that routes to it, the fields it reads, and the rules that govern all of them.
//
// It exists because widgets were being shipped and reviewed nowhere. A `prefers-color-scheme`
// block set every evidence quote to near-white on a white card and it reached a published
// article, because no surface rendered all the cards side by side, where a defect in one of
// them is obvious next to twenty that are fine. This page is the review surface; the gate under
// it (scripts/check-widget-contrast.mjs) is the enforcement. Adding a widget type means adding
// its specimen here in the same change — design law D35.
import {
  governanceHeader,
  governanceFooter,
  governanceChromeStyles,
} from "./_lib/governance_chrome.js";
import { renderPlatformCard, WIDGET_SPECIMENS, platformRailCss } from "./_lib/widgets/rail-platform.js";
import { DESIGN_LAW_OBJECT } from "./_lib/design_law_object.js";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Specimens for the types the showcase set does not cover. Every branch of the router in
// rail-platform.js must be reachable from this page, or a card can ship unlooked-at.
const EXTRA_SPECIMENS = [
  { type: "clinical_trial", id: "spec-ct", title: "A Phase II Trial of Something Measurable", quote: "The primary endpoint was met at 12 weeks in the treatment arm.", url: "https://clinicaltrials.gov/study/NCT00000000", accessed_at: "2026-08-05T00:00", hash: "demo000ct" },
  { type: "review", id: "spec-rev", title: "Systematic review of the same question, done properly", quote: "Across nine trials the effect was consistent in direction and small in size.", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC0000000/", accessed_at: "2026-08-05T00:00", hash: "demo000rv" },
  { type: "imessage", id: "Operator", subtitle: "s-demo", messages: [{ from: "them", text: "did the reconciliation step actually run?" }, { from: "me", text: "no — it reported complete and skipped it." }] },
  { type: "whatsapp", id: "Clinic", subtitle: "s-demo", messages: [{ from: "them", text: "we need the wholesale sheet before Friday" }] },
  { type: "stackoverflow", id: "spec-so", title: "Why does my evidence card render its quote in white?", quote: "Because a media query recoloured the ink and left the surface alone.", url: "https://stackoverflow.com/q/1", accessed_at: "2026-08-05T00:00", hash: "demo000so", stats: { votes: 42, answers: 3 } },
  { type: "arxiv", id: "spec-ax", title: "Silent failure in LLM agents: diffing completion claims against environment state", quote: "Reviewers responded to the confidence of the closing summary rather than to the state of the environment.", url: "https://arxiv.org/abs/2606.09863", accessed_at: "2026-08-05T00:00", hash: "demo000ax" },
  { type: "discord", id: "spec-dc", author: "builder", quote: "shipped it — the gate caught two more before it went out", url: "https://discord.com/channels/1/1", accessed_at: "2026-08-05T00:00", hash: "demo000dc" },
  { type: "email", id: "spec-em", title: "Wholesale enquiry", quote: "We stock eleven compounds and can quote at fifty vials.", url: "https://miscsubjects.com/api/emails/1", accessed_at: "2026-08-05T00:00", hash: "demo000em" },
  { type: "receipt", id: "spec-rc", title: "Dispatch receipt", quote: "EMAIL_SEND_TRACKED — 200 — delivered, witnessed on the inbound ledger.", url: "https://miscsubjects.com/api/dispatch?confirm=1", accessed_at: "2026-08-05T00:00", hash: "demo000rc" },
  { type: "live_surface", id: "spec-ls", title: "GET /api/articles/the-obedience-gap/sources", quote: "The source ledger recomputes its own hash chain on every read.", url: "https://miscsubjects.com/api/articles/the-obedience-gap/sources", accessed_at: "2026-08-05T00:00", hash: "demo000ls" },
  { type: "other", id: "spec-fb", title: "A source with no platform of its own", quote: "The fallback card still carries the quote, the host, the date and the hash.", url: "https://example.org/paper", accessed_at: "2026-08-05T00:00", hash: "demo000fb" },
];

const FIELDS = {
  x: "author, handle, quote, stats.replies/reposts/likes",
  reddit: "subreddit, author, title, quote, stats.votes/comments",
  news: "publisher, section, title, quote or summary",
  statement: "publisher, section, title, quote — the masthead for a vendor, regulator or company speaking in its own name",
  hackernews: "title, author, stats.points/comments",
  youtube: "title, channel, quote",
  instagram: "author, caption",
  pubmed: "title, quote, journal",
  clinical_trial: "title, quote, registry id in the URL",
  review: "title, quote",
  wikipedia: "title, quote",
  dictionary: "headword, translit, pos, quote",
  book: "title, author, quote",
  encyclopedia: "title, quote",
  github: "repo, title, summary, lang, stats.stars/forks",
  stackoverflow: "title, quote, stats.votes/answers",
  arxiv: "title, quote, arXiv id in the URL",
  discord: "author, quote, channel",
  model: "model, prompt, response, receipt URL",
  imessage: "id (contact), subtitle, messages[{from,text}]",
  whatsapp: "id (contact), subtitle, messages[{from,text}]",
  anecdotal: "quote — routed to a message bubble",
  email: "title, quote — rendered as a letter",
  receipt: "title, quote, and the dispatch URL that produced it",
  live_surface: "title, quote, the endpoint URL",
  other: "title, quote, url — the fallback card, which still carries all four",
};

const HOW =
  "In an article body, put the token on its own line: [[embed:source:s7]], where s7 is the id " +
  "of an entry in that article's source ledger. The card is rendered from the ledger entry, so " +
  "the quote on the page and the quote in the ledger cannot drift apart.";

export async function onRequestGet() {
  const all = [...WIDGET_SPECIMENS, ...EXTRA_SPECIMENS];
  const seen = new Set();
  const cards = all
    .filter((s) => {
      const k = String(s.type) + (s.id || "");
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((s) => {
      const type = String(s.type || "other");
      return (
        `<section class="wx-item">` +
        `<header class="wx-h"><code class="wx-key">type: "${esc(type)}"</code>` +
        `<span class="wx-fields">${esc(FIELDS[type] || "title, quote, url")}</span></header>` +
        `<div class="wx-card">${renderPlatformCard(s, "widgets")}</div>` +
        `</section>`
      );
    })
    .join("");

  // Select the widget clauses by what they say, not by a loose keyword: "ink" matched
  // "thinking" and the page listed eleven unrelated principles instead of the five rules
  // that actually govern a card.
  const WIDGET_CLAUSE_TITLES = [
    "A widget's ink is derived from the widget's own surface, never from the viewer's theme",
    "The contrast formula: payload ink 7:1, secondary ink 4.5:1, computed against the resolved surface",
    "One design token, one fallback value, everywhere",
    "A card's payload is the quote, and it is never the faintest thing on the card",
    "Widget ink is a literal, or a token the widget stylesheet itself defines",
    "Every widget appears on the widget index, with its rules beside it",
  ];
  const clauses = (DESIGN_LAW_OBJECT?.content?.clauses || []).filter((c) =>
    WIDGET_CLAUSE_TITLES.includes(String(c.title)),
  );
  const rules = clauses
    .map((c) => `<li><b>${esc(c.title)}</b><span>${esc(c.law)}</span><code>${esc(c.id)}</code></li>`)
    .join("");

  const chrome = typeof governanceChromeStyles === "function" ? governanceChromeStyles() : governanceChromeStyles;
  const rail = typeof platformRailCss === "function" ? platformRailCss() : platformRailCss;

  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Widget index — every card this build can emit, and the rules that govern it</title>` +
    `<meta name="description" content="One live specimen of every widget, its type key, the fields it reads, and the computed contrast law that keeps its text legible.">` +
    `<style>${chrome}${rail}
    .wx-wrap{max-width:1080px;margin:0 auto;padding:28px 20px 80px}
    .wx-wrap h1{font:600 34px/1.2 Georgia,serif;color:#111;margin:0 0 12px}
    .wx-lede{font:400 18px/1.6 Georgia,serif;color:#1a1a1a;max-width:62ch;margin:0 0 8px}
    .wx-sub{font:400 15px/1.65 -apple-system,system-ui,sans-serif;color:#2b2f36;max-width:72ch;margin:0 0 22px}
    .wx-how{font:400 14px/1.65 -apple-system,system-ui,sans-serif;color:#2b2f36;background:#f7f7f8;border:1px solid #e6e6e6;border-radius:12px;padding:14px 16px;max-width:72ch;margin:0 0 30px}
    .wx-how code{font:600 13px/1 ui-monospace,monospace;color:#111}
    .wx-rules{list-style:none;padding:0;margin:0 0 36px;display:grid;gap:12px}
    .wx-rules li{background:#fff;border:1px solid #e6e6e6;border-radius:12px;padding:14px 16px;display:grid;gap:6px}
    .wx-rules b{font:600 15px/1.4 -apple-system,system-ui,sans-serif;color:#111}
    .wx-rules span{font:400 14px/1.6 -apple-system,system-ui,sans-serif;color:#2b2f36}
    .wx-rules code{justify-self:start;font:600 11px/1 ui-monospace,monospace;color:#3f4750;background:#f2f3f5;border-radius:6px;padding:4px 7px}
    .wx-count{font:600 13px/1.5 -apple-system,system-ui,sans-serif;color:#3f4750;margin:0 0 18px}
    .wx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:26px;align-items:start}
    .wx-item{display:grid;gap:10px}
    .wx-h{display:grid;gap:4px}
    .wx-key{font:600 12px/1 ui-monospace,monospace;color:#111;background:#f2f3f5;border-radius:6px;padding:5px 8px;justify-self:start}
    .wx-fields{font:400 12px/1.5 -apple-system,system-ui,sans-serif;color:#3f4750}
    </style></head><body>` +
    governanceHeader("") +
    `<main class="wx-wrap">` +
    `<h1>Widget index</h1>` +
    `<p class="wx-lede">Every card this build can put inside an article, rendered live from the same code the articles use.</p>` +
    `<p class="wx-sub">A widget carries somebody else's words. Its job is to show the masthead those words belong to, the words themselves, the date they were read, and a link back — so a reader never has to take our word for a quotation. The rules below are computed against this page's own stylesheet on every deploy: a card whose text drops below the floor stops the ship.</p>` +
    `<p class="wx-how">${esc(HOW)}</p>` +
    `<ul class="wx-rules">${rules}</ul>` +
    `<p class="wx-count">${seen.size} specimens · contrast floors: payload 7:1, secondary 4.5:1 · gate: scripts/check-widget-contrast.mjs</p>` +
    `<div class="wx-grid">${cards}</div>` +
    `</main>` +
    governanceFooter() +
    `</body></html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=120" },
  });
}
