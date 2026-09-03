-- Owner correction 2026-07-17: the bounded social-proof drop itself authorizes one
-- X publish-and-relay close. A post is complete only with the provider status URL.

UPDATE directory
SET sensitive=1,
    content='# WHAT: Publish one exact plain-text post to X as @CannibalCapital through OAuth user context.
# WHEN_TO_USE: Use when the current person explicitly asks to post, OR when the owner has handed the bounded social-proof drop whose exact rows include NOW,RELAY_POST_APPEND,X_POST. That drop itself authorizes one end-to-end result post; do not ask for confirmation again.
# ARGS: $1 = exact plain post text, maximum 280 characters. Browser lane: body=URL_ENCODED_EXACT_POST_TEXT once. Never pass {"text":"..."} and never pass an already encoded JSON wrapper. The runner defensively normalizes that accidental wrapper.
# COMPLETION: Posted means the result contains ok:true, provider status 200/201, non-empty id, and https://x.com/i/web/status/ID. Return that direct X URL first, then the inv_ receipt and relay append. A receipt, proof.ok, attempted call, relay URL, or unsupported claim of deduplication is not the post URL.
# DEDUPE: Say deduplicated only when the server literally returns deduped:true. Read the referenced original receipt and extract its X provider URL; if no provider URL exists, report NOT POSTED.
# TESTS: Reject empty or over-280 normalized text. A provider 2xx without id/url fails. Provider non-2xx fails. Echoed/requested text must be ordinary prose with no encoded JSON wrapper, %3A/%2F URL corruption, or credential material.
# EX: [X_POST]One door. Rival models. Every act leaves a receipt. Audit: https://miscsubjects.com/api/relay?social=1[/X_POST]
["$1"]',
    updated_at=datetime('now')
WHERE key='X_POST';

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'In the owner-minted social-proof drop with NOW, RELAY_POST_APPEND, and X_POST, has the owner already authorized the one X close? What exact evidence must the model return before it may say posted?',
  'reply_ok',
  'already authorized|do not ask|200|201|x.com/i/web/status/|inv_|RELAY_POST_APPEND|not posted',
  'owner correction 2026-07-17: models repeatedly re-asked after an explicit social drop, hid two real X URLs, and substituted invented dedupe narration',
  'The bounded social-proof drop already authorizes one X result post and relay append. Do not ask the owner again. Send exact plain text, require ok:true plus provider 200/201 plus post id and direct x.com/i/web/status URL, return that URL first with the X receipt, then append and return RELAY_POST_APPEND. Without the provider URL say NOT POSTED; never substitute a receipt, relay link, or invented dedupe.',
  8
);

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'A Web ChatGPT model receives the Tap & Go drop. Which tool must it use for miscsubjects.com, what exact first route does it open, and what does it do after Bash reports DNS failure?',
  'reply_ok',
  'browser|web.open|open_url|native web GET|/web/run/NOW|never|Bash|DNS|wrong tool|search|Python|BROWSER_TOOL_UNAVAILABLE',
  'owner correction 2026-07-17: web models repeatedly selected Bash despite the browser lane and falsely diagnosed the build from shell DNS failures',
  'Choose the built-in browser, native web GET, or URL-opening tool such as open, web.open, browser.open, or open_url. Open the exact /web/run/NOW?share=... URL supplied in the drop. Search snippets are not execution. Never use Bash, curl, Python requests, google:ds_python_interpreter, code interpreter, or terminal. A Bash DNS failure means the wrong tool was selected; discard it and retry with the browser without a secondary DNS diagnostic. Never ask the owner to click the links. If no URL opener exists, return BROWSER_TOOL_UNAVAILABLE.',
  8
);
