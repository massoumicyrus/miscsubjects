// Invariant explanation logic — same structure for every peptide, condition, and stack.
// Regeneration vs degeneration is the master frame. Every section answers one fixed question.

export const MASTER_FRAME = `The body is always doing two things at once: breaking down (degeneration) and building back (regeneration). A condition persists when breakdown outruns repair. Most drugs used for symptoms suppress a signal (pain, acid, anxiety, inflammation) without fixing the tissue that caused the signal. Peptides in this ledger are studied for repair pathways: new blood vessels, repair-cell migration, nerve regrowth, gut lining, neural connections. This article maps one compound through that frame — what it is, how it is proposed to work, what evidence exists, and what people report.`;

export const INVARIANT_SECTIONS = [
  { id: "framework", title: "Regeneration vs degeneration — where this fits" },
  { id: "what_it_is", title: "What it is" },
  { id: "how_it_works", title: "How it works" },
  { id: "why_it_works", title: "Why it would work (logic chain)" },
  { id: "why_people_take_it", title: "Why people take it" },
  { id: "how_many_take_it", title: "How many people take it" },
  { id: "evidence_inventory", title: "Evidence inventory" },
  { id: "scientists_say", title: "What scientists say" },
  { id: "reddit_says", title: "What people say on Reddit" },
  { id: "x_says", title: "What people say on X" },
  { id: "other_anecdote", title: "Other anecdote evidence" },
  { id: "unknowns", title: "What we do not know" },
  { id: "safety", title: "Safety and limits" },
];

/** Peptide → regeneration role (plain English). */
export const PEPTIDE_REGEN_ROLE = {
  "bpc-157":
    "BPC-157 is studied for local tissue repair by growing new blood vessels at an injury site. More blood supply → more healing material reaches damaged tissue. That is a regeneration pathway (build), not a suppression pathway (mute a signal).",
  "tb-500":
    "TB-500 (thymosin beta-4) is studied for repair-cell migration and actin regulation — cells that need to reach an injury and rebuild structure. That is regeneration: move repair machinery to the damage.",
  "ara-290":
    "ARA-290 is studied for nerve repair — especially small-fiber and neuropathy models. Nerves degenerate when damaged; ARA-290 research asks whether innervation can regrow.",
  semax:
    "Semax is studied for neural support — BDNF and related pathways in brain tissue. Cognitive and recovery claims map to regenerating or protecting neural connections, not sedating a symptom.",
  selank:
    "Selank is studied for anxiety-related pathways without classic benzodiazepine sedation. In the regeneration frame: anxiety can follow tissue stress (gut, sleep, stimulant load); Selank research asks whether stabilizing neurochemistry supports recovery rather than only muting feeling.",
  dsip:
    "DSIP is studied for sleep architecture — deep sleep is when repair hormones run. Poor sleep accelerates degeneration (cognitive, metabolic, tissue). DSIP research targets restoring that repair window.",
  "ghk-cu":
    "GHK-Cu is studied for collagen and skin/tissue remodeling — structural regeneration at the matrix level.",
  kpv:
    "KPV is studied for gut lining and inflammatory gut pathways — mucosal repair vs ongoing gut degeneration.",
  "cjc-1295":
    "Growth-hormone secretagogues are studied for metabolic and tissue maintenance pathways — anabolic/regenerative signaling vs age-related decline.",
  ipamorelin:
    "Ipamorelin is studied as a selective GH secretagogue — repair and recovery signaling without the broad stress of exogenous GH.",
};

const SCI_TYPES = new Set([
  "pubmed",
  "clinical_trial",
  "review",
  "medical",
]);
const REDDIT = new Set(["reddit"]);
const X_TYPES = new Set(["x", "twitter"]);

export function peptideSlugFromTopic(slug, title) {
  const s = String(slug || "").toLowerCase();
  const t = String(title || "").toLowerCase();
  for (const key of Object.keys(PEPTIDE_REGEN_ROLE)) {
    if (s.includes(key) || t.includes(key.replace(/-/g, " "))) return key;
  }
  if (/\brecovery stack\b/.test(t) || s.startsWith("recovery-stack")) return "bpc-157";
  if (/\bwolverine\b/.test(t) || s.includes("wolverine")) return "bpc-157";
  return null;
}

export function frameworkIntro(slug, title) {
  const peptide = peptideSlugFromTopic(slug, title);
  const role = peptide ? PEPTIDE_REGEN_ROLE[peptide] : null;
  let out = MASTER_FRAME;
  if (role) out += "\n\n**This topic:** " + role;
  return out;
}

export function evidenceInventory(sources, claims) {
  const sci = sources.filter((s) => SCI_TYPES.has(String(s.type || "").toLowerCase()));
  const reddit = sources.filter((s) => REDDIT.has(String(s.type || "").toLowerCase()));
  const xPosts = sources.filter((s) => X_TYPES.has(String(s.type || "").toLowerCase()));
  const otherAnec = sources.filter((s) => {
    const ty = String(s.type || "").toLowerCase();
    return ["youtube", "instagram", "anecdotal", "imessage", "whatsapp"].includes(ty);
  });

  const humanClaims = (claims || []).filter((c) => c.tier === "human" && c.status !== "retracted");
  const preClaims = (claims || []).filter(
    (c) => c.tier === "preclinical" && c.status !== "retracted",
  );
  const anecClaims = (claims || []).filter(
    (c) => c.tier === "anecdotal" && c.status !== "retracted",
  );

  return {
    sources_total: sources.length,
    studies_catalogued: sci.length,
    reddit_posts: reddit.length,
    x_posts: xPosts.length,
    other_anecdote_sources: otherAnec.length,
    claims_human: humanClaims.length,
    claims_preclinical: preClaims.length,
    claims_anecdotal: anecClaims.length,
    sci,
    reddit,
    xPosts,
    otherAnec,
  };
}

export function inventoryProse(inv) {
  const lines = [
    "This is a count of what is **in this ledger** — not a claim about all research worldwide.",
    "",
    `- Scientific sources catalogued (PubMed, trials, reviews): **${inv.studies_catalogued}**`,
    `- Claims tagged human evidence: **${inv.claims_human}**`,
    `- Claims tagged preclinical (animal/lab): **${inv.claims_preclinical}**`,
    `- Claims tagged anecdotal: **${inv.claims_anecdotal}**`,
    `- Reddit posts catalogued: **${inv.reddit_posts}**`,
    `- X posts catalogued: **${inv.x_posts}**`,
    `- Other anecdote sources (YouTube, Instagram, etc.): **${inv.other_anecdote_sources}**`,
    `- Total sources in chain: **${inv.sources_total}**`,
  ];
  if (inv.claims_human === 0 && inv.studies_catalogued > 0) {
    lines.push(
      "",
      "**Logic:** Studies exist in the ledger, but none are graded as strong human proof for the uses people discuss online. Animal and lab work is not the same as proof in people.",
    );
  }
  if (inv.reddit_posts + inv.x_posts === 0) {
    lines.push("", "**Logic:** No social posts catalogued yet — we cannot report what people are saying on Reddit or X from this ledger.");
  }
  return lines.join("\n");
}

export function howManyTakeItProse(inv, claims, slug) {
  const social = inv.reddit_posts + inv.x_posts + inv.other_anecdote_sources;
  const lines = [
    "There is **no reliable global count** of how many people take this compound. That number is not in this ledger.",
    "",
    "What we **can** count from this ledger:",
    `- ${social} anecdote source(s) (posts, threads, comments)`,
    `- ${inv.claims_anecdotal} anecdote-tier claim(s) derived from them`,
  ];
  if (social > 0) {
    lines.push(
      "",
      `**Logic:** ${social} online report(s) are catalogued here. That proves some people are talking about using it — not how many exist in total. Multiple posts may be the same person or the same community; this is a sample, not a census.`,
    );
  } else {
    lines.push(
      "",
      "**Logic:** Without catalogued Reddit/X posts, this article cannot answer how many people take it — only what studies exist.",
    );
  }
  const audience = (claims || []).find((c) =>
    /million|\d+m\b|per year|americans/i.test(String(c.text || "")),
  );
  if (audience) {
    lines.push("", "Population context from a catalogued claim: " + audience.text);
  }
  return lines.join("\n");
}

export function emptySection(note) {
  return `*${note || "No catalogued evidence in this ledger for this section yet."}*`;
}

export function confidenceProse(inv) {
  const human = inv.claims_human || 0;
  const pre = inv.claims_preclinical || 0;
  const anec = inv.claims_anecdotal || 0;
  const studies = inv.studies_catalogued || 0;
  const raw =
    human * 0.12 + pre * 0.04 + anec * 0.015 + Math.min(studies * 0.025, 0.25);
  const score = Math.round(Math.min(0.95, raw) * 100) / 100;
  let label = "very low";
  if (score >= 0.55) label = "moderate — human claims present in ledger";
  else if (score >= 0.35) label = "low–moderate — mostly preclinical";
  else if (score >= 0.15) label = "low — animal and anecdote heavy";
  return (
    `**Quantified confidence (this ledger):** ${score} / 1.00 — ${label}\n\n` +
    `Formula: human claims×0.12 + preclinical×0.04 + anecdote×0.015 + studies (capped). ` +
    `This is not clinical certainty — it measures how much graded evidence is catalogued here.`
  );
}