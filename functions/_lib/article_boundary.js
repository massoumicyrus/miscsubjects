// ARTICLE BOUNDARY — the coded answer to "when is something a NEW article?"
//
// The unit of the site is the DIV (one claim, one passage). An ARTICLE is not a length
// of text — it is a SUBJECT: one stable entity (OpenAI, Hugging Face, BPC-157) or one
// bounded EVENT (an incident, a trial, a ruling). The formula:
//
//   1. SUBJECT TEST — find the proposed content's center of gravity (title + headings +
//      repeated proper nouns). If an existing article already owns that subject, the
//      content is DIVs for that article: APPEND.
//   2. EVENT TEST — if the content binds TWO OR MORE existing subjects into one bounded
//      happening (dates, "incident", "breach", "trial", "acquisition"), it is a NEW
//      article: an event page, with claim DIVs cross-referenced from each entity page.
//      An event is not a property of either entity — it is a relation between them.
//   3. ORPHAN TEST — if the subject has no page and the content carries fewer than
//      MIN_STANDALONE_DIVS substantive blocks, it is not yet an article: APPEND it to
//      the nearest existing subject as a collapsible section, and only when that
//      section's own DIV count crosses SPLIT_AT does it graduate into its own page
//      (this is the "collapsible OpenAI details on the OpenAI page" rule).
//
// Deterministic, no model call: token overlap + entity extraction + thresholds.

const MIN_STANDALONE_DIVS = 6; // fewer blocks than this → a section, not a page
const SPLIT_AT = 14; // a section this large inside a host article should graduate
const APPEND_SCORE = 0.55; // title/subject similarity at or above this → same subject
const EVENT_WORDS =
  /\b(incident|breach|hack|attack|outage|acquisition|merger|lawsuit|trial|ruling|settlement|launch|release|recall|election|disclosure|investigation)\b/i;

const STOP = new Set(
  "a an and are as at be but by for from has have in into is it its of on or that the this to was were what when where which who will with vs versus how why not new".split(
    " ",
  ),
);

function tokens(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / (a.size + b.size - hit);
}

// Proper-noun-ish entities: repeated Capitalized runs in the body, plus title tokens.
function extractEntities(title, markdown) {
  const counts = new Map();
  const runs = String(markdown || "").match(
    /\b[A-Z][A-Za-z0-9]+(?:[  ][A-Z][A-Za-z0-9]+){0,3}\b/g,
  ) || [];
  for (const r of runs) {
    const key = r.toLowerCase();
    if (tokens(key).length === 0) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const repeated = [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 12)
    .map(([k]) => k);
  return { repeated, titleTokens: tokens(title) };
}

function countDivs(markdown) {
  return String(markdown || "")
    .split(/\n\s*\n/)
    .filter((b) => b.trim().length > 40).length;
}

export async function articleBoundaryAdvice(env, b) {
  const title = String(b.title || "").trim();
  const markdown = String(b.markdown || b.text || "").trim();
  if (!title && !markdown)
    return { error: "title or markdown required", status: 400 };

  const { repeated, titleTokens } = extractEntities(title, markdown);
  const divCount = countDivs(markdown);
  const isEvent =
    EVENT_WORDS.test(title) ||
    (EVENT_WORDS.test(markdown.slice(0, 800)) && repeated.length >= 2);

  const rows =
    (
      await env.DB.prepare(
        "SELECT slug, title, json_extract(meta,'$.tags') AS tags FROM articles WHERE published=1",
      ).all()
    ).results || [];

  // Score every existing article as a potential home for this content.
  const scored = rows
    .map((r) => {
      const rt = tokens(r.title + " " + r.slug.replace(/-/g, " "));
      let score = jaccard(titleTokens, rt);
      // entity bonus: a repeated proper noun that IS an existing article's subject
      let entityHits = 0;
      for (const e of repeated) {
        const et = tokens(e);
        if (et.length && jaccard(et, rt) >= 0.5) entityHits++;
      }
      score += Math.min(0.3, entityHits * 0.15);
      return { slug: r.slug, title: r.title, score: +score.toFixed(3), entityHits };
    })
    .sort((x, y) => y.score - x.score);

  const top = scored[0] || { score: 0, entityHits: 0 };
  const strongSubjects = scored.filter((s) => s.score >= APPEND_SCORE || s.entityHits >= 1);

  let verdict, reason, target = null;
  if (isEvent && strongSubjects.length >= 2) {
    verdict = "new_article";
    reason =
      "EVENT TEST: this content binds " +
      strongSubjects.slice(0, 3).map((s) => s.slug).join(" + ") +
      " into one bounded happening. An event is a relation between subjects, not a property of either — it gets its own page, with claim DIVs cross-referenced from each subject page.";
  } else if (top.score >= APPEND_SCORE) {
    verdict = "append";
    target = top.slug;
    reason =
      "SUBJECT TEST: an existing article already owns this subject (" +
      top.slug +
      ", similarity " +
      top.score +
      "). This content is DIVs for that article, not a page.";
  } else if (divCount < MIN_STANDALONE_DIVS && top.score > 0.2) {
    verdict = "append_as_section";
    target = top.slug;
    reason =
      "ORPHAN TEST: only " +
      divCount +
      " substantive blocks (< " +
      MIN_STANDALONE_DIVS +
      "). Too small to stand alone — add as a collapsible section on " +
      top.slug +
      "; it graduates to its own page when the section crosses " +
      SPLIT_AT +
      " DIVs.";
  } else {
    verdict = "new_article";
    reason =
      "No existing article owns this subject (best similarity " +
      top.score +
      ") and the content carries " +
      divCount +
      " substantive blocks — enough to stand as its own page.";
  }

  return {
    ok: true,
    verdict,
    target_slug: target,
    reason,
    signals: {
      div_count: divCount,
      is_event: isEvent,
      entities: repeated.slice(0, 8),
      best_matches: scored.slice(0, 5),
      thresholds: {
        append_score: APPEND_SCORE,
        min_standalone_divs: MIN_STANDALONE_DIVS,
        split_at: SPLIT_AT,
      },
    },
    rule:
      "An article is a SUBJECT (entity or bounded event), never a length. DIVs describing an existing subject append to it; a happening that binds two or more subjects is a new event page; a subject too small to stand alone lives as a collapsible section until it crosses " +
      SPLIT_AT +
      " DIVs.",
  };
}
