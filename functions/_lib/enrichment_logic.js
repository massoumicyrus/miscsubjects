// Enrichment voice — condition-first, per-compound "why this helps YOU" causal chains.
import {
  parseCrossSlug,
  PEPTIDE_CATALOG,
  PEPTIDE_IDS,
  PHARMA_CATALOG,
  catalogById,
} from "./ledger_canonical.js";
import {
  matchConditionProfile,
  stackPeptidesForArticle,
  PEPTIDE_STACK_LAYER,
  RECOVERY_STACK,
} from "./condition_framework.js";
import { PEPTIDE_REGEN_ROLE } from "./explanation_framework.js";

/** Spine/joint/foot conditions where body weight adds mechanical load. */
const WEIGHT_SENSITIVE = new Set([
  "degenerative-disc",
  "herniated-disc",
  "sciatica",
  "plantar-fasciitis",
  "frozen-shoulder",
  "knee",
  "hip",
  "back",
  "spine",
  "disc",
  "lumbar",
  "osteoarthritis",
  "arthritis",
]);

const DRUG_SLUG_ALIASES = {
  stimulants: "adderall-amphetamine",
  stimulant: "adderall-amphetamine",
  adderall: "adderall-amphetamine",
  vyvanse: "adderall-amphetamine",
  amphetamine: "adderall-amphetamine",
  glp1: "glp1-agonists",
  "glp-1": "glp1-agonists",
  nsaid: "nsaids",
  ppi: "ppis",
  gabapentin: "gabapentin-lyrica",
  lyrica: "gabapentin-lyrica",
  benzo: "benzodiazepines",
  benzos: "benzodiazepines",
  corticosteroid: "corticosteroid-injection",
  corticosteroids: "corticosteroid-injection",
  chemo: "gabapentin-lyrica",
  statin: "statins",
  metformin: "metformin",
};

const WEIGHT_LOSS_PEPTIDES = new Set(["retatrutide", "semaglutide", "tirzepatide", "aod-9604"]);

const STIMULANT_PEPTIDE_MAP = {
  semax: {
    layer: "dopamine / BDNF",
    chain: [
      "You take a stimulant → dopamine is forced out faster than it rebuilds.",
      "Semax is studied for BDNF and neural support — building connections, not sedating.",
      "If your stimulant load is depleting neurochemistry, Semax targets the rebuild side of that trade.",
    ],
  },
  "bpc-157": {
    layer: "gut-brain axis",
    chain: [
      "Stimulants stress the gut lining; gut inflammation feeds back into mood and focus.",
      "BPC-157 is studied for mucosal repair and angiogenesis at injured tissue.",
      "If your Adderall load is hurting your gut, BPC is the repair-pathway answer — not another suppressant.",
    ],
  },
  selank: {
    layer: "anxiety without benzo suppression",
    chain: [
      "Stimulant jitter is arousal without calm — not the same as fixing neurochemistry.",
      "Selank is studied for anxiolytic pathways without classic benzodiazepine sedation.",
      "If you would otherwise reach for a benzo to take the edge off, Selank logic is repair/support, not mute-the-signal.",
    ],
  },
  dsip: {
    layer: "sleep repair window",
    chain: [
      "Stimulants cut deep sleep — when growth hormone and tissue repair run.",
      "DSIP is studied for sleep architecture and deep-sleep promotion.",
      "If you cannot protect sleep on stimulants, every other repair pathway fights uphill.",
    ],
  },
};

export const ENRICHMENT_TAIL_SECTIONS = [
  "What the evidence actually shows",
  "What scientists say",
  "What people say on Reddit",
  "What people say on X",
  "What we do not know",
  "Safety and limits",
];

function slugHay(slug, title) {
  return (String(slug || "") + " " + String(title || "")).toLowerCase();
}

function detectDrugsInSlug(slug, title) {
  const hay = slugHay(slug, title);
  const out = [];
  for (const p of PHARMA_CATALOG) {
    const tokens = p.id.split("-").filter((t) => t.length > 2);
    if (hay.includes(p.id) || tokens.every((t) => hay.includes(t))) out.push(p.id);
  }
  for (const [alias, canon] of Object.entries(DRUG_SLUG_ALIASES)) {
    if (hay.includes(alias) && !out.includes(canon)) out.push(canon);
  }
  return [...new Set(out)];
}

function isWeightSensitive(slug, title, profile) {
  const hay = slugHay(slug, title);
  if (profile?.key && WEIGHT_SENSITIVE.has(profile.key)) return true;
  for (const w of WEIGHT_SENSITIVE) {
    if (hay.includes(w.replace(/-/g, " ")) || hay.includes(w)) return true;
  }
  return /disc|spine|sciatica|plantar|frozen.shoulder|lumbar|back.pain/i.test(hay);
}

function isStimulantContext(slug, title, profile, drugs) {
  if (profile?.key === "adderall-stimulant") return true;
  const hay = slugHay(slug, title);
  if (/adderall|amphetamine|vyvanse|stimulant/.test(hay)) return true;
  return drugs.some((d) => d === "adderall-amphetamine");
}

function peptidesInScope(slug, title, meta = {}) {
  const cross = parseCrossSlug(slug);
  const profile = matchConditionProfile(slug, title);
  const stack = stackPeptidesForArticle(slug, title, meta.embeds);
  const primary = cross.peptide && PEPTIDE_IDS.has(cross.peptide) ? cross.peptide : null;

  const set = new Set();
  if (primary) set.add(primary);
  for (const p of stack) set.add(p);

  const hay = slugHay(slug, title);
  for (const pid of PEPTIDE_IDS) {
    if (hay.includes(pid)) set.add(pid);
  }

  const ordered = [];
  if (primary && set.has(primary)) ordered.push(primary);
  for (const p of stack) {
    if (set.has(p) && !ordered.includes(p)) ordered.push(p);
  }
  for (const p of set) {
    if (!ordered.includes(p)) ordered.push(p);
  }
  return { cross, profile, primary, stack, peptides: ordered };
}

function layerForCondition(peptideId, profile) {
  if (!profile?.degenerative_layers?.length) return null;
  const layer = PEPTIDE_STACK_LAYER[peptideId];
  if (!layer?.layer) return null;
  const match = profile.degenerative_layers.find((l) => {
    const ll = String(l.layer || "").toLowerCase();
    const pl = String(layer.layer || "").toLowerCase();
    return ll.includes(pl.split("/")[0].trim()) || pl.includes(ll.split("/")[0].trim());
  });
  return match || null;
}

/** Per-peptide if-then chain for a specific reader condition. */
export function peptideWhyYouChain(peptideId, ctx) {
  const { profile, primary, peptides, slug, title } = ctx;
  const layer = PEPTIDE_STACK_LAYER[peptideId] || {};
  const catalog = catalogById("peptide", peptideId);
  const name = catalog?.name || peptideId;
  const mappedLayer = layerForCondition(peptideId, profile);

  const steps = [];
  if (profile?.title) {
    steps.push(`You have **${profile.title}** — breakdown is outpacing repair.`);
  } else if (ctx.conditionLabel) {
    steps.push(`You are reading about **${ctx.conditionLabel}** — what breaks down matters before any compound name.`);
  }

  if (mappedLayer) {
    steps.push(
      `**Layer breaking down:** ${mappedLayer.layer} — ${mappedLayer.what_breaks}`,
    );
  } else if (layer.targets_degeneration) {
    steps.push(`**What keeps failing:** ${layer.targets_degeneration}`);
  }

  if (layer.regenerative_mechanism) {
    steps.push(`**What ${name} is studied to do:** ${layer.regenerative_mechanism}`);
  } else if (PEPTIDE_REGEN_ROLE[peptideId]) {
    steps.push(`**Repair pathway:** ${PEPTIDE_REGEN_ROLE[peptideId]}`);
  }

  steps.push(
    `**Therefore for you:** If that layer is part of your problem, ${name} is discussed because it targets repair (${layer.layer || "tissue"}) — not because it masks pain.`,
  );

  if (primary === peptideId && peptides.length > 1) {
    steps.push(
      `This article centers **${name}**; see other sections for ${peptides.filter((p) => p !== peptideId).join(", ")} — different layers, same condition.`,
    );
  }

  const load = weightLoadChain(peptideId, {
    slug: slug || "",
    title: title || "",
    profile,
    peptides,
    primary,
  });
  if (load) {
    steps.push(...load.steps);
  }

  return {
    peptide: peptideId,
    name,
    section_title: `Why ${name} might help you`,
    layer: layer.layer || catalog?.layer || "",
    steps,
    prose: steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
  };
}

function weightLoadChain(peptideId, ctx) {
  const weightSensitive = isWeightSensitive(ctx.slug, ctx.title, ctx.profile);
  if (!WEIGHT_LOSS_PEPTIDES.has(peptideId) || !weightSensitive) return null;
  const pname = catalogById("peptide", peptideId)?.name || peptideId;
  const steps = [
    `**Mechanical load:** Rough rule used in spine biomechanics — each **1 lb** of body weight lost can mean on the order of **~4 lb** less compressive load through the lumbar spine (leverage through the kinetic chain).`,
    `**${pname}** is studied for meaningful weight loss (GLP-1 / incretin pathways).`,
    `**Chain for you:** more weight → more disc and facet load → faster degeneration and nerve irritation; ${pname} → weight loss → less load → less ongoing breakdown. That is **load reduction**, not disc regeneration — it gives repair peptides less damage to fight.`,
  ];
  return {
    drug: peptideId,
    name: pname,
    section_title: `Why ${pname} might help you (mechanical load)`,
    steps,
    prose: steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
  };
}

/** Drug / GLP-1 mechanical or suppression logic for this reader. */
export function drugWhyYouChain(drugId, ctx) {
  const weightChain = weightLoadChain(drugId, ctx);
  if (weightChain) return weightChain;

  const pharma = PHARMA_CATALOG.find((p) => p.id === drugId);
  if (!pharma) return null;

  const steps = [];
  const weightSensitive = isWeightSensitive(ctx.slug, ctx.title, ctx.profile);

  if (drugId === "glp1-agonists" && weightSensitive && ctx.peptides.some((p) => WEIGHT_LOSS_PEPTIDES.has(p))) {
    const glp = ctx.peptides.find((p) => WEIGHT_LOSS_PEPTIDES.has(p));
    return weightLoadChain(glp, ctx) || drugWhyYouChain(glp, { ...ctx, primary: glp });
  }

  steps.push(`**Drug:** ${pharma.name}`);
  steps.push(`**What it does:** ${pharma.degenerative_logic || "Symptom or pathway modulation — context dependent."}`);

  if (weightSensitive && WEIGHT_LOSS_PEPTIDES.has(drugId)) {
    steps.push(
      `**Load logic:** weight loss → less spinal/joint compression → slower mechanical degeneration.`,
    );
  }

  if (ctx.profile?.degenerative_pharmaceuticals) {
    const hit = ctx.profile.degenerative_pharmaceuticals.find((p) =>
      String(p.drug || "").toLowerCase().includes(pharma.name.toLowerCase().split("/")[0].trim()),
    );
    if (hit) {
      steps.push(`**In your condition:** ${hit.degenerative_logic}`);
    }
  }

  steps.push(
    `**Therefore for you:** state whether this drug **reduces load**, **suppresses a signal**, or **supports metabolism** — and whether that helps or trades off repair for your condition.`,
  );

  return {
    drug: drugId,
    name: pharma.name,
    section_title: `Why ${pharma.name} matters for you`,
    steps,
    prose: steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
  };
}

function stackTogetherProse(ctx, peptideChains) {
  const { profile, peptides, primary } = ctx;
  const lines = [];
  if (profile?.stack_logic) lines.push(profile.stack_logic);
  else if (peptides.length > 1) {
    lines.push(
      "Each compound above targets a different degeneration layer. Together they are a **stack** — not five copies of the same mechanism.",
    );
  } else {
    lines.push(
      "Single-compound focus — if your condition profile includes a multi-peptide stack, siblings target other layers listed in the condition profile.",
    );
  }
  for (const ch of peptideChains) {
    lines.push(`- **${ch.name}** → ${ch.layer || "repair layer"}`);
  }
  if (primary && peptides.length > 1) {
    lines.push(
      `\n*Primary focus of this slug: **${catalogById("peptide", primary)?.name || primary}**. Others are in scope because the same condition breaks down on multiple layers.*`,
    );
  }
  return lines.join("\n");
}

function stimulantSupplementChains(ctx) {
  if (!isStimulantContext(ctx.slug, ctx.title, ctx.profile, ctx.drugs)) return [];
  const relevant = ["semax", "bpc-157", "selank", "dsip"].filter(
    (p) => ctx.peptides.includes(p) || ctx.profile?.stack?.includes(p),
  );
  if (!relevant.length) {
    return Object.entries(STIMULANT_PEPTIDE_MAP).map(([pid, spec]) => ({
      peptide: pid,
      name: catalogById("peptide", pid)?.name || pid,
      section_title: `Why ${catalogById("peptide", pid)?.name || pid} might help you on stimulants`,
      steps: spec.chain,
      prose: spec.chain.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      stimulant_hint: true,
    }));
  }
  return relevant.map((pid) => {
    const spec = STIMULANT_PEPTIDE_MAP[pid];
    if (spec) {
      return {
        peptide: pid,
        name: catalogById("peptide", pid)?.name || pid,
        section_title: `Why ${catalogById("peptide", pid)?.name || pid} might help you on stimulants`,
        steps: spec.chain,
        prose: spec.chain.map((s, i) => `${i + 1}. ${s}`).join("\n"),
        stimulant_hint: true,
      };
    }
    return peptideWhyYouChain(pid, ctx);
  });
}

/** Article shape — drives how many compound sections the writer produces. */
export function enrichmentArticleShape(slug, title, meta = {}) {
  const scope = peptidesInScope(slug, title, meta);
  const n = scope.peptides.length;
  if (n >= 3) return "multi_stack";
  if (n === 2) return "dual_compound";
  if (scope.cross.cross && scope.primary) return "single_cross";
  if (scope.profile?.stack?.length >= 2) return "condition_stack";
  return "single_focus";
}

/** Full brief passed to write / synthesize-body / compose. */
export function enrichmentBrief(slug, title, meta = {}) {
  const scope = peptidesInScope(slug, title, meta);
  const drugs = detectDrugsInSlug(slug, title);
  const cross = scope.cross;
  const profile = scope.profile;

  let conditionLabel = profile?.title || null;
  if (!conditionLabel && cross.target) {
    const t = catalogById(cross.kind, cross.target);
    conditionLabel = t?.name || cross.target;
  }

  const ctx = {
    slug,
    title,
    profile,
    cross,
    primary: scope.primary,
    peptides: scope.peptides,
    stack: scope.stack,
    drugs,
    conditionLabel,
    weight_sensitive: isWeightSensitive(slug, title, profile),
    stimulant_context: isStimulantContext(slug, title, profile, drugs),
    article_shape: enrichmentArticleShape(slug, title, meta),
  };

  const breakingDown = {
    section_title: conditionLabel
      ? `What's breaking down if you have ${conditionLabel}`
      : "What's breaking down",
    degenerative_why: profile?.degenerative_why || [],
    degenerative_layers: profile?.degenerative_layers || [],
    note: profile
      ? null
      : "No condition profile matched — infer degeneration layers from slug/title and ledger claims.",
  };

  const peptideChains = scope.peptides.map((p) => peptideWhyYouChain(p, ctx));

  const drugChains = [];
  for (const d of drugs) {
    const ch = drugWhyYouChain(d, ctx);
    if (ch) drugChains.push(ch);
  }
  for (const p of scope.peptides) {
    if (
      WEIGHT_LOSS_PEPTIDES.has(p) &&
      ctx.weight_sensitive &&
      !scope.peptides.includes(p)
    ) {
      const ch = weightLoadChain(p, ctx);
      if (ch && !drugChains.some((x) => x.drug === ch.drug)) drugChains.push(ch);
    }
  }

  const stimulantChains =
    ctx.stimulant_context && !peptideChains.some((p) => STIMULANT_PEPTIDE_MAP[p.peptide])
      ? stimulantSupplementChains(ctx).filter(
          (s) => !peptideChains.some((p) => p.peptide === s.peptide),
        )
      : [];

  const section_headings = [
    breakingDown.section_title,
    ...peptideChains.map((p) => p.section_title),
    ...stimulantChains.map((s) => s.section_title),
    ...drugChains.map((d) => d.section_title),
    "How these fit together",
    ...ENRICHMENT_TAIL_SECTIONS,
  ];

  return {
    voice: "enrichment",
    article_shape: ctx.article_shape,
    condition: conditionLabel,
    condition_key: profile?.key || cross.target || null,
    primary_peptide: scope.primary,
    peptides_in_scope: scope.peptides.map((id) => ({
      id,
      name: catalogById("peptide", id)?.name || id,
    })),
    drugs_in_scope: drugs,
    weight_sensitive: ctx.weight_sensitive,
    stimulant_context: ctx.stimulant_context,
    breaking_down: breakingDown,
    peptide_chains: peptideChains,
    drug_chains: drugChains,
    stimulant_chains: stimulantChains,
    stack_together: stackTogetherProse(ctx, peptideChains),
    section_headings: [...new Set(section_headings)],
    writer_rules: [
      "One ## section per compound in peptide_chains — do not merge into one peptide essay.",
      "Each Why section must use if-then steps from peptide_chains / drug_chains.",
      "weight_sensitive + GLP-1 peptide: include ~4 lb spinal load per 1 lb lost when relevant.",
      "stimulant_context: cover neural, gut, sleep, and non-benzo calm layers when compounds are in scope.",
      "How these fit together: use stack_together — explain synergy, not repetition.",
    ],
  };
}

export function usesEnrichmentVoice(mode) {
  return mode === "condition" || mode === "stack" || mode === "article";
}

export function enrichmentSectionHeadings(brief) {
  if (!brief) return [];
  return brief.section_headings || [];
}