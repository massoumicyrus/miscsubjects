# Security

## Where credentials live

Nowhere in this repository. There is no `.env`, no `.dev.vars`, no key file, and `.gitignore`
refuses the usual names. At run time:

- **Cloudflare Pages Functions** read secrets from Pages environment variables (`env.NAME`).
- **Sibling Workers** read Worker secrets set with `wrangler secret put`.
- **The Mac bridge** reads a local environment file that is never committed and is loaded into the
  shell on the operator's machine only.
- **GitHub Actions** read repository secrets; every workflow prints `ABSENT` and stops when its
  secret is missing rather than failing obscurely.

The build's own admin and API are gated by one key, `TERMINAL_KEY`, presented as the header
`x-terminal-key`. Reads of public surfaces need no key. Scoped, time-bounded capability tokens can
be minted for agents that should hold less than the whole key.

## Configuration names the code expects

These are the environment variable names the Functions and Workers read. Names only; a value is a
secret and lives in the platform's secret store. Names for integrations that the public primitive
stubs out are still listed, because the function-runner module reads them by name.

| Group | Names |
|---|---|
| Build | `TERMINAL_KEY`, `ADMIN_SESSION_SECRET`, `MCP_TOKEN`, `INVOKE_TOKEN`, `PHONE_TOKEN`, `VAULT_UNLOCK_TOKEN`, `LBL_SYNC_KEY`, `LBL_VIEWER_PASS`, `LOOP_DELIVER_TOKEN`, `STORE_KEY`, `BUILD_URL`, `EMAIL`, `EMAIL_FORWARD` |
| Cloudflare | `CF_ACCOUNT_ID`, `CLOUDFLARE_ACCOUNT_ID`, `CF_API_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CF_TOKEN`, `CLOUDFLARE_EMAIL`, `CLOUDFLARE_GLOBAL_KEY`, `SECRETS_STORE_ID`, `AIG_GATEWAY_ID`, `AIG_TOKEN`, `AIG_RUN_TOKEN`, `AIG_SHIM_TOKEN`, `AIG_DEFAULT_MODEL` |
| Models | `GROK_API_KEY`, `OPENAI_API_KEY`, `OPENAI_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_KEY`, `GEMINI_API_KEY`, `GEMINI_KEY`, `MOONSHOT_API_KEY`, `KIMI_API_KEY` |
| Messaging | `BLOOIO_API_KEY`, `BLOOIO_FROM_NUMBER`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TWOCHAT_API_KEY` |
| Code and data | `GITHUB_TOKEN`, `GITHUB_TAIL_TOKEN`, `GH_API_KEY`, `AIRUNNER_WEB_APP_URL`, `GOOGLE_MAPS_KEY`, `GOOGLE_PLACES_KEY` |
| Commerce and marketing | `STRIPE_SECRET_KEY`, `META_ACCESS_TOKEN`, `META_BUSINESS_ID`, `META_API_VERSION`, `ARCADS_API_KEY`, `ARCADS_BASIC_AUTH`, `ARCADS_BASE_URL`, `JCI_API_BASE`, `JCI_USER_ID` |
| Social | `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `X_CONSUMER_KEY`, `X_CONSUMER_SECRET`, `REDDIT_CLIENT_ID`, `REDDIT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD` |
| Federation | `PEER_DOMAIN`, `OIP_PEER_KEYS`, `OIP_HOME_KEY`, `OIP_HOME_AGENT`, `HOME_BASE`, `HOME_AGENT` |

Bindings (not secrets) are declared in `wrangler.toml`: `DB`, `LEDGER`, `KV`, `R2`, `AI`,
`DIRECTORY_DO`, `SHEET_DO`, `TASKS`, `STORE`, `META_BRIDGE`, and in the sibling Worker
`CF_EXPERT_DO`, `AGENT_DO`, `DELIVER_WF`, `SELFTEST_WF`.

## What the public ledger will never show

The ledger is public by design, so redaction happens at ingest, in one place:
`functions/_lib/public_secret_guard.js`. It replaces known provider key shapes, every secret bound
in the environment, signed capability tokens, and the owner's identity (names, handles, emails, home
directory, machine name) before a row is stored. `scripts/check-owner-name-leak.mjs` checks the live
public endpoints for a regression on every deploy.

## Gates that protect this repository

- `scripts/check-failure-vault.mjs` — every owner-named failure mode is an entry in
  `failure-vault.json`; a commit that reintroduces one is refused.
- `scripts/check-coding-law.mjs` — a changed code file without a committed sha256 lease fails the
  deploy.
- `scripts/check-protected-features.mjs` and the `.githooks/` — locked paths are refused at commit.
- `scripts/check-approval-tokens.mjs` — no self-issued approval marker clears a protected edit.
- `scripts/publish-mirror.mjs` — the only path to a publishable repository; it fails on any
  credential shape, any real vault value, any identity string, or any gitleaks finding in the
  output. See `docs/PUBLISHING.md`.

## Reporting

If you find a credential, personal data, or a way to write to a governed table without a task,
open an issue on the repository that says **what** and **where** without pasting the value, or write
to `build@miscsubjects.com`. Anything you send is treated as a failure object: it gets a class, the
layer that permitted it, the invariant that should have prevented it, and a gate so it cannot recur
silently.
