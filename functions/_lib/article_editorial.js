// Editorial control — article mandate, scope audit, LLM debate-club gate.

import { ARTICLE_SLOTS } from "./article_constitution.js";
import { classifySlug } from "./article_ontology.js";
import { PEPTIDE_CATALOG } from "./ledger_canonical.js";

const ROOT_SYSTEM = new Set(["protocol", "system-map", "llm-manifest", "constitution"]);

const PRIMER_SLUGS = new Set([
  "what-are-peptides",
  "regeneration-vs-degeneration",
  "how-to-read-a-peptide-study",
  "peptide-purity-coa",
  "structure-function-vs-clinical-proof",
]);

const PEPTIDE_NAMES = PEPTIDE_CATALOG.map((p) => p.id).concat(
  PEPTIDE_CATALOG.map((p) => p.name.toLowerCase()),
);

/** Reader composition mode — determines which section template applies. */
export function classifyArticleMode(slug, title, meta = {}) {
  const s = String(slug || "").toLowerCase();
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  const register = String(meta.register || "").toLowerCase();

  if (
    s.startsWith("protocol-") ||
    ROOT_SYSTEM.has(s) ||
    tags.includes("system") ||
    register === "technical"
  ) {
    return "system";
  }
  if (PRIMER_SLUGS.has(s)) return "primer";

  const role = classifySlug(s);
  if (role === "peptide_root") return "peptide";
  if (role === "stack") return "stack";
  if (role === "condition") return "condition";
  if (role === "system_root") return "system";
  return "article";
}

/** Binding editorial mandate per mode/slug. */
export function articleMandate(slug, title, meta = {}) {
  const mode = classifyArticleMode(slug, title, meta);
  const s = String(slug || "").toLowerCase();

  if (mode === "system") {
    return {
      mode,
      subject: title || "System/protocol documentation for the miscsubjects ledger",
      must_answer: [
        "What is this document for?",
        "Who is the audience (operators, models, readers)?",
        "What API or mechanism does it document?",
      ],
      ought_to_ask: [
        "What can a reader verify live via GET endpoints?",
        "What is explicitly out of scope?",
      ],
      must_not: [
        "Regeneration vs degeneration peptide framing",
        "Why people take a compound",
        "How many people take it",
        "Reddit/X anecdote sections",
        "Single-peptide mechanism deep dives unless the article is about that peptide",
      ],
      resolves: "Documents the build — not a compound catalogue entry.",
    };
  }

  if (s === "what-are-peptides") {
    return {
      mode: "primer",
      subject: "What peptides are as a class — structure, signaling, evidence tiers, how they differ from drugs and supplements",
      must_answer: [
        "What is a peptide (amino acid chains)?",
        "How do peptides differ from proteins, small-molecule drugs, and supplements?",
        "What are evidence tiers (human, preclinical, anecdote)?",
        "How should a reader approach peptide claims?",
      ],
      ought_to_ask: [
        "Why does sequence length matter?",
        "Why is RUO vs Rx distinction relevant?",
      ],
      must_not: [
        "ARA-290, BPC-157, or any named compound as more than a one-line category example",
        "Mechanism deep dives for specific peptides",
        "Why people take a specific peptide",
        "Dosing or sourcing advice",
      ],
      resolves: "Teaches peptide literacy — not a compound article.",
    };
  }

  if (mode === "primer") {
    return {
      mode: "primer",
      subject: title || "Educational primer",
      must_answer: ["What concept does this teach?", "What should the reader do with this?"],
      ought_to_ask: ["What is still contested or unknown?"],
      must_not: ["Unrelated compound deep dives", "Regeneration frame unless article is regeneration-vs-degeneration"],
      resolves: "Concept primer — not a stack or condition article.",
    };
  }

  if (mode === "peptide") {
    return {
      mode: "peptide",
      subject: `${title || s} — one compound: what it is, mechanism, evidence, limits`,
      must_answer: [
        "What is this compound?",
        "What repair pathway is studied?",
        "What human vs preclinical evidence exists in the ledger?",
        "What is unknown?",
      ],
      ought_to_ask: [
        "Why would someone discuss this compound online?",
        "What would falsify the main claims?",
      ],
      must_not: ["Full articles about other peptides embedded here", "Medical advice or doses"],
      resolves: "Single peptide root article.",
    };
  }

  if (mode === "condition" || mode === "stack") {
    return {
      mode,
      subject: title || `${mode} article — enrichment: why each compound helps someone with this condition`,
      must_answer: [
        "What is breaking down in this condition for the reader (layers)?",
        "Why would each in-scope peptide help THIS reader — one explicit if-then chain per compound?",
        "If drugs or GLP-1 peptides are in scope, why via load/suppression/mechanism logic?",
        "How do the compounds fit together (stack synergy, not repeated essays)?",
        "What evidence exists per tier?",
      ],
      ought_to_ask: [
        "Weight-sensitive spine/joint: does load reduction (e.g. GLP-1 weight loss) belong in the logic chain?",
        "Stimulant context: neural, gut, sleep, and non-benzo calm layers covered?",
      ],
      must_not: [
        "Single-peptide catalog tone when multiple compounds are in scope",
        "Generic 'what it is' without tying to the reader's condition",
        "Dosing protocols",
      ],
      resolves: `${mode} enrichment article — condition-first, per-compound why-you chains.`,
    };
  }

  return {
    mode: "article",
    subject: title || s,
    must_answer: [
      "What is breaking down for the reader with this topic?",
      "Why would each named peptide or drug help — separate if-then section per compound?",
      "How do they fit together?",
      "What evidence exists per tier?",
    ],
    ought_to_ask: [
      "Mechanical load logic for weight + spine/joint?",
      "Multi-pathway stacks vs single-compound focus?",
    ],
    must_not: [
      "One-peptide invariant template when slug implies condition cross or stack",
      "Scope drift into unrelated compounds",
      "Dosing protocols",
    ],
    resolves: "Matrix cross-article — enrichment voice, condition-first.",
  };
}

const EMPTY_MARKERS = [
  "no catalogued evidence",
  "no mechanism claims catalogued",
  "no catalogued reasons",
  "no scientific sources",
  "no reddit posts",
  "no x posts",
  "no explicit gap claims",
  "no safety or limitation",
];

function isEmptyPlaceholder(text) {
  const t = String(text || "").toLowerCase();
  return EMPTY_MARKERS.some((m) => t.includes(m));
}

/** Deterministic scope violations before LLM debate. */
export function auditEditorialScope(slug, title, body, meta = {}) {
  const mandate = articleMandate(slug, title, meta);
  const violations = [];
  const text = `${title}\n${body}\n${(meta.claims || []).map((c) => c.text).join("\n")}`.toLowerCase();

  if (mandate.mode === "system") {
    if (/regeneration vs degeneration|why people take it|how many people take/i.test(body)) {
      violations.push({
        code: "wrong_template",
        message: "System article rendered with peptide invariant template (regen frame / uptake sections).",
      });
    }
  }

  if (slug === "what-are-peptides" || mandate.mode === "primer") {
    const named = [];
    for (const p of PEPTIDE_NAMES) {
      if (p.length < 4) continue;
      const re = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(text) && !/category example|for example|such as/i.test(text)) {
        named.push(p);
      }
    }
    const unique = [...new Set(named)].filter((n) => n.length > 3);
    if (unique.length > 2) {
      violations.push({
        code: "primer_peptide_drift",
        message: `Primer names specific peptides off-mandate: ${unique.slice(0, 6).join(", ")}`,
        peptides: unique.slice(0, 8),
      });
    }
  }

  for (const forbidden of mandate.must_not || []) {
    if (forbidden.toLowerCase().includes("regeneration vs degeneration") && /regeneration vs degeneration — where this fits/i.test(body)) {
      violations.push({ code: "forbidden_section", message: forbidden });
    }
  }

  const emptySections = (String(body || "").match(/^## .+$/gm) || []).length;
  const placeholderCount = EMPTY_MARKERS.filter((m) => text.includes(m)).length;
  if (placeholderCount >= 3) {
    violations.push({
      code: "empty_section_sprawl",
      message: `${placeholderCount} empty placeholder sections visible to readers`,
      count: placeholderCount,
    });
  }

  return {
    slug,
    mode: mandate.mode,
    mandate,
    violations,
    pass: violations.length === 0,
    editorial_score: Math.max(0, 1 - violations.length * 0.2 - placeholderCount * 0.08),
    empty_section_count: placeholderCount,
  };
}

export function shouldUseInvariantCompose(slug, title, meta = {}) {
  const mode = classifyArticleMode(slug, title, meta);
  return mode === "peptide" || mode === "condition" || mode === "stack";
}

export function shouldPreferStoredBody(slug, title, meta = {}) {
  const mode = classifyArticleMode(slug, title, meta);
  return mode === "system" || mode === "primer";
}

/** Skip rendering empty placeholder sections. */
export function isRenderableSectionBody(body) {
  const text = String(body || "").trim();
  if (!text) return false;
  if (isEmptyPlaceholder(text)) return false;
  return true;
}

export const EDITORIAL_DEBATE_SCHEMA = {
  mandate: {
    subject: "string",
    must_answer: ["string"],
    ought_to_ask: ["string"],
    must_not: ["string"],
  },
  prosecutor: {
    violations: [{ code: "string", message: "string", evidence: "string" }],
    score: "0-1 severity",
  },
  defender: {
    in_scope: ["string"],
    defends: ["string"],
  },
  judge: {
    verdict: "pass|revise|fail",
    resolves_must_answer: [{ question: "string", resolved: "bool", note: "string" }],
    unanswered_ought: ["string"],
    answerable_but_missing: ["string"],
    required_fixes: ["string"],
    editorial_score: "0-1",
  },
  pass: "bool",
};

export function editorialDebatePrompt(slug, title, body, meta, audit) {
  const mandate = audit.mandate || articleMandate(slug, title, meta);
  const claims = (meta.claims || []).slice(0, 20).map((c) => ({
    id: c.id,
    text: String(c.text || "").slice(0, 200),
    tier: c.tier,
    slot: c.slot,
  }));

  return (
    `EDITORIAL DEBATE CLUB — three voices, one verdict.\n\n` +
    `SLUG: ${slug}\nTITLE: ${title}\nMODE: ${mandate.mode}\n\n` +
    `MANDATE (what this article IS):\n${JSON.stringify(mandate, null, 2)}\n\n` +
    `DETERMINISTIC AUDIT:\n${JSON.stringify(audit.violations, null, 2)}\n\n` +
    `BODY (excerpt):\n${String(body || "").slice(0, 8000)}\n\n` +
    `CLAIMS:\n${JSON.stringify(claims, null, 2)}\n\n` +
    `Each voice must answer:\n` +
    `1. What is this article supposed to be about?\n` +
    `2. What questions MUST it answer? Does it?\n` +
    `3. What questions OUGHT it to ask? Does it?\n` +
    `4. What could it answer but does NOT?\n` +
    `5. What is off-scope scope drift?\n\n` +
    `Output ONLY JSON matching schema: mandate (confirm/refine), prosecutor, defender, judge, pass (bool).`
  );
}

/** Constitution-slot compose for system/primer articles. */
/** Claims on primer articles that name specific compounds off-mandate. */
export function offMandateClaimIds(slug, claims, meta = {}) {
  const mandate = articleMandate(slug, "", meta);
  if (mandate.mode !== "primer") return [];
  const out = [];
  for (const c of claims || []) {
    if (c.status === "retracted") continue;
    const text = String(c.text || "").toLowerCase();
    let hits = 0;
    for (const p of PEPTIDE_NAMES) {
      if (p.length < 5) continue;
      if (text.includes(p.replace(/-/g, "")) || text.includes(p)) hits++;
    }
    if (hits >= 1 && !/category example|for example|such as peptide/i.test(text)) {
      out.push(c.id);
    }
  }
  return out;
}

export function systemSectionsFromClaims(claims, title) {
  const active = (claims || []).filter(
    (c) => c.status !== "retracted" && c.status !== "cut",
  );
  const parts = [];
  if (title) parts.push(`# ${title}\n`);

  for (const slot of ARTICLE_SLOTS) {
    const slotClaims = active.filter((c) => c.slot === slot.id);
    if (!slotClaims.length) continue;
    const body = slotClaims.map((c) => c.text).join("\n\n");
    parts.push(`## ${slot.answers || slot.id}\n\n${body}`);
  }

  const unslotted = active.filter((c) => !c.slot && c.tier === "system");
  if (unslotted.length) {
    parts.push(
      `## System notes\n\n` + unslotted.map((c) => c.text).join("\n\n"),
    );
  }

  return parts.length > 1 ? parts.join("\n\n") : null;
}