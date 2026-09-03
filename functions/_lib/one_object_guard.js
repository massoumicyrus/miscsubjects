// ONE OBJECT PER ARTICLE — enforced in the canonical write path, not in an instruction.
//
// FAILURE (2026-08-04, owner-named catastrophic): the tirzepatide page shipped titled
// "Tirzepatide: 20.9% of body weight in 72 weeks, and nothing measured about a painful back".
// Tirzepatide is a weight-loss drug that has never claimed anything about a back. The headline
// denied a claim the subject never made, and it imported a condition the page is not about.
//
// LAYER THAT PERMITTED IT: the article write path accepted any title and body for any slug. The
// editorial preflight checked headline length and hero briefs; nothing checked whether the prose
// was about the article's own subject. Every client — a coding agent, a Gateway model, the admin
// studio, the Sheets poller, curl — could publish cross-object framing.
//
// INVARIANT: an article whose slug names ONE object carries only that object's frame. Its title,
// and every section heading in its body, name that object or a general property of it — never a
// second object from another family. Cross-object writing lives only in an article whose slug
// names both objects (bpc-157-sciatica, tb-500-herniated-disc, bpc-157-vs-nsaids).
//
// This module is the single source of truth for that vocabulary. The write path refuses on it,
// scripts/check-one-object.mjs sweeps the live corpus with it, and the unit test pins the exact
// failure above. A future agent that has never read the conversation cannot publish the same
// class of page through any normal path.

// One-object subjects: compound pages.
export const COMPOUNDS = Object.freeze([
  "bpc-157", "tb-500", "ara-290", "kpv", "ghk-cu", "dsip", "thymosin-alpha-1", "semax", "selank",
  "mots-c", "nad-plus", "epitalon", "mk-677", "ipamorelin", "tesamorelin", "cjc-1295", "aod-9604",
  "melanotan-ii", "pt-141", "retatrutide", "tirzepatide", "semaglutide", "5-amino-1mq",
  "kisspeptin", "dihexa", "slu-pp-332", "atx-304", "bdnf-p21", "tesofensine", "ss-31", "vip",
  "humanin", "cerebrolysin", "pinealon", "glutathione", "matrixyl", "ll-37", "glow-70",
  "hexarelin", "sermorelin", "thymalin", "aod-9604", "mk-677",
]);

// One-object subjects: condition pages.
export const CONDITION_SLUGS = Object.freeze([
  "herniated-disc", "degenerative-disc-disease", "sciatica", "carpal-tunnel", "plantar-fasciitis",
  "frozen-shoulder", "trigeminal-neuralgia", "postherpetic-neuralgia", "diabetic-neuropathy",
]);

// CONDITION VOCABULARY — named clinical conditions only.
//
// Precision matters in both directions. A compound page legitimately reports the tissue a study
// of that compound used: BPC-157's rat Achilles work is BPC-157's own evidence, and "nerve growth
// factor" is its own biology. What a compound page must never do is frame itself on a named human
// condition it is not about. So the list is clinical conditions and the unambiguous
// anatomical-complaint phrases, never bare tissue words — a bare-word list produced false refusals
// on "dying back", "comes back" and "the tendon studies", and a gate that cries wolf gets weakened.
export const CONDITION_TERMS = Object.freeze([
  "herniated disc", "herniation", "bulging disc", "slipped disc", "disc pain", "disc herniat",
  "degenerative disc", "spinal disc", "sciatica", "sciatic pain", "sciatic nerve pain",
  "back pain", "low back", "lower back", "painful back", "backache",
  "pinched nerve", "nerve root", "compressed nerve", "damaged nerve", "injured nerve",
  "nerve pain", "nerve damage", "neuropathy", "neuropathic", "radicular", "radiculopathy",
  "radiculitis", "carpal tunnel", "frozen shoulder", "rotator cuff tear", "plantar fasciitis",
  "trigeminal neuralgia", "postherpetic", "osteoarthritis", "arthritis", "spinal stenosis",
  "whiplash", "scoliosis", "fibromyalgia", "tendinopathy", "tendinitis", "tendonitis",
  "knee pain", "shoulder pain", "joint pain", "chronic pain",
]);

// Retained for callers that ask for the old export name.
export const CONDITION_WORDS = CONDITION_TERMS;

// Headline framing that denies a claim the subject never made.
export const DENIAL_PATTERNS = Object.freeze([
  /and nothing (?:measured|about|proven|tested|known)/i,
  /nothing measured about/i,
  /does nothing for/i,
  /no evidence (?:for|about) [a-z' ]*\b(?:pain|disc|back|nerve)\b/i,
]);

// Words that are anatomy-of-the-compound rather than a condition frame. "nerve" inside
// "nerve growth factor" is the compound's own biology; "a pinched nerve root" is a condition.
const ALLOWED_PHRASES = [
  "nerve growth factor", "nerve cell", "nerve cells", "nerve tissue", "nerve signalling",
  "nerve signaling", "brain-derived", "backbone", "background", "backed", "backing",
  "discontinu", "discover", "discuss", "disclosure", "discipline", "discrepan",
  "degenerative disc disease" /* only reachable on its own page; slug check handles it */,
];

function scrubAllowed(text) {
  let t = String(text || "").toLowerCase();
  for (const p of ALLOWED_PHRASES) t = t.split(p).join(" ");
  return t;
}

/** The object a slug is about, or null when the slug names more than one object. */
export function singleObjectOf(slug) {
  const s = String(slug || "").toLowerCase();
  if (COMPOUNDS.includes(s)) return { kind: "compound", name: s };
  if (CONDITION_SLUGS.includes(s)) return { kind: "condition", name: s };
  return null;
}

/**
 * Cross-object framing violations for one article write.
 * Returns [] for combination slugs (bpc-157-sciatica) and for anything not a single-object page.
 */
export function crossObjectViolations({ slug, title, body }) {
  const subject = singleObjectOf(slug);
  if (!subject) return [];
  const out = [];
  const rawTitle = String(title || "");

  if (subject.kind === "compound") {
    // Check the title past the subject clause: "Tirzepatide: <this part>".
    const tail = rawTitle.includes(":") ? rawTitle.slice(rawTitle.indexOf(":") + 1) : rawTitle;
    const hay = scrubAllowed(tail);
    for (const w of CONDITION_TERMS) {
      if (hay.includes(w)) {
        out.push({
          code: "cross_object_framing",
          message: `the title of a single-compound page names the condition "${w}" — this page is about ${subject.name} and nothing else`,
          replacement: `Write the headline about ${subject.name}. "${subject.name} for ${w}" belongs in the combination article whose slug names both objects (e.g. /a/${subject.name}-${w.replace(/[^a-z]+/g, "-")}).`,
        });
        break;
      }
    }
    // Section headings framed on a foreign condition.
    for (const line of String(body || "").split("\n")) {
      if (!/^#{2,3}\s/.test(line)) continue;
      const hh = scrubAllowed(line);
      for (const w of CONDITION_TERMS) {
        if (hh.includes(w)) {
          out.push({
            code: "cross_object_section",
            message: `a section heading on a single-compound page is framed on the condition "${w}": ${line.trim()}`,
            replacement: `Delete the section or move it to the combination article. A ${subject.name} page may report a condition that a study of ${subject.name} used as its endpoint, inside the prose — it never carries a section headed on a condition the page is not about.`,
          });
          break;
        }
      }
      if (out.some((o) => o.code === "cross_object_section")) break;
    }
  }

  if (subject.kind === "condition") {
    const tail = rawTitle.includes(":") ? rawTitle.slice(rawTitle.indexOf(":") + 1) : rawTitle;
    const hay = tail.toLowerCase();
    for (const c of COMPOUNDS) {
      if (hay.includes(c.replace(/-/g, " ")) || hay.includes(c)) {
        out.push({
          code: "cross_object_framing",
          message: `the title of a single-condition page names the compound "${c}" — this page is about ${subject.name} and nothing else`,
          replacement: `Write the headline about ${subject.name}. "${c} for ${subject.name}" belongs in /a/${c}-${subject.name}.`,
        });
        break;
      }
    }
  }

  for (const d of DENIAL_PATTERNS) {
    if (d.test(rawTitle)) {
      out.push({
        code: "denial_framing",
        message: "the headline denies a claim the subject never made",
        replacement: "State what the subject is and what was measured. A headline never leads on the absence of a claim nobody made.",
      });
      break;
    }
  }
  return out;
}
