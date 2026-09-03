#!/usr/bin/env node

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";

// Technical term -> the plain words that carry the same meaning. Presence of the term without
// its plain gloss nearby is the defect.
const JARGON = {
  angiogenesis: "new blood vessel growth",
  "angiogenic": "blood-vessel-growing",
  desiccation: "drying out",
  desiccated: "dried out",
  "fibroblast migration": "tissue-building cells moving to the injury",
  proliferation: "cells multiplying",
  "extracellular matrix": "the scaffold between cells",
  "nucleus pulposus": "the soft centre of the disc",
  "annulus fibrosus": "the tough outer ring of the disc",
  radiculopathy: "a pinched nerve root",
  radiculitis: "an inflamed nerve root",
  "anti-fibrotic": "reduces scarring",
  fibrosis: "scarring",
  "upregulate": "increase",
  "downregulate": "reduce",
  "modulate": "change",
  "attenuate": "reduce",
  "ameliorate": "improve",
  "efficacy": "whether it works",
  "administration": "taking it",
  "utilise": "use",
  "utilize": "use",
  "demonstrate": "show",
  "indicate": "show",
  "elucidate": "explain",
  "facilitate": "help",
  "mediated by": "happens through",
  "in vivo": "in a living animal",
  "in vitro": "in a dish",
  "nociceptive": "pain-signalling",
  "catabolic": "tissue-breaking-down",
  "anabolic": "tissue-building",
  "pharmacokinetic": "how the body absorbs and clears it",
  "bioavailability": "how much reaches the blood",
  "immunogenicity": "whether the immune system reacts to it",
  "epithelial": "lining",
  "hematopoietic": "blood-cell-making",
  "haematopoietic": "blood-cell-making",
};

// Hedges that replace a number. W63.
const HEDGES = [
  "may support", "may help", "might help", "could potentially", "may potentially",
  "some evidence suggests", "more research is needed", "further studies are needed",
  "it is thought that", "it is believed that", "appears to be promising",
  "shows promise", "may be beneficial", "could be beneficial",
];

// Naming an audience inside the page. W64.
// W68: verbs that no tier may use about a person.
const FALSE_CLAIM = [
  "treats ", "cures ", "prevents ", "is safe for", "is effective for",
  "will heal", "will repair", "will fix",
];

// W65: language whose truth depends on who is reading. Roles, second-person instruction.
const AUDIENCE = [
  "chiropractic practice", "chiropractor", "a clinic can", "clinics can",
  "practitioners can", "what a practice", "would care", "can honestly say",
  "for your patients", "your practice", "stock this", "sell this",
  "as a practitioner", "as a clinician", "your patients", "your clients",
  "you are the peptide writer", "in your practice", "your readers",
];


const SUBSTANCE = /^(bpc-157|tb-500|ara-290|kpv|ghk-cu|dsip|thymosin-alpha-1|semax|selank|mots-c|nad-plus|epitalon|mk-677|ipamorelin|tesamorelin|cjc-1295|aod-9604|melanotan-ii|pt-141|retatrutide|wolverine-stack.*|glow-70.*|5-amino-1mq|kisspeptin|dihexa|slu-pp-332|atx-304|bdnf-p21|tesofensine)$/;
function substanceChecks(slug, body, low) {
  const out = [];
  if (!SUBSTANCE.test(slug)) return out;
  // (1) a visible evidence-state block near the top, naming the human-trial state either way
  // the opening legitimately carries the evidence-state block AND the disclosure
  const head = low.slice(0, 4200);
  const statesHuman = /(randomi[sz]ed|human trial|human stud|in people|tested in a person|no human)/.test(head);
  if (!statesHuman) {
    out.push("W64 no evidence-state block up top — the human-trial state must be stated in plain words in the opening, saying none where there is none");
  }
  // (3) commercial relationship disclosed in the body, not a footer
  const discloses = /(sells|sold by|profits|commercial|affiliat|we stock|the owner of this site|financial interest|conflict of interest)/.test(low);
  if (!discloses) {
    out.push("W65 no commercial-relationship disclosure in the body — required on any page describing a substance the site or an affiliated business sells");
  }
  // the disclosure states the relationship and never the identity (identity rules bind harder)
  for (const brand of ["the tenant", "tenant", "the tenant", "the tenant"]) {
    if (low.includes(brand)) out.push(`IDENTITY-LEAK "${brand}" — disclose the commercial relationship, never the seller's name`);
  }
  return out;
}

// A model name burned into a hero image shipped on this site. Heroes are checked by filename
// and alt text here; the pixels are checked by the editorial audit.
const MODEL_TOKENS = /(fable|opus|sonnet|haiku|claude|gpt-?[45]|grok|gemini|kimi|glm|llama)[\s-]?\d*/i;

const args = process.argv.slice(2);

const MIN_AUDITED = 60;

async function corpus() {
  const list = [];
  for (let offset = 0; offset < 5000; offset += 250) {
    const url = `${BASE}/api/articles?limit=250&offset=${offset}&status=published`;
    let page = null;
    let why = '';
    const OVERLOAD = /overloaded|Requests queued for too long|7429/i;
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      const r = await fetch(url).catch((e) => ({ ok: false, status: 0, _err: e }));
      const body = r.text ? await r.text().catch(() => '') : '';
      let j = null;
      try { j = body ? JSON.parse(body) : null; } catch { j = null; }
      const got = r.ok && (Array.isArray(j) ? j : (j && (j.articles || j.items)) || null);
      if (got) { page = got; break; }
      why = (j && (j.error || j.message)) || (r._err && String(r._err.message)) || `HTTP ${r.status}`;
      if (attempt >= 8) break;
      const backoff = OVERLOAD.test(why) ? Math.min(30000, attempt * 8000) : attempt * 3000;
      console.error(`PLAIN_LANGUAGE_LAW: corpus read ${attempt}/8 got ${String(why).slice(0, 80)} — waiting ${Math.round(backoff / 1000)}s`);
      await new Promise((res) => setTimeout(res, backoff));
    }
    if (!page) {
      console.error(
        `PLAIN_LANGUAGE_LAW could not read the corpus after 8 tries: ${url} answered ${why}. ` +
          `The corpus was not audited, so nothing here is a verdict on the writing. Retry the read.`,
      );
      process.exit(2);
    }
    list.push(...page);
    if (page.length < 250) break;
  }
  // Anchored on slug segments, so "disc" matches /a/herniated-disc and never "disconfirming".
  const KEEP =
    /(^|-)(bpc|bpc-157|tb-500|ara-290|kpv|ghk|ghk-cu|dsip|thymosin|semax|selank|vip|pt-141|tesamorelin|tirzepatide|retatrutide|semaglutide|peptide|peptides|disc|discs|sciatica|nsaid|nsaids|tendon|tendons|tendinopathy|neuropathy|neuropathic|nerve|stack|wolverine|glow|herniated|degenerative|spine|spinal|stenosis|frozen|shoulder|carpal|tunnel|facet|joint|sacroiliac|plantar|fasciitis|rotator|cuff)(-|$)/i;
  const slugs = list.map((a) => a.slug).filter((s) => s && KEEP.test(s));
  console.error(
    `PLAIN_LANGUAGE_LAW: ${list.length} published articles fetched, ${slugs.length} in the peptide/condition corpus and audited.`,
  );
  if (slugs.length < MIN_AUDITED) {
    console.error(
      `PLAIN_LANGUAGE_LAW FAIL — only ${slugs.length} articles matched the corpus filter, below the floor of ${MIN_AUDITED}. ` +
        `This is what a broken selector looks like from the inside; it is not evidence that the corpus is clean. ` +
        `Fix the fetch or the filter. Do not lower the floor.`,
    );
    process.exit(1);
  }
  return slugs;
}

const slugs = args.length ? args : await corpus();
const seenHeadings = new Map();
const failures = [];

for (const slug of slugs) {
  let body = "";
  let claimText = "";
  try {
    const r = await fetch(`${BASE}/api/articles/${slug}`);
    const j = await r.json();
    body = j.body || "";
    // CLAIMS RENDER ON THE PAGE. The labelled blocks a reader sees ("What it is", "What is
    // known", "Safety and limitations") are composed from the claims array, not from the body.
    // Checking only the body passed pages whose visible text was unreadable — the exact failure
    // this gate exists to stop. Claim prose is page prose and is checked as such.
    claimText = (j.claims || []).map((c) => `${c.section || ""}. ${c.text || ""}`).join("\n\n");
  } catch {
    continue;
  }
  if (body.length < 2000 && claimText.length < 800) continue; // fragments: a different gate owns those
  // Everything below runs over body AND claim prose, because both reach the reader.
  const visible = body + "\n\n" + claimText;
  // A VERBATIM QUOTE IS NOT OUR PROSE. The FDA writing "routes of administration" inside quotation
  // marks is the regulator's sentence; de-jargonising it would falsify the quote. The vocabulary
  // clauses run over our own words only — quoted spans are removed first. Headings, labels and
  // repeated-section checks still run over everything, because those are structure, not wording.
  const ours = visible.replace(/[""][^""]{0,2000}[""]/g, " ").replace(/"[^"\n]{0,2000}"/g, " ");
  const low = ours.toLowerCase();
  const lowAll = visible.toLowerCase();
  const hits = [];

  for (const [term, plain] of Object.entries(JARGON)) {
    const n = (low.match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")) || []).length;
    // One use is tolerated only if the plain words appear within the page as the gloss.
    if (n > 1 || (n === 1 && !low.includes(plain.split(" ")[0]))) {
      hits.push(`JARGON "${term}" x${n} — say "${plain}"`);
    }
  }
  for (const h of HEDGES) {
    const n = (low.match(new RegExp(h, "g")) || []).length;
    if (n) hits.push(`HEDGE "${h}" x${n} — replace with the count, species and dose`);
  }
  for (const f of FALSE_CLAIM) {
    const n = (low.match(new RegExp(f, "g")) || []).length;
    if (n) hits.push(`FALSE-CLAIM "${f.trim()}" x${n} — no tier may use this verb about a person (W68)`);
  }
  for (const a of AUDIENCE) {
    const n = (low.match(new RegExp(a, "g")) || []).length;
    if (n) hits.push(`RELATIVE: "${a}" x${n} — the reader has the condition`);
  }
  // a heading reused across pages is a template.
  for (const line of visible.split("\n")) {
    if (!/^#{2,3}\s/.test(line)) continue;
    const key = line.replace(/^#+\s*/, "").toLowerCase().replace(/[^a-z ]/g, "").trim();
    if (key.length < 12) continue;
    if (seenHeadings.has(key) && seenHeadings.get(key) !== slug) {
      hits.push(`REPEATED-HEADING from /a/${seenHeadings.get(key)}: "${key}"`);
    } else {
      seenHeadings.set(key, slug);
    }
  }
  // Hashtags belong on social posts, not in article bodies (surface + social clauses, scoped).
  for (const m of visible.match(/(^|\s)#[a-z][a-z0-9_]{2,}/gi) || []) {
    hits.push(`HASHTAG-IN-ARTICLE "${m.trim()}" — hashtags are obligatory on social posts and default to none in articles`);
  }
  hits.push(...substanceChecks(slug, visible, lowAll));

  // Invented grammar (W90): any ALL-CAPS label-colon opener, not only the tier words.
  for (const m of (visible.match(/(^|\n)\s*[A-Z][A-Z /-]{2,24}[.:]\s/g) || []).slice(0, 6)) {
    const w = m.trim().replace(/[.:]$/, "");
    if (/^(NOTE|WARNING|TL;DR|FDA|WADA|NCT|PMID|DOI|USP|GMP|EU|UK|US)$/.test(w)) continue;
    hits.push(`INVENTED-GRAMMAR ${JSON.stringify(w)} — a label-colon opener is not English; write the sentence`);
  }

  // Tier labels barked into prose. The tier belongs in claim metadata, carried in the sentence
  // by ordinary English. "HUMAN. That does not mean..." is unreadable.
  for (const m of visible.match(/(^|\n|\.\s|\*\*)(HUMAN|ANIMAL|ANECDOTAL|STRUCTURE|MECHANISTIC|PRECLINICAL)[.:]/g) || []) {
    hits.push(`TIER-BARK ${JSON.stringify(m.trim())} — the tier is claim metadata, never a label in the prose; say "in people", "in rats", "one person reported"`);
  }

  const CODE_TEMPLATE = [
    "therefore for you",
    "what keeps failing",
    "layer breaking down",
    "is studied to do:",
    "repair pathway:",
    "different layers, same condition",
    "targets a different degeneration layer",
    "not because it masks pain",
    "breakdown is outpacing repair",
    "chain for you:",
  ];
  for (const t of CODE_TEMPLATE) {
    const n = (low.split(t).length - 1);
    if (n) {
      hits.push(
        `CODE-TEMPLATE ${JSON.stringify(t)} x${n} — this sentence was emitted by a function, not written. ` +
          `Code may pass facts; it may never choose words. Withdraw the page and have a writer holding the law write it.`,
      );
    }
  }

  // W61: the missing-human-evidence point must not be the opening.
  const opening = lowAll.slice(0, 700);
  if (/no human (trial|evidence|stud)/.test(opening)) {
    hits.push("ABSENCE-AS-THESIS: opens on missing human evidence — that is a row in the table, not the thesis");
  }
  if (hits.length) failures.push({ slug, hits });
}

if (failures.length) {
  console.log(JSON.stringify({ ok: false, law: "PLAIN_LANGUAGE_LAW", failing: failures.length,
    checked: slugs.length, failures }, null, 1));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, law: "PLAIN_LANGUAGE_LAW", checked: slugs.length }));
