# The traffic engine

One request in, one decision out, every condition recorded, every decision explainable and
replayable. The decision core is `functions/_lib/traffic/`; the public entry is
`functions/go/[[path]].js`; configuration and evidence are under `functions/api/traffic/[[path]].js`;
the console is `functions/admin/traffic-console.js`. Schema: `migrations/0380_traffic_engine.sql`
and the profile tables in `migrations/ledger/0378_capability_contexts.sql`.

## 1. The pipeline

```
REQUEST → IDENTIFIERS → PROFILE → SIGNALS → POLICY → DECISION → EXPERIENCE
```

| Stage | Module | Does |
|---|---|---|
| identifiers | `store.js` | keyed hashing of every identifier (cookie, device, phone, e-mail); stored hashed and masked, never raw; upserted per tenant |
| profile | `store.js` | resolves the visitor to one profile shared with the authority model (`traffic_profiles`, `traffic_devices`, `traffic_identifiers`, `traffic_events`) |
| signals | `signals.js` | every captured field with its type and meaning: request, network, device, geography, history, memberships, verification state |
| policy | `conditions.js`, `engine.js` | the active ruleset's rules in priority order; each rule is conditions over signals and an action |
| decision | `engine.js` | the action, the experience, the rule that fired, and every rule's every condition as true or false |
| experience | `render.js` | what the visitor sees |

`evaluateContext(signals, configuration)` is pure. `decide()` wraps it with identity resolution,
cookie state, persistence and the ledger. `explain()` runs it on a simulated visitor with no side
effects. `replay(decision)` re-runs a stored decision's own signals against the ruleset revision that
made it and against the live configuration and reports the difference.

## 2. Conditions

A condition is `field op value`. Operators: `in`, `not_in`, `contains`, `not_contains`, `matches`
(regular expression), `between`, `cidr`, `exists`, and the comparison operators. Rules are also
authored in plain English through the console or `POST /api/traffic/rule/plain`:

```
if country in US,CA and risk_score between 0,40 then redirect offer
if network.is_datacenter matches true then deny
```

`GET /api/traffic/fields` lists every field with its type, meaning and example values.

## 3. Experiences

| Experience | The visitor gets |
|---|---|
| redirect | a `302` to a destination, with attribution and query passthrough per the destination's policy |
| inline | a destination rendered in place |
| VERIFY | a Turnstile page; a pass writes `TURNSTILE_PASS` to the profile and stamps the device |
| ACK | an acknowledgement page that records consent |
| DENY | a block, with the reason captured |
| STATIC | a fixed page |
| SQUEEZE | the SMS funnel (§4) |

Squeeze pages and destinations carry **versions**: a squeeze page splits by version weight, and a
weighted group destination splits across its members, sticky per visitor, so both the squeeze and
the destination page are version-tested.

## 4. Grants and the SMS funnel

A squeeze page shows a one-time code. The visitor texts `JOIN <code>` to the build's number; the
inbound path (`inbound_hook.js`) recognises a live funnel code before any agent sees the message,
joins the phone identity to the profile, re-runs policy, and answers. An approved visitor receives a
signed HMAC **grant** (`grants.js`), redeemed once at `/go/_/enter?g=<token>`: the grant is verified
for signature and expiry (its audience is the destination host), the destination is resolved and
gated, and a second redemption is `410`. `/go/_/dest/<id>` renders one destination by id for the
blocked and review hand-over pages. Memberships such as `sms_verified:approved` persist on the
profile and are signals on the next visit.

## 5. Surfaces

| Surface | Auth | Purpose |
|---|---|---|
| `GET /go/<entry>` | none | the splitter |
| `GET /go/_/enter?g=`, `/go/_/dest/<id>` | none | redeem a grant; render a destination |
| `POST /api/traffic/turnstile/verify`, `/ack`, `GET /api/traffic/sms/status`, `/sms/tap` | none | visitor actions |
| `POST /api/traffic/sms/inbound` | `x-traffic-webhook-key` | the messaging platform's webhook |
| `/api/traffic/config`, `/rulesets`, `/rulesets/<id>/activate`, `/rules`, `/rules/plain`, `/rule/plain`, `/fields`, `/squeeze`, `/seed-history`, `/profiles`, `/profiles/link`, `/profiles/<id>`, `/decisions/<id>`, `/grid`, `/metrics`, `/explain`, `/replay/<id>`, `/retention/run`, `/signals` | terminal key or admin session | configuration, the unified profile view, evidence |

The unified profile view shows a visitor's device and phone identifiers, decisions, events,
memberships and the operator operations available on it. `GET /api/traffic/grid` flattens every
decision's signals into one column per field, one row per visitor hit, from the ledger, with
filter, pagination, column toggles and CSV. Every traffic table is also a view-sheet source.

A fault in the API or the webhook returns a named `TRAFFIC_ERROR` with the message and a ledger row,
never a bare `500`. A just-activated ruleset can give mixed experiences for about a minute while
the edge caches warm.

## 6. Configuration names

`TRAFFIC_GRANT_SECRET` signs grants; `TRAFFIC_SMS_WEBHOOK_KEY` authenticates the inbound webhook;
`TRAFFIC_TENANT` names the tenant; `TURNSTILE_SITEKEY` and `TURNSTILE_SECRET_KEY` drive
verification; `TURNSTILE_MAX_AGE_S` bounds how long a pass counts.

The importer for a prior third-party cloaking service's history (`jci_import.js`) is a tenant
module and is a stub in this repository.

Tests: `scripts/traffic-engine.test.mjs` (the engine is importable in Node without Cloudflare).
