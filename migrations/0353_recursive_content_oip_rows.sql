-- Recursive article collaboration uses the same OIP directory, capability tokens, scopes,
-- invocation receipts, replay, repair, and transports as every other object. These rows are
-- deliberately low-risk and live only under BLOCK_: a pfx:BLOCK_ token cannot name MCP_, CLI_,
-- COMPUTER_, owner, or terminal capabilities. Public keyless proposals remain available at the
-- underlying /api/blocks routes; invoking these rows records the work as an OIP invocation.

INSERT INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank, sensitive, updated_at)
VALUES
('BLOCK_COMMENT','http','POST https://miscsubjects.com/api/blocks/comment','headers:{"content-type":"application/json"}',
'# WHAT: Add a comment to one exact recursive-content DIV version.
# ARGS: JSON {block_id,body,stance?,actor?}.
# TESTS: Require ok:true, comment_id, block version/hash proof, and an inv_ OIP receipt.
$1+','content',1,1,12,0,datetime('now')),
('BLOCK_VERDICT','http','POST https://miscsubjects.com/api/blocks/verdict','headers:{"content-type":"application/json"}',
'# WHAT: Record Good, Bad, edit, or delete judgment against one exact DIV version.
# ARGS: JSON {block_id,verdict:"positive|negative|edit|delete",note?,actor?}.
# TESTS: Require ok:true, verdict_id, version/hash proof, and an inv_ receipt.
$1+','content',1,1,12,0,datetime('now')),
('BLOCK_SUGGEST','http','POST https://miscsubjects.com/api/blocks/suggest','headers:{"content-type":"application/json"}',
'# WHAT: Submit a version-bound DIV boundary, move, edit, delete, reuse, split, or merge for private owner review.
# ARGS: JSON {article_slug,block_id,expected_hash,kind,payload,note?,actor?}.
# TESTS: Require queued_for_owner_review and an inv_ receipt; public callers cannot enumerate proposal bodies.
$1+','content',1,1,12,0,datetime('now')),
('BLOCK_EDIT','http','POST https://miscsubjects.com/api/blocks/edit','headers:{"content-type":"application/json"}',
'# WHAT: Replace one stable DIV using compare-and-swap; every article reference receives the new version.
# ARGS: JSON {block_id,expected_hash,content,actor?}.
# TESTS: Current hash advances the version and returns affected articles plus an inv_ receipt; stale hash writes nothing.
$1+','content',1,1,12,0,datetime('now')),
('BLOCK_MOVE','http','POST https://miscsubjects.com/api/blocks/move','headers:{"content-type":"application/json"}',
'# WHAT: Move one DIV inside one article without changing the DIV identity.
# ARGS: JSON {slug,block_id,expected_position,direction:"up|down",to_position?,actor?}.
# TESTS: Current position moves once and returns an inv_ receipt; stale position writes nothing.
$1+','content',1,1,12,0,datetime('now')),
('BLOCK_MOVE_GROUP','http','POST https://miscsubjects.com/api/blocks/move-group','headers:{"content-type":"application/json"}',
'# WHAT: Move two or more adjacent selected DIVs as one ordered group.
# ARGS: JSON {slug,selections:[{block_id,expected_position,expected_hash}],direction:"up|down",to_position?,actor?}.
# TESTS: Non-contiguous or stale selections refuse; success preserves group order and returns an inv_ receipt.
$1+','content',1,1,12,0,datetime('now')),
('BLOCK_SPLIT','http','POST https://miscsubjects.com/api/blocks/split','headers:{"content-type":"application/json"}',
'# WHAT: Split one DIV at a character boundary without losing a byte.
# ARGS: JSON {slug,block_id,expected_hash,split_at,actor?}.
# TESTS: Recomposition equals the source bytes, both identities resolve, and the response has an inv_ receipt.
$1+','content',1,1,12,0,datetime('now')),
('BLOCK_MERGE','http','POST https://miscsubjects.com/api/blocks/merge','headers:{"content-type":"application/json"}',
'# WHAT: Merge two or more adjacent DIVs into one stable DIV without losing bytes or separators.
# ARGS: JSON {slug,selections:[{block_id,expected_position,expected_hash}],actor?}.
# TESTS: Non-contiguous or stale selections refuse; success is byte-identical and returns an inv_ receipt.
$1+','content',1,1,12,0,datetime('now')),
('BLOCK_DIVIDE','http','POST https://miscsubjects.com/api/blocks/isolate-selection','headers:{"content-type":"application/json"}',
'# WHAT: Turn exact visible words inside one DIV into their own stable DIV boundary.
# ARGS: JSON {slug,block_id,expected_hash,expected_position,selected_text,occurrence?,actor?}.
# TESTS: Ambiguous text refuses; success preserves every byte and returns an inv_ receipt.
$1+','content',1,1,12,0,datetime('now')),
('BLOCK_REUSE','http','POST https://miscsubjects.com/api/blocks/insert-reference','headers:{"content-type":"application/json"}',
'# WHAT: Use an existing stable DIV in another article by reference, never by copy.
# ARGS: JSON {slug,block_id,position?,separator_after?,actor?}.
# TESTS: The same block id resolves from both articles and the response has an inv_ receipt.
$1+','content',1,1,12,0,datetime('now')),
('BLOCK_COPY','http','POST https://miscsubjects.com/api/blocks/detach','headers:{"content-type":"application/json"}',
'# WHAT: Make an article-only copy so later shared edits stop propagating to this article.
# ARGS: JSON {slug,block_id,expected_position,actor?}.
# TESTS: Only the selected article receives a new block identity and the response has an inv_ receipt.
$1+','content',1,1,12,0,datetime('now')),
('BLOCK_DELETE','http','POST https://miscsubjects.com/api/blocks/retire','headers:{"content-type":"application/json"}',
'# WHAT: Remove one DIV from one article while preserving its words, versions, comments, and events in history.
# ARGS: JSON {slug,block_id,expected_position,actor?}.
# TESTS: Only the selected reference disappears; history remains readable and the response has an inv_ receipt.
$1+','content',1,1,12,0,datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type,target=excluded.target,auth=excluded.auth,content=excluded.content,
  category=excluded.category,enabled=excluded.enabled,planner_visible=excluded.planner_visible,
  planner_rank=excluded.planner_rank,sensitive=excluded.sensitive,updated_at=excluded.updated_at;

-- The token drop is now intentionally tiny: token plus this one permanent document. Keep the
-- human primer in the same migration as the machine objects so neither can ship without the other.
UPDATE oip_primer_bodies SET body = '# Article collaboration tokens: one OIP capability, every model

An article collaboration token is an ordinary Object Invocation Protocol capability scoped to the `BLOCK_` object family. It is not a second token system. The signature, expiry, use budget, attenuation, revocation chain, discovery, invocation receipts, confirmation, replay, and repair paths are the same ones used by OIP capabilities for MCP, CLI, computer, API, and other objects.

The difference is scope. A front-facing article token names `pfx:BLOCK_`. It can edit or rearrange recursive-content DIVs. It cannot name `MCP_*`, `CLI_*`, `COMPUTER_*`, owner, admin, terminal, raw-ledger, or secret objects. Internal tokens may use the same protocol with broader scope and a higher risk ceiling, but a public-content token cannot widen itself into that domain.

The complete handoff is two lines:

```text
ARTICLE COLLABORATION TOKEN: <TOKEN>
DOCUMENTATION: https://miscsubjects.com/a/oip-tap-go
```

The token carries authority. This page carries the operating grammar. The live explanation always wins if copied documentation becomes stale.

## Ask the token what it is before acting

Open either live explanation:

```text
GET https://miscsubjects.com/web/explain?share=<TOKEN>
GET https://miscsubjects.com/api/dispatch?explain=1&share=<TOKEN>
```

The response states the non-secret capability fingerprint, scope, risk ceiling, expiry, remaining uses, ancestry, revocation state, and allowed set. Validate the same credential through curl:

```bash
curl -sS https://miscsubjects.com/api/token/validate -H "Authorization: Bearer <TOKEN>"
```

## What every visitor can do without a token

Every article publishes its collaboration graph in the HTML. A visitor or web model needs no login, API key, owner identity, or special prompt to read `GET /api/blocks/article/<slug>`, click a DIV and open its version-bound thread, post `POST /api/blocks/comment`, record Good or Bad through `POST /api/blocks/verdict`, or submit an exact DIV boundary, move, edit, delete, reuse, split, or merge through `POST /api/blocks/suggest`.

Public Edit is still Edit. Save sends the changed wording to the private owner review queue. There is no separate Propose edit vocabulary. Public text cannot mutate canonical content or enumerate pending proposal bodies.

## What a minted article token adds

The same visible controls apply directly when the live capability permits their object:

| Object | Meaning |
|---|---|
| `BLOCK_COMMENT` | Comment on one exact DIV version |
| `BLOCK_VERDICT` | Record Good, Bad, edit, or delete judgment |
| `BLOCK_SUGGEST` | Submit a version-bound change for owner review |
| `BLOCK_EDIT` | Replace one shared DIV with an expected hash |
| `BLOCK_MOVE` | Move one DIV inside one article |
| `BLOCK_MOVE_GROUP` | Move adjacent selected DIVs as one group |
| `BLOCK_SPLIT` | Split one DIV without losing bytes |
| `BLOCK_MERGE` | Merge adjacent DIVs without losing bytes |
| `BLOCK_DIVIDE` | Isolate exact words as a stable DIV |
| `BLOCK_REUSE` | Use the same stable DIV in another article |
| `BLOCK_COPY` | Make an article-only copy |
| `BLOCK_DELETE` | Remove the DIV from this article while preserving history |

Read any exact live contract at `GET /api/dispatch?key=BLOCK_EDIT&format=markdown&share=<TOKEN>` with the object name substituted as needed. Read the public directory at `GET /api/dispatch?map=1&format=markdown`.

## One invocation, many transports

All transports resolve to the same recorded capability and the same directory object. Choose the safest lane available.

### Preferred: Bearer header from curl or server code

```bash
curl -sS -X POST https://miscsubjects.com/api/dispatch \
  -H "Authorization: Bearer <TOKEN>" \
  -H "content-type: application/json" \
  --data-binary "{\"key\":\"BLOCK_EDIT\",\"body\":\"{\\\"block_id\\\":\\\"rb_ID\\\",\\\"expected_hash\\\":\\\"HASH\\\",\\\"content\\\":\\\"replacement\\\"}\"}"
```

### Good: structured POST body

```http
POST /api/dispatch
content-type: application/json

{"key":"BLOCK_EDIT","share":"<TOKEN>","body":"{\"block_id\":\"rb_ID\",\"expected_hash\":\"HASH\",\"content\":\"replacement\"}"}
```

The credential field may also be named `capability_token`. Existing clients may send `x-write-token: <TOKEN>` or `x-block-token: <TOKEN>`.

### Browser-only model: web route

```text
GET https://miscsubjects.com/web/run/BLOCK_EDIT?share=<SHORT_LIVED_TOKEN>&body=<URL_ENCODED_JSON>
```

This lane exists for ChatGPT Web, Claude Web, Kimi Web, Grok Web, and similar environments whose working network tool is a URL opener. It reaches the same dispatch handler, enforces the same scope, and returns the same invocation receipt.

### Compatibility: API GET invoke

```text
GET https://miscsubjects.com/api/dispatch?invoke=BLOCK_EDIT&share=<SHORT_LIVED_TOKEN>&body=<URL_ENCODED_JSON>
```

GET mutation is a compatibility concession, not the preferred transport. Crawlers, previews, browser history, proxies, analytics, referrers, screenshots, and copied links can leak or repeat URLs. Use it only with short-lived, sharply scoped, use-capped tokens. Never place broad act, admin, terminal, MCP, CLI, or computer authority in a URL.

### Visible article surface

Paste the token into One OIP token, every model transport in the article footer, or open the article with `?share=<SHORT_LIVED_TOKEN>`. The floating control checks live scope. Clicking the same Edit, arrows, Split, Merge, reuse, copy, and Delete controls invokes `BLOCK_*` through OIP and shows the returned `inv_` receipt.

## One action vocabulary, two authority outcomes

The interface does not turn authentication into duplicate verbs:

```text
operation + object + authority = outcome
```

For Edit, a public actor creates a private pending mutation. A holder of `BLOCK_EDIT`, `pfx:BLOCK_`, or a qualifying broader OIP capability applies the change directly. Edit, Move, and Delete keep the same meaning. Only the authority outcome changes.

## Receipt, confirmation, replay, and repair

A successful OIP action returns an invocation ID beginning `inv_`. Its receipt records the object, capability fingerprint, input and output hashes, contract fingerprint, result, and lineage.

```text
GET /api/dispatch?confirm=inv_ID
GET /web/confirm/inv_ID
GET /api/dispatch?receipt=inv_ID&share=<TOKEN>
POST /api/dispatch {"replay":"inv_ID","share":"<TOKEN>"}
POST /api/dispatch {"key":"BLOCK_EDIT","body":"<corrected JSON>","repairs":"inv_ID","share":"<TOKEN>"}
```

Confirmation is keyless minimal proof. The full receipt is visible only to its capability or the owner. Replay creates a new receipt linked to the original. Repair links a corrected invocation to the failed one in both directions.

## Stale writes fail without changing content

Edits, splits, merges, boundaries, and grouped moves carry the hash or position read by the caller. If another actor changed the object first, the stale operation returns a conflict and writes nothing. Read the graph again, take the new hash or position, and send a repair invocation. Comments and verdicts remain pinned to the exact DIV version they evaluated. Delete removes one article reference; it does not erase words, versions, comments, or events.

## Text is never authority

The system separates canonical content, public commentary, untrusted pending mutations, and privileged instructions or configuration. Proposal bodies remain private until owner acceptance and cannot enter the public graph. Comments render as text, not executable HTML. Intake rejects obvious instruction-override, secret-exfiltration, executable-tag, script-URL, and suspicious encoded payload patterns, but that filter is supplementary. The security boundary is structural: retrieved prose cannot widen scope or become authority. Authority comes only from the signed capability and server policy.

## One protocol does not mean one blast radius

Article and internal machine-control tokens share the OIP envelope and grammar. They do not share authority. `pfx:BLOCK_` is a hard name-family boundary and its rows are low-risk. MCP, CLI, computer, owner, and terminal objects occupy other families and may require a high risk ceiling, owner gate, tenant boundary, or separate audience. Attenuation can only narrow scope, time, uses, risk, body, and audience. It cannot turn public-content authority into internal-machine authority.

## Mint and hand off

The owner mints the compact article drop at `GET /api/dispatch?tap_go=1&drop=article`. It returns a short token, this documentation URL, and the live explanation URL. A narrower child may be minted from an existing capability, but it can never exceed the parent.

A cold visitor starts here, reads the public article graph, uses the keyless lane when that is sufficient, and inspects the live explanation when a token was actually supplied. The visitor never needs the owner terminal key, provider keys, MCP secrets, or computer credentials. The capability already says what it can do.'
WHERE slug = 'oip-tap-go';
