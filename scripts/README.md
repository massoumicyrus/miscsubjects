# scripts/

Operational scripts for the miscsubjects build. Each runs under Node (`node scripts/<name>.mjs`).

## guard.mjs

Protected-widget guardian. Keeps its own snapshot of each locked file in `.protected/guard-baseline/` and detects changes *between* snapshots (git HEAD is not a valid baseline because the working tree is chronically dirty). First sight of a file = silent snapshot; a later change = quarantine the new version, ask Grok + Kimi for a verdict, text the owner, and heal on 👍.

Modes:
- `--baseline` — snapshot all locked files now (no alerts). Run after authorized work.
- `--check` — alert on any locked file changed since its snapshot.
- `--heal <path>` — restore `<path>` from its snapshot; clear pending (👍).
- `--adopt <path>` — accept the change: snapshot becomes current; clear pending (👎).
- `--list` — show pending alerts.
- `--quiet` — do not send texts. `--nojudge` — skip Grok/Kimi.

Run:
```bash
node scripts/guard.mjs --check
```

Cron (launchd `com.the owner.guard`): `node scripts/guard.mjs --check --nojudge` every 900s (15 min), `RunAtLoad` true. Logs to `~/.miscsubjects/guard.log`.

## ship.mjs

Canonical deploy path for the Pages build: apply the newest D1 migration to `loop-content-spine` first, then deploy `public/` to `loop-safe-miscsubjects`. Pass explicit `.sql` files to apply those instead, or `--no-migrations` for a code-only redeploy.

Run:
```bash
node scripts/ship.mjs
```

## recurse.mjs

Recursive GitHub loop. The build files its own build issues and closes its own tickets. Pulls open work from `builder_queue` via the build dispatch, files deduped-by-title issues to the GitHub repo, and closes resolved ones with a ledger receipt.

Run:
```bash
node scripts/recurse.mjs
```

Cron (launchd `com.the owner.recurse`): `node scripts/recurse.mjs` every 3600s (hourly), `RunAtLoad` false. Logs to `~/.miscsubjects/recurse.log`.

## resolve.mjs

Autonomous ticket resolver. Picks an open `[auto]` GitHub issue, fixes it in an isolated git worktree via a local `claude` run, commits to a `bot/` branch, pushes, posts the diff as the issue receipt, and closes the issue. Rails: worktree off HEAD (never the dirty tree), branch only (never main), no deploy, no protected-file edits, `[auto]`-title gate.

Run (optional explicit issue number, otherwise picks the latest open `[auto]` issue):
```bash
node scripts/resolve.mjs [issueNumber]
```

Cron: none. Invoked manually or from another loop.
