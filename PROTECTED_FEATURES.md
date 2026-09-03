# PROTECTED FEATURES - OWNER LOCKED VAULT

This file is the human-readable manifest for feature locks beyond the article widget renderer.

## Locked feature families

- Article widgets: `PROTECTED_WIDGETS.md`
- Vault catalogue API: `functions/api/vault/[[path]].js`
- Vault admin page: `functions/admin/vault.js`
- Vault widget renderer: `functions/_lib/vault_widgets.js`
- Vault session-scan cron: `.github/workflows/vault-session-scan.yml`
- Local mutation hooks: `.githooks/pre-commit`, `.githooks/commit-msg`

## Rule

No AI agent edits locked feature files unless the owner explicitly authorizes it in the same instruction window.

Approved commits must include one of:

- `#widgets-approved` for article widget renderer changes
- `#vault-approved` for vault/catalog/protection changes

The vault's purpose is to preserve macro ideas, micro prompt rules, feature state, task state, event state, and model-session evidence as REST-readable JSON plus sideways visual cards.

The session-scan cron is intentionally bounded: read recent `cc_turns`, flag protected paths/destructive commands, write one ledger event, and perform zero code writes.

## Deployment law

- Always run `npx wrangler pages deploy ...` from the project root: `/Users/owner/miscsubjects-pages`.
- Never deploy from `~` or any other directory. Wrangler will look for `functions/` in the current directory and skip the real Functions bundle.
- Before deploying, unset any stale `CLOUDFLARE_API_TOKEN`:
  ```bash
  unset CLOUDFLARE_API_TOKEN
  npx wrangler login
  npx wrangler pages deploy public --project-name miscsubjects-pages --branch main --commit-dirty=true
  ```
- If using a token, ensure it has Cloudflare Pages:Edit scope for project `miscsubjects-pages`.
- This rule is locked in the vault; any agent instructing a deploy must include the `cd` step and directory check.
