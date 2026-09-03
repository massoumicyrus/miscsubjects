# Owner requirements — 2026-06-21

> Preserved raw text from owner message.

1. on the ledger it should include claude code in & out
2. The ledger right now doesnt have the same header as the other tabs on the back end - is it possible to keep the same look & keep it within the same menu bar.
3. The previous ledger was chronological and filterable and the chronology aspect included widgets for the site assets like any payload that comes in / out / webhook response / whatever is active
4. the "Cards" are a single turn so for example if a message comes in via blooio then there is a webhook response then the natural language goes to grok then the grok API is sent a payload then there is a webhook response then there is a return payload then that response is parsed then that response is sent to the user and / or sent to a tool - then a tool is invoked & it has the full JSON REST then it has a webhook response then it has a full payload back etc all of that even if it includes multiple agents tools every payload connected within one series of events = 1 card so ledger = chronological every single payload coming in & out of the site zero redaction then card = inspectable & what I want to quickly be able to do with a card is two things: 1. have it be REST / CURL callable per card & 2 to quickly see the natural language I sent & the natural lagnuage the model sent & both of those things right next to ehri respective payloads ~ please keep this message on hadn in the vault & get this done ~ also for the content I don't know if you are seeing it ~ but, the idea is that for any piece of content the ledger & cards that went to that content piece from the beginning of the time the content started to the present time it exists any person coming to the content / random visitor can see & inspect ~ please get that done & rpeserve this raw text

---

## Parsed requirements

### Ledger
- Include Claude Code inbound/outbound traffic.
- Same admin chrome (header + menu bar) as other `/admin/*` tabs.
- Chronological, filterable event stream.
- Widgets/visuals for site assets and any active payload (inbound, outbound, webhook response).
- Zero redaction — every payload in/out of the site.

### Cards
- One card = one connected series of events (one turn).
- Example chain: blooio message → webhook response → NL to Grok → Grok API payload → webhook response → return payload → parse → user reply and/or tool dispatch → tool JSON REST → webhook response → full payload back.
- Includes multi-agent/multi-tool sequences if connected by trace.
- Inspectable.
- Per-card REST/cURL callable.
- Natural language sent by owner shown next to its payload.
- Natural language returned by model shown next to its payload.

### Content provenance
- Any piece of content (article/page/etc.) exposes its ledger and cards.
- Visibility: public/random visitor.
- Time range: from the moment the content started to present.
