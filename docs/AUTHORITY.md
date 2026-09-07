# Authority: tokens, contexts, presenters

How the system decides whether one invocation may execute now. The code is
`functions/api/dispatch.js` (the gates, in order), `functions/_lib/capability_context.js` (the
context half), `functions/api/device/verify.js` (the Turnstile step-up) and the `PROFILE_*`,
`DEVICE_*`, `CAP_*` and `ACCESS_DECISIONS` directory rows.

## 1. Two halves

A bearer credential is the right shape for what does not change after minting and the wrong shape
for everything that does. So authority is split:

| Half | Answers | Where | Mutability |
|---|---|---|---|
| **Token** | what may be done, for how long, how many times, under which ancestor | a signed share token, presented as `?share=` or `Bearer` | immutable |
| **Capability context** | who or what it belongs to and where it may be exercised | `capability_contexts` in the `LEDGER` database, keyed by the token's fingerprint | mutable, server-side |
| **Presenter** | who is presenting it right now | `traffic_profiles`, `traffic_devices`, `traffic_identifiers`, `traffic_sessions` in `DB` | changes per request |
| **Decision** | may this invocation execute now? | `evaluateContext`, a pure function | computed each time |
| **Ledger** | what was decided and what ran | one row per decision, `source=authz`, `action=context_decision`, with a decision hash | append-only |

An invocation succeeds only when the token is valid **and** the context is valid. A cryptographically
valid token copied into another browser fails on the second half, by name.

## 2. Tokens

The terminal key (`x-terminal-key`) is the operator's whole authority. Everything else holds less:

- `GET /api/dispatch?mint_share=1&scope=<scope>&ttl=<seconds>&max_uses=<n>` mints a token. Scope is
  a row key, a category, `act`, `read`, or `sheet:<id>` for one sheet. `CAP_MINT` is the same
  operation as a row, with typed arguments (scope, row key, ttl, max uses, purpose, risk ceiling,
  owner gate).
- `GET /api/dispatch?explain=1&share=<token>` says exactly what a token may do.
- `?narrow=`, `?attenuate=` and `?revoke=` derive a smaller token, cap its uses, or end it.
- The dispatcher enforces scope, tenant, risk class, fixed-body and payload ceilings before a row
  runs, and consumes a use only after the context gate has passed.

## 3. Contexts

`CAP_CONTEXT_BIND <fingerprint>|{json}` attaches a context to a token; `CAP_CONTEXT_GET` reads it;
`CAP_CONTEXT_UNBIND` removes it. A child context may only narrow its parent. A context may name:

| Field | Constrains |
|---|---|
| `profile_id` | the one profile that may present the token |
| `device_ids` | the trusted devices that may present it |
| `session_ids` | the browser-model sessions it was issued to |
| `state_handles` | the `state://` handles it belongs to |
| `sheet_ids` | the sheets it may act on |
| `origins` | the origins it may be exercised from |
| `require_verification_s` | how recently the human behind it must have passed Turnstile, in seconds |
| `require_pop` | whether the device must prove possession of its key on every call |
| `policy` | the profile-state policy: which profile states are allowed (a blocked profile is refused) |
| `tenant_id`, `actor_kind` | the tenant and the kind of actor (human, model, service, device, workflow) |

The presenter is read from the headers `x-device-id`, `x-session-id`, `x-webmodel-session` and
`x-state-handle`, or the equivalent query and body fields.

## 4. Denial codes

Every refusal is one of these, never a bare `403`, because the person reading the explain surface
needs to know which condition failed.

| Code | Meaning |
|---|---|
| `DEVICE_NOT_APPROVED` | the presenting device is not in the context |
| `DEVICE_REVOKED` | the device was revoked |
| `DEVICE_TRUST_EXPIRED` | the device's trust window has lapsed |
| `SESSION_NOT_APPROVED` | the browser-model session is not the one the token was issued to |
| `PROFILE_MISMATCH` | the presenter's profile is not the bound profile |
| `PROFILE_BLOCKED` | the profile's state is refused by policy |
| `TURNSTILE_REQUIRED` | no human verification on record for this device |
| `TURNSTILE_STALE` | the last verification is older than the context allows |
| `ORIGIN_MISMATCH` | the request came from an origin the context does not name |
| `STATE_HANDLE_MISMATCH` | the token belongs to a different `state://` handle |
| `POP_REQUIRED` | proof of possession is required and was not presented |
| `POP_INVALID` | the signature does not verify |
| `POP_STALE` | the timestamp is outside the window |
| `POP_REPLAY` | the nonce was already consumed |
| `POLICY_DENIED` | the profile-state policy refused |

## 5. Presenters: profiles and devices

One profile object serves humans, model actors, services, devices and workflows
(`traffic_profiles.kind`). Identifiers are stored hashed and masked, never raw. Browser-model
sessions get a persistent model actor, so a web model's actions are attributable across sessions.

| Row | Does |
|---|---|
| `PROFILE_NEW`, `PROFILE_IDENTIFY`, `PROFILE_360`, `PROFILE_EVENT` | create a profile, link an identifier, read the unified view, record a first-party event |
| `PROFILE_EVENT_FORWARD` | forward a first-party event to configured consumers with hashed identifiers only, recording each destination's answer on the event row and in the ledger; wired to the event bridge so no hand-placed call is needed |
| `DEVICE_REGISTER`, `DEVICE_TRUST`, `DEVICE_REVOKE`, `DEVICE_VERIFY_RECORD` | register a device with its public key, trust it for a window, revoke it, record a verification |
| `ACCESS_DECISIONS` | read the ledger's authorization decisions |

## 6. Proof of possession

A device holds an EC P-256 key and registers the public half. When a context requires it, every
call carries `x-device-signature`, `x-device-nonce` and `x-device-ts`: an ECDSA signature over
`fingerprint|key|sha256(body)|nonce|ts`. The nonce is consumed by a primary-key insert into
`pop_nonces`, so a replay fails on the insert. WebCrypto only; no custom cryptography.

## 7. Step-up

`/verify-device?device=<id>` renders the managed Turnstile widget. `POST /api/device/verify` runs
`siteverify` server-side, stamps the device with the instant, and writes a `TURNSTILE_PASS` event
to the profile. Contexts read that instant against `human_verified_within_s`. The site key and
secret are `TURNSTILE_SITEKEY` and `TURNSTILE_SECRET_KEY`.

## 8. Where the gate runs

The context gate runs after the token and tenant gates in all three authorization lanes: `GET`
invoke, `POST` dispatch, and nested calls made by flows, agents and the relay lane. A capability a
browser model asks for through the relay is evaluated under the **caller's** authority, never the
model's, so a token that may not touch a sensitive row does not acquire that right by asking a model
nicely.

Tests: `scripts/capability-context.test.mjs`.
