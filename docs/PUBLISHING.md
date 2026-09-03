# Publishing the build: how the code reaches a repository that can be made public

This document is the plan and the mechanism in one place. It answers four questions: why the
operating repository cannot simply be made public, what the publishable thing is instead, how it is
produced and checked, and what remains before the visibility switch is flipped.

## 1. Why the operating repository is never published

An audit of the operating repository on 2026-09-02 found that it is a working ledger as much as a
codebase. It holds, tracked in git:

| Class | Where | Why it blocks publication |
|---|---|---|
| Operational ledger data | `ledger-mirror/` (thousands of daily event files, the bulk of the tracked bytes) | Full request and response bodies from before identity scrubbing existed: phone numbers, addresses, message text, and credential material captured in transit |
| Guard baselines | `.protected/` | Byte copies of protected files at every version, including versions that carried identifiers since removed |
| Session notes and handoffs | `HANDOFF_*.md`, `AUDIT_*.md`, `BUILD_STATE.md`, `ACCESS.md`, hundreds of root scratch files | Written for one operator by one agent; they name people, machines, accounts and credential locations |
| Legacy consoles | `grok-console/`, `operator-console/` | Hardcoded provider keys from an earlier design; rotated, but a key that was ever committed stays in history |
| A signing key | `.witness/` | A private JSON web key committed as a file |
| Identity in code | about 280 code, prompt and doc files outside the ledger mirror | The operator's name, emails, phone and home directory used as literals in prompts, defaults and comments |
| A licensed font | `public/font/URW-*` | Served by the site under license; not redistributable in source |

Rewriting history to remove this is not a repair. The repository has more than fourteen thousand
commits, several agents push to it on a ten-minute cycle, and a rewrite would break every clone and
every worktree while leaving the current tree still full of the identity literals above. The honest
answer is that this repository is the private working state of a running system, and a running
system's working state is not a publication.

## 2. What is published instead: a generated projection

The publishable artifact is a **second repository whose every commit is the output of one script**.
Nothing in it was ever committed by hand, and its history begins at its first export, so nothing from
the operating repository's history can be in it.

```
 operating repository (private, forever)
        │  git ls-files  → allow-list → exclude patterns → path renames
        │  text files    → identity substitution
        │  output        → gates: forbidden strings · paths · vault values · size · gitleaks
        ▼
 projection directory  ──►  PROJECTION.json (source commit, counts, gates, what was substituted)
        │
        ▼  one commit: "projection of <source sha> (<n> files, <k> gates passed)"
 mirror repository  [OWNER_HANDLE]/miscsubjects   (private today; a visibility toggle publishes it)
```

The script is [`scripts/publish-mirror.mjs`](../scripts/publish-mirror.mjs). Its configuration is
`scripts/publish-mirror.config.json`, which lists the identity strings it removes and is therefore
the one file that never travels to the projection. Running the script from inside a projection stops
at "config missing", on purpose.

### What travels

Allow-listed prefixes: `functions/`, `scripts/`, `migrations/`, `workers/`, `public/`, `docs/`,
`prompts/`, `apps-script/`, `hooks/`, `.githooks/`, `.github/`, `misc-cli/`, `bridge/`, and the
agent configuration directories `.claude/`, `.agents/`, `.codex/`, `.gemini/`, `.grok/`, `.kimi/`,
`.kimi-code/`.

Allow-listed root files: `README.md`, `SECURITY.md`, `AGENTS.md`, `STATE.md`, `API.md`,
`wrangler.toml`, `schema.sql`, `.gitignore`, `PROTECTED_FEATURES.md`, `PROTECTED_WIDGETS.md`,
`failure-vault.json`, `.source-quote-ceiling.json`.

Everything else is dropped by construction: a file has to be named to travel. Within the allow-list
a short exclude list removes editor backups, the Apps Script project binding, the licensed font,
captured vendor documentation, lockfiles for the local bridge, and the config itself. Each exclusion
carries its reason in the config and the count of files it removed appears in `PROJECTION.json`.

### What is substituted

Substitution runs on every text file, in this order:

1. **Specific literals** — the account subdomain, the Cloudflare account id, non-secret Google
   identifiers, possessive forms of the owner's name.
2. **E-mail addresses** — kept only when the domain is on an allow-list of build and vendor
   domains; owner domains become `[OWNER_EMAIL]`, anything else becomes `[REDACTED_EMAIL]`.
3. **Phone numbers** — the owner's and the build's numbers in every formatting, then any `+1`
   number, become `[OWNER_PHONE]`, `[BUILD_PHONE]` or `[PHONE]`.
4. **The owner-identity table the site itself uses** at ledger ingest
   (`functions/_lib/public_secret_guard.js`): names, handles, home directory, machine name. One
   table, two consumers, so the two can never disagree.
5. **Paths** — launchd service names carry the same substitution as their contents.

A substituted file keeps its meaning for a reader. Where a literal was load-bearing (a default
phone number, a default email) the projection carries a placeholder, and `PROJECTION.json` lists
every file that was touched with a count per category, never the string. The scrubber's own pattern
table is itself substituted in the projection; that is expected and recorded.

### Gates, all run against the output

| Gate | Examines | Fails when |
|---|---|---|
| `forbidden_strings` | every file; text after substitution, binary files as raw bytes | any identity string, personal email domain, real home directory, account id, phone, or any of fourteen credential shapes (OpenAI, Anthropic, xAI, GitHub, Stripe, AWS, Google, Slack, GitLab, webhook secrets, JWTs, private key blocks) remains |
| `paths` | every path | a path carries identity |
| `vault_values` | every text file, local runs only | the exact value of any credential or identifier in the operator's vault appears. A secret here is a defect in the source and is never laundered; the export refuses and names the file and the vault key, not the value |
| `size` | every file | any file over 2 MB or total over 120 MB |
| `gitleaks` | the projection directory | the independent detector finds anything. Required in CI, used when installed locally |

On any failure the projection directory is deleted, so a half-checked tree cannot be pushed by hand.
Each gate reports how many files it examined, because a gate that examined nothing is not a pass.

### Continuous export

`.github/workflows/publish-mirror.yml` runs the exporter after every real commit to `main`
(ledger-mirror and baseline commits are ignored by path) and pushes to the mirror over a deploy key
that can write to the mirror only. The vault is not in CI, so the `vault_values` gate runs on the
operator's machine and the pattern, identity, path and gitleaks gates run in both places.

To run it by hand from the operating repository:

```bash
node scripts/publish-mirror.mjs --out .tmp/projection/mirror
```

adds `--push` to commit and push, `--announce` to publish the manifest to the build's own public
surface (needs `TERMINAL_KEY`), `--json` for one-line output, `--require-gitleaks` to make the
absence of gitleaks a failure, `--keep` to leave a failed projection on disk for inspection, and
`--report <path>` to write every gate hit with a masked context window.

The latest manifest is public at https://miscsubjects.com/img/projection/latest.json, and each
export is also kept at `https://miscsubjects.com/img/projection/<source sha12>.json`. That is the
surface the work object grades this mechanism on.

## 3. Reading a projection

`PROJECTION.json` at the root of the mirror holds: the source commit, file and byte counts, how many
tracked files were dropped and for which reasons, the list of substituted files with per-category
counts, every gate with its examined count and result, and a content hash over every path and byte
so two projections can be compared. The commit message names the source commit as well.

## 4. Going public: the checklist

The mirror is private today. Publishing it is one setting on that repository. Before flipping it:

1. Run the exporter locally so the `vault_values` gate has run against the exact tree being
   published, and read `PROJECTION.json`.
2. Rotate any credential that was ever committed to the operating repository, even though that
   repository stays private. The classes are listed in section 1; the operating repository's own
   records name the keys.
3. Decide the license and add `LICENSE` to the allow-list. Until then the projection states that all
   rights are reserved.
4. Read the projection's `README.md`, `SECURITY.md` and `docs/REPO_MAP.md` as a stranger would; the
   exporter checks strings, not sense.
5. Flip visibility on the mirror repository. Nothing about the operating repository changes.

## 5. What this plan deliberately does not do

- It does not rewrite the operating repository's history. Section 1 says why.
- It does not publish content dumps (`research/`, `improved-content/`, `oip-articles-*`, root
  article payloads). The published site is the projection of content; the repository is the
  projection of code.
- It does not publish `ledger-mirror/`. The ledger is public at `/ledger` with scrubbing applied at
  ingest, which the mirrored files predate.
- It does not weaken a gate to get a file through. A file that fails is fixed in the operating
  repository or excluded with a reason.
