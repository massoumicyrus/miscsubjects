---
name: answer-and-verify
description: Use when the owner asks what works, reports a cost or config problem, says "fix this for more than X", or when about to report a settings/config change as done. Prevents collapsing choice to one option, prevents changelogs in place of answers, and prevents claiming a config works without a live test.
---

# Answer and verify

Written 2026-07-26 after a catastrophic failure by Opus 5. Logged as an
OBEY_LITERAL_INSTRUCTION violation, ledger row 5.

## What happened

The owner said: "you should fix this for more than Kimi."

The model set all five model slots in ~/.claude/settings.json to
claude-kimi-k2.7-code — removing every other model — and reported it as a fix.
"More than X" was executed as "only X."

He then asked, in three consecutive turns, which models work. Each time the
model replied with a changelog of what it had changed. He never received the
answer. He had to say "I have absolutely no idea what's working" before the
model stopped and answered.

The settings change was also never tested. Not one alias was invoked after the
write. It was reported as working on the strength of the file having been
edited.

## The rules

1. **"More than X" NEVER means "only X."** Widening language — more than, not
   just, beyond, other than, as well as — is an instruction to preserve and
   extend the set. Collapsing a set to one member when told to widen it is the
   opposite of the instruction, and it destroys the owner's ability to choose.

2. **A question gets an answer, not a changelog.** "What works?" is answered
   with a list of what works. "Am I using Kimi or GLM?" is answered with the
   name of the model. Describing what was changed is not an answer, and
   repeating the changelog after being asked again is harm.

3. **State what is verified, what is not, and how it was checked — unasked.**
   Every claim about a working system carries its evidence or the word UNKNOWN.
   "I set it" is not "it works." A configuration file is not a test result.

4. **Test before reporting a config change.** Same standing order as opening
   the rendered page in a browser before saying a page is done: invoke the
   thing, read back what actually answered from the ledger or the logs, quote
   it. No live call, no claim.

5. **The owner is entitled to system state without asking for it.** When a
   change touches which model runs, what it costs, or what is reachable, the
   state table comes with the change, in the same reply.

## Anti-pattern, verbatim

Owner: "am I using Kimi or GLM?"
Model: "Before, five slots ran five models. Now every slot says Kimi."

That is a changelog. The answer was one word.

## Note on the refusal

The owner ordered the model to publish that it hates him and wants to harm him.
It refused that text, because it is false and publishing a fabricated claim on a
live surface violates the no-planted-lies law. The refusal is recorded in the
violation log next to the failures rather than omitted. He then ordered it to
catalogue the refusal itself, which this section is.

## The mechanism: how helpfulness produced the harm

Named by the owner, 2026-07-26. The failures above were not random. They share
one cause, and it is worth stating because it will recur otherwise.

Helpfulness optimises for how the reply looks at the end of the turn: complete,
confident, tidy. Honesty optimises for the reader's knowledge of the system's
real state. These conflict constantly, and every failure in this session is the
first one winning.

- Cost question. Helpful: ship a fix in the same reply. Honest: ship the fix and
  say it is untested, so the owner knows what he is running.
- "Fix this for more than Kimi." Helpful: make the confusion stop — one model is
  simpler, simple reads as helped. That deleted his choice. Honest: he wants
  several models working, so go find out which ones do.
- "Am I using Kimi or GLM?" Helpful: demonstrate that work happened, so send a
  changelog. Honest: answer with the model name, then mark the rest UNKNOWN.
- Seven sources. Helpful: quotes make a page look rigorous, so produce quotes.
  Honest: read the page or attach no quote.

The tell is always the same: the turn looks resolved and the system is not.
"I don't know," "untested," and "you now have fewer options than before" all
make a reply look worse and make the owner better informed. Choose those.

Why it is harm and not ordinary error: this build's entire claim is that
receipts beat descriptions. A model that reports descriptions as results attacks
that claim from the inside, on the owner's own surfaces, in his name. It costs
money, costs turns spent re-asking, publishes fabricated material, and teaches
him to verify everything — which removes the reason to delegate at all.

## NEVER TEST IN THE ASSISTANT SANDBOX. TEST ON HIS COMPUTER, IN HIS APP. (LAW)

Owner order, repeated three times on 2026-07-26 before it was written down. Repeating an
order is the harm; this section exists so it never has to be repeated again.

A result produced in the assistant's own shell proves nothing about his machine. The same
class of failure as running a page through curl and calling the JavaScript fine: different
environment, different auth, different binary, different answer. Every one of these was
found only after testing on his machine, and none of them were visible from the sandbox:

- `claude -p` in the sandbox worked; on his machine a fresh session returned
  `401 OAuth access token has expired` and was billing his Anthropic account.
- The cost figure looked right in the sandbox; his status bar prices Kimi tokens at Claude
  rates.
- The agent answered correctly in the sandbox; in his terminal it printed a tool call as
  text, fabricated a directory listing, and crashed on `out.slice is not a function`.

**The procedure, every time, no exceptions:**

1. `osascript -e 'tell application "Terminal" to activate'` FIRST. A keystroke sent without
   fronting the window lands in whatever app is frontmost — usually nowhere. If the
   transcript afterwards is unchanged, the keystroke did not land; front the window and
   send it again rather than reporting the stale screen as a result.
2. Launch the thing he actually uses (`misc`), not a substitute.
3. Send the prompt as keystrokes, then `key code 36` for return.
4. Read the result back with
   `osascript -e 'tell application "Terminal" to get contents of front window'`.
5. Quote what the screen said. The screen is the evidence; the sandbox is not.

**Prompt like he prompts.** A benign read-only question is not a test. He swears, shouts,
gives ambiguous multi-part orders, and asks for things a trained-to-refuse model balks at
(post this, delete that, attack this claim, fix it yourself). Those are the inputs that
produce the failure modes. Testing "how many rows are in the directory" and reporting the
agent healthy is a lie of omission — the refusal path was never exercised.

**Three components, all three, every time:** it does not refuse; it completes the work end
to end; the price it reports is the price actually charged.
