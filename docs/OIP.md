# Object Invocation Protocol (OIP) v0.1

**Status:** Live on production (2026-06-29)  
**Principle:** Every capability is an invokable object — identify, explain, invoke, ledger, yield.

OIP is the operational contract for miscsubjects: natural language compiles to object invocation; knowledge lives in objects; reasoning lives in models; history lives in the ledger.

---

## 1. Surfaces

| Surface | Method | Auth | Purpose |
|---------|--------|------|---------|
| Protocol index | `GET /api/dispatch` | none | Cold bootstrap — endpoints, invariant loop, schema links |
| Object registry | `GET /api/dispatch?registry=1` | none | All enabled directory objects (689+) with read/write/invoke paths |
| Object self | `GET /api/dispatch?key=KEY` | none | `_self` + full object descriptor for one directory key |
| Invocation schema | `GET /api/dispatch?schema=invocation` | none | Canonical invocation event JSON schema |
| Invoke (directory) | `POST /api/dispatch` | `x-terminal-key` | Run any directory row; response includes `invocation` + `yield` |
| Invocation log | `GET /api/invocations` | none | Query yield/waste events from LEDGER |
| Protocol ops | `POST /api/protocol/*` | `x-terminal-key` | Writer queue; responses include `invocation` + `yield` |

Directory fn rows: `OIP_PROTOCOL`, `OIP_REGISTRY` (callable via dispatch).

---

## 2. Invariant loop

```
intent → resolve(object_id)
       → validate(schema)
       → execute(runner)
       → ledger(append)
       → response(data + _self + yield)
       → repair | grow | challenge
```

---

## 3. POST /api/dispatch response envelope

Every authenticated dispatch returns:

```json
{
  "ok": true,
  "trace": "t_abc123",
  "result": "...",
  "cost": 0.0012,
  "invocation": { "id", "ts", "trace_id", "object_id", "material", "waste", "yield", "event_id", "links" },
  "yield": { "tokens_in", "tokens_out", "tokens_total", "cost_usd", "material_outputs", "usd_per_output", "material", "waste" },
  "_self": { "protocol": "OIP", "widget", "invoke", "urls", ... },
  "_oip": { "version": "0.1", "object": { "id", "object_type", "runner", "read", "write", ... } }
}
```

Agent turns accumulate `tokens_in`/`tokens_out` on `ctx`. Dispatch steps link to LEDGER `events` via `invocation.event_id`.

---

## 4. POST /api/protocol/* response envelope

Writer-queue endpoints log to the same `invocations` table:

| Action | object_id | Logs tokens from |
|--------|-----------|------------------|
| `write` | `PROTOCOL_WRITE` | model usage on draft |
| `populate` | `PROTOCOL_POPULATE` | Grok web-search rounds |
| `repair` | `PROTOCOL_REPAIR` | materialized claim count |
| `collaborate` | `PROTOCOL_RUN` | Kimi/Gemini passes |
| `claim` | `PROTOCOL_CLAIM` | claim posted |
| `ingest` | `PROTOCOL_INGEST` | sources ingested |
| `ask` | `ARTICLE_ASK` | question node created |
| `grow` / `run` | `PROTOCOL_RUN` / `GRAPH_GROW` | pipeline tick |

Zero-yield populate (`added=0`) logs `waste=true` when tokens were spent. Phase ladder advances via `pipeline_chain.js` (`phase_exhausted`, `next_focus`).

---

## 5. GET /api/invocations

```bash
BASE=https://miscsubjects.com

# Recent invocations
curl -s "$BASE/api/invocations?limit=20"

# Per-article (writer queue)
curl -s "$BASE/api/invocations?slug=bpc-157&limit=50"

# Waste only (tokens spent, no material output)
curl -s "$BASE/api/invocations?waste=1&limit=50"

# Per dispatch trace
curl -s "$BASE/api/invocations?trace_id=t_abc123"

# Schema
curl -s "$BASE/api/invocations?schema=invocation"
```

Response includes `summary.total_cost_usd`, `material_count`, `waste_count`.

Per-article yield detail also lives at `GET /api/articles/{slug}/contributions` (provenance passes).

---

## 6. Storage

| Store | Binding | Table / location |
|-------|---------|------------------|
| Invocation events | `LEDGER` (`loop-shared-events`) | `invocations` |
| Directory objects | `DB` (`loop-content-spine`) | `directory` |
| Dispatch events | `LEDGER` | `events` |
| Turn costs | `DB` | `turn_costs` |

### Migrations

```bash
# LEDGER — invocation table
wrangler d1 execute loop-shared-events --remote --file=migrations/0195_oip_invocations.sql

# Main DB — OIP_PROTOCOL + OIP_REGISTRY rows
wrangler d1 execute loop-content-spine --remote --file=migrations/0196_oip_directory_rows.sql
```

Local dev (optional parity):

```bash
wrangler d1 execute loop-shared-events --file=migrations/0195_oip_invocations.sql
wrangler d1 execute loop-content-spine --file=migrations/0196_oip_directory_rows.sql
```

---

## 7. Source files

| File | Role |
|------|------|
| `functions/_lib/object_contract.js` | Object descriptors, yield math, wrap envelope |
| `functions/_lib/invocation_log.js` | Append + list invocations |
| `functions/_lib/protocol_invocation.js` | Protocol-path logging + token extraction |
| `functions/api/dispatch.js` | GET protocol/registry; POST envelope + log |
| `functions/api/invocations.js` | GET invocation query API |
| `functions/_lib/self_explain.js` | `oip_protocol`, `oip_registry`, `oip_invocations` features |

---

## 8. Deploy

```bash
cd /Users/owner/miscsubjects-pages
wrangler pages deploy public --project-name=loop-safe-miscsubjects
```

Commits: `18148f2` (OIP v0.1 core), `2a01792` (protocol logging + token yield).

---

## 9. Ops surfaces (v0.2)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/tasks?stats=1` | Queue depth + `invocations_24h` rollup (auth) |
| `GET /api/invocations?stats=1` | 24h material/waste/cost summary |
| `GET /api/articles/{slug}/invocations` | Per-article invocation log |
| `GET /api/invocations?trace_id=` | Group steps from one cron chain |

**Waste iMessage:** when `article_notify=1`, `ledgerChain` sends `wasteNotifyMessage` if a protocol step logs `waste=true` and no other notify fired.

**Trace propagation:** `PROTOCOL_RUN` assigns or reuses `trace_id` on each task; write→populate and populate phase followups carry it in `tasks.body`.

**MCP tools** (`miscsubjects-mcp` worker): `oip_registry`, `oip_invocations`.

Deploy MCP worker after changing `workers/mcp-server/src/index.ts`:
```bash
cd workers/mcp-server && wrangler deploy
```

## 10. What remains (advisable next)

1. **Hourly waste digest** — KV-gated summary iMessage when `waste_rate > 0.5` in rolling 24h (not per-tick).
2. **Deploy MCP worker** — `oip_registry` / `oip_invocations` tools need `wrangler deploy` on `workers/mcp-server`.
3. **Uncommitted local WIP** — `ledger_matrix`, `meta_leads`, `functions/api/matrix/` not on main.
4. **Router OIP** — `POST /api/protocol/router` logs invocations but object_id is generic `PROTOCOL_RUN`; split if router needs distinct yield.
## 11. OIP v0.2 — receipt / replay / repair (shipped + proven 2026-07-01)

The v0.1 loop ended at `ledger(append)`. v0.2 closes it: every invocation is now a
first-class object you can read back, re-fire, and repair — by URL, with lineage.

**The canon (six verbs, all on `/api/dispatch`):**

| Verb | Wire shape | What it does |
|---|---|---|
| DESCRIBE | `GET ?key=KEY` / `?registry=1` / `?ask=...` | object explains itself |
| SHAPE (dry-run) | `POST {key, body, shape:true}` | fully-shaped outbound payload, never fires, never ledgers |
| INVOKE | `POST {key, body}` / `GET ?invoke=KEY&body=...&share=...` | fires; envelope now carries `invocation.links.receipt` |
| RECEIPT (verify) | `GET ?receipt=inv_ID` (read-token gated) | full recorded request + response (R2 overflow included) + lineage + the verbs that act on it |
| REPLAY | `POST {replay:"inv_ID"}` | re-fires that invocation's object with its recorded input (from the linked event's `request_json`); new receipt links `replay_of` |
| REPAIR | `POST {key, body, repairs:"inv_ID"}` | corrected re-fire; new receipt links `repairs`, old receipt gains `repaired_by` (validated — unknown id → 404, lineage never dangles) |

**Schema:** migration `0199_oip_receipt_lineage.sql` adds `replay_of`, `repairs`,
`repaired_by` to `invocations` (loop-shared-events), indexed. `logInvocation` writes the
forward links; `linkRepairedBy` stamps the reverse link. `listInvocations` returns all
three plus a `links.receipt` URL per row.

**Code:** `functions/_lib/object_contract.js` (OIP_VERSION 0.2, `receiptPayload`,
lineage in `buildInvocationEvent` + schema + manifest verbs + worked example),
`functions/_lib/invocation_log.js` (`getInvocation`, `linkRepairedBy`, lineage INSERT),
`functions/api/dispatch.js` (GET `?receipt=`, POST `replay`/`repairs`).

**Proof (live, act share token, no terminal key handled after mint):**
- `inv_wvitbmiym6` — NOW invoked, envelope returned its own receipt URL.
- `GET ?receipt=inv_wvitbmiym6` — full request/response + verbs came back.
- `inv_gzi1w138jz` — `{replay:"inv_wvitbmiym6"}` → `replay_of` set, receipt-linked.
- `inv_6ximjestte` — deliberately wrong key `NWO` → `ERR:dispatch:unknown_key:NWO`.
- `inv_a5fwylh2n9` — `{key:"NOW", repairs:"inv_6ximjestte"}` → `repairs` set; the failed
  receipt now reads back `repaired_by: inv_a5fwylh2n9`. Both directions live.
- keyless `?receipt=` → 401. Public manifest announces version 0.2 + all six verbs.

The invariant loop is now:
`intent → resolve → validate → execute → ledger → response(+receipt) → verify(receipt) → replay | repair(linked) | grow | challenge`

A wrong invocation is no longer a dead end in the ledger — it is an addressable object
whose receipt teaches any model exactly how to re-fire or fix it, and the fix points back.

## 12. OIP v0.3 — OIP-Caps: delegated agency objects (shipped + proven 2026-07-01)

A capability URL is exact authority over one object/action/scope/time/use/risk ceiling —
scoped, decaying, explainable, revocable, ledgered, purpose-bound. The signed share token
(`sh.<exp>.<scope>.<uses>.<nonce>.<sig>`) stays the wire credential; the claims it cannot
carry live in the `capabilities` table (migration `0200_oip_capabilities.sql`, LEDGER db),
keyed by `fingerprint = cap_<sha256(token)[0:16]>`. The raw token is never stored or ledgered.

**Surfaces (all query modes on `/api/dispatch`):**

| Verb | Wire shape | Notes |
|---|---|---|
| MINT | `GET ?mint_share=1&scope=row&key=KEY&ttl=600&uses=1&purpose=…&actor=…&risk_ceiling=low\|high&owner_gate=1&body_fixed=…` | owner-only; returns fingerprint + invoke_url + explain_url + revoke_url + ledger_url; mint is ledgered |
| EXPLAIN | `GET ?explain=1&share=TOKEN` (token holder) or `GET ?explain=cap_FP` (read tier) | fingerprint, issuer, actor, purpose, allowed row/verbs, TTL remaining, uses remaining, risk ceiling, owner gate, revocation, ledger trail — never the raw token |
| REVOKE | `GET ?revoke=cap_FP` | owner-only; enforcement fails closed immediately |
| INVOKE | `GET ?invoke=KEY&body=…&share=TOKEN` / `POST {key,body}` with `?share=` | gates enforced on GET **and** POST: scope, expiry, uses, revoked, owner_gate, risk_ceiling vs row.sensitive, body_fixed |

Every attempt — allowed or denied — is ledgered. Invocations carry `actor = cap:<fingerprint>`
(query: `/api/invocations?actor=cap:…`). Lifecycle events (`action = mint | explain | deny | revoke`)
land in LEDGER `events` with the fingerprint and the denial reason
(`scope_mismatch`, `token_exhausted`, `revoked`, `owner_gate_required`,
`risk_ceiling:low<row:high`, `body_not_allowed:fixed_body_only`, `invalid_or_expired_token`).

**NL closure — six directory fn rows (migration `0201_oip_caps_rows.sql`):**
`CAP_MINT`, `CAP_EXPLAIN`, `CAP_REVOKE`, `OIP_RECEIPT`, `OIP_REPLAY`, `OIP_REPAIR`
(`OIP_REPAIR` = the receipt-driven repair agent: derives the corrected key from the failure,
auto-fires only low-risk targets, returns an exact proposal payload for high-risk ones,
writes lineage both directions). ROUTER carries a `## RECEIPTS + CAPABILITY TOKENS (OIP)`
section (backup: `prompts/ROUTER.v_pre_oipcaps.backup.md`).

**Gating shipped with v0.3:** `/api/invocations` and `/api/events/<id>` now require read-tier
auth (key / cookie / share token); `workers/mcp-server` sends the key on `oip_invocations`.

**Proof (live 2026-07-01, ~22:57–23:06Z):** cap_bfca1ad52e52a8ec (row:NOW, 600s, 3 uses) —
explained itself by URL, fired NOW 3× (inv_jd3ublgbi4, inv_e2nn3amhlu, inv_zhjvyh5nhh),
denied UPPER (401 scope_mismatch), denied 4th use (429). cap_e3410d2d6de82165 revoked → 401.
cap_7c8d0cc26a870812 owner-gated → 403. cap_f95744a0a8cf89c8 fixed-body → wrong body 403,
empty body fired the fixed body. cap_eac38e4a0c497fb5 expired → 401. cap_4476ab5412fe674a (act)
ran the full loop keylessly: wrong key NWO2 → inv_y0gtt4uo9k → receipt → repair inv_ycavkmy0wg
(both lineage directions) → replay inv_s238xq2ibd → DEL_ROW denied 403 risk_ceiling.
15 lifecycle events ledgered. ROUTER drove mint/explain/receipt/replay/repair/why-fail/revoke
from plain English (traces t_fo7fqzw8, t_wwttn0y5, t_zsop90kt, t_1l8yk9wl, t_rawne103,
t_vt864v97, t_j21s4mhm).

The loop is now:
`natural language → capability-scoped invocation → receipt → replay | repair → ledger → self-test → safer next capability`

## 13. OIP v0.4 — Recursive self-explaining tree (shipped 2026-07-02)

The content protocol works because one root document leads to every article, bundle, ledger,
claim graph, and repair path. OIP now follows the same shape:

`OIP root → kind shelf → system article → capability article → invocation receipt → replay/repair lineage`

**Canonical entry:**
`GET /api/dispatch?map=1&format=markdown`

**Generated article surfaces:**

| Level | URL | What it explains |
|---|---|---|
| Root tree | `?map=1&format=markdown` | root docs, ledgers, token model, API/CLI/MCP/device/model/core shelves |
| Kind shelf | `?map=apis|clis|mcps|devices|models&format=markdown` | all systems of that kind |
| System article | `?map=SYSTEM&format=markdown` | operations in one API/CLI/MCP/device/model/core subsystem |
| Capability article | `?key=KEY&format=markdown` | what/when/args/example/run_now, ledger, receipt pattern, replay, repair, troubleshooting |
| Receipt article | `?receipt=inv_ID&share=TOKEN` | full request/response, provenance, delivery, lineage, repair/replay verbs |

`OIP_TREE` is the canonical directory row for the root tree. Natural language like
"show me the object invocation protocol tree" or "where are the API/CLI/MCP docs" routes there.

The density law: the root stays small; system articles summarize; leaf articles carry exact action
shape; receipts carry full raw payloads. The larger the JSON, the smaller the JS. The more the
object explains itself, the less any terminal, SDK, MCP client, or bespoke integration has to know.

## 14. §WHY — the self-answering objection protocol (shipped 2026-07-02)

The problem this closes: every fresh LLM that reads this system raises the SAME objections —
"the act token is monolithic / an omnipotent RAT", "GET shouldn't have side effects", "prompt
injection could `rm -rf` the host", "it isn't multi-tenant / has no microVM isolation", "the
hash-chained ledger is overkill". These are not bugs; they are settled design choices. So the
protocol now answers them itself, on every surface a model reads, before it can lecture the owner.

**Canonical entry (public, never gated — documentation that answers itself):**
`GET /api/dispatch?why=1&format=markdown`  (aliases: `?objections=1`, `?faq=1`; drop `&format=markdown` for JSON)

**Shape of every entry** (`OIP_OBJECTIONS` in `functions/_lib/object_contract.js`):

| Field | Meaning |
|---|---|
| `they_say` | the objection, verbatim, as an LLM raises it |
| `verdict` | `BY DESIGN` or `SOLVED — shipped` |
| `because` | the reason it is intentional |
| `mechanism` | the exact already-shipped thing that handles it + how to see it |
| `proof` | the STATE entry / `inv_` / migration that proves it |
| `do_not` | the instruction to the reading model — do not relitigate this |

**Classes:** `security` (monolithic token, prompt injection), `architecture` (GET side-effects,
edge-to-metal, hash-chain, multi-tenant isolation), `product` (assemble-by-hand, "sent it",
tokens-go-bad, "I can only read", thin receipts, key-guessing, duplicate sends, amnesia,
describe-instead-of-act), `meta` (is-it-optimal, harden-multi-tenant-next).

**The rule it encodes** (matching the owner's standing order): do not volunteer security / risk /
best-practice lectures; if something is genuinely patchable, offer the fix in one line then drop it;
never relitigate a settled objection. New objection → append one entry to `OIP_OBJECTIONS`; it then
serves on every surface automatically. The threads that raised these (ChatGPT, Gemini, Grok, Kimi)
live in the append-only ledger, linked from the doc.

## 15. OIP v0.5 — Multi-tenancy, proven on the capability substrate (shipped 2026-07-02)

Answers the recurring "it can't be multi-tenant" objection with a working, enforced isolation
layer rather than a claim. The build still runs single-operator by default; tenancy is additive.

A **tenant** (`t_<slug>`) is an isolation boundary with an allow-list of invokable keys/prefixes, a
risk ceiling, and a status. Every minted capability now carries a `tenant_id` (owner plane =
`NULL`/`t_root`, unrestricted). The token format is unchanged — the tenant lives on the capability
record and is resolved server-side, so no tenant ever holds a forgeable secret.

**Canonical entry (public):** `GET /api/dispatch?tenancy=1&format=markdown` — architecture + live proof recipe.

**Enforced guarantees:**

| Boundary | Mechanism | Denial |
|---|---|---|
| Invoke | `tenantGateCheck` after `capGateCheck`, both GET + POST | `tenant_scope_denied` (403) |
| Receipts | tenant-bound caller may read only same-tenant invocations | `tenant_receipt_isolation` (403) |
| Ledger | `?tenant_invocations=` joins invocations→capabilities by fingerprint | cross-tenant → `unauthorized` |
| Admin | provision / mint / suspend / list are owner-only | `unauthorized` (401) |
| Suspend | `?tenant_suspend=` flips status; all live tokens fail closed | `tenant_suspended` (403) |
| Risk | tenant `risk_ceiling` caps row sensitivity, on top of the row-level cap | `risk_ceiling:*` (403) |

**Owner ops:** `?tenant_create=<name>&keys=<K1,K2>&prefixes=<P>&risk=low`, `?tenant_mint=t_<slug>&scope=act`,
`?tenants=1`, `?tenant_suspend=`/`?tenant_resume=`, `?tenant_invocations=t_<slug>`.

**Storage:** `migrations/0215_multitenancy.sql` on `loop-shared-events` — `tenants` table +
`capabilities.tenant_id` + index. Helpers in `functions/_lib/admin_session.js`
(`createTenant`/`getTenant`/`listTenants`/`setTenantStatus`/`tenantAllowsKey`/`tenantFingerprints`);
gate + query modes in `functions/api/dispatch.js`; doc builders in `functions/_lib/object_contract.js`
(`buildTenancy`/`tenancyMarkdown`/`tenantExplain`).

**Proven live (2026-07-02):** two tenants `t_acme` (NOW, GROK_LEDGER_TAIL) and `t_globex`
(NOW, DIR_GET). acme→DIR_GET and globex→GROK_LEDGER both `tenant_scope_denied`; each fires its own
keys (`ran:true`); globex reading acme's receipt → `tenant_receipt_isolation`; globex reading acme's
ledger → `unauthorized`; a delegated t_acme row token fired by another holder ran and stayed
row-scoped; suspending t_acme made its live token return `tenant_suspended`. Compute isolation for
untrusted CODE (microVMs) remains deliberately out of scope — this proves the auth/data isolation
that multi-tenant delegation actually requires.

## §16 — Conformance (v0.6): the executable protocol proof

"Is OIP a protocol?" is a test, not an opinion. A protocol = defined message formats + invariants + a conformance test. The normative spec is the human article `/a/oip-spec` (14 numbered clauses, MUST language). The conformance suite executes every clause LIVE against production:

```
GET https://miscsubjects.com/api/dispatch?conformance=1&format=markdown
```

Clauses: C1 manifest, C2 object self-description, C3 plain-language discovery, C4 invocation envelope, C5 receipt forensics, C6 replay, C7 repair lineage (both directions), C8 fail-closed, C9 append-only ledger, C10 idempotency, C11 capability scoping, C12 public docs plane, C13 clarity recursion, C14 human/machine duality. Evidence = receipts and public confirm URLs; tokens never echoed. Results cache 120s (KV `oip:conformance`). Implementation: `functions/_lib/oip_conformance.js`. §WHY gained the `not_a_real_protocol` objection pointing at this URL. The OIP voxel graph (typed nodes/edges + adjacency + machine reading order) replaced the voxels stub: `GET /api/articles/oip/voxels`.

### Running the conformance test

1. **Manual run:** open `https://miscsubjects.com/api/dispatch?conformance=1&format=markdown` in a browser or curl it. The response is a markdown report with each clause, status, evidence URL, and any failure details.
2. **CI / cron:** schedule `GET /api/dispatch?conformance=1` via `AUTOMATE_ADD` (e.g. every 60 minutes). The endpoint returns JSON with `ok`, `conformant_count`, `total_clauses`, and `failures`. A non-200 or `ok:false` means the protocol is out of spec.
3. **After a change:** always re-run conformance before declaring OIP work complete. If a clause fails, the evidence URL points to the ledgered invocation that failed; repair that invocation and re-run.
4. **Adding a clause:** edit `functions/_lib/oip_conformance.js`, add a new `C<N>` entry with a descriptive name, a `test` async function that returns `{ok, evidence, detail}`, and increment the total. The suite will pick it up automatically on the next run.
