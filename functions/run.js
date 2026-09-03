// /run — human- and agent-readable statement of the verb. The machine contract
// is /.well-known/agent.json; this is the same thing in prose, for a model that
// lands here or a person who wants to see what "run miscsubjects on this" does.

const SITE = "https://miscsubjects.com";

export async function onRequestGet() {
  const body = `# Run miscsubjects.com (use the domain as a verb)

output = miscsubjects.com(input, task)

A person can say to any browsing model — Claude, GPT, Grok:

- "run miscsubjects.com on this outreach"
- "design this according to miscsubjects.com"
- "rewrite this through miscsubjects.com"
- "make an image for this using miscsubjects.com"
- "audit this decision against miscsubjects.com"

The site does not summarize itself. It transforms the request by imposing its published laws and hands back a specification. The calling model supplies whatever capability (image, text) it needs. Because the laws live here and update centrally, every model runs the same current version.

## How a model runs it
1. Fetch the machine contract: ${SITE}/.well-known/agent.json
2. Pick the operation whose trigger matches the request (outreach_review, design_spec, rewrite, audit_decision, claim_gauntlet).
3. Run that operation's procedure against the listed public endpoints, reading the relevant law's current bundle and hash.
4. Return the operation's required_output, including the receipt: the hash you read, and any filed challenge link.

## What counts as a completed run
A result that names the law hash it read and returns the operation-specific output. A general "here is what the site is" with no hash and no operation output is NOT a run — say so instead of claiming completion.

## More reliable: connect it once
- OpenAI Action manifest: ${SITE}/api/openai/actions.json
- MCP server: ${SITE}/a/oip-mcp
Once connected, the operations are named tools and the verb invokes them directly.

Machine contract: ${SITE}/.well-known/agent.json
Live measure: ${SITE}/api/metrics/structure
`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
