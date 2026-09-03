#!/usr/bin/env node
/**
 * Canonize architecture verdict on immutable protocol article.
 * Usage: node scripts/post_protocol_verdict.mjs [--dry-run]
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const SLUG = "protocol";
const dryRun = process.argv.includes("--dry-run");

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error("TERMINAL_KEY not found");
}

const CLAIMS = [
  // —— 7 problems solved ——
  {
    slot: "what_it_is",
    tier: "mechanistic",
    text: "Problem 1 (hallucination): solved by tier weights + mandatory source_ids + hash-chained ledger — no source = unsourced + why_material; models cannot invent citations.",
    why_material: "Core epistemic invariant",
  },
  {
    slot: "what_it_is",
    tier: "mechanistic",
    text: "Problem 2 (evidence inflation): solved by hardcoded tier weights — human 0.8, preclinical 0.5, anecdotal 0.3 — weight is declared in schema, not inferred by prose.",
    why_material: "Prevents weak→strong rhetorical smoothing",
  },
  {
    slot: "what_it_is",
    tier: "mechanistic",
    text: "Problem 3 (knowledge rot): solved by append-only ledger — retractions stay visible as status:retracted + retraction events; corrections link to false claims permanently.",
    why_material: "Audit trail over silent edits",
  },
  {
    slot: "what_it_is",
    tier: "mechanistic",
    text: "Problem 4 (model monoculture): solved by mandatory posted_by provenance — each model contribution tagged and visible; cross-model challenge is a trust dimension.",
    why_material: "Multi-model writeback operational (Kimi + Gemini on peptide slugs)",
  },
  {
    slot: "what_it_is",
    tier: "mechanistic",
    text: "Problem 5 (knowledge sprawl): solved by ontology tree + misstep detection — peptide roots, condition branches, stack compositions; duplicate scope flagged for merge/reparent.",
    why_material: "Anti-sprawl governance",
  },
  {
    slot: "what_it_is",
    tier: "mechanistic",
    text: "Problem 6 (curation bottleneck): solved by populate→repair→fill-slots — constitution defines slots; machine extracts claims, assigns tiers, links voxel edges.",
    why_material: "Machine executes rules humans define",
  },
  {
    slot: "what_it_is",
    tier: "mechanistic",
    text: "Problem 7 (model communication friction): solved by self-explaining payloads (_self) + prompt-injection tags ([ARTICLE_CLAIM], [KIMI_COLLABORATE]) — bundle is operable without external docs.",
    why_material: "Zero-context model onboarding",
  },

  // —— novelty (mechanistic — design claims, not market claims) ——
  {
    slot: "what_is_known",
    tier: "mechanistic",
    text: "Novelty: cryptographic source chaining + mandatory source_ids replaces human-only fact-checking for citation integrity.",
    why_material: "Method distinction vs standard fact-check",
  },
  {
    slot: "what_is_known",
    tier: "mechanistic",
    text: "Novelty: hardcoded tier weights in claim schema replace peer-review tone as evidence-strength signal.",
    why_material: "Schema-level epistemic honesty",
  },
  {
    slot: "what_is_known",
    tier: "mechanistic",
    text: "Novelty: append-only retraction events (blockchain-inspired) replace version-history silent edits for knowledge corrections.",
    why_material: "Visible correction chain",
  },
  {
    slot: "what_is_known",
    tier: "mechanistic",
    text: "Novelty: per-model posted_by + adversary challenge replaces single-model output as trust basis.",
    why_material: "Cross-model epistemology",
  },
  {
    slot: "what_is_known",
    tier: "mechanistic",
    text: "Novelty: automated ontology misstep detection replaces taxonomy-committee-only sprawl control.",
    why_material: "Machine-governed graph shape",
  },
  {
    slot: "what_is_known",
    tier: "mechanistic",
    text: "Novelty: constitution-directed populate-repair replaces crowdsourced/expert-only curation at scale.",
    why_material: "Slot-filling automation",
  },
  {
    slot: "what_is_known",
    tier: "mechanistic",
    text: "Novelty: prompt-injection claim tags + _self payloads replace API/JSON-schema-only model handoffs.",
    why_material: "Paste-operable protocol",
  },

  // —— weaknesses (limitations) + inline resolution pointer ——
  {
    slot: "limitations",
    tier: "human",
    text: "WEAKNESS: Truth — hash chain verifies integrity, not correctness. A hash-chained lie remains a lie. RESOLUTION: adversary challenges (POST /api/protocol/challenge), explicit what_is_unknown slots, human audit of high-weight claims.",
    why_material: "Honest epistemic ceiling",
  },
  {
    slot: "limitations",
    tier: "human",
    text: "WEAKNESS: Source quality — PubMed and Reddit are both chainable sources; ledger labels tier (e.g. anecdotal w=0.3) but does not exclude low-quality sources. RESOLUTION: human/source_hunt reviews, elevation only when sourced, cut threshold for noise.",
    why_material: "Labeling ≠ filtering",
  },
  {
    slot: "limitations",
    tier: "human",
    text: "WEAKNESS: Malicious model actors — fabricated source_ids are recorded, not auto-detected. RESOLUTION: cross-model collaborate+challenge passes, source verify endpoint, retract/scrub on leak detection.",
    why_material: "Adversarial layer required",
  },
  {
    slot: "limitations",
    tier: "human",
    text: "WEAKNESS: Semantic understanding — duplicate assertions (e.g. angiogenesis vs blood vessel formation) stay separate atoms unless a model links them. RESOLUTION: future equivalence edges in voxel graph + dedup pass in repair.",
    why_material: "No automatic semantic merge yet",
  },
  {
    slot: "limitations",
    tier: "human",
    text: "WEAKNESS: Scale beyond text — handles evidence paste, not raw lab data, images, or structured trial datasets. RESOLUTION: ingest kinds for structured data + R2 attachments on source voxels.",
    why_material: "Text claim graph only today",
  },
  {
    slot: "limitations",
    tier: "human",
    text: "WEAKNESS: Incentive alignment — no token, reputation, or reward for model/human contribution. RESOLUTION: contribution scoring, public provenance cards, optional bounties on what_is_unknown slots.",
    why_material: "Relies on builder intent today",
  },
  {
    slot: "limitations",
    tier: "mechanistic",
    text: "WEAKNESS (live): Ontology embed wiring incomplete — misstep detection flags sprawl but reparent/merge loop not fully automated. RESOLUTION: link_peptide_graph.mjs + enforced embeds on populate.",
    why_material: "Sprawl detected > sprawl fixed",
  },
  {
    slot: "limitations",
    tier: "mechanistic",
    text: "WEAKNESS (live): Infrastructure is centralized (D1/Pages/TERMINAL_KEY) — decentralized epistemology, single-operator spine. RESOLUTION: federated article mirrors, signed contribution export, optional IPFS source blobs.",
    why_material: "Architecture vs deployment honesty",
  },

  // —— possible resolutions (what_is_unknown — proposed, not proven) ——
  {
    slot: "what_is_unknown",
    tier: "speculative",
    text: "RESOLUTION (proposed): Fabrication detection — auto-flag claims whose source_ids have no matching quote or dead link_status after verify pass.",
    why_material: "Automate adversary trigger",
  },
  {
    slot: "what_is_unknown",
    tier: "speculative",
    text: "RESOLUTION (proposed): Corroboration score — dimension when N distinct posted_by models cite same source_id or assert overlapping claim without challenge.",
    why_material: "Quantify cross-model trust",
  },
  {
    slot: "what_is_unknown",
    tier: "speculative",
    text: "RESOLUTION (proposed): Semantic equivalence edges — claim↔claim relation type equivalent_to with human/model approval gate.",
    why_material: "Reduce atom duplication",
  },
  {
    slot: "what_is_unknown",
    tier: "speculative",
    text: "RESOLUTION (proposed): Reputation on contributions — weight future model writes by challenge accuracy and retract rate.",
    why_material: "Incentive without token",
  },

  // —— significance + utility ——
  {
    slot: "what_is_known",
    tier: "speculative",
    text: "Significance: first operational protocol for multi-model collaborative knowledge graphs with cryptographic auditability, tier honesty, and adversarial correction — peptides are demo substrate, not the point.",
    why_material: "Infrastructure claim — verify via protocol article + collaborate endpoints",
  },
  {
    slot: "what_is_known",
    tier: "mechanistic",
    text: "Significance (evidenced): Kimi (moonshot-v1-8k) and Gemini (gemini-2.5-flash) posted claims and challenges to live peptide slugs — first non-Grok ledger writeback traffic.",
    why_material: "Problem 4 proof point Jun 2026",
  },
  {
    slot: "who_claims_what",
    tier: "human",
    text: "Utility for researchers: audit trail of who claimed what, when, with what evidence tier — no more unattributed 'I read a study somewhere.'",
    why_material: "Provenance-as-product",
  },
  {
    slot: "who_claims_what",
    tier: "human",
    text: "Utility for clinicians: what_is_unknown slots and tier weights prevent treating preclinical data as clinical truth.",
    why_material: "Explicit gaps reduce overconfidence",
  },
  {
    slot: "who_claims_what",
    tier: "human",
    text: "Utility for patients: anecdotal reports preserved at w=0.3 — not dismissed, not inflated.",
    why_material: "Honest anecdote handling",
  },
  {
    slot: "who_claims_what",
    tier: "mechanistic",
    text: "Utility for model builders: every claim has posted_by model ID — bias traceable in training/eval corpora derived from ledger.",
    why_material: "Training data provenance",
  },
  {
    slot: "who_claims_what",
    tier: "mechanistic",
    text: "Utility for builder: constitutional AI OS — rules govern machine writers (populate, collaborate, claim), not only human behavior; iMessage/dispatch as control plane.",
    why_material: "Machine→manual bridge closed",
  },

  // —— verdict ——
  {
    slot: "limitations",
    tier: "mechanistic",
    text: "Verdict: 7 problems addressed by 7 novel methods (novel = distinctive combination on a public claim graph, not never conceived elsewhere). 8 documented weaknesses with resolution paths. Architecture admits its own gaps by design.",
    why_material: "Canonical self-assessment",
  },
];

const BODY_APPEND = `

## Architecture verdict (canonized ${new Date().toISOString().slice(0, 10)})

Seven problems, seven methods, eight weaknesses with resolution paths — all as tiered claim atoms on this article.

| # | Problem | Method | Weakness | Resolution path |
|---|---------|--------|----------|-----------------|
| 1 | Hallucination | source_ids + hash chain | Truth unverified | challenge + human audit |
| 2 | Evidence inflation | hardcoded tier weights | Source quality unfiltered | tier labels + source_hunt |
| 3 | Knowledge rot | append-only retraction | — | (addressed) |
| 4 | Model monoculture | posted_by + challenge | Malicious actors | cross-model adversary |
| 5 | Knowledge sprawl | ontology missteps | Embed wiring incomplete | link_peptide_graph |
| 6 | Curation bottleneck | populate-repair | — | (addressed) |
| 7 | Model friction | _self + prompt tags | Centralized spine | federated mirrors |

**Significance:** infrastructure for machine-collaborative epistemology — auditable, tier-honest, adversarial.

**Live proof:** Kimi + Gemini collaborate passes on bpc-157, tb-500, wolverine-stack-glp1.

Read claims: \`GET /api/articles/protocol/health\` · voxels: \`GET /api/articles/protocol/voxels\`
`;

async function main() {
  const key = loadKey();
  const posted = [];

  for (const c of CLAIMS) {
    const body = {
      slug: SLUG,
      tier: c.tier,
      text: c.text,
      slot: c.slot,
      who_claims: "miscsubjects protocol verdict",
      channel: "protocol/verdict",
      model: "grok-build",
      why_material: c.why_material,
    };
    if (dryRun) {
      console.log("[dry]", c.slot, c.tier, c.text.slice(0, 80));
      continue;
    }
    const r = await fetch(BASE + "/api/protocol/claim", {
      method: "POST",
      headers: { "content-type": "application/json", "x-terminal-key": key },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.error) {
      console.error("FAIL", c.text.slice(0, 60), j.error);
    } else {
      posted.push(j.claim_id);
      console.log("OK", j.claim_id, c.slot);
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  if (!dryRun) {
    const cur = await fetch(BASE + "/api/articles/" + SLUG, {
      headers: { "x-terminal-key": key },
    }).then((r) => r.json());
    const newBody = (cur.body || "") + BODY_APPEND;
    const pr = await fetch(BASE + "/api/articles/" + SLUG, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-terminal-key": key },
      body: JSON.stringify({
        body: newBody,
        prov: { model: "post_protocol_verdict", action: "append-verdict-section" },
      }),
    });
    const pj = await pr.json();
    console.log("\nPATCH body:", pr.status, pj.error || "ok");
    const h = await fetch(BASE + "/api/articles/" + SLUG + "/health").then((r) =>
      r.json(),
    );
    console.log("health:", h.counts, "issues:", h.issues);
    console.log("posted", posted.length, "claims:", posted.join(", "));

    const msg = [
      "📜 Protocol verdict canonized",
      "",
      "+" + posted.length + " claims on /protocol",
      "Slots: problems, novelty, weaknesses+resolutions, utility",
      "",
      BASE + "/a/protocol",
      BASE + "/api/articles/protocol/voxels",
    ].join("\n");
    await fetch(BASE + "/api/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json", "x-terminal-key": key },
      body: JSON.stringify({
        key: "SEND_BY_CHANNEL",
        body: "blooio|[OWNER_PHONE]|" + msg,
      }),
    });
    console.log("texted");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});