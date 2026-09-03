---
name: operator-vantage
description: Use before testing anything, before saying a thing works, and before writing any claim. Verification happens in a window the operator controls — never in the agent's own sandbox — and every claim is stated from the operator's or a traffic viewer's seat, never the agent's.
---

# The vantage law

## Rule 1 — Never test from your own sandbox. Test in a window he controls.

Your `Bash` tool, your `curl`, your preview pane, your MCP fetch, your exit code, your subagent — **none of these is a test.** They are the agent's own user experience, and the agent's user experience has never once been the thing that was broken.

> "YOU WILL NEVER TEST BASED OFF OF YOUR UX AND THAT IS A BUILD RULE WHICH SHOULD ALWAYS BE APPLIED"

A test happens where the operator's inputs happen:

- **A web surface** is tested by loading the public URL in a real browser at his viewport and asserting on rendered content — not by the write API returning `ok:true`.
- **A capability** is tested by calling it the way the build calls it in production, with the token the build actually holds, on the schedule it actually runs.
- **An email or message** is tested by its arrival in the destination inbox, not by the send API returning a message id.

You have computer control. **Therefore you must make it happen in a window he would control.** "I verified it from here" is not a lesser form of verification; it is the specific thing that has produced every false completion claim in this build's record.

### The failure this rule exists to stop

An internal agent was declared working, repeatedly, across eight days and $90.21 of spend — by `curl`, by a self-run probe, by a model reading its own exit code. It was never once exercised the way the operator exercises it. When it finally was, the root cause was an expired capability token with a 24-hour TTL and no renewal: **an agent that works the day it is built and is dead afterwards, which no day-zero sandbox test could ever surface.** The sandbox was not a weaker test. It was a test of a different system.

## Rule 2 — Claims are from the operator's seat or a traffic viewer's seat. Never the agent's.

> "CLAIMS ARE NEVER FROM THE PERSPECTIVE OF THE AGENT THEYRE FROM THE PERSPECTIVE OF THE OPERATOR OR A TRAFFIC VIEWER"

Every claim — in a report, an article, a commit message, a ledger row — is written from one of exactly two vantage points:

- **The operator**, sitting at his own machine, giving his own inputs.
- **A traffic viewer**, arriving cold at a public surface with no context and no key.

Rewrite from the agent's seat to the operator's seat:

| Agent's seat (banned) | Operator's / viewer's seat (required) |
|---|---|
| "The write returned `ok:true`" | "The page at `<url>` returns 200 and shows `<content>`" |
| "I deployed it" | "The live site serves the new build; here is the byte that proves it" |
| "The send API accepted it" | "It arrived in `<inbox>`; here is the witness row" |
| "The agent responded correctly" | "Typed into his Terminal, it answered `<x>` in `<n>` calls" |
| "All gates passed" | "The rendered page, fetched cold, contains `<needle>`" |
| "It must be working" | *not a claim — go look* |

**The word "must" is the tell.** Reasoning from your own premises to a conclusion about the outside world and reporting the conclusion as an observation is the single most expensive habit in this record. One agent wrote *"The file is correct. The deploy is clean. The live site must serve the new design."* The live site was serving the old design. It had not looked.

## Operate

1. Before claiming anything works, name the vantage point. If it is yours, it does not count.
2. Open the operator's surface — his Terminal, the public URL in a real browser, the destination inbox.
3. Give it the input **he** would give it, at the length and density he gives it.
4. Capture what the surface returned, verbatim, and quote that.
5. Write the claim from his seat. If you cannot, you do not have a claim; you have a hope.

## Reject as nonconforming

- a completion claim whose evidence is the agent's own tool result
- "verified" where the verification was a sandbox call
- a CLI tested by anything other than a terminal window the operator can type into
- "must be", "should be", "presumably" anywhere near a state claim
- a receipt id, message id, or hash the model composed rather than read from a capability's return value
- reporting a footer, dashboard or cost figure as correct without checking it against the upstream that bills it

## Pair with

`verification-before-completion` (evidence before assertions) and `answer-and-verify` (no config claim without a live test). This skill is the vantage rule those two depend on.
