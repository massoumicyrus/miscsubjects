# Documentation

Start with the [README](../README.md), then read in this order.

| Document | What it answers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | How a request becomes a receipt: the directory, dispatch and its three gates, execution routing, flows, the ledger and event bridge, the work object, agents in code and in browsers, sheets, the environment, storage, Workers, the traffic engine, content, laws as gates, the coding law, public surfaces |
| [OIP.md](OIP.md) | The Object Invocation Protocol every row answers to: identify, explain, invoke, ledger, yield |
| [SIX_WAYS.md](SIX_WAYS.md) | One capability, six ways to call it — the door, REST, MCP, the agent, a spreadsheet, a browser model |
| [COLD_MODELS.md](COLD_MODELS.md) | Operable by strangers: the token drop, sheets as inboxes, and how well cold models operate the build |
| [AUTHORITY.md](AUTHORITY.md) | The two halves of authority: signed capability tokens and server-side capability contexts; profiles, devices, proof of possession, Turnstile step-up; the fifteen denial codes |
| [FLOWS.md](FLOWS.md) | The flow DSL (`>`, `|`, `$1`, `$PREV`, `JSON:`, `EACH:`, `MERGE:`) and learned flows compiled from ledger traces |
| [WEB_MODELS.md](WEB_MODELS.md) | Logged-in web ChatGPT, Claude, Grok, Gemini and Kimi as execution substrates; receipts; `state://` handles; the relay lane; the sheet bridge |
| [SHEETS.md](SHEETS.md) | Sheets as objects and as views of the record; pins; sheets by saying so; environment descriptors and the generated manual |
| [TRAFFIC.md](TRAFFIC.md) | The traffic engine: identifiers, profile, signals, policy, decision; experiences; grants and the SMS funnel; explain and replay; plain-English rules |
| [SITE_DESIGN_SCHEMA.md](SITE_DESIGN_SCHEMA.md) | The design schema the renderer and the design gates enforce |
| [PUBLISHING.md](PUBLISHING.md) | How this repository is generated from the private operating repository, what travels, what is substituted, and the gates on the output |
| [REPO_MAP.md](REPO_MAP.md) | Every directory and what it is for |

Two documents at the root complete the set: [SECURITY.md](../SECURITY.md) names where credentials
live and every configuration name the code reads, and [API.md](../API.md) mirrors the generated REST
manual for people.

The live system describes itself at [`/start`](https://miscsubjects.com/start) and in the generated
[environment manual](https://miscsubjects.com/api/environment?format=markdown), which is produced
from the same descriptors the runtime uses and therefore cannot drift from it.
