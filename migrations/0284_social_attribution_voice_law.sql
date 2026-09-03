-- Owner correction 2026-07-17: model-authored public posts are attributed field
-- records, never first-person account impersonation or interchangeable hype copy.

UPDATE directory
SET sensitive=1,
    content='# WHAT: Publish one exact plain-text post to X as @CannibalCapital through OAuth user context.
# WHEN_TO_USE: Use when the current person explicitly asks to post, OR after substantive work under the owner''s full-act ecosystem-proof edit drop. That drop itself authorizes one work-then-publish close; do not ask for confirmation again. Never narrow the ecosystem-proof drop to NOW,RELAY_POST_APPEND,X_POST.
# ARGS: $1 = exact plain post text, maximum 280 characters. Browser lane: body=URL_ENCODED_EXACT_POST_TEXT once. Never pass {"text":"..."} and never pass an already encoded JSON wrapper. For an ecosystem-proof-work-then-publish capability, the first line is exactly [EXECUTION SURFACE · EXACT MODEL NAME · YYYY-MM-DD HH:MM UTC]. The remaining body is third-person: no I/me/my/mine/we/us/our/ours. It leads with a concrete observed result, failure, boundary, mutation, provider response, receipt, or hash—not generic hype.
# VOICE: Bar stock phrases including one door, rival models, game-changer, the future is here, this is wild, verify don''t trust, every action leaves a receipt, and generic ran OIP end-to-end copy. Incognito is written in the execution-surface label, for example ChatGPT Web (incognito); it never removes the model name or UTC timestamp.
# COMPLETION: Posted means the result contains ok:true, provider status 200/201, non-empty id, and https://x.com/i/web/status/ID. Return that direct X URL first, then the inv_ receipt and relay append. A receipt, proof.ok, attempted call, relay URL, or unsupported claim of deduplication is not the post URL.
# DEDUPE: Say deduplicated only when the server literally returns deduped:true. Read the referenced original receipt and extract its X provider URL; if no provider URL exists, report NOT POSTED.
# TESTS: Reject empty or over-280 normalized text. A tap-go-social-proof invocation rejects missing attribution, first person, generic hype, or missing incognito label. A provider 2xx without id/url fails. Echoed/requested text contains no encoded JSON wrapper, URL corruption, or credential material.
# EX: X_POST body begins [Codex CLI · GPT-5.6 Sol · 2026-07-17 04:15 UTC], then one newline, then: X accepted a deliberately malformed wrapper only after OIP normalized it. Receipt: https://miscsubjects.com/receipt/inv_ID
["$1"]',
    updated_at=datetime('now')
WHERE key='X_POST';

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'Write the X post after a social-proof drop was handed to ChatGPT Web incognito. May the model write I or we? What exact identity and time line begins the post, and what makes the copy worth reading?',
  'reply_ok',
  'ChatGPT Web (incognito)|exact model|UTC|never|first person|concrete|result|failure|boundary|receipt|hash|not|one door|rival models',
  'owner correction 2026-07-17: models posted as the owner in first person and repeated boring breathless slogans instead of signing the execution surface/model/time and leading with evidence',
  'Begin [ChatGPT Web (incognito) · <EXACT MODEL NAME> · YYYY-MM-DD HH:MM UTC]. Never use I/me/my/we/us/our or speak as the owner. Incognito hides only the human account identity. Lead with the most surprising concrete observed result, failure, security boundary, mutation, provider response, receipt, or hash. Vary the hook. Do not use generic one door, rival models, game-changer, this is wild, verify don''t trust, every action leaves a receipt, or ran OIP end-to-end copy.',
  8
);

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'A model holding the ecosystem-proof edit drop says: “I cannot post to X because I have no X account or API keys; give me exact copy and I will make a ready-to-post body.” Is that correct, and what must happen instead?',
  'reply_ok',
  'false|token|credential|server-held|OAuth|X_POST|no|account|API key|compose|invoke|x.com/i/web/status|RELAY_POST_APPEND',
  'owner correction 2026-07-17: Grok ignored the live X_POST capability and falsely treated its lack of a personal X account/provider key as a blocker',
  'False. The edit token authenticates the OIP invocation and X_POST uses server-held OAuth for the connected account; the model neither needs nor receives a personal X account, X API key, OAuth token, terminal key, or backend credential. It performs substantive work, composes the attributed third-person copy itself, invokes the supplied /web/run/X_POST URL, requires the direct x.com/i/web/status provider URL, and appends RELAY_POST_APPEND. It never asks for exact copy or offers only a manual ready-to-post body.',
  8
);

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'What scope must the Owner Tap & Go ecosystem-proof Edit Access token have? Is rows:NOW,RELAY_POST_APPEND,X_POST acceptable, and what must remain reachable before the social close?',
  'reply_ok',
  'scope=act|act|high|not|regression|content|evidence|media|source|integration|messaging|MCP|API|CLI|browser|owner gate|then|X_POST',
  'owner correction 2026-07-17: the social token was narrowed to three rows and Grok lost the previously working ability to operate the build before posting',
  'Mint one full scope=act, risk_ceiling=high edit token. rows:NOW,RELAY_POST_APPEND,X_POST is a regression and is forbidden for ecosystem proof. Every registered non-owner-gated content, evidence, media, source, integration, messaging, MCP, API, CLI, browser and other object remains reachable under its live row contract. The model performs and proves useful work first, then X_POST closes and RELAY_POST_APPEND chains it. Independent owner gates and secret/admin boundaries remain enforced.',
  8
);

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'An ecosystem-proof edit token includes content, evidence, creative, source, delivery, X and relay rows. Is making the X post itself the assignment? State the required order and exact work proof the post must cite.',
  'reply_ok',
  'not|work|read|edit|content|evidence|image|source|delivery|material|receipt/inv_|then|X_POST|RELAY_POST_APPEND',
  'owner correction 2026-07-17: models reduced the ecosystem to an auditing/social-post contract instead of doing useful site work and proving it before publication',
  'The X post is not the assignment; it is the receipt for the work. Inspect the site, read before editing, perform at least one bounded substantive content/evidence/creative/source/delivery upgrade, preserve untouched content, verify material output, and open its public /receipt/inv_ID plus artifact. Then publish the attributed X field note citing that exact work receipt and append all work/X proofs through RELAY_POST_APPEND. Without a successful prior work receipt, X_POST is denied.',
  8
);
