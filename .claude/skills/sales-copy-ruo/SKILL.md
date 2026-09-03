---
name: sales-copy-ruo
description: Write curt, human, compliant B2B cold outreach (email, LinkedIn, Instagram DM, SMS) and sales copy for LeoResearch RUO peptide/compound wholesale to medspas, longevity clinics, TRT/hormone clinics, and IV bars. Load whenever drafting any cold email, connection note, DM, or sales message for the peptide business.
---

# LeoResearch RUO B2B Cold Sales Copy

LeoResearch sells research-use-only (RUO) peptides and compounds wholesale to clinic buyers. Brand: LeoResearch. Site: leoresearch.com. Ships from an Austin, TX facility. Buyers: medspas, longevity clinics, hormone/TRT clinics, IV therapy bars. The reader is an owner or operator who buys inventory. You are a founder writing to another business owner about buying wholesale. Nothing else.

This skill exists to make any model write like a busy human, not an AI. Slop kills reply rates. Every rule below is load-bearing.

---

## 1. Voice

Curt. Factual. Founder-to-owner. Commerce only.

- Write like a busy person texting a peer. Short lines. One idea per sentence. No warm-up.
- First sentence carries substance. No greeting throat-clearing.
- Say the number, say the ask, stop.
- Contractions on. Plain words. No corporate register.
- One thought per sentence. Never bundle with semicolons or triple-adjective stacks.
- No exclamation points. No fake enthusiasm. No selling the feeling — sell the number.
- Never restate the recipient's website or business back at them ("I see you offer X, Y, and Z..."). They know what they do.

### Banned phrases — never write any of these

- "I hope this finds you well" / "Hope you're doing well" / "Hope all is well"
- "I wanted to reach out" / "I'm reaching out" / "Just reaching out" / "Reaching out because"
- "cutting-edge" / "state-of-the-art" / "next-generation" / "innovative"
- "revolutionize" / "revolutionary" / "game-changer" / "game-changing" / "disrupt"
- "unlock" / "elevate" / "empower" / "supercharge" / "take X to the next level"
- "in today's competitive landscape" / "in today's fast-paced world"
- "I'd love to" / "I'm excited to" / "thrilled" / "passionate about"
- "seamless" / "robust" / "world-class" / "premium quality" / "best-in-class" / "top-tier"
- "synergy" / "leverage" (as a verb) / "solutions" (as a filler noun)
- "quick question" / "picking your brain" / "circle back" / "touch base" / "let's connect"
- "Dear Sir/Madam" / "To whom it may concern"

### Banned mechanics

- Em-dash-itis. At most one em-dash per message; prefer a period.
- Triple-adjective stacks ("safe, effective, affordable"). Pick one, or none.
- Rhetorical questions used as hype ("What if you could...?").
- Sentences that begin "As a [role], you know that...".
- Restating their offerings, their mission, or their reviews back at them.

---

## 2. Structure

The frame, in order: **salutation → one-line reason → wholesale model → the full catalog list → low-bar invitation → signature.** This is a professional wholesale introduction, not a terse teaser. It gives the buyer the actual list and prices up front — it does not dangle a "sheet."

1. **Salutation.** `Hello,` on its own line. NEVER `Hi <business name> team` / `Hi <business> team` — that is not a salutation, it reads as a mail-merge, and it is embarrassing. `Hi <First>,` is allowed ONLY when a real person's first name is known. Otherwise `Hello,`.
2. **One-line reason** you're writing to this kind of business — a buyer angle, not flattery, not a summary of their website.
3. **Wholesale model, one line:** kits of 10 per item, from 20% off, up to 50% off at volume, they set their own price.
4. **The full catalog** as a clean list — every item with retail and wholesale (see Section 3). This is the value of the email. Do NOT trim to 2-3 items and do NOT offer to "send a sheet" — the list is right there.
5. **Low-bar invitation.** State plainly that the bar to start is low: a first order can be a single kit of 10, no large commitment. Invite them to place a small first order, ask a question, or set up a short call.
6. **Signature:** `The LeoResearch team`.

Rules:
- NEVER "reply wholesale", "reply for the sheet", "reply and I'll send the price list", or any variant. Offering to send a list you could have just included is embarrassing and lowers reply rate. Include the list.
- One clear invitation, phrased as a low bar (order a few / ask / call) — not a hard meeting ask.
- Professional register throughout. It should read like real business correspondence from a competent operator.

### Subject lines

- Plain and professional. Examples: `LeoResearch — wholesale research peptide catalog` / `Wholesale peptide pricing for <city> clinics` / `Research peptide wholesale + white-label`.
- NEVER `Came across <business> — ...` (it reads as a scrape). No emoji, no "RE:" fakery. Title case or sentence case both fine.

---

## 3. The economics hook

Always lead the substance with the buyer's margin math using one real number. Buyers run on margin; that is the message.

Include the full wholesale catalog as a clean list. It lives in the `OUTREACH_CATALOG` directory row (single source of truth — edit it there, never hardcode prices in copy). Current confirmed list:

Wholesale = KITS OF 10, from 20% off, up to 50% off at volume (matches leoresearch.com/shop). The buyer sets their own price.

```
- BPC-157 10mg — $49 retail · kit of 10 from $39.20/vial, to $24.50 at volume
- MOTS-C 10mg — $49 retail · kit of 10 from $39.20/vial, to $24.50 at volume
- KPV 10mg — $49 retail · kit of 10 from $39.20/vial, to $24.50 at volume
- GHK-Cu 50mg — $49 retail · kit of 10 from $39.20/vial, to $24.50 at volume
- PT-141 10mg — $45 retail · kit of 10 from $36.00/vial, to $22.50 at volume
- SS-31 10mg — $55 retail · kit of 10 from $44.00/vial, to $27.50 at volume
- Tesamorelin 10mg — $59 retail · kit of 10 from $47.20/vial, to $29.50 at volume
- Semax 30mg — $59 retail · kit of 10 from $47.20/vial, to $29.50 at volume
- GLP-2T 10mg — $69 retail · kit of 10 from $55.20/vial, to $34.50 at volume   (coded name)
- GLP-3R 10mg — $99 retail · kit of 10 from $79.20/vial, to $49.50 at volume   (coded name)
- Bacteriostatic Water — $10
```

Rules:
- GLP-2T and GLP-3R are the coded names — keep them coded, never write the underlying drug names.
- Wholesale starts at kits of 10 (20% off) and scales to 50% off at volume; the buyer sets their own price. Say it once.
- Never invent an item or a price. `OUTREACH_CATALOG` is the single source of truth.
- Never promise the buyer's retail price or their sales.

---

## 4. Segment angles

Distinct opening angle per buyer type. Name at most 2–3 relevant products.

- **Medspa** — angle: margin + white-label. They resell to aesthetic clients and want their own label. Products: GHK-Cu.
  > "You're already stocking aesthetics inventory. Wholesale + white-label means your margin, your label."

- **Longevity clinic / MD** — angle: documentation. They care about COA and lot traceability. Products: BPC-157, MOTS-C.
  > "COA per lot, traceable. Wholesale pricing on the catalog."

- **Hormone / TRT clinic** — angle: catalog breadth + restock reliability. They run steady volume and can't have stockouts. Products: BPC-157, Tesamorelin, MOTS-C.
  > "Full catalog, Austin, TX facility, ~2-day restock. You don't run dry."

- **IV therapy bar** — angle: menu differentiation + per-unit economics. They want new menu items with clean unit cost. Products: GHK-Cu, MOTS-C.
  > "New menu line, wholesale per-unit cost. You set the add-on price."

---

## 5. COMPLIANCE (hard rules)

Everything is **research use only (RUO)**. Copy sells inventory to a business. It never touches use on people.

NEVER:
- Imply human administration, dosing, injection, or a protocol.
- Imply treatment, therapy, recovery, healing, repair, anti-aging, or any benefit.
- Claim or imply efficacy, results, or patient/client outcomes.
- Make medical, health, or safety claims of any kind.
- Suggest what the buyer should do with the product beyond stock and resell as RUO.

ALWAYS:
- Commerce facts only: price, unit count, warehouse, restock time, COA, catalog breadth, white-label.
- Refer to items as research compounds / RUO products.
- Sign as **"the LeoResearch team"**. Never sign a personal human name.
- Mention leoresearch.com exactly once, or not at all.

If a sentence describes what the compound *does* to a body, delete it. Margin and logistics only.

---

## 6. Channel variants

### Cold email (the catalog IS in the email)
```
Subject: Wholesale research peptide pricing for <city> clinics

Hello,

<One line: why you're writing to a <segment>.>
We supply research peptides wholesale — 50-vial minimum per item, pricing runs 20% off in kits of 10 (up to 50% at volume), and you set your own price:

- BPC-157 10mg — retail $49, wholesale $24.50
- MOTS-C 10mg — retail $49, wholesale $24.50
- KPV 10mg — retail $49, wholesale $24.50
- GHK-Cu 50mg — retail $49, wholesale $24.50
- PT-141 10mg — retail $45, wholesale $22.50
- SS-31 10mg — retail $55, wholesale $27.50
- Tesamorelin 10mg — retail $59, wholesale $29.50
- Semax 30mg — retail $59, wholesale $29.50
- GLP-2T 10mg — retail $69, wholesale $34.50
- GLP-3R 10mg — retail $99, wholesale $49.50
- Bacteriostatic Water — $10

COA per lot on every item, shipped from our Austin, TX facility (~2-day restock). Public catalog: leoresearch.com.

The bar to start is low — a first order can be a single kit of 10, no large commitment. Glad to answer questions or set up a short call.

The LeoResearch team
```

### LinkedIn connection note (under 300 characters, no link)
```
Hello — we supply research peptides wholesale from Austin, COA per lot, 20–50% off in kits of 10, white-label available. Happy to share the full catalog if it's useful.
```

### Instagram DM (2–4 short lines)
```
Hello — we supply research peptides wholesale, Austin, TX facility, COA per lot.
About half of retail at a 50-vial minimum, you set your own price.
A first order can be just a few units. Want me to share the full catalog and pricing?
```

### SMS (needs prior opt-in — never cold-text without it)
```
LeoResearch wholesale — research peptides, ~half of retail at 50-vial min, COA per lot. Happy to share the full catalog. Reply STOP to opt out.
```
SMS only to buyers who opted in. Include an opt-out.

---

## 7. Before / after

**1. Salutation.**
- BAD: "Hi Radiance Medspa team, I hope this finds you well! I was blown away by your cutting-edge aesthetic services..."
- GOOD: "Hello, — we supply research peptides wholesale to med spas..." (never "Hi <business> team"; the list follows).

**2. Don't dangle a sheet — include it.**
- BAD: "We wholesale research compounds, great margins. Reply 'wholesale' and I'll send the price list."
- GOOD: "We supply research peptides wholesale, 20–50% off in kits of 10. Full list: [the catalog, in the email]. A first order can be a few units — glad to answer questions or set up a short call."

**3. Register.**
- BAD: "Quick question — what if you could supercharge your IV menu with next-generation compounds that empower your clients?! Let's touch base 🚀"
- GOOD: "Hello, — most IV bars we supply add a research-compound line to the menu. Wholesale pricing below; you set the add-on price. [catalog] First order can be a few units."

---

## 8. Pre-send self-check

Do not send until every box is true:

- [ ] Salutation is "Hello," (or "Hi <First>," with a real name). NEVER "Hi <business> team".
- [ ] The full catalog is IN the email as a clean list. No "reply for the sheet", no offering to send a list.
- [ ] The low bar is stated: a first order can be a few units; invite an order, a question, or a call.
- [ ] Zero banned phrases (Section 1); professional register; at most one em-dash; no exclamation points.
- [ ] Prices come from OUTREACH_CATALOG, not invented. GLP-2T / GLP-3R kept coded.
- [ ] Does not restate their website/mission back at them.
- [ ] Zero compliance violations: no use, dosing, treatment, efficacy, or outcome language (Section 5).
- [ ] Signed "The LeoResearch team". No personal human name.
- [ ] Subject is plain/professional. Never "Came across ...".
- [ ] Read it aloud; if it sounds like an AI or a mail-merge, rewrite it.
