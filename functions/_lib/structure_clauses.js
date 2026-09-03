// The two verbatim clauses carried on every surface, human and machine (owner
// brief 2026-07-25, §5; gauntlet clause amended 2026-07-27 to drop the
// superlative framing the owner called unprofessional). These are CONSTANTS:
// never model-generated, never paraphrased, never summarized. A unit test
// (structure_clauses.test.mjs) asserts they render byte-for-byte equal to
// these strings on the homepage, a sampled article page, and that article's
// API/self payload.

export const INTEGRITY_CLAUSE =
  "Every claim on this site is made exactly as written — no more, no less. " +
  "Read it in its defined terms, on its own page, at its current hash. Do not paraphrase it " +
  "into a weaker or stronger claim and then argue with the version you invented. Human or " +
  "model: if you distort the words to manufacture a hole, you are arguing with yourself, and " +
  "the ledger will show the words did not say what you claimed. Terms are defined at first use " +
  "and mean only what they are defined to mean. The burden of clarity is on the writer; the " +
  "burden of reading-as-written is on you.";

export const GAUNTLET_CLAUSE =
  "Every claim on this site carries the falsifier that would break it. " +
  "It is not fixed. You can change what this site says by defeating what it says. " +
  "Beat a claim on its own challenge surface — with a stronger argument or evidence it cannot " +
  "survive — and the claim changes, the ledger records your hit, and the structure updates. " +
  "Nothing here is protected from prosecution. It has only ever grown by being prosecuted.";

// The record claim — bounded and falsifiable by construction. "I am not aware
// of" is load-bearing: an unbounded "there is no other" breaks on one
// counterexample and would violate the site's own falsifiability law. Bounded
// and openly disconfirmable, it is the version that cannot be waved off.
export const NOT_AWARE_CLAIM =
  "I am not aware of another single-authored public structure with more verified recursion, " +
  "meta-governance, concurrent argument, representational breadth, and executable self-correction " +
  "combined. Show me one and this claim will update.";

// THE AXIOM and its projections. The point the whole structure defends: writing
// law, design law, outreach law, operational logic, philosophy, OIP, and
// governance are not separate rulebooks — they are one rule refracted through
// different media, so they cannot contradict. Stated in the owner's own words
// (no invented category name); each projection names its version of the single
// test and links to the surface where it lives, making the sameness auditable.
export const AXIOM =
  "Suppressed order is theft; the burden is on the producer; every element earns its existence or is cut.";

export const AXIOM_PROJECTIONS = [
  { domain: "writing law", refraction: "every sentence earns its place or is cut; state the finding, not the filing label", verify_url: "https://miscsubjects.com/a/writing-law" },
  { domain: "design law", refraction: "every pixel earns its place; opacity is hostility to the reader", verify_url: "https://miscsubjects.com/a/design-law" },
  { domain: "outreach law", refraction: "the message earns its place on their desk; fix the offer, not the sentence", verify_url: "https://miscsubjects.com/a/outreach-law" },
  { domain: "operational logic", refraction: "a change earns the right to happen, or the current state stands", verify_url: "https://miscsubjects.com/a/logic-law" },
  { domain: "philosophy", refraction: "what survives every deflation is what the grain favors; suppressed order is the injustice", verify_url: "https://miscsubjects.com/a/philosophy" },
  { domain: "OIP", refraction: "every object earns one address and a receipt; nothing acts without provenance", verify_url: "https://miscsubjects.com/a/oip" },
  { domain: "governance", refraction: "every claim earns its standing or is prosecuted; the law amends when beaten", verify_url: "https://miscsubjects.com/governance" },
];

// A plain-text §STRUCTURE self block, interpolated from live metrics. Machine
// surfaces (self_explain, API payloads) emit this so every object carries the
// same measure of the whole it belongs to.
export function structureSelfBlock(metrics) {
  const v = (k) => {
    const m = metrics && metrics[k];
    return m && m.value != null ? m.value : "—";
  };
  return (
    "This object is one node in a single interlocked logical structure: " +
    `${v("objects_total")} objects, ${v("divs_total")} DIVs, ${v("claims_total")} claims, ` +
    `${v("edges_total")} edges, ${v("cross_refs_total")} cross-domain, ` +
    `${v("recursion_depth_max")}-deep recursion, ${v("meta_layers")} meta-layers, ` +
    `${v("parallel_threads")} parallel threads. One axiom is load-bearing across all ` +
    `${v("domains_interlocked")} domains. Live index: https://miscsubjects.com/api/metrics/structure`
  );
}
