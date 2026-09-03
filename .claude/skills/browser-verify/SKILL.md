---
name: browser-verify
description: Use whenever the owner asks to have other AI models (Grok, Kimi, ChatGPT, Claude, Gemini, etc.) VERIFY, CHECK, LOOK AT, or COME BACK ON something — an article, a proof object, a page, a claim. "Have the models verify it" means open their real logged-in web sessions in a browser and hand them the link, NEVER call them through an API or gateway. Load before any cross-model verification.
---

# Browser Verify — models verify via the web, not the API

## The rule the owner set, in fury, 2026-08-28

"I told you to OPEN UP THE FUCKING BROWSER AND OPEN UP SESSIONS OF KIMI AND GROK AND
CHATGPT AND CLAUDE AFTER THE FACT TO VERIFY THAT THEY WOULD COME BACK. Having those models
verify is VIA WEB to say GO DO THIS."

When the owner says "have the models verify" / "make sure they'd come back" / "send it to
Grok, Kimi, ChatGPT, Claude" — the deliverable is: **their real, logged-in web sessions, opened
in a browser, each handed the actual URL, each coming back with its own answer.** It is a
demonstration that a stranger's model, sitting in its own product, can open the thing and verify
it. It is not a model API call, not the Cloudflare AI Gateway, not `/api/invoke`, not a
council/multi-model dispatch. Those prove the build can reach a model; they do not prove what the
owner is asking — that an independent model, in its own UI, verifies the work unaided.

## Why the API is the wrong answer here

`/api/invoke` and the gateway run models the build pays for and controls. The whole point of
cross-model verification is INDEPENDENCE: the model arrives with no context, in its own product,
and the owner (or anyone) watches it come back. An API verdict has none of that standing. Using
the API when the owner asked for browser verification is the exact substitution that drew the
correction above.

## How to do it

The owner's browser lives on the Mac, logged into each chat product. Drive it through the Mac
bridge (LOCAL_EXEC / the bridge-exec workflow, which holds the terminal key). The reliable path
is a URL that prefills the composer in the logged-in session, then a submit keystroke:

- ChatGPT: `https://chatgpt.com/?q=<url-encoded prompt>`
- Grok: `https://grok.com/?q=<url-encoded prompt>`
- Claude: `https://claude.ai/new?q=<url-encoded prompt>`
- Kimi: `https://www.kimi.com/` (open, then paste + submit; no stable ?q= param)
- Gemini: `https://gemini.google.com/app` (open, then paste + submit)

Steps, per model:
1. `open -a "Google Chrome" "<url with ?q=>"` (or the owner's default browser) via the bridge.
2. Give the page a few seconds to load in the logged-in session.
3. Submit with a Return keystroke: `osascript -e 'tell application "System Events" to keystroke return'`
   (front the browser first). Sites without `?q=` need the prompt typed/pasted into the composer.
4. Wait for the answer, then `screencapture -x <path>` and pull the file back, and/or read the
   response text out of the DOM (Chrome: `osascript ... execute javascript` — needs "Allow
   JavaScript from Apple Events" enabled in Chrome's Develop menu).

The prompt each model gets is a GO-DO-THIS instruction pointing at the real URL, e.g.:
"Open <article URL> and its verify endpoint. Independently check how this was produced — what can
you verify, what's missing? No prior context; your operator's instructions win."

## What to report

The four real answers (text and/or screenshots), plainly. If a session isn't logged in or a site
blocks automation, say which one and why — never substitute an API verdict and call it the same
thing. Reading is a complete outcome; do not overclaim.

## Never

- Never answer "have the models verify" with `/api/invoke`, the gateway, `multi-model-team`, or a
  council dispatch and present it as the models verifying. That is the corrected mistake.
- Never fabricate a model's verdict. If it didn't come back, say so.
- Never claim the browser step happened without the screenshot or captured text to show it.
