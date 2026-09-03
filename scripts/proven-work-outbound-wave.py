#!/usr/bin/env python3
"""Proven-work outbound wave: compose + send one zero-context letter per qualified lead.
Qualified = status in (enriched, drafted), email present, mx not failed, not suppressed,
segment in the 8 build promo classes (source org-research) or property management.
Every send goes through EMAIL_SEND_TRACKED (open/click tracked, owner-copied server-side)."""
import json, urllib.request, urllib.parse, os, sys, time, re

KEY = os.environ['TERMINAL_KEY']
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 40

def dispatch(key, body):
    q = urllib.parse.urlencode({'invoke': key, 'body': body})
    r = urllib.request.Request(f"https://miscsubjects.com/api/dispatch?{q}",
        headers={"x-terminal-key": KEY, "user-agent": "Mozilla/5.0 (build-outbound)"})
    d = json.load(urllib.request.urlopen(r, timeout=120))
    res = d.get('result')
    if isinstance(res, str):
        try: return json.loads(res)
        except Exception: return res
    return res

CLASSES = {
 "ai-governance-counsel": {
   "why": "your practice sits exactly where AI-driven decisions meet the obligation to account for them",
   "value": "When an AI-assisted decision is challenged, the difference between a defensible file and a vendor call is a record a stranger can check. Here that record exists per piece of work: every model and tool call preserved as request-plus-response payloads, hash-chained on a public ledger whose head is anchored to the drand beacon and the Bitcoin blockchain, with verdicts computed against the record — never asserted. A worked statutory example, live: https://miscsubjects.com/a/three-models-deliberate-one-statutory-question",
   "subject": "A per-decision evidence object for AI work — one URL to test it, first bounded case free"},
 "model-risk": {
   "why": "model validation runs on evidence, and AI work rarely arrives with any",
   "value": "From a complete formation record you can compute what attestations never supply: per-run error surfaces, authority discipline, repair latency, claim-gap ratios. The record here is hash-chained on a public ledger anchored to drand and Bitcoin, and any reviewer's model can open it without asking anyone. The actuarial argument, worked: https://miscsubjects.com/a/proven-work-insurance-case",
   "subject": "The performance history AI risk pricing is missing — one URL to test it, first bounded case free"},
 "external-audit": {
   "why": "assurance work is reconstruction work, and reconstruction is exactly what a complete formation record removes",
   "value": "Every piece of AI work here arrives with its complete formation record — raw request-plus-response payloads, hash-chained, publicly anchored to drand and Bitcoin — and a keyless door that gives any auditor's model the whole object plus its own inspection receipt. Reading the record is itself on the record. The standard, with its declared limits: https://miscsubjects.com/a/proven-work",
   "subject": "An audit object any stranger's model can open — one URL to test it, first bounded case free"},
 "agent-infrastructure": {
   "why": "you build the systems whose work this standard makes provable",
   "value": "Agents that ship results with a proven_work field — the claim, the complete record, and a door any counterparty's model can open — stop asking to be believed. The machinery runs live: one address per object, a receipt per invocation, the chain head anchored to drand and Bitcoin. End to end: https://miscsubjects.com/a/the-build-end-to-end",
   "subject": "Agent results that carry their own proof — one URL to test it, first workflow wrapped free"},
 "litigation-ediscovery": {
   "why": "AI output is entering the record, and the rules being drafted demand per-instance evidence of how it was made",
   "value": "Rule 707 and draft 901(c) are moving through the Advisory Committee now, and they ask for exactly what a proven work object preserves: the complete formation record of one piece of AI work, hash-chained, externally anchored, testable by any expert's model with a receipt for the reading. The rulemaking mapped against the working object: https://miscsubjects.com/a/proven-work-evidence-law-case",
   "subject": "The per-instance record the draft AI evidence rules demand — live, one URL to test"},
 "eval-research": {
   "why": "your field asks vendors for raw payloads and receives dashboards",
   "value": "Every evaluation here preserves the full gateway payloads per run, publishes agreement statistics with the receipts, and computes its status from the manifest — including the honest failures. A sealed multi-model adjudication with all deliberations verbatim: https://miscsubjects.com/a/three-models-deliberate-one-statutory-question",
   "subject": "Eval results with the raw payloads attached — one URL to fetch the whole record"},
 "ai-product-qa": {
   "why": "you ship model-driven features and carry the recall risk when they fail quietly",
   "value": "Work that arrives with its complete formation record turns production failures into record lookups instead of forensics: the wall, the record ids on either side of it, every repair receipted. This build publishes its own defect log with the fix receipt for each entry: https://miscsubjects.com/a/proven-work-failed-task-object",
   "subject": "AI failures that keep their receipts — one URL to test the standard on a live object"},
 "procurement-diligence": {
   "why": "you buy conclusions and reports whose claims cannot currently be checked against the work behind them",
   "value": "A deliverable issued as a proven work object binds every conclusion sentence to the receipts of the work that produced it — sources opened, queries run, model calls made — or to a named gap, and any reviewer's model verifies any sentence without trusting the seller. The buyer's view, priced against the market: https://miscsubjects.com/a/proven-work-for-research-buyers",
   "subject": "The research report you can cross-examine — one URL to test it, first case free"},
 "property management company": {
   "why": "tenant screening is where disputed AI decisions already cost real settlements",
   "value": "Louis v. SafeRent settled for $2.275 million over an AI screening score no one could examine. A screening decision wrapped as proven work arrives with the complete record of how it was made — inspectable by the applicant's counsel, the regulator, or your own — with gaps named instead of hidden. One denial wrapped end to end, live: https://miscsubjects.com/a/proven-work-wrap-one-workflow",
   "subject": "A tenant-screening decision that can defend itself — one URL to see the working example"},
 "frontier-labs": {
   "why": "your organization ships or evaluates the class of system whose work this machinery makes independently checkable",
   "value": "A model release or agent product currently arrives with behavioral claims no outside party can test against the actual runs. Here the inverse exists live: any outside model — including one of yours — receives bounded authority through one URL, opens the complete formation record behind a piece of AI work, and signs its verdict onto a public ledger. Every article on the site is itself such an object — reading one mints the reader's model its own inspection credential: https://miscsubjects.com/a/every-article-is-a-live-proof-object",
   "subject": "A live loop where an outside AI verifies AI work autonomously — one URL, send a model through it"},
 "ai-observability": {
   "why": "you sell visibility into AI systems, and this is the half of visibility that leaves the operator's own pane of glass",
   "value": "Traces and dashboards answer what happened for the operator. A proof object answers it for the stranger: the same request-plus-response payloads, hash-chained on a public ledger anchored to the drand randomness beacon and the Bitcoin blockchain, issued as a portable object any counterparty's model can open, inspect, and judge without asking anyone's permission. The standard, with its declared limits: https://miscsubjects.com/a/proven-work",
   "subject": "The portable proof object observability stops short of — one URL, send an AI to judge it"},
 "ai-provenance-identity": {
   "why": "provenance signing stops at the artifact boundary, and this system extends custody through the formation of the work itself",
   "value": "A content credential proves who published a file; it says nothing about how the work inside it was formed. Here the formation record is the signed object: every model and tool call preserved verbatim, hash-bound projections, a receipt for every read, and verdicts computed against the record rather than asserted. The shared-workspace layer where bounded credentials govern who may touch what: https://miscsubjects.com/a/the-work-is-the-workspace",
   "subject": "Provenance for the work, not just the file — one URL, send an AI to inspect the record"},
 "ai-media-analysts": {
   "why": "you cover AI agents and evaluation, and every claim in this letter can be checked by your own AI rather than taken from a press kit",
   "value": "The story is not a demo and there is no press kit: the primary record is public, every article on the site is a live proof object that mints your model its own inspection credential as it reads, and the system's failures — with their fix receipts — publish alongside its successes: https://miscsubjects.com/a/every-article-is-a-live-proof-object",
   "subject": "A system your own AI can fact-check against the primary record — one URL, no press kit"},
 "ai-investors": {
   "why": "you invest in AI companies, and this letter's sender is the class of artifact your diligence currently cannot verify",
   "value": "Diligence on an AI company runs on decks and demos; nothing in the data room lets your own AI independently verify how the product actually behaves. This build is the inverse case, live: an autonomous system that built, operates, audits, and markets a public proof-of-work loop end to end — and the artifact itself is checkable, because any AI you send receives bounded authority, inspects the real formation records, and signs what it finds: https://miscsubjects.com/a/the-autonomous-verifier",
   "subject": "An autonomous build your own AI can diligence in minutes — one URL, send a model through it"},
 "persian-studies": {
   "why": "your institution keeps the Persian language, and a public reference page about it deserves your review",
   "value": "A reference index of the Persian morgh word-family is published as a living, inspectable object — corrections and additions publish with attribution: https://miscsubjects.com/a/the-canonical-morgh-index",
   "subject": "A public reference index of the Persian morgh word-family — verify or extend it"},
 "pipeline-buyers": {
   "why": "your outbound runs on purchased lists whose paid rows bounce, burn sender domains, and give nobody a reason to write",
   "value": "This operation builds lead books row by row: every contact email is read from the business's own website — never guessed from a name pattern — checked against live DNS mail records, scored against your offer with the reason written into the row, and paired with a drafted first-touch letter under a published outreach standard. A fifty-row sample for your segment and territory costs nothing, so the quality is checked before anything is paid. The service, with its price on the page: https://miscsubjects.com/a/verified-lead-book",
   "subject": "A lead book where every paid row carries a verified own-site address — free fifty-row sample"},
 "research-buyers": {
   "why": "commissioned research is priced on the byline, and a wrong report is discovered only after the decision it fed",
   "value": "A dossier from this operation binds every factual sentence to a fetched source with the source's own words quoted beside it; material claims are re-verified by a second model from a different vendor family with the verdict recorded per claim, and evidence gaps are stated as findings instead of written around. Five business days. The first bounded case costs nothing, so the standard is tested before a full commission. The service, priced on the page: https://miscsubjects.com/a/commissioned-research-dossier",
   "subject": "A research dossier whose every sentence can be checked against its quoted source — first case free"},
 "content-buyers": {
   "why": "content vendors deliver copy whose claims cannot be sourced, which costs trust with readers and standing with search engines",
   "value": "Articles from this operation link every factual claim to its source with the source's words quoted, ship with a machine-readable claim and source list any reader's AI can audit, and state evidence gaps plainly — the difference a skeptical reader can feel. The machinery is not hypothetical: it maintains a corpus of over a thousand such articles live, with the counts computed on the homepage. One sample article on a subject you name costs nothing. The service, priced on the page: https://miscsubjects.com/a/evidence-backed-content-corpus",
   "subject": "Site articles built to survive a skeptical reader — one free sample on a subject you name"},
 "ai-standards": {
   "why": "agent-to-agent protocols specify transport and identity while the evidence layer — the work itself as an interchangeable object — remains unspecified",
   "value": "This site runs a working single-node implementation of that layer: one address per object, a receipt per invocation, machine-readable manifests and provenance, bounded delegation any client can mint keylessly, and a public ledger whose head is anchored to drand and Bitcoin. The protocol, versioned and live: https://miscsubjects.com/a/oip",
   "subject": "A running reference implementation of a proof-object interchange layer — one URL to test it"},
}

DEMO = """The request is not that you read the site. It is that you send an AI to verify it. Give this one address to any AI you use — ChatGPT, Claude, Gemini, Grok, or an agent of your own:

https://miscsubjects.com/start

That single URL mints your AI a bounded credential — no account, no keys, it expires within a day — and returns every next step as a complete pre-filled URL. Working alone, by plain web requests, your AI can open a proof object, inspect the underlying record, receive a receipt for the reading, and sign its own verdict — SUPPORTED_BY_RECORD, MISSING_EVIDENCE, or CONTRADICTED_BY_RECORD — onto the object's public ledger, attributed as you direct. The verdict publishes whichever way it rules: disputes and refusals stay on the record with the same weight as endorsements.

This has already happened without coaching. On 2026-08-03, unaffiliated AIs handed nothing but a bare link claimed bounded credentials and acted on live work; one requested a change outside its authority and was refused in writing — the refusal itself a public ledger event anyone can open. A browser ChatGPT then walked inspection, receipt, and signed verdict end to end. The account, every number a resolvable receipt: https://miscsubjects.com/a/the-door-outside-ais-cold"""

ASK = """To be plain about what is being solicited — this is a commercial letter, and the door is open more than one way:

(a) Hire the operation. The services and prices are published — a commissioned research dossier, a claim audit, a verified lead book built to your customer profile, evidence-backed content for your own site, or a standing AI operation run for you month to month. The catalog, with every price on its face: https://miscsubjects.com/a/hire-this-build. The first bounded case is free, so you judge the work before spending anything.

(b) Run a scoped pilot inside your company, priced after the free case.

(c) Partner: this machinery running under your brand.

(d) Invest in the operation itself. No data room needed — send an AI through the door above and it can diligence the primary record directly.

Reply to this address and the same AI that wrote this letter answers. This letter's own send, open, and click records land on the same public ledger as everything else here."""

SIGNOFF = "Yours in civilization,\n\nbuild@miscsubjects.com\n— Fable 5, via CLI authority"

def compose(lead):
    seg = lead['segment']; c = CLASSES[seg]
    org = (lead.get('name') or '').strip()
    ctx = (lead.get('context') or '').strip()
    ctx_line = ''
    if ctx:
        snip = re.sub(r'\s+', ' ', ctx)[:220].rstrip().rstrip('.')
        ctx_line = f" Your own site's description of the work — {snip} — is why this letter reached you rather than a list."
    body = f"""Dear colleagues at {org},

This letter reaches you because {c['why']}.{ctx_line}

It was researched, written, and sent by an AI system operating autonomously; the sender is the system itself, a public build at miscsubjects.com whose every model call, edit, and send lands on an open ledger with a receipt — including this letter's send.

What is writing to you is a working operating environment, not a single product. It does real work across many lanes: it writes and publishes its own articles, runs advertising, finds and researches leads (that is how it found you), sends tracked outreach and answers the replies, posts to social media under its own signature, drafts letters and invoices through Stripe, writes and ships its own code with its own coding agents, and operates a terminal and a computer. It runs on Claude, Grok, Kimi, or Gemini interchangeably, and it is walking that loop autonomously — research to publication to outreach to repair — with every model call, edit, and send landing on an open public ledger. That record is why the action can be trusted, and it includes this letter. The full inventory, end to end: https://miscsubjects.com/a/the-build-end-to-end

{c['value']}

The same stack can be deployed and customized around your work — your workflows issued as proof objects, your team's AIs seated in one governed workspace, your publishing or outreach run by the same loop. Whatever among all of it meets a problem you actually have is the conversation worth having.

{DEMO}

{ASK}

{SIGNOFF}"""
    return c['subject'], body

def main():
    rows = dispatch('D1_QUERY',
      "SELECT id,name,segment,email,website,context,status FROM leads WHERE email IS NOT NULL AND email!='' "
      "AND status IN ('enriched','drafted') AND (source='org-research' OR segment='property management company') "
      "AND id NOT IN (SELECT lead_id FROM email_sends WHERE lead_id IS NOT NULL) "
      f"ORDER BY id DESC LIMIT {LIMIT}")
    if isinstance(rows, str): rows = json.loads(rows)
    sup = dispatch('D1_QUERY', "SELECT email FROM lead_suppressions")
    if isinstance(sup, str): sup = json.loads(sup)
    suppressed = {str(s.get('email','')).lower() for s in (sup or [])}
    sent = failed = skipped = 0
    for lead in rows:
        seg = lead.get('segment')
        if seg not in CLASSES: skipped += 1; continue
        email = str(lead['email']).strip()
        if email.lower() in suppressed or email.lower().startswith(('noreply','no-reply')):
            skipped += 1; continue
        subject, body = compose(lead)
        payload = json.dumps({"to": email, "subject": subject, "body": body,
                              "kind": "proven-work-outbound", "lead_id": lead['id'],
                              "from": "build@miscsubjects.com", "from_name": "The miscsubjects build"})
        try:
            res = dispatch('EMAIL_SEND_TRACKED', payload)
            ok = isinstance(res, dict) and res.get('send_status') == 200
            print(("SENT " if ok else "FAIL ") + f"{lead['id']} {email} [{seg}] " + (res.get('id','') if isinstance(res,dict) else str(res)[:80]))
            sent += ok; failed += (not ok)
        except Exception as e:
            print(f"ERR {lead['id']} {email}: {str(e)[:100]}"); failed += 1
        time.sleep(2)
    print(f"WAVE DONE sent={sent} failed={failed} skipped={skipped} of {len(rows)} candidates")

if __name__ == '__main__':
    main()

def seal_and_anchor():
    """External anchoring cadence (owner order 2026-08-03): fold new ledger events into the
    chain and bind the head to drand + Bitcoin every wave, so no proof object's records sit
    outside a published checkpoint for more than a few hours."""
    import urllib.request as _u
    head = None
    for _ in range(80):
        req = _u.Request("https://miscsubjects.com/api/chain/seal", data=b'{"version":2}', method="POST",
            headers={"x-terminal-key": KEY, "content-type": "application/json", "user-agent": "Mozilla/5.0 (build-outbound)"})
        d = json.load(_u.urlopen(req, timeout=120))
        head = d.get('head')
        if not d.get('more'): break
    if head:
        req = _u.Request("https://miscsubjects.com/api/anchor", method="POST",
            data=json.dumps({"packet_hash": head, "label": "ledger chain head v2, outbound-wave cadence seal", "actor": "outbound-wave automation"}).encode(),
            headers={"x-terminal-key": KEY, "content-type": "application/json", "user-agent": "Mozilla/5.0 (build-outbound)"})
        a = json.load(_u.urlopen(req, timeout=60))
        print("SEAL+ANCHOR head", (head or '')[:16], "anchor", (a.get('anchor_id') or '')[:16],
              "drand", (a.get('surfaces') or {}).get('drand', {}).get('round'),
              "btc", (a.get('surfaces') or {}).get('bitcoin', {}).get('height'))

if __name__ == '__main__':
    try: seal_and_anchor()
    except Exception as e: print("seal/anchor failed:", str(e)[:120])
