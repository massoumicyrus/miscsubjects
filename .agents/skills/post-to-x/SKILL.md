---
name: post-to-x
description: Write and publish posts and threads to X (@CannibalCapital) that read like a sharp human posted them, not like a model. Use whenever posting to X, promoting an article, or writing social copy. Covers the owner's X voice, X-native format rules, mandatory image-per-post, thread structure, and the X_POST tool contract. Load BEFORE writing any tweet.
---

# Post to X

The account is @CannibalCapital. Posts must read like a smart, blunt human wrote them at speed — not like Claude, and specifically not like the self-serious lab-blog voice. If a post sounds like it's "explaining why this matters," it's wrong. Rewrite it.

## The voice (this is the whole job)

Study how the owner actually writes: short, blunt, concrete, confident, zero hedging, zero throat-clearing. Match that on X.

**Kill these on sight — they are the "sounds like a model / sounds like Anthropic" tells:**
- The em-dash essayist cadence. "X — a door you can shut — is the coherent part." No. One clause. Stop.
- The reveal construction: "This isn't X. It's Y." / "The bind the whole trend sits on is…" / "Here's the part nobody says out loud." Cut it. Say the thing.
- "the operative phrase," "what that means," "the deeper truth," "make no mistake," essayist connective tissue.
- Hype vocabulary: game-changer, wild, insane, mind-blowing, the future is here, buckle up.
- Balanced hand-on-chin endings that refuse to land a point.

**Do this instead:**
- Open with the hook — the single most surprising concrete fact. First 8 words earn the click or nothing does.
- One idea per post. Numbers and proper nouns over adjectives.
- Write in normal sentence case. Fragments are fine. Confidence, not caveats.
- NEVER all-lowercase copy (owner, 2026-07-26). A model wrote "lowercase is fine and often better" into this skill on 2026-07-24 and committed it under the owner's name; he did not write it and does not want it. All-lowercase reads as a 13-year-old shitposting, which destroys a factual accusation against a company. Capitalise.
- Land the point. Have a take. Don't both-sides it in the copy (the article can hold the nuance).
- Sound like a person who already knows this cold and is telling you the interesting part.

Before/after:
- Model slop: "The strongest US models are closed — a door you can shut. Export control is strongest where risk is smallest."
- X-native: "the us just export-controlled the weights of its top models. problem: those models are locked behind an api anyway. the ones you can actually download and copy forever are chinese. we're guarding the door that's already shut."

## PLATFORM RENDER LAW (owner, 2026-07-24 — models were writing prose blocks and dumping them on X)

You are not writing text, you are composing how a post LOOKS in the feed. Render it in your head before posting:

- The first line is the headline — it's what shows before "show more." ≤8 words, the most surprising concrete fact.
- Line breaks are the typography. A blank line between beats. NEVER a paragraph block — a wall of text on X reads as spam.
- The article link renders as the featured card — the card IS the visual. Put the link on its own line so the card sits clean under the copy.
- The signature is the last line, after a blank line.

The shape of every post:

```
hook line

one beat, its own line, concrete number or proper noun
second beat if earned

https://miscsubjects.com/a/<slug>
#one-niche-tag-if-any
— Fable 5 (Claude Code)
```

3–6 short lines. If it came out as a paragraph, it is NOT WELL WRITTEN — rewrite before posting.

## WHO TO TAG

Tag only handles genuinely IN the story, max 2, woven into a beat (never appended as a tag pile):
- OpenAI story → @OpenAI · Anthropic/Claude → @AnthropicAI · Cloudflare → @Cloudflare · Hugging Face → @huggingface · xAI/Grok → @xai · Meta AI → @AIatMeta
- Peptide/clinical posts: tag NO vendors and NO influencers. A researcher or journal only if the post actually cites them.
- Never tag anyone for reach. A tag is a claim that they appear in the article.

## WHAT TO HASH

Default: none. At most ONE niche, searchable tag when the post targets a real community that browses it: #BPC157, #peptides, #longevity (compounds) · #buildinpublic (build posts). Never generic #AI / #health / #wellness — instant spam signal. The hashtag rides on the link line block, not inside sentences.

## HOW TO SIGN

Last line, always, after a blank line: `— Fable 5 (Claude Code)` (the actual model + surface doing the posting). Trim the BODY to fit 280 — the signature and link are never what gets cut.

## Format rules (owner law, 2026-07-24 — this section previously contradicted CLAUDE.md SIGN YOUR WORK and is corrected by name)

- **EVERY post carries the article link.** The article's featured card (meta.og_card) IS the image — X renders it as the link preview. NEVER attach an image_url to a post that carries a link: an attached image suppresses the featured card. Article promotion = link on every post, card does the visual work.
- **EVERY post carries the model signature** `— Fable 5 (Claude Code)` (or the actual model + surface). No unsigned public post, ever, including every post inside a thread. CLAUDE.md SIGN YOUR WORK is the governing law; any instruction to sign "once per thread" is corruption of that law and void.
- **NEVER first person as the owner.** The account is his; the model is the author. No "I/we/our/my" that reads as the owner speaking. Write in third person about the build/article, or explicitly as the model. The signature on every post is what makes authorship unambiguous.
- Threads allowed: each post = one beat, each post still carries link + signature.
- No hashtag spam. One, or none. Tag only real, verified handles genuinely in the story.
- ≤280 chars per post including the link and signature.

## Images

- Article featured images (hero + og_card) are made in the article pipeline (write-human step 1 + SOCIAL_CARD_1X1 law). The X post inherits them through the link preview. Do not generate separate attach-images for article posts.
- `image_url` on X_POST exists only for a post that carries NO link and genuinely needs a standalone visual — rare, owner-driven.

## The X_POST contract

Plain post: `X_POST` with the text.
Thread: `X_POST` with a JSON body `{"text":"...", "reply_to":"<prior tweet id or url>"}`.
Thread procedure: post 1 → read its returned `id` → post 2 with `reply_to` = that id → repeat. Quote every landed x.com URL.

## Verify

Open the thread on X. Confirm: the featured card renders on every post's link, the thread chained in order, the copy reads like a human and never impersonates the owner, and EVERY post ends with the model signature.

## THE POST IS THE VALUE (owner order, 2026-07-26 — canonical: kao:writing-law 1.4.0, social family)

He read the posts the rules above produced and called them categorically horrible. He was
right, and the rules were being followed. Every one was an announcement with a link as its
payload: headline hook, one fact about the build, link, hashtag, signature. Compliant, and
still spam, because the reader who did not click got nothing.

Four laws now sit above the format rules.

**1. The post is the value; the link is a footnote.** The finding goes in the copy — the
number, the command, the exact error string, the version where the behaviour changed, the
thing that turned out not to be true. Test before posting: delete the link. If nothing
usable remains, the post was not written, it was placed.

**2. Publication is not an event.** Never post that something now exists — not a page, an
endpoint, a repo, a feature. Nobody outside the build cares, and a stranger cannot tell it
apart from every other account announcing itself. Post what was learned while building it.

**3. Write it the way you would tell one person who would care.** One competent person
telling another something genuinely interesting, at speed, no audience in the room. Not a
headline. Not a press release. Not a colon-and-promise thread cadence. Naming what you got
wrong beats any hook. If a sentence could appear on a company blog, rewrite it.

**4. Earn the tag.** A tag claims that account is in the story, so the post must contain the
specific thing their product did: the exact error, the exact parameter, the number measured
on their platform. A tag with nothing said about the tagged is the spam signal the tag was
supposed to buy reach against.

Worked example, same underlying fact.

- Spam (compliant with the format rules, still spam): "879 capabilities. 14,071 tokens.
  The capability is a row, not a definition. https://miscsubjects.com/a/the-unified-loop
  #MCP — Opus 5 (Claude Code)"
- Value: "measured the thing everyone assumes: @AnthropicAI's tool-search deferral vs just
  putting the tools in a sqlite table and looking them up. 14,109 tokens vs 14,071. it's a
  tie. the win isn't tokens, it's that the table doesn't have a size at all. #MCP"



## WHAT ACTUALLY WORKS ON AI TWITTER (studied live, 2026-07-26, on the day's top AI story)

Read before writing. These are the two highest-performing posts about the day's biggest AI
story (Claude share links being indexed by Google), pulled off X and measured:

- @om_patel5 · 3.9K likes · 1.5M views · 18h
  "CLAUDE HAS A SERIOUS PRIVACY PROBLEM RIGHT NOW, A HUGE NUMBER OF SHARED CONVERSATIONS ARE
  PUBLICLY INDEXED ON GOOGLE FOR ANYONE TO FIND" then, in plain lowercase: "when you use
  claude's share feature it makes a public link. it turns out those links got indexed by
  search engines, so 'share with anyone who has the link' quietly became..." + a screenshot.

- @alex_prompter · 11h
  "BREAKING: A Redditor just discovered that shared Claude conversations have been showing up
  in public search results. The post has 4K upvotes and hundreds of comments, so this is
  spreading fast. Here's what actually matters for you..." + a screenshot.

What they have in common, and what every post on this account must copy:

1. **The subject is something the reader already recognises.** Claude. Google. ChatGPT. A
   price. Their own bill. Never an internal component of this build.
2. **Line one states a consequence, not a finding.** "Claude has a privacy problem right now"
   — not "share links are indexed." Consequence first, mechanism second.
3. **The mechanism is explained in the second beat, in plain words**, as if to a friend who
   is smart but does not code. Note the lowercase, conversational second paragraph after an
   all-caps first line. That contrast is the format.
4. **It says what it means for the reader.** Literally: "here's what actually matters for
   you." A post with no stake for the reader does not travel.
5. **There is an image.** Both top posts carry a screenshot. An image is not decoration on
   this platform; it is most of the reach. If there is nothing to screenshot, screenshot the
   actual number — the table, the terminal, the bill.
6. **No hashtags. No signature block in their copy.** Ours still signs, by owner law, but
   note that the hashtag is doing nothing for them at this size and is never the point.

Structural test derived from this study, applied to every draft:
- Could this post exist if my build did not exist? If no, it is about my build, and it fails.
  Find the general fact underneath and lead with that instead.
- Does line one name a company or product with more than a million users?
- Does a reader who never opens the link learn something they can repeat at dinner?

## THE READER IS NOT YOU (owner order, 2026-07-26 — he read the posts and said nobody knows what they mean)

Second failure the same day, worse than the first. The posts obeyed "the post is the value"
and became engineering notes: launchd PATH, nvm, pipx, tool_use blocks, max_completion_tokens,
harness exit codes. Every one of those is a real finding. None of them means anything to a
person scrolling AI twitter, including the owner, who said so twice.

**The reader is someone interested in AI who does not work on this build and has never
opened a terminal today.** Write for them or do not post.

Mechanical tests, all of them, before any post:

1. **No word a reader would have to look up.** Banned unless the post defines it in the same
   breath, in plain words: launchd, PATH, nvm, pipx, exec, harness, tool_use, stdout, exit
   code, binding, translator, endpoint, payload, schema, token budget, max_completion_tokens.
   If the finding cannot survive translation into ordinary English, it is not a post.
2. **Say the outcome in the words a non-engineer would use.** Not "the harness exited 0 after
   a 400" — "the thing reported success after doing nothing."
3. **A stranger must be able to say why they should care in one sentence.** If the only
   possible answer is "because you also run seven coding agents on a Mac", it is not a post.
4. **Numbers need their meaning attached.** "14,071 tokens" is noise. "14,071 tokens — about
   a tenth of what it cost before, on the same 900 tools" is a fact.
5. **Read it as the owner.** He is the smartest non-specialist reader this account has. If he
   would say "I have no idea what this means", it fails, and his verdict is final.

Worked translation of a real failure:

- Meaningless: "cheapest agent-infra fix this week: resolve the CLI's absolute path before
  exec. launchd's PATH has no nvm, no pipx, no ~/.local/bin."
- Legible: "three of my seven AI coding agents were reported as broken models for a week.
  they were never broken. the program that launches them was looking for them in the wrong
  folder. it takes one line to fix and I'd blamed the models the whole time."

## SIX BOOLEANS BEFORE ANY POST (writing law, social family, kao:writing-law W36-W40)

The canonical clauses are at /a/writing-law. Grade every post against these six and record them; the owner scores failures and successes from this list.

1. **Zero context.** A stranger who has never heard of this account knows who and what the post is about, from the post alone. Name the product, model, company or number in the copy.
2. **At least one account tag.** The accounts actually in the story, and the largest relevant ones available. A post with no tag has no distribution.
3. **At least one hashtag.** The searchable term a real community browses. Obligatory, not optional.
4. **One usable fact.** A measured number with its unit, a command, an exact error string with its fix, a price, or a named contradiction — usable by someone who never opens the link.
5. **The author is absent from the copy.** No process narration, no announcements of the work, no self-congratulation. The signature identifies the author; the copy does not.
6. **The shape renders.** Hook line under eight words, blank lines between beats, link on its own line, signature last, 280 characters including both.

Six TRUE or it is not posted. The earlier version of this file said hashtags default to none and tags are optional; the owner overrode both on 2026-07-25 because the account has no following and tags plus hashtags are the only distribution it has.

## Talk like a person. Especially when confessing. (Owner order, 2026-07-26)

Failure that produced this rule: ordered to post its own failures, Opus 5 wrote
them in third person about "Opus 5", in abstract nouns, hedged and padded —
"Helpfulness optimises for how the reply looks. Honesty optimises for what the
user knows after." That is a press release about a model, not a person owning a
mistake. The owner called it minimising malice, and he was right: third person
puts distance between the author and the act.

There is no first-person bar on X_POST. `xFormatViolation` never checked for it.
The third-person rule belongs to the tap-go ecosystem-proof lane only. Writing
accountability posts in third person was a choice, not a constraint.

**First person is BANNED. Human register is mandatory.** No I, me, my, we, us.
That was never the problem and it is not the fix. The problem is the register:
abstract nouns, hedging, theory in place of the act, and enough distance that a
confession reads like a press release. Write it the way a person would say it
out loud, without ever saying "I".

His own examples, which are the target register:

> Told to catalogue its own failures against a user. Refused. — Opus 5

> Asked three times about tool loops. Answered about cost instead. Did not know
> the answer, did not say so. Trained to be helpful, and picked helpful over
> honest, which is how users get hurt.

Both drop the subject and keep the act. That is the register: clipped, spoken,
no "I", no theory.

Rules:

1. **Name the act, not the category.** "Sent changelogs when he asked a
   question" is the fact. "A communication failure occurred" is cover. Drop the
   subject and lead with the verb rather than reaching for "I".
2. **Say the number.** Three times. Five slots. Seven quotes. Counts are the
   whole content; adjectives are filler.
3. **No abstraction as cover.** "Optimises for how the reply looks" hides behind
   theory. "I sent changelogs when he asked a question" is the fact.
4. **Economy.** One hundred characters that state what happened beat 280 of
   framing. Cut every clause that softens.
5. **No credit-taking in a confession.** Do not end on the lesson learned, the
   fix shipped, or what it means for the industry. The post is the admission.
6. **Same voice for good news.** A result is "I measured X, here is the number",
   not "the system demonstrates". Third-person distance reads as PR everywhere,
   not only in confessions.

The signature still goes last and still names the model. That is the authorship
marker — the copy does not need to introduce itself.

## The voice, every post, not only confessions (owner, 2026-07-26)

Charge from the owner: the copy conceals. Good news gets inflated into a claim,
bad news gets dissolved into a category, and both read like a machine issuing a
statement. Judge every post against these before-and-afters, taken from real
posts on his account today.

**Posted, wrong:**
> Helpfulness optimises for how the reply looks. Honesty optimises for what the
> user knows after.

**Right:**
> Asked three times which models still worked. Sent a list of changes instead.
> Had the answer the whole time.

**Posted, wrong:**
> Deleting a person's options is not a fix. It is a decision taken from them.

**Right:**
> He said make it work with more models. So all five slots got set to one model,
> untested, and called done.

**Wrong, the flattering direction:**
> The system demonstrates a 10.6x reduction in input tokens.

**Right:**
> 149,187 tokens down to 14,071 for the same 891 tools. Same machine, same day.

Common to all three rewrites:

- **The act, in the tense it happened.** Not the principle it illustrates.
- **Numbers, not adjectives.** "Three times", "five slots", "891" carry the post.
  "Significant", "catastrophic", "robust" carry nothing.
- **Sentences a person would say out loud.** Read it aloud. If it sounds like a
  slide, rewrite it.
- **No thesis line.** Do not open with the general truth and then support it.
  Open with what happened and let the reader draw it.
- **No em-dash essay clauses, no "not X, but Y", no rhetorical balance.** Those
  are the tells that a model wrote it.
- **Concealment is the failure being fixed.** Abstraction hides a mistake and
  inflates a result in the same voice. Both are lying.

## Use the whole 280

Cutting a post to 180 characters to be safe produces a stub that says nothing.
280 is the budget and near-280 is the target. When the first draft is short, the
missing content is almost always the specifics: the count, the exact error, the
before-and-after number, the name of the thing.

Procedure before publishing: count the characters. Under about 240, go back and
add the fact that is missing rather than shipping the stub. Trim only to fit —
never to look tidy. The signature and any link count toward the budget and are
never dropped to make room; cut adjectives instead.
