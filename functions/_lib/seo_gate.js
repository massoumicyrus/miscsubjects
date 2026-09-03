// SEO gate — search best practices enforced at the one write path every article goes through
// (owner order 2026-08-06: "install logic so that all articles are gated around those best
// practices"). Server-side 422 refusals with the fix named, same contract as every other
// content law here: the law is learned by hitting it, never by remembering it.
//
// What is deliberately NOT gated here, because an existing gate already owns it:
//   title quality and length        → checkTitle (title_hero_gate.js), runs on every title change
//   claims present                  → claim_law.js
//   sources attached to claims      → source law (article_object.js)
//   test/placeholder/reserved names → registerViolation (api/articles)
//   hero inspection                 → editorialPreflight
//
// The two SEO facts nothing gated until now:
//   1. tags — they drive the meta keywords, the BreadcrumbList middle level, and the /t/
//      folders that give search engines a crawlable topic hierarchy. A new article published
//      without any tag enters the corpus invisible to all three. Ratcheted: only NEW articles
//      are refused, so no existing page is retroactively blocked from repair.
//   2. deck length — the deck is the homepage card description and the strongest
//      description candidate. A deck outside 40–300 chars is either too thin to orient a
//      reader or truncated by every SERP and social card that renders it. Checked only when
//      the write itself sets or changes the deck, so untouched fields never block a repair.

function tagList(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t || "").trim()).filter(Boolean);
  if (typeof tags === "string") return tags.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}

const DECK_MIN = 40;
const DECK_MAX = 300;

/**
 * Same issue shape as editorialWriteIssues: [{code, message, replacement}].
 * @param {object} p
 * @param {boolean} p.isNew        no existing row for this slug
 * @param {number}  p.published    the published flag this write will store
 * @param {object}  p.meta         the merged meta about to be stored
 * @param {object}  p.prevMeta     the meta before this write (null when new)
 */
export function seoWriteIssues({ isNew, published, meta, prevMeta }) {
  const issues = [];
  const tags = tagList(meta?.tags);
  if (isNew && published && !tags.length) {
    issues.push({
      code: "seo_tags_required",
      message:
        "a new article published with no tags is invisible to the topic folders (/t/), carries no keywords, and renders a one-level breadcrumb trail",
      replacement:
        'Add "tags": ["<subject family>", …] to the write — the first tag becomes the breadcrumb middle level and the /t/ folder this article files under.',
    });
  }
  const deck = meta?.deck != null ? String(meta.deck).trim() : "";
  const prevDeck = prevMeta?.deck != null ? String(prevMeta.deck).trim() : "";
  const deckTouched = deck !== prevDeck;
  if (deck && deckTouched) {
    if (deck.length < DECK_MIN) {
      issues.push({
        code: "seo_deck_too_thin",
        message: `the deck is ${deck.length} chars; under ${DECK_MIN} it orients nobody on the homepage card or a search result`,
        replacement: `Write a ${DECK_MIN}–${DECK_MAX} character deck stating what the article establishes, in plain words.`,
      });
    } else if (deck.length > DECK_MAX) {
      issues.push({
        code: "seo_deck_overlong",
        message: `the deck is ${deck.length} chars; past ${DECK_MAX} every SERP and social card truncates it mid-sentence`,
        replacement: `Cut the deck to ${DECK_MAX} characters or fewer, keeping the concrete finding and dropping the preamble.`,
      });
    }
  }
  return issues;
}
