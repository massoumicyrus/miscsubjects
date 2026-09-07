# Sheets and the environment: every object has an address, every sheet is a view

The directory holds the nouns, the ledger holds the verbs, and everything else is a view. The code
is `functions/api/sheets/[[path]].js`, `functions/_lib/sheet_views.js`, `functions/_lib/sheets_store.js`,
`workers/sheet-do/`, `functions/api/environment/[[path]].js`, `functions/_lib/environment_descriptor.js`,
`functions/_lib/environment_manual.js` and `functions/_lib/object_context.js`.

## 1. A sheet is an object

| Surface | Address |
|---|---|
| canonical reference | `sheet://<id>` |
| human page | `/sheet/<id>` |
| self payload | `GET /api/sheets/<id>/self` (`?format=markdown` for a model) |
| visibility | `PATCH /api/sheets/<id> {visibility: "public" or "private"}`, operator only |
| webhook | `POST /api/sheets/<id>/values:append` |
| a token for one sheet | `GET /api/dispatch?mint_share=1&scope=sheet:<id>&ttl=86400`; presented as `?share=` or `Bearer`; it cannot touch other sheets, visibility or delete |

Each sheet is one Durable Object in `workers/sheet-do`: single writer, local reads, WebSocket push
to open grids, spill to R2 when large. Grids are wide and may be password-gated.

## 2. A view sheet stores a description, not rows

`user_sheets.col_meta.view` holds `{source, filters, where, columns, order, limit}`; every open of
the tab re-reads the source, so a view can never drift from the record.

| Part | Meaning |
|---|---|
| `source` | `events` (the ledger), `directory`, `directory_versions`, `agent_turns`, `turn_jobs`, `pending_deliveries`, `articles`, profiles, devices, profile events, capability contexts, web-model sessions and turns, and the traffic tables |
| `filters` | `[{field, op, value}]`, editable from the grid |
| `columns` | `[{path, header, format, w}]`; a path is a source column optionally followed by a JSON path, so `request_json.body.messages[0].content` is the exact text a model was sent |
| `formats` | `text`, `json`, `time`, `number`, `link`, `image` |

A read that fails answers `ok:false` with the error and a sentence saying this is not an empty
result; a read that returns no result set at all is also a failure, never an empty table. The
directory's own workbook tab is a fixed query; new columns appear on view sheets.

**Pins** (`col_meta.pins`, `[{label, ref}]`) sit in a band above the grid and write through:
`directory/<KEY>/<field>` (a directory content write records a version and a ledger row),
`sheet/<id>/<A1>`, `settings/<key>`. Articles are a view source with write-through by hash via
`POST /api/sheets/<id>/write`, so a cell edit lands on the article and nowhere else.

## 3. Sheets by saying so

Creation is plain text: `POST /api/sheets {title, source, columns: "a,b", filter: "f op v"}`. One
verb per change: `/columns`, `/filters`, `/pins:add`, `/columns:remove`. Each verb is also a
`SHEET_*` directory row, so it is visible over MCP and runnable from any client that can reach the
door. Templates (`POST /api/sheets {template, param}`) build the common views in one call.

From any directory view, a row can be run (`POST /api/directory/<KEY>/test`), created or deleted;
a directory row's `invocation` column is the real REST request it makes, and `=INVOKE(cell)` fires it
from a cell with the vault variable swapped in.

## 4. The environment: descriptors and one manual

Every object the environment has is a directory row with a **descriptor** in `descriptor_json`:
schema, operations, source references, relationships, governance attachments, comparables and
representations. Its content hash covers what the descriptor says, never where or how often it was
stored (`hash`, `revision` and the storage address are excluded), so the same contract hashes the
same in a migration seed, a `POST`, a `PATCH` and a re-read, and a gate refuses a drift. Edits are
compare-and-set with `expected_descriptor_rev`; a stale edit is `409 descriptor_revision_stale`.

Canonical references:

```text
environment://miscsubjects       directory://ROUTER          prompt://ROUTER/system
page://admin/sheets              route://GET/api/sheets/{id} model://xai/grok-4.3
sheet://<sheet-id>/<tab>/<range> source://functions/_lib/object_contract.js
law://design/D08                 skill://coding-law
```

| Surface | Returns |
|---|---|
| `GET /api/environment?format=markdown` | the one manual, generated from the descriptors the runtime uses |
| `GET /api/environment/objects?ref=<ref>` | the object's descriptor |
| `GET /api/environment/governance?ref=<ref>` | the rules that govern it, direct and inherited, with the path each arrives by |
| `GET /api/environment/comparables?ref=<ref>` | its comparables |

Every admin page carries one **object-context line** naming its `page://` reference and those three
links, injected by `functions/_middleware.js` so the locked shell renderer never has to be edited; an
unregistered page resolves to `object_not_registered`, which is shown, not hidden.

`scripts/check-environment-contract.mjs` runs the whole contract against a real in-memory SQLite
database in the deploy's pre-phase.

Tests: `functions/_lib/sheet_views.test.mjs`, `functions/_lib/sheet_self.test.mjs`,
`functions/_lib/sheet_writes.test.mjs`, `functions/_lib/environment_descriptor.test.mjs`,
`functions/_lib/environment_comparables.test.mjs`, `functions/_lib/object_context.test.mjs`.
