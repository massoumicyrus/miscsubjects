# One capability, six ways to call it

The most distinctive fact about this system is not what any one capability does; it is that **the
same capability is reachable a half-dozen ways, with nothing re-implemented for any of them.** A
capability is one row in the `directory` table. Add the row and the thing exists everywhere at once,
because there is only ever the row — no second copy to keep in sync.

Take `NOW`, a capability that returns the current time. It is one row. Here it is, called six ways.

| # | Surface | The call | What it is |
|---|---|---|---|
| 1 | **The door** | `POST /api/dispatch {"key":"NOW"}` | One write path for every capability. Token, tenant and context checks live here, once. |
| 2 | **Plain REST** | `GET /api/dispatch?key=NOW` · `GET /api/manual` | Every capability is REST; one call to the manual returns the exact request for all of them. |
| 3 | **MCP** | tool `NOW` | The same rows appear as tools in any Model Context Protocol client — no glue code. |
| 4 | **The router agent** | `[NOW][/NOW]` | The conversational router speaks one grammar; a capability is called by naming it in tags mid-turn. |
| 5 | **A spreadsheet** | `=INVOKE("NOW")`, or write it into a shared-sheet inbox | Call it from a formula, or write the call into a Google Sheet the build reads as an inbox (see [COLD_MODELS.md](COLD_MODELS.md)). |
| 6 | **A browser model** | `[NOW][/NOW]` → the relay | A logged-in web model emits the same tags; the relay runs them under the caller's authority, no API key on their side. |

And they **compose**: a seventh and eighth way are flows chaining rows ([FLOWS.md](FLOWS.md)) and any
ledger event triggering one (the event bridge, [ARCHITECTURE.md](ARCHITECTURE.md) §6) — still the same
row, no new plumbing.

## Why this is the whole design

- **One door, not many.** Every call routes through `POST /api/dispatch`, so authorization, tenancy
  and the capability-context gate are enforced in exactly one place, and all six surfaces inherit it.
  See [AUTHORITY.md](AUTHORITY.md).
- **One row, no second copy.** The same rows are the API, the MCP tools, the agent's tools, the
  generated manual, and the spreadsheet cells. Nothing can drift, because there is nothing to sync.
- **Self-describing.** `GET /api/dispatch?key=NOW` returns the row's own `_self` block — what it is,
  how to run it, how to change it, where to look next — so a caller on any surface is oriented
  without external docs. This is the Object Invocation Protocol; see [OIP.md](OIP.md).

Live: [a row describing itself](https://miscsubjects.com/api/dispatch?key=NOW) ·
[the whole manual, one call](https://miscsubjects.com/api/manual) ·
[every capability](https://miscsubjects.com/api/directory?brief=1).
