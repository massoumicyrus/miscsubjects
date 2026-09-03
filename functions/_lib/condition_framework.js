// Condition & stack logic — what is degenerative, what is regenerative, end-to-end.
import { PEPTIDE_REGEN_ROLE, evidenceInventory } from "./explanation_framework.js";

/** Default recovery stack composition. */
export const RECOVERY_STACK = ["bpc-157", "tb-500", "ara-290"];

export const PEPTIDE_STACK_LAYER = {
  "bpc-157": {
    layer: "structure / tissue",
    targets_degeneration:
      "Poor blood supply at injury, weak collagen organization, slow tissue turnover.",
    regenerative_mechanism:
      "Studied for growing new blood vessels (angiogenesis) so repair material reaches damaged tissue.",
    evidence_tier_typical: "preclinical-heavy; limited human pilots",
  },
  "tb-500": {
    layer: "inflammation clearance / repair-cell migration",
    targets_degeneration:
      "Repair cells not reaching injury, stalled inflammation, actin/cytoskeleton disorganization.",
    regenerative_mechanism:
      "Studied for thymosin beta-4 pathways — cells migrate to damage and rebuild structure.",
    evidence_tier_typical: "preclinical-heavy",
  },
  "ara-290": {
    layer: "nerve / innervation",
    targets_degeneration:
      "Nerve compression, small-fiber loss, neuropathic pain signaling without tissue repair.",
    regenerative_mechanism:
      "Studied for nerve repair and small-fiber regeneration in neuropathy models.",
    evidence_tier_typical: "emerging human data in neuropathy contexts",
  },
  semax: {
    layer: "neural / cognitive",
    targets_degeneration:
      "BDNF decline, stimulant-induced neuro stress, cognitive fatigue after dopamine load.",
    regenerative_mechanism:
      "Studied for BDNF and neural support — building connections, not sedating symptoms.",
    evidence_tier_typical: "preclinical + small human pilots",
  },
  selank: {
    layer: "anxiety / neurochemistry",
    targets_degeneration:
      "Chronic stress chemistry, stimulant jitter, non-restorative arousal.",
    regenerative_mechanism:
      "Studied for anxiolytic pathways without classic benzodiazepine sedation.",
    evidence_tier_typical: "small human trials (often non-US)",
  },
  dsip: {
    layer: "sleep / repair window",
    targets_degeneration:
      "Lost deep sleep — when growth hormone and tissue repair cycles run.",
    regenerative_mechanism:
      "Studied for sleep architecture and deep-sleep promotion.",
    evidence_tier_typical: "small human insomnia trials",
  },
  retatrutide: {
    layer: "metabolic load / body weight",
    targets_degeneration:
      "Excess body weight multiplies compressive load on spine, hips, knees, and plantar fascia.",
    regenerative_mechanism:
      "Studied for GLP-1/GIP/glucagon-driven weight loss — less mechanical load, not direct disc regeneration.",
    evidence_tier_typical: "human trials for weight and metabolic endpoints",
  },
  semaglutide: {
    layer: "metabolic load / body weight",
    targets_degeneration:
      "Weight-related joint and disc overload; metabolic stress on repair capacity.",
    regenerative_mechanism:
      "Studied for GLP-1-driven weight loss — reduces mechanical load on weight-sensitive tissues.",
    evidence_tier_typical: "human trials (Rx metabolic)",
  },
  tirzepatide: {
    layer: "metabolic load / body weight",
    targets_degeneration:
      "Same mechanical overload pattern as other GLP-1 contexts at higher body weight.",
    regenerative_mechanism:
      "Studied for GLP-1/GIP weight loss — load reduction on spine and joints.",
    evidence_tier_typical: "human trials (Rx metabolic)",
  },
};

/** Condition profiles — degenerative anatomy + pharma + behaviors. */
export const CONDITION_PROFILES = {
  "degenerative-disc": {
    title: "Degenerative disc disease",
    aliases: ["degenerative disc", "ddd", "disc degeneration", "degenerative disk"],
    degenerative_why: [
      "The disc is mostly water and collagen. Over time it loses height and hydration.",
      "Less hydration → less shock absorption → more load on joints and nerves.",
      "Micro-tears accumulate. The body cannot repair as fast as load breaks tissue down.",
      "That is degeneration: breakdown outruns regeneration.",
    ],
    degenerative_layers: [
      { layer: "Disc matrix", what_breaks: "Collagen and proteoglycans degrade; disc height drops." },
      { layer: "Inflammation", what_breaks: "Chronic inflammatory signaling without resolution stalls repair." },
      { layer: "Nerves", what_breaks: "Nerve roots get irritated or compressed as disc bulges." },
      { layer: "Blood supply", what_breaks: "Discs are avascular — repair depends on diffusion; less supply = slower repair." },
    ],
    degenerative_behaviors: [
      "Long-term NSAID use for pain — suppresses inflammation signal; may slow structural healing (repair vs suppression).",
      "Repeated corticosteroid injections — short-term relief; linked to cartilage/disc weakening over time.",
      "Sedentary patterns — deconditions supporting muscles; more load on disc.",
      "Poor sleep — repair hormones run in deep sleep; less sleep = less regeneration window.",
      "Smoking — linked to disc degeneration in observational data.",
    ],
    regenerative_behaviors: [
      "Sleep — deep sleep is when tissue repair signaling peaks.",
      "Movement within tolerance — keeps blood flow and supporting muscle strength.",
      "Protein and micronutrients — raw material for collagen repair.",
      "Addressing root load — posture, weight, ergonomics — reduces ongoing breakdown.",
      "Choosing repair pathways over suppression-only approaches when possible.",
    ],
    degenerative_pharmaceuticals: [
      {
        drug: "NSAIDs (ibuprofen, naproxen, etc.)",
        mechanism: "Suppress prostaglandins → less pain and inflammation signal.",
        degenerative_logic:
          "Inflammation is part of the repair cascade. Shutting it down can mute pain while the structural damage continues.",
      },
      {
        drug: "Corticosteroid injections",
        mechanism: "Powerful anti-inflammatory at injection site.",
        degenerative_logic:
          "Treats the symptom (inflammation/pain) at the cost of local tissue integrity with repeated use.",
      },
      {
        drug: "Opioids",
        mechanism: "Suppress pain signaling in the brain.",
        degenerative_logic: "No tissue repair; tolerance and dependence risk; does not address disc or nerve degeneration.",
      },
    ],
    stack: RECOVERY_STACK,
    stack_logic:
      "Three degeneration layers — disc/tissue, inflammation/repair cells, nerves — map to three repair pathways in the recovery stack.",
  },
  "herniated-disc": {
    title: "Herniated disc",
    aliases: ["herniated disc", "disc herniation", "slipped disc", "ruptured disc"],
    extends: "degenerative-disc",
    degenerative_why: [
      "A herniation is when disc material pushes through the outer ring.",
      "Often starts from degenerative disc changes — weakened annulus tears under load.",
      "The herniation itself is an acute event on top of chronic degeneration.",
      "Nerve compression or chemical irritation causes pain; the disc structure is still compromised.",
    ],
    stack: RECOVERY_STACK,
  },
  sciatica: {
    title: "Sciatica",
    aliases: ["sciatica", "sciatic pain", "radiculopathy"],
    extends: "herniated-disc",
    degenerative_why: [
      "Sciatica is nerve pain along the sciatic nerve — often from disc herniation or stenosis compressing a root.",
      "The nerve is signaling damage/compression; suppressing pain does not uncompress the nerve.",
    ],
    stack: RECOVERY_STACK,
  },
  "adderall-stimulant": {
    title: "Stimulant load (Adderall / amphetamine)",
    aliases: ["adderall", "amphetamine", "vyvanse", "dexamfetamine", "stimulant"],
    degenerative_why: [
      "Amphetamines force dopamine and norepinephrine release — borrow focus now.",
      "Sleep, appetite, and gut lining often suffer — less regeneration window.",
      "Chronic load can deplete neurochemistry and stress the gut-brain axis.",
    ],
    degenerative_layers: [
      { layer: "Dopamine system", what_breaks: "Forced release → depletion → crash, anhedonia, tolerance." },
      { layer: "Sleep", what_breaks: "Stimulants delay sleep onset and cut deep sleep." },
      { layer: "Gut", what_breaks: "Stimulants stress mucosa; gut inflammation affects mood and cognition." },
      { layer: "Anxiety", what_breaks: "Arousal without calm → jitter, rumination, non-restorative stress." },
    ],
    degenerative_behaviors: [
      "Skipping sleep to work — cuts repair window.",
      "More stimulant to compensate for poor sleep — accelerates depletion cycle.",
      "Benzodiazepines for stimulant anxiety — suppresses feeling; does not restore neurochemistry.",
    ],
    regenerative_behaviors: [
      "Protect sleep window — non-negotiable for neural repair.",
      "Protein and hydration — raw material for neurotransmitter synthesis.",
      "Deload days — let dopamine reserves rebuild.",
      "Gut-supportive food — mucosal repair supports brain-gut axis.",
    ],
    degenerative_pharmaceuticals: [
      {
        drug: "Amphetamine (Adderall, Vyvanse, etc.)",
        mechanism: "Increases synaptic dopamine and norepinephrine.",
        degenerative_logic:
          "Trade: acute focus now vs sleep, gut, and neurochemical reserve later if load is chronic.",
      },
      {
        drug: "Benzodiazepines",
        mechanism: "GABAergic sedation — suppress anxiety signal.",
        degenerative_logic: "Does not rebuild BDNF, sleep architecture, or gut lining.",
      },
    ],
    stack: ["semax", "selank", "dsip"],
    stack_logic:
      "Neural support (Semax), non-benzo calm (Selank), sleep repair window (DSIP) — each targets a stimulant-degeneration layer.",
  },
};

export function matchConditionProfile(slug, title) {
  const s = String(slug || "").toLowerCase();
  const t = String(title || "").toLowerCase();
  const hay = s + " " + t;

  for (const [key, profile] of Object.entries(CONDITION_PROFILES)) {
    if (s.includes(key) || key.includes(s)) return resolveProfile(key, profile);
    for (const alias of profile.aliases || []) {
      if (hay.includes(alias)) return resolveProfile(key, profile);
    }
  }
  if (/herniated|degenerative.disc|disc.degeneration|ddd/.test(hay)) {
    return resolveProfile("herniated-disc", CONDITION_PROFILES["herniated-disc"]);
  }
  if (/recovery.stack|bpc.ara|tb.500.*disc/.test(hay)) {
    return resolveProfile("degenerative-disc", CONDITION_PROFILES["degenerative-disc"]);
  }
  if (/adderall|amphetamine|vyvanse|stimulant/.test(hay)) {
    return resolveProfile("adderall-stimulant", CONDITION_PROFILES["adderall-stimulant"]);
  }
  return null;
}

function resolveProfile(key, profile) {
  if (profile.extends) {
    const parent = CONDITION_PROFILES[profile.extends];
    return {
      key,
      ...parent,
      ...profile,
      degenerative_why: profile.degenerative_why || parent.degenerative_why,
      degenerative_layers: profile.degenerative_layers || parent.degenerative_layers,
      degenerative_behaviors:
        profile.degenerative_behaviors || parent.degenerative_behaviors,
      regenerative_behaviors:
        profile.regenerative_behaviors || parent.regenerative_behaviors,
      degenerative_pharmaceuticals:
        profile.degenerative_pharmaceuticals || parent.degenerative_pharmaceuticals,
    };
  }
  return { key, ...profile };
}

export function stackPeptidesForArticle(slug, title, metaEmbeds) {
  const profile = matchConditionProfile(slug, title);
  if (profile?.stack?.length) return profile.stack;
  const embeds = Array.isArray(metaEmbeds) ? metaEmbeds : [];
  const fromEmbeds = embeds.filter((e) => PEPTIDE_STACK_LAYER[e]);
  if (fromEmbeds.length) return fromEmbeds;
  if (/recovery|herniated|sciatica|disc/.test(String(slug || ""))) return RECOVERY_STACK;
  return [];
}

export function confidenceScore(inv) {
  const human = inv.claims_human || 0;
  const pre = inv.claims_preclinical || 0;
  const anec = inv.claims_anecdotal || 0;
  const studies = inv.studies_catalogued || 0;
  const raw =
    human * 0.12 +
    pre * 0.04 +
    anec * 0.015 +
    Math.min(studies * 0.025, 0.25);
  const score = Math.round(Math.min(0.95, raw) * 100) / 100;
  let label = "very low";
  if (score >= 0.55) label = "moderate (human data present)";
  else if (score >= 0.35) label = "low–moderate (mostly preclinical)";
  else if (score >= 0.15) label = "low (animal/anecdote heavy)";
  return {
    score,
    label,
    breakdown: {
      human_claims: human,
      preclinical_claims: pre,
      anecdote_claims: anec,
      studies_catalogued: studies,
    },
  };
}

export function peptideEmbedJson(peptideSlug, invForPeptide) {
  const layer = PEPTIDE_STACK_LAYER[peptideSlug] || {};
  const conf = invForPeptide ? confidenceScore(invForPeptide) : { score: null, label: "not loaded" };
  return {
    peptide: peptideSlug,
    regenerative_layer: layer.layer || "unknown",
    targets_this_degeneration: layer.targets_degeneration || "",
    proposed_regeneration: layer.regenerative_mechanism || PEPTIDE_REGEN_ROLE[peptideSlug] || "",
    evidence_in_ledger: conf.breakdown || null,
    confidence_0_to_1: conf.score,
    confidence_label: conf.label,
    full_article: `https://miscsubjects.com/a/${peptideSlug}`,
  };
}

export function conditionSectionsProse(profile, stackSlugs, peptideInvMap) {
  if (!profile) return [];
  const parts = [];

  parts.push({
    title: "Why this condition is degenerative",
    body:
      `**${profile.title}** — systematic breakdown:\n\n` +
      (profile.degenerative_why || []).map((l, i) => `${i + 1}. ${l}`).join("\n"),
  });

  if (profile.degenerative_layers?.length) {
    parts.push({
      title: "What is breaking down (layers)",
      body: profile.degenerative_layers
        .map(
          (l) =>
            `- **${l.layer}:** ${l.what_breaks}`,
        )
        .join("\n"),
    });
  }

  if (profile.degenerative_pharmaceuticals?.length) {
    parts.push({
      title: "How common drugs can be degenerative (suppress without repair)",
      body: profile.degenerative_pharmaceuticals
        .map(
          (p) =>
            `**${p.drug}**\n- What it does: ${p.mechanism}\n- Degenerative logic: ${p.degenerative_logic}`,
        )
        .join("\n\n"),
    });
  }

  if (profile.degenerative_behaviors?.length) {
    parts.push({
      title: "Behaviors that accelerate degeneration",
      body: profile.degenerative_behaviors.map((b) => `- ${b}`).join("\n"),
    });
  }

  if (profile.regenerative_behaviors?.length) {
    parts.push({
      title: "Behaviors that support regeneration",
      body: profile.regenerative_behaviors.map((b) => `- ${b}`).join("\n"),
    });
  }

  if (stackSlugs.length) {
    const stackLines = stackSlugs.map((ps) => {
      const layer = PEPTIDE_STACK_LAYER[ps] || {};
      const inv = peptideInvMap[ps];
      const conf = inv ? confidenceScore(inv) : null;
      return (
        `### ${ps} — ${layer.layer || "repair layer"}\n` +
        `- **Targets degeneration:** ${layer.targets_degeneration || "see full peptide article"}\n` +
        `- **Regenerative mechanism:** ${layer.regenerative_mechanism || ""}\n` +
        (conf
          ? `- **Evidence in ledger:** ${conf.breakdown.studies_catalogued} studies, ${conf.breakdown.human_claims} human claims, ${conf.breakdown.anecdote_claims} anecdote claims — confidence **${conf.score}** (${conf.label})`
          : `- **Evidence:** see embedded peptide article`)
      );
    });
    parts.push({
      title: "Why each peptide in this stack is regenerative",
      body:
        (profile.stack_logic || "") +
        "\n\n" +
        stackLines.join("\n\n") +
        "\n\n*Expand each peptide embed below for JSON summary + link to full article.*",
    });
  }

  return parts;
}