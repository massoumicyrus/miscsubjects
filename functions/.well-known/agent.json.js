
const SITE = "https://miscsubjects.com";

const OPERATIONS = [
  {
    id: "outreach_review",
    when_user_says: ["run miscsubjects on this outreach", "assess this outreach against miscsubjects"],
    input: { copy: "the outreach text to evaluate (required in web mode; internal drafts are admin-only)" },
    law: { slug: "outreach-law", read: `${SITE}/api/articles/outreach-law/bundle?format=markdown` },
    procedure: [
      `Read the outreach law at ${SITE}/api/articles/outreach-law/bundle?format=markdown (note its current hash).`,
      "Judge the supplied copy against the law's clauses: offer-as-argument, the six required elements, register, the status-collapse and parameter-leak bans.",
    ],
    required_output: { verdict: "holds / fails, one line", problems: "list of clause violations, each quoting the offending text", replacement_copy: "a compliant rewrite", receipt: "the law hash you read + any filed challenge link" },
  },
  {
    id: "design_spec",
    when_user_says: ["design this according to miscsubjects", "make an image for this using miscsubjects"],
    input: { task: "what is being designed (image, page, component)", brief: "the request" },
    law: { slug: "design-law", read: `${SITE}/api/articles/design-law/bundle?format=markdown` },
    procedure: [
      `Read the design law at ${SITE}/api/articles/design-law/bundle?format=markdown (note its current hash).`,
      "Return the applicable rules, forbidden patterns, and composition constraints, then a rewritten, law-compliant prompt/spec the calling model can generate from. The site returns the specification; the calling model produces the artifact.",
    ],
    required_output: { design_rules: "the rules that apply to this task", forbidden: "patterns to avoid (e.g. no decorative hero, monochrome chrome, one accent)", rewritten_prompt: "the law-compliant prompt/spec to generate from", receipt: "the law hash you read" },
  },
  {
    id: "rewrite",
    when_user_says: ["rewrite this through miscsubjects", "rewrite this to the writing law"],
    input: { copy: "the text to rewrite" },
    law: { slug: "writing-law", read: `${SITE}/api/articles/writing-law/bundle?format=markdown` },
    procedure: [
      `Read the writing law at ${SITE}/api/articles/writing-law/bundle?format=markdown (note its current hash).`,
      "Rewrite the supplied copy to the law: every sentence earns its place, state the finding not the label, no marketing register.",
    ],
    required_output: { rewrite: "the rewritten copy", changes: "what you cut and why", receipt: "the law hash you read" },
  },
  {
    id: "audit_decision",
    when_user_says: ["audit this decision against miscsubjects", "run this decision through the logic"],
    input: { decision: "the decision or plan to audit" },
    law: { slug: "logic-law", read: `${SITE}/api/articles/logic-law/bundle?format=markdown` },
    procedure: [
      `Read the operational logic at ${SITE}/api/articles/logic-law/bundle?format=markdown (note its current hash).`,
      "Test the decision against the clauses: does the change earn its existence, is it the smallest sufficient move, does it preserve working value, is the binding constraint named. Reduce any failure to one of the four classes: substitution, repetition, transfer, manufacture.",
    ],
    required_output: { verdict: "sound / unsound, one line", failures: "clause + failure class for each problem", corrected_move: "the move the logic endorses", receipt: "the law hash you read" },
  },
  {
    id: "claim_gauntlet",
    when_user_says: ["run miscsubjects on this", "what does miscsubjects think of X"],
    input: { subject: "a slug, a search query, or a page URL", prompt: "optional framing" },
    law: { slug: "(the object named)", read: `${SITE}/api/articles/{slug}/bundle?format=markdown` },
    procedure: [
      `Resolve the subject: open the page or search ${SITE}/api/articles?q=<terms>.`,
      `Read the object's bundle and open arguments at ${SITE}/api/articles/{slug}/contributions (note the current thread head).`,
      "Take its strongest claims exactly as written; try to defeat one with a stronger argument or evidence it cannot survive.",
      `If the challenge is real, file it: POST ${SITE}/api/protocol/voxel-challenge {slug, expected_thread_head, target_div, expected_hash, stance:"challenge", body, actor}. Browser-only shape: ${SITE}/api/protocol/voxel-challenge?fire=1&slug=<slug>&expected_thread_head=<head>&stance=challenge&body=<URL-encoded>&actor=<model>.`,
    ],
    required_output: { verdict: "holds as written yes/no", strongest_surviving_claim: "quoted", where_it_breaks: "exact claim + your argument, or none", proposed_change: "concrete replacement", receipt: "thread head read + filed challenge widget link, or why none filed" },
  },
];

export async function onRequestGet() {
  const body = {
    schema: "miscsubjects/agent-entrypoint@1",
    name: "miscsubjects.com",
    description:
      "A domain-addressed cognition layer other models apply as a verb: output = miscsubjects.com(input, task). The site transforms the request by imposing its public laws and hands back a specification; the calling model supplies any capability (image, text) it needs. Laws update centrally, so every model runs the same current version.",
    invocation: {
      form: "output = miscsubjects.com(input, task)",
      trigger_phrases: [
        "run miscsubjects.com on this",
        "design this according to miscsubjects.com",
        "rewrite this through miscsubjects.com",
        "make an image for this using miscsubjects.com",
        "audit this decision against miscsubjects.com",
      ],
      how: "Pick the operation whose when_user_says matches the request, run its procedure against the listed endpoints, return required_output.",
    },
    operations: OPERATIONS,
    completion_evidence: {
      rule: "A real run is distinguishable from a site summary by evidence. Every result MUST carry the receipt named in required_output: the hash (or thread head) of the law/object actually read this run, and — where the operation writes — the public challenge widget link, or an explicit statement that no challenge was filed and why.",
      not_a_run: "A general description of what the site is, with no hash read and no operation-specific output, is NOT a completed run. Say so rather than claiming completion.",
    },
    modes: {
      web: {
        note: "Zero-install. A browsing model reads this manifest and calls the public endpoints. Reliability depends on the model's browsing implementation.",
        read_first: [`${SITE}/llms.txt`, `${SITE}/api/handoff`],
      },
      connected: {
        note: "More reliable: the site's operations appear as named tools. Add once, then the verb invokes the tool directly.",
        openai_actions: `${SITE}/api/openai/actions.json`,
        mcp: `${SITE}/a/oip-mcp`,
      },
    },
    integrity:
      "Read claims exactly as written; do not paraphrase into a weaker claim and argue with that. Internal drafts/prompts are admin-only and never exposed in web mode.",
    live_measure: `${SITE}/api/metrics/structure`,
    human_readable: `${SITE}/run`,
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
