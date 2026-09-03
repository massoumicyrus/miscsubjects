---
name: multi-model-team
description: Run a task across multiple frontier models as a collaborating team through the Cloudflare AI Gateway (one account, one billing/observability plane, BYOK), instead of trusting a single model. Use for hard calls — copy/creative critique, article review, design decisions, adversarial fact-checking, or any "get more than one brain on this" moment. Covers the gateway route, the model roster, and the propose→critique→synthesize loop.
---

# Multi-model team (via Cloudflare AI Gateway)

One model is one opinion. For anything that matters — a headline, an article's honesty, a design call, a risky claim — run it past a panel of models and synthesize, rather than shipping the first model's take. The Cloudflare AI Gateway makes this one account, one auth plane, one log.

## Why the gateway (not direct provider calls)

- One endpoint for every provider: `https://gateway.ai.cloudflare.com/v1/{CF_ACCOUNT_ID}/cloud-kernel/compat/chat/completions` (OpenAI-compatible `chat/completions`).
- BYOK: `Authorization: Bearer <PROVIDER_KEY>` selects the provider; the `model` field is `provider/model` (e.g. `anthropic/claude-*`, `openai/gpt-*`, `grok/grok-4.3`, `google-ai-studio/gemini-*`, `deepseek/deepseek-*`, `groq/...`, `workers-ai/@cf/...` which is CF-billed, no key).
- Optional `cf-aig-authorization: Bearer <AIG_TOKEN>` for gateway auth.
- Every call lands in one observability log (cost, latency, cache) — you can prove which model said what.
- In this build: the `CF_GROK` / `callGateway` runner already goes through `cloud-kernel`; the same route serves any provider by swapping the `model` field and the provider key. `GW_MODELS` lists the catalogue.

## The loop (propose → critique → synthesize)

1. **Propose.** Send the task to 3+ diverse models in parallel (different providers, not three of one). Ask each for its own answer, not a vote.
2. **Critique.** Give each model the OTHERS' answers and ask it to attack them — find the weakest claim, the missed angle, the thing that reads wrong. Diversity of provider is the point; three of the same model agree with themselves.
3. **Synthesize.** You (or a designated synthesizer model) write the final from the strongest answer, grafting the best correction from each critic. Keep what survived attack; drop what didn't.

Use it for: X copy and headlines (does this read human or like slop?), article honesty passes (is any claim overstated?), design/UX calls, and adversarial checks on a claim before it goes on the live site.

## Rules

- Odd panel size (3 or 5) so a synthesizer isn't tie-breaking blind.
- Providers must differ — the value is disagreement, not consensus theater.
- Attribute in the log: which model produced the kept line. Never present a model's opinion as fact; it's one input.
- REASONING_EFFORT=NONE for any Grok call (owner law): send `reasoning_effort: "none"`.
- This does not replace real evidence. A panel of models agreeing is still not a source; sourced facts outrank model consensus.
