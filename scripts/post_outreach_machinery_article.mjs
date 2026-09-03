#!/usr/bin/env node
/**
 * Publish the outreach-machinery article: the build's own lead discovery, enrichment,
 * qualification, drafting, review, send gates, tracking and channel inventory, plus the
 * audience logic and the delta equation that decides who is contacted and when.
 * Run: node scripts/post_outreach_machinery_article.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";

const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try {
    const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
    const m = env.match(/TERMINAL_KEY=(.+)/);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY;
  } catch {
    return process.env.TERMINAL_KEY;
  }
})();

const slug = "outreach-machinery";

const sources = [
  {
    id: "s1",
    type: "other",
    title: "Overpass API — querying OpenStreetMap data",
    publisher: "OpenStreetMap Wiki",
    url: "https://wiki.openstreetmap.org/wiki/Overpass_API",
    summary:
      "The free endpoint behind the first discovery source. Tag filters, area scoping, and the 30-second timeout the runner sets.",
    accessed_at: "2026-07-29T00:00",
    claim_ids: ["c2"],
  },
  {
    id: "s2",
    type: "other",
    title: "Places API (New) — usage and billing",
    publisher: "Google",
    url: "https://developers.google.com/maps/documentation/places/web-service/usage-and-billing",
    summary:
      "Text Search Enterprise + Atmosphere is the SKU the second discovery source bills against. The runner writes the per-call cost into its own result.",
    accessed_at: "2026-07-29T00:00",
    claim_ids: ["c3"],
  },
  {
    id: "s3",
    type: "other",
    title: "NPPES NPI Registry API",
    publisher: "Centers for Medicare & Medicaid Services",
    url: "https://npiregistry.cms.hhs.gov/api-page",
    summary:
      "The federal registry of licensed US providers. Free, keyless, authoritative on identity and address, and carries no website field — which is why a resolve stage exists.",
    accessed_at: "2026-07-29T00:00",
    claim_ids: ["c4"],
  },
  {
    id: "s4",
    type: "other",
    title: "RFC 8484 — DNS Queries over HTTPS (DoH)",
    publisher: "IETF",
    url: "https://www.rfc-editor.org/rfc/rfc8484",
    quote:
      "This document defines a protocol for sending DNS queries and getting DNS responses over HTTPS.",
    summary:
      "How mailbox verification runs from a Worker with no DNS socket: MX lookups over HTTPS.",
    accessed_at: "2026-07-29T00:00",
    claim_ids: ["c7"],
  },
  {
    id: "s5",
    type: "other",
    title: "16 CFR Part 316 — CAN-SPAM Rule",
    publisher: "Electronic Code of Federal Regulations",
    url: "https://www.ecfr.gov/current/title-16/part-316",
    summary:
      "The source of the two send-time preconditions that are configuration rather than code: a valid physical postal address in the message, and a working opt-out.",
    accessed_at: "2026-07-29T00:00",
    claim_ids: ["c11"],
  },
  {
    id: "s6",
    type: "other",
    title: "RFC 7489 — Domain-based Message Authentication, Reporting, and Conformance (DMARC)",
    publisher: "IETF",
    url: "https://www.rfc-editor.org/rfc/rfc7489",
    summary:
      "Together with SPF (RFC 7208) and DKIM (RFC 6376), the alignment the sending domain must prove before the send gate is allowed to open.",
    accessed_at: "2026-07-29T00:00",
    claim_ids: ["c11"],
  },
  {
    id: "s7",
    type: "other",
    title: "Reddit Data API documentation",
    publisher: "Reddit",
    url: "https://www.reddit.com/dev/api/",
    summary:
      "The read and reply surface behind the Reddit rows. Reads need two credentials; replying as an account needs four.",
    accessed_at: "2026-07-29T00:00",
    claim_ids: ["c14"],
  },
  {
    id: "s8",
    type: "other",
    title: "X API documentation",
    publisher: "X",
    url: "https://developer.x.com/en/docs/x-api",
    summary:
      "OAuth 1.0a user-context posting. The row's completion contract is derived from what this API actually returns: an id, and a status URL built from it.",
    accessed_at: "2026-07-29T00:00",
    claim_ids: ["c13"],
  },
  {
    id: "s9",
    type: "live_surface",
    title: "POST /api/dispatch — the single door every row is invoked through",
    publisher: "miscsubjects.com",
    url: "https://miscsubjects.com/api/dispatch",
    summary:
      "Every capability named on this page is invoked the same way: a key and a body. The invocation lands on the ledger before the result returns.",
    accessed_at: "2026-07-29T00:00",
    claim_ids: ["c1"],
  },
  {
    id: "s11",
    type: "other",
    title: "Marketing API — campaign, ad set, creative and audience objects",
    publisher: "Meta for Developers",
    url: "https://developers.facebook.com/docs/marketing-apis/",
    summary:
      "The paid surface the build holds fifty-eight rows against: read, create, budget, status, audience, lookalike, delivery estimate, and asynchronous insights.",
    accessed_at: "2026-07-29T00:00",
    claim_ids: ["c24"],
  },
  {
    id: "s12",
    type: "other",
    title: "Conversions API — server-side event delivery",
    publisher: "Meta for Developers",
    url: "https://developers.facebook.com/docs/marketing-api/conversions-api/",
    summary:
      "How a server reports an outcome back to the ad platform. The build holds one row against it and has never sent a conversion for this subject.",
    accessed_at: "2026-07-29T00:00",
    claim_ids: ["c24"],
  },
  {
    id: "s13",
    type: "other",
    title: "IndexNow — submitting URLs to search engines on change",
    publisher: "IndexNow",
    url: "https://www.indexnow.org/documentation",
    summary:
      "One of the named absent capabilities: the site publishes a sitemap and waits to be crawled instead of announcing each change.",
    accessed_at: "2026-07-29T00:00",
    claim_ids: ["c26"],
  },
  {
    id: "s14",
    type: "live_surface",
    title: "GET /llms.txt — the machine-readable index of this site",
    publisher: "miscsubjects.com",
    url: "https://miscsubjects.com/llms.txt",
    summary:
      "The lowest-cost promotion surface the build has: a document written for a model reading the site rather than a person browsing it.",
    accessed_at: "2026-07-29T00:00",
    claim_ids: ["c23"],
  },
  {
    id: "s10",
    type: "live_surface",
    title: "GET /api/relay — the ledger feed",
    publisher: "miscsubjects.com",
    url: "https://miscsubjects.com/api/relay",
    summary:
      "Where an outreach decision is readable after the fact: the allocation, the inputs it read, and the invocation that produced it.",
    accessed_at: "2026-07-29T00:00",
    claim_ids: ["c19"],
  },
];

const claims = [
  {
    id: "c1",
    text:
      "Every outreach capability on this site is a directory row invoked through one endpoint, and every invocation is appended to the ledger before its result is returned to the caller.",
    section: "One door",
    tier: "system",
    source_ids: ["s9"],
    why_material:
      "It is what makes the rest of the page checkable rather than descriptive: each named row can be called, and each call leaves a record nobody has to be trusted about.",
  },
  {
    id: "c2",
    text:
      "The first discovery source queries OpenStreetMap through Overpass with per-segment tag filters and discards any result that has neither a website nor a phone number.",
    section: "Discovery",
    tier: "system",
    source_ids: ["s1"],
    why_material:
      "A record with no reachable contact cannot progress through any later stage, so it is refused at the point of entry rather than counted as a lead.",
  },
  {
    id: "c3",
    text:
      "The second discovery source is a paid Places text search that records its own per-call cost in the result it returns.",
    section: "Discovery",
    tier: "system",
    source_ids: ["s2"],
    why_material:
      "Cost is a field on the invocation, not an estimate reconstructed later, which is what allows a discovery run to be priced from its own receipt.",
  },
  {
    id: "c4",
    text:
      "The third discovery source is the federal NPPES registry, which is authoritative on identity and address and contains no website field.",
    section: "Discovery",
    tier: "system",
    source_ids: ["s3"],
    why_material:
      "It explains why a separate resolve stage exists: the most reliable identity source is the one least able to be crawled.",
  },
  {
    id: "c5",
    text:
      "Enrichment reads only the target's own website. It crawls a fixed path list, extracts addresses four ways including de-obfuscating protected addresses, and prefers an address on the target's own domain.",
    section: "Enrichment",
    tier: "system",
    source_ids: [],
    why_material:
      "It bounds where contact data can come from. No third-party contact database and no guessed address can enter the system through this path.",
  },
  {
    id: "c6",
    text:
      "The text captured from the target's own site is the only material a draft may personalise from, and a batch claim column prevents two workers from enriching the same record.",
    section: "Enrichment",
    tier: "system",
    source_ids: [],
    why_material:
      "Personalisation with no recorded source is indistinguishable from invention, so the source is stored as a column and shown beside every draft.",
  },
  {
    id: "c7",
    text:
      "Mailbox verification is an MX lookup over HTTPS. It proves the domain accepts mail. It does not prove the individual mailbox exists.",
    section: "Verification",
    tier: "system",
    source_ids: ["s4"],
    why_material:
      "Stating the limit is what stops a verified flag being read as a delivery guarantee; a typed role address on a live domain can still bounce.",
  },
  {
    id: "c8",
    text:
      "Qualification is a model scoring each record against a stored thesis document and writing back a score, a counterparty type, and a one-line reason. No calibration study exists for that score.",
    section: "Qualification",
    tier: "system",
    source_ids: [],
    why_material:
      "The score gates every later stage, so the absence of a calibration study is the single largest unquantified error in the pipeline.",
  },
  {
    id: "c9",
    text:
      "Drafting refuses to run unless a verified address, a passing MX check, a score at or above the floor, a minimum quantity of real site context, and a clean suppression check all hold.",
    section: "Drafting",
    tier: "system",
    source_ids: [],
    why_material:
      "The gates are preconditions on the writing step, not advice to the writer, so a missing input produces a refusal instead of a plausible sentence.",
  },
  {
    id: "c10",
    text:
      "A completed draft is discarded and retried when it contains a banned phrase, a subject that violates the subject contract, or claims outside the permitted register. The discard happens before anything is saved.",
    section: "Drafting",
    tier: "system",
    source_ids: [],
    why_material:
      "A validator that runs after saving produces a corpus that has to be cleaned; one that runs before saving produces a corpus that never contained the defect.",
  },
  {
    id: "c11",
    text:
      "Sending is refused unless the caller passes a literal confirmation token, and the gate re-checks every qualification condition at send time plus four more: this address has never been sent to, the recipient is not suppressed, a postal address is configured, and the sending domain's authentication is flagged as proven.",
    section: "The send gate",
    tier: "system",
    source_ids: ["s5", "s6"],
    why_material:
      "Re-checking at send time is the difference between a gate and a stale approval, because every condition was checked when the draft was written and any of them can have changed since.",
  },
  {
    id: "c12",
    text:
      "Eleven emails have been sent to external recipients by this machinery, all on 2026-07-06, before the confirmation gate existed. None of the eleven appear in the send-tracking table, because the single-send path writes the record status and does not write a tracking row.",
    section: "The honest state",
    tier: "system",
    source_ids: [],
    why_material:
      "It is both the entire external send history and an open recording defect, and either one alone would be a misleading account of the system.",
  },
  {
    id: "c13",
    text:
      "A post to X counts as posted only when the provider returns a success status and a non-empty id and the row returns the status URL built from that id. A receipt, an attempted call, or a deduplication claim is not a post.",
    section: "Channels",
    tier: "system",
    source_ids: ["s8"],
    why_material:
      "The completion contract exists because models repeatedly reported a post as published while holding only their own receipt for the attempt.",
  },
  {
    id: "c14",
    text:
      "Reddit reads require two credentials and replying as an account requires four, so the read lane and the reply lane can be independently available or unavailable.",
    section: "Channels",
    tier: "system",
    source_ids: ["s7"],
    why_material:
      "Treating one channel as a single capability produces a false inventory; the lanes fail separately and must be reported separately.",
  },
  {
    id: "c15",
    text:
      "There is no LinkedIn capability. There is no cold direct-message capability on any channel. Messaging channels are reply and warm channels only.",
    section: "What it does not do",
    tier: "system",
    source_ids: [],
    why_material:
      "An inventory of a promotion system is worthless without its complement, and the absent channels are the ones a reader would otherwise assume.",
  },
  {
    id: "c16",
    text:
      "Audience classes are derived by independent models reading the published corpus and answering one question — who bears a loss this machinery reduces — with every model's full request and response stored as a ledger object.",
    section: "Who would care",
    tier: "system",
    source_ids: [],
    why_material:
      "It makes the targeting thesis refutable: the reasoning that produced each class is readable, and a reader can attack the class rather than the outcome.",
  },
  {
    id: "c17",
    text:
      "Daily volume per class and channel is the product of five terms — fit, novelty, permission, one minus saturation, and a response prior — where permission and novelty can only zero the result.",
    section: "The delta equation",
    tier: "system",
    source_ids: [],
    why_material:
      "Making novelty a zeroing term is what prevents a contact sequence: with nothing new to show a class, the computed volume for that class is zero.",
  },
  {
    id: "c18",
    text:
      "The response prior starts as a declared constant, not as an assumed response rate, and updates only from recorded events: replies, opt-outs, complaints, and the reviewer verdict stored against each draft.",
    section: "The delta equation",
    tier: "speculative",
    source_ids: [],
    why_material:
      "The first wave's ordering therefore rests on an estimate with no response data behind it, which is the weakest input in the equation and is published as such.",
  },
  {
    id: "c19",
    text:
      "Each allocation writes one ledger object holding the policy version, every input term per class, the resulting volumes, and the identifiers of the records selected, so the allocation can be replayed and contradicted.",
    section: "The delta equation",
    tier: "system",
    source_ids: ["s10"],
    why_material:
      "An unreplayable selection cannot be audited by the person it selected, which is the only audit of a targeting decision that matters.",
  },
  {
    id: "c20",
    text:
      "A recipient can open the arithmetic that selected them through a token issued to that recipient. Class-level allocations are public; a named recipient's record is not.",
    section: "The delta equation",
    tier: "system",
    source_ids: [],
    why_material:
      "Publishing a named individual's targeting file to prove transparency would be the harm the transparency is supposed to prevent.",
  },
  {
    id: "c21",
    text:
      "Copy shape is measured by removing the personalised opener, the catalog block, every URL and every number from a draft and hashing what remains, so drafts written under the same rules collapse to the same hash.",
    section: "Template collapse",
    tier: "system",
    source_ids: [],
    why_material:
      "It caught a real failure: a personalisation rule strict enough to ban every available observation left one legal opener and one hundred and twenty-one drafts converged on it.",
  },
  {
    id: "c23",
    text:
      "The build's cheapest promotion surface is machine-readable: a plain-text index for models, a sitemap, a feed, and two well-known descriptor documents that let an agent enumerate the site's capabilities without a human intermediary.",
    section: "Machine-readable discovery",
    tier: "system",
    source_ids: ["s14"],
    why_material:
      "For a system whose audience includes coding agents and web models, the document written for them is not a side channel; it is the primary one.",
  },
  {
    id: "c24",
    text:
      "The build holds fifty-eight rows against a paid advertising API covering campaign, ad set, ad, creative, audience, lookalike, budget, status, targeting search, delivery estimate and asynchronous insights, plus one server-side conversion row.",
    section: "Paid channels",
    tier: "system",
    source_ids: ["s11", "s12"],
    why_material:
      "The paid lane is not a plan; the create paths exist. What does not exist is any spend for this subject, and the distinction between capability and use is the whole point of documenting it.",
  },
  {
    id: "c25",
    text:
      "Image and video generation is available through four independent providers, and generated assets are stored in object storage with the generating request preserved.",
    section: "Making the creative",
    tier: "system",
    source_ids: [],
    why_material:
      "Creative production being in the same receipted system as the send is what allows an asset, the message that carried it, and the outcome to be joined afterwards.",
  },
  {
    id: "c26",
    text:
      "Named absent capabilities include TikTok, Google Ads, LinkedIn, YouTube, Instagram publishing, Threads, Bluesky, Mastodon, Discord, Slack, compliant application-to-person SMS, a deliverability-reporting mail provider, search-console and change-notification interfaces, and every developer-community submission surface.",
    section: "What it does not have",
    tier: "system",
    source_ids: ["s13"],
    why_material:
      "A promotion system that documents only what it can do produces an inventory that reads as complete; the gap list is what makes the inventory usable for deciding what to build next.",
  },
  {
    id: "c22",
    text:
      "No party has been contacted about this build. The machinery described here has been exercised end to end for a different subject, and its audience logic for this subject has never been run against a real recipient.",
    section: "The honest state",
    tier: "system",
    source_ids: [],
    why_material:
      "The standing objection to this build is that nobody else has adopted it, and the correct answer to that objection is the current number, not an argument.",
  },
];

const body = `## What this page documents

This build has a working lead-discovery and outreach system. Until this page existed, none of it was documented anywhere a reader outside the build could see: the scrapers, the enrichment crawler, the qualification gates, the drafting validator, the send gate, the tracking, and the channels it can speak on were internal tooling described only in code and in an administrative view nobody else can open.

The same is true of everything adjacent to it: the image and video generation, the fifty-eight paid-advertising rows, and the machine-readable documents that are the only promotion surface written for a program rather than a person.

This page documents all of it to the same standard as every other capability here — the real row names, the real code paths, the real tables and columns, the real gates, the real costs, and the real counts as they stand at publication. It documents what the system does **not** do, and then what it does not **have** — every channel and interface a system like this should hold and does not — because for a promotion system that complement is the more load-bearing half.

Two things follow it. The first is the logic that decides who should hear about this build at all, derived from the published corpus rather than asserted. The second is the arithmetic that decides how many of them are contacted on a given day, through which channel, with which artifact — recorded, replayable, and openable by the person it selected.

## Why it is being published

The most common objection to this build, raised by nearly every model that has been shown it, is not architectural. It is that nobody else has adopted it. The architecture is granted and then dismissed on that ground.

That objection is correct on its facts and the number is in this page. It also has a structure worth naming: the thing being asked for is external demand, and the honest way to produce external demand is to reach the people whose problem the build addresses and let them check it. Doing that with an undocumented, unreviewable outreach system would reproduce, one level up, exactly the failure this build exists to refuse — an action taken for reasons nobody outside the actor can inspect.

So the outreach machinery is documented first, on the same terms as everything else: the mechanism is public, the decision is receipted, and the reason a particular recipient was selected is a record that recipient can open.

## One door

Every capability named below is a directory row invoked the same way:

\`\`\`bash
curl -s -X POST https://miscsubjects.com/api/dispatch \\
  -H 'content-type: application/json' \\
  -d '{"key":"LEADS_VERIFY_MX","body":"25"}'
\`\`\`

The invocation is appended to the ledger — key, actor, inputs, result, cost, trace — before the result returns to the caller. Each one is then readable at \`/receipt/<invocation id>\`. That property is what makes the rest of this page checkable instead of merely descriptive.

[[embed:source:s9]]

## Discovery: four independent sources, one table

Discovery finds candidate organisations. Four rows do it, from four sources that fail in different ways, and all four write into one table with a uniqueness constraint on name and city so the same organisation cannot be counted twice.

| row | source | cost | what it yields | how it fails |
|---|---|---|---|---|
| \`LEADS_DISCOVER\` | OpenStreetMap via Overpass | free | name, website, phone, address, tag context | coverage is volunteer-dependent and thin for professional practices |
| \`LEADS_DISCOVER_PLACES\` | Places text search | metered per request, written into the result | name, website, phone, formatted address, rating, type | costs money per call and returns commercial listings only |
| \`LEADS_DISCOVER_NPI\` | NPPES federal registry | free | authoritative identity, phone, address, taxonomy | contains no website at all |
| \`LEADS_DISCOVER_AI\` | live web search | model tokens | organisations the other three miss | least structured and least verifiable of the four |

Every one of them discards a result that has neither a website nor a phone number. A record with no reachable contact cannot pass any later stage, so it is refused at entry rather than stored and counted.

[[embed:source:s1]]

[[embed:source:s3]]

The insert is a conflict-ignoring insert that returns the new identifier only when a row was actually created, so a discovery run reports how many records are new rather than how many results it saw. Both numbers are in the result.

## Resolve: giving the authoritative rows something to crawl

The most reliable identity source has no website field. A separate row looks up siteless records by name and city and attaches the website, which is the only thing that makes the next stage possible. This is the stage that decides whether personalisation can happen at all — not the writer, and not the model.

## Enrichment: the target's own site, and nothing else

Enrichment fetches the organisation's own website and reads a fixed list of paths on it — the homepage, then the conventional contact, about, team, services, and location paths. Addresses are extracted four ways: visible text, mail links, structured data, and de-obfuscation of protected addresses that are rendered as encoded attributes rather than text. A junk filter removes placeholders, platform addresses, and content-delivery artefacts. An address on the organisation's own domain is preferred; a role address is next.

The same pass captures the site's own title and description, and stores them as the record's context.

Two properties matter more than the extraction detail.

**The only permitted source of contact data is the target's own website.** No purchased list, no third-party contact database, and no pattern-guessed address can enter the system through this path. If the organisation has not published an address, the record ends as *no address found* and is never drafted.

**The stored context is the only material a draft may personalise from,** and it is displayed beside every draft along with the URL it came from. A personalised sentence with no recorded source is indistinguishable from an invented one, so the source is a column.

A batch version processes several records at a time and stamps a claim timestamp on each, with stale-claim recovery, so two workers running concurrently never enrich the same record twice.

## Verification: what a verified address actually means

Mailbox verification looks up the mail-exchange records for each address's domain over HTTPS, because a Worker has no DNS socket. Domains with no mail server are parked so that no draft and no send is ever spent on them.

[[embed:source:s4]]

The limit has to be stated in the same breath as the check: this proves the **domain** accepts mail. It does not prove the individual mailbox exists. A role address on a live domain can still bounce, and any claim stronger than that is false.

## Qualification: a score, and the study that does not exist

A model reads each verified record against a stored thesis document — what is being offered, to whom, and why they would want it — and returns a score out of one hundred, a counterparty type, and a one-line concrete reason. The score and the reason are written back onto the record, so the list can be ordered by judged fit rather than by whether a website happened to be found.

Records below the floor are never drafted.

**No calibration study exists for that score.** It is a model's estimate of commercial fit, it gates every later stage, and its error rate is unmeasured. That is the largest unquantified term in the whole pipeline and it is not improved by describing it in stronger language.

## Drafting: preconditions, then a validator that destroys its own output

The drafting row refuses to run at all unless every one of these holds: an address was found on the organisation's own site, its domain accepts mail, the qualification score is at or above the floor, there is a minimum quantity of real site context to write from, and the recipient is not suppressed. A missing input produces a refusal, not a plausible sentence written around the gap.

When it does run, the finished draft is then checked and — if it fails — **discarded and retried before anything is stored**. The checks include banned phrases, a subject-line contract, register violations, and claims outside the permitted class. A validator that runs after saving produces a corpus that has to be cleaned later; one that runs before saving produces a corpus that never contained the defect.

## Template collapse, and how it is measured

The most expensive failure this system has produced was not a rule being broken. It was a rule being obeyed.

A personalisation rule was tightened until it banned every observation the target sites actually contained. One legal opener remained, and one hundred and twenty-one drafts converged on it under the same four-word subject. Every draft passed every validator. Interchangeable mail is unwanted mail regardless of how strict the rules that produced it were.

The detector for it is structural. A draft's *shape* is what remains after the personalised opener, the catalog block, every URL and every number are removed; that residue is hashed. Two drafts written under the same rules produce the same hash. Clustering the corpus on it turns a pile of near-identical bodies into the handful of generations the copy has actually been through, and the count of distinct businesses inside one shape is the collapse measurement.

Every change to the drafting rules is stored verbatim with its timestamp, and the shape clustering is re-run after the change. The rule history and the corpus it produced are inspected together, because a rule change is only evaluable against the output it caused.

## Review: nothing reaches a recipient unreviewed

Drafts are mailed for review with the recipient, the subject, and the full body, one per draft. Nothing is sent to any recipient until that review has happened.

Review mail deliberately carries **no** link wrapping, unlike outbound mail. Wrapping rewrites the visible destination of every link, and a review message carrying a dozen rewritten links is a text-and-destination mismatch on every one of them — which is what filters score as impersonation. That was not theoretical: a wrapped review batch went to spam while earlier unwrapped mail arrived.

## The send gate

The send row refuses unless the caller passes a literal confirmation token as the first argument. It is not a parameter with a default; the absence of the exact token returns a refusal that sends nothing.

With the token, it re-checks all of the following **at send time**:

1. the record is in the drafted state;
2. its domain still passes the mail check;
3. its qualification score is still at or above the floor;
4. the recipient is not in the suppression table;
5. this address has never been sent to before, by any record;
6. a valid physical postal address is configured;
7. the sending domain's authentication alignment is flagged as proven.

Then it appends the disclosure footer — the postal address, and a one-word reply that stops all further contact.

[[embed:source:s5]]

Re-checking is the whole point. Every one of those conditions was already checked when the draft was written, and any of them can have changed since. An approval that is not re-verified at the moment of action is a memory of an approval.

The batch version caps the number it will send and runs the entire gate again per record, so a batch is a loop over individual gated sends and not a bulk path around them.

[[embed:source:s6]]

## Tracking, and its unreliability

Outbound mail has its links rewritten through a redirect that counts clicks, and carries a single-pixel image that counts opens. Delivery status, open count, first and last open, click count and a click log are stored per send.

Open tracking is unreliable and should be read as a floor, not a measurement: image blocking, privacy proxies, and prefetching all break it in both directions. Click tracking is more reliable and still not proof of a human.

## Follow-ups

A follow-up row drafts a short threaded sequence off the first message. It is subject to the same review-before-send rule, and to the same never-twice constraint at the address level.

## The channels, and the completion contract on each

| channel | rows | state | what counts as done |
|---|---|---|---|
| email | \`EMAIL_SEND\`, \`EMAIL_SEND_TRACKED\`, \`LEADS_SEND\`, \`LEADS_SEND_BATCH\` | live | provider accepted the message, and a tracking row exists |
| X | \`X_POST\`, \`X_REPLY\`, \`X_SEARCH\` | live, owner account, user-context OAuth | provider success status, non-empty id, and the status URL built from that id |
| Reddit | \`REDDIT_SEARCH\`, \`REDDIT_THREAD\`, \`REDDIT_REPLY\` | reads and replies implemented; the reply lane needs two more credentials than the read lane | the provider's comment identifier and its permalink |
| iMessage | messaging-provider rows, with a capability probe per number | live | provider delivery event for the specific message |
| WhatsApp | messaging-provider rows | live | provider delivery event |
| Telegram | dedicated route | live | provider message identifier |
| paid delivery | fifty-eight advertising rows, read and create | live, never used for this build | the platform's own object identifier for the created campaign, ad set, ad or creative |
| creative production | image, video and ad-format generation across four providers | live | the stored asset and the request that produced it |
| machine-readable | \`/llms.txt\`, \`/sitemap.xml\`, \`/feed.xml\`, two well-known descriptors | live | a fetch of the document, logged |

[[embed:source:s8]]

[[embed:source:s7]]

The X completion contract deserves its own line because it was written against a real repeated failure: a model reported a post as published while holding only its own receipt for having attempted it. A receipt proves a call was made. Only the provider's identifier and the resulting status URL prove a post exists. The same standard now applies to every channel in the table: the provider's own identifier, or the action is not done.

## Machine-readable discovery: the channel with no recipient

The cheapest promotion this build does has no message and no send. It is a set of documents written for a program rather than a person.

| surface | what it is for |
|---|---|
| \`/llms.txt\` | a plain-text index of the site, written so a model reading it can find the substantive pages without parsing navigation |
| \`/sitemap.xml\` | every page, for crawlers |
| \`/feed.xml\` | changes, for anything that subscribes |
| \`/.well-known/agent.json\` | a descriptor telling an agent what this site is and how to call it |
| \`/.well-known/oip.json\` | the object protocol descriptor: the shape of every addressable object here |
| \`/api/dispatch\`, \`/api/relay\`, \`/receipt/<id>\` | the enumerable capability surface and its history |

[[embed:source:s14]]

This matters more for this build than it would for most. A meaningful share of the audience for an auditable-reasoning primitive is not a human browsing — it is a coding agent or a web-based model asked to evaluate something, which will read whatever is machine-addressable and ignore whatever is not. Making the capability surface enumerable, and every claim traceable to a receipt an agent can fetch, *is* the promotion. A page a model cannot verify is a page a model will hedge about.

## Making the creative: images and video

Creative production is inside the same receipted system as the send.

| capability | rows |
|---|---|
| ad-format image and video generation, uploaded to object storage | creative-platform rows including a credit check, a generate call, a video generate call, and an upload-to-storage step |
| general image generation | two independent model providers, each with a direct call and a store-to-object-storage variant |
| image editing | provider edit rows |
| short video generation | a start-and-poll pair |
| text-to-image on the platform's own inference | one row |

Four independent providers exist for images, so a provider refusal or outage is not a stop. The generating request is preserved alongside the asset, which is what allows an image, the message that carried it, and whatever came back to be joined afterwards rather than guessed at.

Every featured image on this site, including the one on this page, was produced this way.

## Paid channels: the ads surface

The build holds fifty-eight rows against a paid advertising API. Not a read-only integration — the create paths exist:

- **read**: accounts, businesses, portfolio, campaigns, ad sets, ads, creatives, images, videos, audiences, pixels, catalogs and their diagnostics, activities, studies;
- **create**: campaign, ad set, ad, creative, custom audience, lookalike audience, catalog;
- **change**: budget set, status set, campaign update, ad set update, ad update, object delete;
- **measure**: insights, asynchronous insights create/status/result, dataset stats, delivery estimate;
- **target**: targeting search and targeting browse;
- **report back**: one server-side conversion row.

[[embed:source:s11]]

[[embed:source:s12]]

**Zero has been spent promoting this build.** The advertising account those rows are bound to belongs to a different venture. The capability is real and the use is nil, and the distinction between those two things is exactly what this page exists to make legible.

The reason the paid lane is documented next to the free one is that they are one loop, not two. A paid impression and a cold email are both a spend of something scarce against a hypothesis about who cares; both produce a signal; both signals move the same terms in the same equation. The only structural difference is that the paid lane can be bought in volume before the hypothesis is any good, which is the argument for its coming last rather than first.

## What it does not have, and should

An inventory of a promotion system that lists only what it can do reads as complete. This is the complement — every channel and interface that is absent, with what its absence costs.

| absent | what it would do | cost of not having it |
|---|---|---|
| TikTok Content Posting and Marketing APIs | organic posting and paid delivery on the platform with the largest current attention surplus | the entire short-video audience is unreachable |
| Google Ads API | intent-side paid delivery — reaching a search rather than an interest | no way to appear at the moment someone searches for the problem this solves |
| LinkedIn Pages and Marketing APIs | the professional network where the audience classes for this build actually work | the single largest miss for a business-to-business primitive |
| YouTube Data API | publishing demonstration video where technical evaluation actually happens | a demonstration has nowhere durable to live |
| Instagram Graph publishing | scheduled organic publishing | ad rows exist for the platform; organic publishing does not |
| Threads, Bluesky and Mastodon | the developer-adjacent networks displacing a share of X | one microblog is a single point of failure |
| Discord and Slack | the closed communities where technical adoption is actually argued | no presence where practitioners talk |
| Product Hunt, Hacker News, developer-community submission | one-shot launch surfaces with real reach for infrastructure | no launch mechanism at all |
| compliant application-to-person SMS | text as an outbound channel under a registered campaign | messaging exists only as a reply channel, correctly, because the compliant path is unbuilt |
| a mail provider with deliverability reporting | bounce, complaint and reputation data as first-class events | delivery is inferred from an accepted request, and complaints are invisible |
| IndexNow and search-console interfaces | announcing each change and reading back what indexes and what ranks | the site publishes and waits, blind to its own search performance |
| a newsletter surface | a subscription that does not require the build to initiate | every contact must be outbound; nobody can opt in |
| review and comparison directories | third-party listings buyers consult before contacting anyone | absent from the places evaluation actually starts |

[[embed:source:s13]]

That table is not a wish list. It is the input to the same allocation described below: an absent channel with a high-scoring class behind it is a build task with a priority, and the reason it is published is that the gap list is the part of a self-promotion system nobody writes down.

## What it does not do

- **No LinkedIn.** There is no LinkedIn capability of any kind — no posting, no messaging, no scraping. A reader assuming otherwise from a list of channels would be wrong.
- **No cold direct messages, on any channel.** iMessage, WhatsApp and Telegram are reply channels and warm channels. A cold message to a personal phone number is not a lower-friction email; it is a worse one, and no row exists to send it.
- **No purchased or third-party contact lists.** Contact data enters only from the target's own published website.
- **No guessed addresses.** No first-name-dot-last-name construction against a domain, ever.
- **No scraping behind a login, and no automated defeat of bot checks.** The crawler fetches public pages of public sites.
- **No sending without a human review of the exact body**, and no sending twice to one address.
- **No claim of delivery, open, or adoption that is not backed by a provider record.**

## Who would care, and how that is decided

The audience logic is derived, not asserted. Independent models — from different training families, the same channels the adjudication panel uses — read the published corpus and answer one question each: *who bears a loss this machinery reduces, and what is the one sentence that would make them reply?* Their full requests and responses are stored as ledger objects, so the reasoning that produced a class is readable and can be attacked directly.

A class is stored as a record with: the loss borne, the mechanism that addresses it, the single strongest artifact to show that class, a one-sentence thesis, the counter-argument that class will raise first, and a fit score with its reason. The drafting row reads the class record the same way it reads any other thesis document, so the same code writes to a regulator and to an infrastructure engineer without a fork.

The starting classes are candidates, scored and cut on evidence, not a finished list: assurance and audit technology, litigation support and discovery engineering, model-risk and AI-governance functions inside regulated firms, conformity-assessment and standards bodies, underwriters of professional and technology liability, agent-infrastructure and protocol builders, evaluation and interpretability researchers, procurement functions that must evidence diligence, public-sector oversight bodies, and the platform teams whose primitives this is built on.

The scoring question for each is deliberately narrow: does a wrong decision in their work cost money or licence, do they already pay for attestation of some kind, can one person there act without a committee, and does a page on this site already speak to their specific loss.

## The delta equation

Volume is not a target. It is the output of an equation whose terms are recorded.

For a class \`c\`, a channel \`k\`, on a day \`d\`:

\`\`\`
priority(c,k,d) = fit(c) · novelty(c,d) · permission(c,k) · (1 − saturation(c,k,d)) · prior(c,k)

volume(c,k,d)   = clamp( round( cap(k,d) · priority(c,k,d) / Σ priority ), 0, cap_class(c,d) )
\`\`\`

- **fit** — the class score, from the derivation above.
- **novelty** — what has shipped since this class was last contacted that is *relevant to this class*: a new article, a new claim, a new receipt, a new capability, a resolved defect. **Zero new relevant material is zero novelty and therefore zero volume.** This is the term that makes the system incapable of running a drip sequence: with nothing new to show a class, it does not write to that class.
- **permission** — one for a published organisational address on a channel that class has permitted, zero otherwise. It is a gate that can only zero the term, never a weight that trades against the others.
- **saturation** — how much of the class has already been contacted on this channel in the trailing window, plus a hard per-domain rate.
- **prior** — a declared constant to begin with, updated only by recorded events: replies, opt-outs, complaints, and the reviewer's verdict on each draft.
- **cap** — the daily channel ceiling, set low enough that every message remains individually reviewable.

Each run writes one ledger object holding the policy version, every input term for every class, the resulting volumes, and the identifiers of the records selected. The allocation is therefore replayable and contradictable — someone can recompute it, disagree with a term, and point at the exact number they disagree with.

[[embed:source:s10]]

**The prior is the weakest input.** With no response data, the first wave's ordering rests on an estimate. It is published as an estimate, and the first real replies will move it.

### The receipt the recipient can open

Every message carries a link to the arithmetic that selected its recipient: the class, each input term, the artifact chosen, and why. The link resolves for that recipient, through a token issued to them, using the same audience-bound mechanism this build already uses for blinded human review.

Class-level allocations are public. A named recipient's record is not, and publishing one to demonstrate transparency would be precisely the harm the transparency is for.

## What happens when someone replies

- **A one-word stop** writes the address to the suppression table, which every gate consults before every draft and every send. Nothing further is possible to that address.
- **A substantive reply** is a first-class event, stored, and it updates the prior for that class rather than being read as a private success.
- **"This is spam"** is treated as a defect report about the machinery, not about the recipient. It is recorded against the class and the shape that produced it.
- **"You are wrong"** is the reply the machinery is most interested in, and it has a place to go: the objection log, attributed and dated, alongside every other objection raised against this build.

## One loop over every channel, free and paid

The loop is five steps and each hop is a receipt.

1. **Something ships** — an article, a capability, a resolved defect, a measurement, a generated asset.
2. **The novelty term changes** for whichever classes that thing is relevant to. Nothing relevant, no contact.
3. **The allocation recomputes** — who is worth reaching today, on which channel, with which artifact. The artifact changes when a newer and stronger one exists. The channel set includes the free lanes, the machine-readable surfaces, and the paid lane, priced in the same units.
4. **Signal comes back** on every lane and into the same table: replies, opt-outs, complaints and reviewer verdicts from the direct lanes; impressions, clicks and cost from the paid lane; traffic, referrers and which pages were actually read from the analytics surface; and — the signal specific to this build — which receipts and which machine-readable documents were fetched, and by what.
5. **That signal moves two things, not one.** It moves the priors and class scores, which changes the next allocation. And it moves the **gap list**: a class that responds through a channel the build does not have turns the absence of that channel into a ranked build task. What the build learns about who finds it interesting steers what it builds next, not only who it writes to next.

Step five is the part that makes this different from a marketing pipeline. The output of the loop is not only a message; it is a change to the build's own priorities, produced by evidence about which of its capabilities anyone actually cared about.

There is nothing autonomous about the send. A human reviews every body before a first contact to any class. What is automated is the *reasoning about who and when*, and that reasoning is recorded in a form that can be read back and contradicted. That is the same standard this build applies to every other decision it makes; outreach is not an exception to it.

## The honest state, in numbers

At publication:

- **8,584** records discovered and not yet enriched.
- **680** enriched with a verified address; **814** where no address was found on the target's own site; **18** parked for having no mail server; **7** where no website could be resolved at all.
- **11** drafted and awaiting review; **8** rejected.
- **41** review messages sent to the reviewer, and **1** deliverability test.
- **0** addresses in the suppression table, because no recipient has yet asked to be removed.
- **0** spent on paid delivery for this build, across fifty-eight available advertising rows.
- **0** posts, replies or messages sent about this build on any social or messaging channel.
- **11** emails sent to external recipients — all of them on 2026-07-06, all for a different subject, and all before the confirmation gate existed. That gate exists because of them.

**No party has been contacted about this build.** The machinery above has been exercised end to end for another subject. Its audience logic for this subject has never been run against a real recipient, and the first wave has not been sent.

## Defects, stated before anyone has to find them

1. **The eleven sends are not in the tracking table.** The single-send path updates the record's status and does not write a tracking row, so the send table shows zero outbound messages while eleven records say sent. Two sources of truth that disagree, in the direction that understates activity.
2. **The qualification score has no calibration study.** It gates everything and its error rate is unknown.
3. **The response prior is a declared constant.** Ordering the first wave with it is an estimate presented as an estimate.
4. **Open tracking is unreliable** in both directions, and no engagement number from it should be read as a measurement.
5. **A verified address is a verified domain.** Individual mailboxes are unproven until a message is accepted.
6. **The audience classes are model output about the build's own value,** produced by models that were shown the build's own corpus. A promotion system grading its own targeting is a conflict it cannot resolve from the inside. That is the specific reason the outbound message asks for external audit rather than asserting significance.
7. **The paid lane has no attribution wired to this subject.** The conversion row exists and no conversion definition for this build does, so a paid impression could be bought today and its outcome could not be joined to anything.
8. **The analytics signal is not yet an input to the allocation.** Traffic and referrer data are collected and readable; the equation does not read them. Until it does, step four of the loop is smaller than described here for the free lanes and empty for the paid one.
9. **Nobody outside has adopted this.** It remains the strongest objection, and the number above is the answer rather than an argument.

## What is being asked for

Three questions, and they are the reason a message gets sent at all:

1. **Where is this most commercially valuable, and to whom** — from someone who actually buys in that market.
2. **What is the strongest objection to it** that the objection log does not already contain.
3. **Which of the build's claims about itself do not survive contact with your practice.**

Every one of those has a place to be recorded, publicly and attributed, whether the answer flatters the build or ends it.
`;

async function main() {
  const { token } = await getWriteToken(slug);
  const payload = {
    slug,
    title:
      "Outreach machinery: how this build finds who should see it, writes, sends, and records why",
    body,
    register: "technical",
    tags: ["system", "protocol", "governance", "agents", "marketing"],
    claims,
    sources,
    status: "published",
  };
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-terminal-key": KEY,
      "x-write-token": token,
    },
    body: JSON.stringify(payload),
  });
  console.log(r.status, (await r.text()).slice(0, 600));
}

main();
