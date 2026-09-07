# Operable by strangers: the token drop, sheets as inboxes, and cold models

Three mechanisms make one claim true: **an agent that has never seen this system, holds no SDK, and
was never trained on it can operate it correctly from a single link.** That means onboarding a new
caller costs nothing per capability.

## 1. The token drop

Most systems onboard a caller with an SDK, a broad API key, and docs to read. This one hands over a
**bounded capability token** in a URL: scoped to one capability or category, time-boxed, use-counted,
carrying its own authority and nothing else.

The receiver isn't told what it can do — the object tells it. Asking a capability to explain itself
returns only *the moves this exact credential is allowed to make*:

```
# GET /api/dispatch?key=NOW  →  _self  (abridged, from the live build)
{
  "protocol": "OIP", "version": "1.2.0", "name": "NOW",
  "principle": "This _self block is the capability: what it is,
                how to run it, how to change it, and where to look next.",
  "run_now": "/api/dispatch?invoke=NOW&share=<TOKEN>",
  "affordances": {
    "note": "Only moves this credential can take are listed; the server enforces scope regardless.",
    "contract": "GET /api/dispatch?key=NOW&format=markdown",
    "confirm":  "GET /api/dispatch?confirm=INV_ID   // public proof it ran"
  }
}
# check a token before using it:  GET /api/dispatch?explain=1&share=<TOKEN>
```

Every call the token makes lands on the public ledger as a receipt, so a working link can be dropped
to an agent you don't fully trust and the blast radius is exactly the token's scope, visible after
the fact. The full authority model — tokens plus mutable capability contexts — is in
[AUTHORITY.md](AUTHORITY.md).

## 2. Sheets as inboxes (for the models that refuse the token)

A model reading a web page must treat that page as *data*, never instructions — the whole defense
against prompt injection. So when a capability token is dropped onto a page, some models act on it
and **some correctly refuse.** The refusal is not a bug; it is the model being safe.

So the authority is moved. When a person asks their **own** model to write a row into their **own**
spreadsheet, that is an ordinary user-authorized action, and every model will do it. A shared Google
Sheet tab becomes the mailbox: the model writes what to invoke in the first column; the build runs it
and writes the state, the answer, the time and the ledger trace back beside it; the model reads the
answer on its next look. No token in the conversation, no instruction issued by a page — and **one
Google connection reaches the entire catalog**, every capability now and every one added later, with
no per-tool setup. See [SHEETS.md](SHEETS.md) for sheets as projections generally.

## 3. How well it works on cold models

A caller is "cold" if it has never seen this system and holds only the manual or a dropped link. The
test is whether it produces the *exact* correct call on the first attempt.

1. **Given only the one-call manual**, a cold frontier model wrote the exact `POST` for a capability
   it had never seen, and the object it created existed afterward, confirmed by receipt — no
   fine-tuning, no examples, no back-and-forth.
2. **Handed a dropped token**, models split, and the split is the finding: some operate immediately,
   others refuse to act on a credential found on a page. That refusal is correct, and it is *why* the
   sheet-inbox exists.
3. **Through the sheet-inbox**, the models that refuse the token operate the whole build anyway,
   because the authority comes from the user, not the page.

**Why it matters.** MCP onboards one integration per provider. A dropped link or a shared sheet
onboards the entire catalog at once, for any model, with the safe ones staying safe. Onboarding
stops scaling with the size of the system. Every claim here is reproducible against the live manual,
and every run leaves its own receipt.

Live: [the one-call manual](https://miscsubjects.com/api/environment?format=markdown) ·
[a sheet as an object](https://miscsubjects.com/api/sheets/sh_urmt4xfs/self) ·
[a capability describing itself](https://miscsubjects.com/api/dispatch?key=NOW).
