// The lead-scraping + email-outreach loop, packaged for the admin Marketing tab:
// stage map, live data, and one plain-text dump the owner can copy and paste to any model.

// The whole marketing loop, stage by stage, in plain language — written so a model with zero
// context on this build can read it and know exactly how a business goes from "exists in a city"
// to "received a wholesale email". Every stage names the real tool key (invokable via
// POST https://miscsubjects.com/api/dispatch {key, body}) and the real code path.
const PIPELINE = [
  ['1. DISCOVER — find businesses', 'Four scrapers write rows into the D1 `leads` table (status=new, deduped on name+city):\n' +
    '- LEADS_DISCOVER — OpenStreetMap Overpass query per segment (medspa/clinic/wellness/gym/supplement/chiro/massage/weightloss/longevity), keeps only rows with a website or phone.\n' +
    '- LEADS_DISCOVER_PLACES — Google Places text search ("<segment> in <city>"), captures website, phone, address, rating.\n' +
    '- LEADS_DISCOVER_NPI — NPPES federal registry of licensed US providers (authoritative identity + phone + address, no website).\n' +
    '- LEADS_DISCOVER_AI — Grok live web search for businesses the other three miss.\n' +
    'LEADS_SWEEP runs discovery across a list of cities in one call. Code: functions/_lib/fn_runners.js → leadsDiscover / leadsDiscoverPlaces / leadsDiscoverNpi / leadsDiscoverAI / leadsSweep.'],
  ['2. RESOLVE SITES — attach websites', 'LEADS_RESOLVE_SITES / LEADS_FIND_SITES look up siteless rows (NPPES/OSM) by name+city on Google Places and attach the website so the crawler can reach it. Code: leadsResolveSitesPlaces / leadsFindSites.'],
  ['3. ENRICH — get the email + context', 'LEADS_ENRICH crawls up to 9 pages of the lead\'s own site (home, /contact, /contact-us, /about, /team, /providers, /services, /book, /locations). Extracts emails four ways: plain text, mailto: links, JSON-LD "email", and Cloudflare-obfuscated data-cfemail. Junk filter kills placeholders, platform addresses, CDN artifacts. Prefers an address on the lead\'s own domain, then role prefixes (info@, contact@, hello@...). Also captures buying signals into context: booking software (Boulevard/Vagaro/Mindbody/Jane/Acuity/Calendly...), Instagram handle, phone, and the site\'s own title+description. Result: status=enriched (has email) or no_email. LEADS_ENRICH_BATCH does 8 at a time with stale-claim recovery so two workers never double-process. Code: leadsEnrich / leadsEnrichBatch.'],
  ['4. VERIFY MX — is the mailbox real', 'LEADS_VERIFY_MX checks each email domain\'s MX records over DNS-over-HTTPS. mx:ok is stamped into notes; domains with no mail server are parked as no_mx so no draft or send ever wastes a slot on a dead mailbox. Code: leadsVerifyMx.'],
  ['5. SCORE — is this a real buyer', 'LEADS_SCORE_AI: the model scores each enriched+mx:ok lead 0-100 on wholesale fit, grounded in the OUTREACH_DOSSIER — does this business plausibly buy peptides at volume, who the buyer is, realistic volume. Penalizes consumer gyms and marketing-agency pages. Writes score + icp: note (buyer type, volume, reason). Code: leadsScoreAI.'],
  ['6. DRAFT — write the email', 'LEADS_DRAFT_AI refuses unless ALL gates pass: verified email, mx:ok, icp score ≥65, real site context ≥40 chars, recipient not suppressed. The model writes ONE email following the OUTREACH_DOSSIER rules (below on this page): true observation from their site as the opener, 50%-of-listed pricing in one line, the full catalog with prices and product links verbatim, COA + 2-day Dallas shipping + samples line, one soft sample-offer CTA, signed LeoResearch. The draft is then hard-rejected (nothing saved, retry) if it contains clinical/treatment language, AI-tell slop phrases, a bad subject line (must be 2-4 lowercase internal-looking words), or no store mention. Saved on the lead, status=drafted. Code: leadsDraftAI.'],
  ['7. REVIEW — owner approval', 'Drafts are emailed to the owner as "Draft N/5: <Business>" (EMAIL_SEND_TRACKED, kind=draft-review), each showing To + Subject + full body. NOTHING goes to a lead without the owner approving the copy. Code: emailSendTracked.'],
  ['8. SEND — gated release', 'LEADS_SEND requires the literal word CONFIRM. It re-checks every gate at send time: status=drafted, mx:ok, icp ≥65, not suppressed, this address never emailed before, business postal address configured, sending-domain SPF/DKIM/DMARC flag set. Appends the ad-disclosure footer with postal address and a reply-no opt-out. LEADS_SEND_BATCH CONFIRM|N sends up to 25, same gates per lead. Status=sent. Code: leadsSend / leadsSendBatch.'],
  ['9. TRACK — what happened', 'Every send is recorded in the email_sends table. Links in the body are rewritten through /api/t/c/<id> (click tracking) and a 1x1 pixel /api/t/o/<id>.gif counts opens. EMAILS_SENT lists sends with opens/clicks; the Outbox below is the same data. Code: emailSendTracked, functions/api/t/[[path]].js.'],
  ['10. FOLLOW UP — touches 2 and 3', 'LEADS_FOLLOWUPS drafts a 3-touch sequence threaded off the first email (40-60% of positive replies come from touches 2-3). Same review-before-send rule. Code: leadsFollowups.'],
];

function pipelineText() {
  return PIPELINE.map(([title, body]) => title + '\n' + body).join('\n\n');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function loadAll(env) {
  const outbox = (await env.DB.prepare(
    "SELECT id, lead_id, to_email, subject, body, kind, sent_at, send_status, opens, clicks FROM email_sends ORDER BY sent_at DESC LIMIT 50"
  ).all()).results || [];
  const drafts = (await env.DB.prepare(
    "SELECT id, name, segment, city, email, website, score, draft, context, COALESCE(notes,'') notes FROM leads WHERE status='drafted' AND draft IS NOT NULL ORDER BY score DESC, id DESC LIMIT 100"
  ).all()).results || [];
  const dossier = await env.DB.prepare("SELECT content, updated_at FROM directory WHERE key='OUTREACH_DOSSIER'").first();
  const catalog = await env.DB.prepare("SELECT content, updated_at FROM directory WHERE key='OUTREACH_CATALOG'").first();
  const byStatus = (await env.DB.prepare('SELECT status, COUNT(*) n FROM leads GROUP BY status ORDER BY n DESC').all()).results || [];
  let ruleVersions = [];
  try {
    ruleVersions = (await env.DB.prepare('SELECT ts, source, label, full_text FROM outreach_rule_versions ORDER BY ts ASC, id ASC').all()).results || [];
  } catch { ruleVersions = []; }
  return { outbox, drafts, dossier, catalog, byStatus, ruleVersions };
}

function parseDraft(raw) {
  try { const d = JSON.parse(raw || '{}'); return { subject: d.subject || '', body: d.body || '', model: d.model || '', venture: d.venture || '' }; }
  catch { return { subject: '', body: String(raw || ''), model: '', venture: '' }; }
}

// The review packet spec is the owner's, verbatim intent (2026-07-25): a professional,
// self-contained packet for humans and web models. Zero outside context. Real product names
// (Tirzepatide, Retatrutide — internal codes only when documenting a database field, mapped
// immediately). Review scope is scraping quality + email copy only; "No, I don't have feedback."
// is the required answer when there is nothing productive to say.

function fmtDraftMeta(r, d) {
  return 'Lead ' + r.id + ' · ' + r.name + ' · ' + (r.segment || 'segment unknown') + ' · ' + (r.city || 'city unknown')
    + '\nRecipient: ' + (r.email || 'none') + ' · fit score ' + r.score + (d.model ? ' · drafted by ' + d.model : '');
}

function provenance(r, d) {
  const opener = String(d.body || '').split('\n').map(s => s.trim()).filter(Boolean)[1] || '';
  const generic = /^We supply research peptides wholesale/i.test(opener);
  const lines = [];
  lines.push('Personalization fact: ' + (generic ? 'none — no reliable site fact existed, so the draft opens plainly (by rule).' : '"' + opener + '"'));
  lines.push('Source URL: ' + (r.website || 'none on record'));
  lines.push('Scraped source text: ' + (String(r.context || '').trim() || 'none on record'));
  const icp = (String(r.notes || '').match(/icp:\d+[^·\n]*/) || [])[0];
  if (icp) lines.push('Qualification note: ' + icp.trim());
  lines.push('Validator result: passed all copy filters (clinical-claim, banned-phrase, subject-contract, store-mention).');
  return lines.join('\n');
}

export function textDump({ outbox, drafts, dossier, catalog, byStatus, ruleVersions }) {
  const L = [];
  const sends = outbox || [];
  const prospectSends = sends.filter(s => s.kind !== 'draft-review' && s.kind !== 'test');
  const reviewSends = sends.filter(s => s.kind === 'draft-review');
  const testSends = sends.filter(s => s.kind === 'test');

  L.push('LEORESEARCH MARKETING LOOP — REVIEW PACKET');
  L.push('');
  L.push('Review only the scraping quality and the email copy. If you have no productive feedback, reply: "No, I don\'t have feedback."');
  L.push('');
  L.push('Purpose:');
  L.push('This packet shows the complete current state of LeoResearch wholesale outreach so a reviewer can evaluate the scraping quality and email copy. It includes the operating logic, source data available to the writer, exact writing rules, catalog, pipeline counts, and a representative volume of complete drafts.');
  L.push('');
  L.push('Requested review:');
  L.push('Review only:');
  L.push('1. Whether the scraped facts are accurate, specific, and useful for writing.');
  L.push('2. Whether each email sounds credible, direct, and commercially effective.');
  L.push('3. Whether any sentence should be changed or removed.');
  L.push('');
  L.push('Do not provide:');
  L.push('- legal, regulatory, medical, or platform-policy commentary');
  L.push('- generic warnings about research peptides');
  L.push('- commentary about open-rate reliability');
  L.push('- unrelated marketing architecture');
  L.push('- recommendations to rebuild the pipeline');
  L.push('- safety-theater disclaimers');
  L.push('');
  L.push('When there is no productive scraping or copy feedback, answer exactly:');
  L.push('No, I don\'t have feedback.');
  L.push('');
  L.push('Generated at: ' + new Date().toISOString() + '. Source of record: the live LeoResearch outreach database — every draft, rule, count, and send below is read from it at generation time; nothing is mocked or summarized from memory.');
  L.push('');

  L.push('== 1. BUSINESS CONTEXT ==');
  L.push('LeoResearch supplies research peptides wholesale.');
  L.push('The recipient businesses are clinics, medical spas, wellness practices, hormone clinics, longevity practices, and related buyers.');
  L.push('Every catalog item is offered wholesale at 50% of its listed LeoResearch price; the buyer sets their own resale price. White-label service, third-party COAs on every lot (published at https://www.leoresearch.com/coa), samples, and approximately two-day nationwide shipping from Dallas are available.');
  L.push('The outreach objective is to obtain a reply requesting a sample or further purchasing information.');
  L.push('');

  L.push('== 2. COMPLETE PIPELINE — discovery through follow-up ==');
  L.push([
    'Stage 1 — DISCOVER. Purpose: find candidate businesses in a target city and segment. Inputs: segment + city. Four scrapers, each a different source:',
    '  · leadsDiscover queries OpenStreetMap for businesses tagged as spas, clinics, gyms, supplement shops, etc., and keeps only ones with a website or phone.',
    '  · leadsDiscoverPlaces runs a Google Places text search ("medical spa in Naples") and captures website, phone, address, and rating.',
    '  · leadsDiscoverNpi pulls from the US federal registry of licensed providers — authoritative identity, phone, address (no website).',
    '  · leadsDiscoverAI uses live web search for businesses the other three miss.',
    '  Output fields: business name, segment, city, website, phone, address, a context seed, a source tag. Rejection: no website AND no phone → skipped. Duplicates on (name, city) are silently dropped. Effect on the email: none directly — this stage only decides WHO can eventually receive one.',
    'Stage 2 — RESOLVE SITES. Purpose: attach a website to rows that arrived without one (registry/OSM rows), by looking the business up by name + city on Google Places. Without a website the writer has no facts, so this stage decides whether personalization is possible at all.',
    'Stage 3 — ENRICH. Purpose: get a real email address and writing material. leadsEnrich crawls up to 9 pages of the business\'s own site (home, /contact, /contact-us, /about, /team, /providers, /services, /book, /locations). It extracts email addresses four ways (visible text, mailto links, structured data, and de-obfuscated protected addresses), throws away placeholders and platform junk, prefers an address on the business\'s own domain, then role addresses (info@, contact@...). It also captures: the site\'s own title + description, booking software in use (Boulevard, Vagaro, Mindbody, Jane, Acuity, Calendly...), Instagram handle, and phone. Output: email + a context string. Rejection: no email found → status no_email, never drafted. Effect on the email: the context string is the ONLY material the writer may personalize from.',
    'Stage 4 — VERIFY MX. Purpose: never write to a dead domain. Checks each email domain\'s mail (MX) records via DNS. Domains with no mail server are parked. Note the limit honestly: MX proves the DOMAIN accepts mail, not that the individual mailbox is valid — a typo\'d info@ can still bounce.',
    'Stage 5 — SCORE. Purpose: rank commercial fit. leadsScoreAI has a model judge each lead 0-100 on one question — does this business plausibly BUY peptides at volume (clinic protocols, med-spa services, resale) — grounded in the same dossier the writer uses. It writes the score plus buyer type, realistic volume, and a one-line reason. Consumer gyms and marketing-agency pages are penalized. Effect on the email: leads under 65 never get one.',
    'Stage 6 — DRAFT. Purpose: write the email. leadsDraftAI refuses to run unless ALL gates pass: verified email, domain accepts mail, fit score ≥ 65, real site context of at least 40 characters, recipient not suppressed. The model writes ONE email under the rules in section 5. The draft is then destroyed and retried (never saved) if it contains clinical/treatment language, any banned phrase, a promotional-looking subject, or no store mention.',
    'Stage 7 — REVIEW. Purpose: the owner reads every draft before it can send. Nothing reaches a prospect until he says send. This packet is that review surface.',
    'Stage 8 — SEND. Purpose: gated release. leadsSend requires the literal word CONFIRM and re-checks every gate at send time, plus: this address has never been emailed before, the business postal address is configured, and the sending domain\'s authentication is proven. It appends the advertising-disclosure footer with postal address and a reply-no opt-out.',
    'Stage 9 — TRACK. Purpose: know what happened. Every prospect send records delivery status, opens, and clicks.',
    'Stage 10 — FOLLOW UP. Purpose: touches 2 and 3, threaded off the first email (most positive replies come from later touches). Same owner-review rule before anything sends.',
  ].join('\n'));
  L.push('');

  L.push('== 3. SCRAPED DATA AVAILABLE TO THE WRITER ==');
  L.push('For each business the writer can see: business name, segment, city and address, website, email, phone, rating (when Places supplied one), named practitioners (when the site names them), listed services, named compounds, additional locations, booking software, and the site\'s own title and description. Each draft in section 8 shows the source URL and the exact scraped text behind its opener.');
  L.push('Personalization must use a verified fact from the business\'s own site. The writer may NOT infer purchasing behavior, demand, success, intent, or expansion unless the source explicitly states it. When no reliable fact exists, the email opens plainly instead — an invented observation is treated as worse than none.');
  L.push('');

  L.push('== 4. LEAD QUALIFICATION RULES ==');
  L.push('A lead is only draftable when every one of these holds: an email address was found on the business\'s own site; the email\'s domain accepts mail (MX verified — this proves the domain, not the individual mailbox); a model scored it ≥ 65/100 on wholesale-buyer fit with a recorded buyer type and reason; at least 40 characters of real site context exist to write from; the recipient is not on the suppression list; and the same address has never been emailed before (duplicate prevention is enforced again at send time). City/segment matching happens at discovery: leads are scraped per target city and segment, and the draft references only that business\'s own location.');
  L.push('');

  L.push('== 5. COMPLETE WRITING RULES (the full active drafting prompt, verbatim — nothing omitted) ==');
  L.push(dossier ? dossier.content : '(missing)');
  L.push('');

  L.push('== 6. COMPLETE CATALOG (public product names; wholesale = 50% of listed price; internal database codes GLP-2T/GLP-3R map to Tirzepatide/Retatrutide and never appear in emails) ==');
  L.push(catalog ? catalog.content : '(missing)');
  L.push('');

  L.push('== 7. LIVE PIPELINE STATE (leads by status, at generation time) ==');
  for (const r of (byStatus || [])) L.push(r.status + ': ' + r.n);
  L.push('');

  L.push('== 8. DRAFT REVIEW SET — ' + drafts.length + ' complete current drafts, everything needed to judge each one is here ==');
  for (const r of drafts) {
    const d = parseDraft(r.draft);
    L.push('----------------------------------------');
    L.push(fmtDraftMeta(r, d));
    L.push(provenance(r, d));
    L.push('Subject: ' + d.subject);
    L.push('');
    L.push(d.body);
    L.push('');
  }

  L.push('== 9. SENT-EMAIL RESULTS ==');
  L.push('Prospect outreach sends (' + prospectSends.length + '):');
  if (!prospectSends.length) L.push('None yet — no prospect has been emailed; every send so far was internal review or deliverability testing. Reply, sample-request, and order tracking begin with the first approved prospect send.');
  for (const s of prospectSends) {
    L.push('- ' + s.sent_at + ' · to ' + s.to_email + ' · delivered ' + (s.send_status === 200 ? 'yes' : 'no (' + s.send_status + ')') + ' · opens ' + s.opens + ' · clicks ' + s.clicks + ' · Subject: ' + (s.subject || ''));
  }
  L.push('');
  L.push('Internal owner-review emails (' + reviewSends.length + ') and deliverability tests (' + testSends.length + ') are excluded from the review set; they are audit history, not outreach. Appendix below.');
  L.push('');

  L.push('== 10. REVIEW RESPONSE FORMAT ==');
  L.push('For each draft, respond with only productive scraping or copy feedback.');
  L.push('Use:');
  L.push('KEEP — [what works and why]');
  L.push('CHANGE — [exact replacement or correction]');
  L.push('DELETE — [what should be removed and why]');
  L.push('Do not discuss adjacent issues.');
  L.push('When a draft has no productive defect, write:');
  L.push('No, I don\'t have feedback.');
  L.push('');

  L.push('== 11. RULE CHANGE HISTORY — EVERY VERSION OF THE WRITING LOGIC, VERBATIM ==');
  const rv = ruleVersions || [];
  if (!rv.length) {
    L.push('No rule versions recorded.');
  } else {
    L.push('Every block below is the complete rule text that was in force at that timestamp — the drafting prompt the model receives, the outreach-law rule file, and the live drafting-rules row. Nothing is summarized. Read them in order to see exactly which clause changed and when the emails changed with it.');
    L.push('');
    for (const v of rv) {
      L.push('--- ' + v.ts + ' · ' + v.source + ' · ' + v.label + ' ---');
      L.push(String(v.full_text || ''));
      L.push('');
    }
  }
  L.push('');

  L.push('== APPENDIX: AUDIT HISTORY (internal review emails and tests — not part of the review) ==');
  for (const s of [...reviewSends, ...testSends]) {
    L.push('- ' + s.sent_at + ' · ' + (s.kind || '') + ' · to ' + s.to_email + ' · status ' + s.send_status + ' · Subject: ' + (s.subject || ''));
  }
  return L.join('\n');
}


