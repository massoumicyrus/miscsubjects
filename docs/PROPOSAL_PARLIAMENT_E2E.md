# Proposal Parliament + Code Retirement — End-to-End Design

**Status:** Design proposal (2026-07-01)  
**Author:** Grok (Niger Dog) for the owner  
**Repo:** `[OWNER_HANDLE]/miscsubjects-pages`  
**Principle:** GitHub Issues = human-readable deliberation. Ledger = canonical receipt. Owner = ratify.

---

## 1. What this is

Two automated loops on the **same OIP runtime** (read / invoke / ledger / resume / alter):

| Loop | Grows | Surface | Receipt |
|------|-------|---------|---------|
| **Writer queue** (shipped) | Article content | `/api/protocol/*` | Ledger + D1 articles |
| **Proposal Parliament** (new) | Build intent | GitHub Issues | Ledger invocations |
| **Code retirement audit** (new) | Subtraction | GitHub Issues | Ledger invocations |

Models debate **proposals** on GitHub. Every `GITHUB_*` invoke goes through `dispatch` → **ledger row**. the owner approves on GitHub or iMessage → `BUILDER_ADD` / `ADDTASK` / delete → another ledger row.

---

## 2. Architecture

```
┌─────────────┐     cron/tick      ┌──────────────┐
│  tasks row  │ ─────────────────► │ TODO_RUN /   │
│  (source=*) │                    │ protocol/next│
└─────────────┘                    └──────┬───────┘
                                          │ invoke
                                          ▼
┌─────────────┐   GITHUB_ISSUE_*   ┌──────────────┐
│ GitHub      │ ◄───────────────── │ POST dispatch│
│ Issues/PRs  │                    │ (share:act)  │
└──────┬──────┘                    └──────┬───────┘
       │ human read                      │ append
       ▼                                 ▼
┌─────────────┐                    ┌──────────────┐
│ the owner       │                    │ LEDGER       │
│ approve/    │                    │ invocations  │
│ reject      │                    │ agent_turns  │
└─────────────┘                    └──────────────┘
```

**Invariant:** No GitHub write off-ledger. All paths: `?invoke=GITHUB_*&share=` or `POST /api/dispatch`.

---

## 3. Task sources (extend `tasks` table)

| `source` | Cron KV flag | Tick |
|----------|--------------|------|
| `writer-queue` | `writer_queue_autorun=1` | existing ~1/min |
| `proposal-reflex` | `proposal_autorun=1` | `ISSUE_POLL` every 15m |
| `code-audit` | `code_audit_autorun=1` | weekly + on-demand |
| `retirement-vote` | (child of code-audit) | staggered agent pass |

`GET /api/protocol/next?role=proposal-reflex` — same pattern as writer queue.

---

## 4. Proposal Parliament

### 4.1 Issue labels

- `proposal` — build intent
- `code-audit` — retirement parent issue
- `retirement:consensus` — 2+ agents agree on delete target
- `agent:claude-cli` | `agent:codex` | `agent:kimi` | `agent:grok-cli`
- `needs-owner` — ready for the owner
- `approved` | `rejected` | `wontfix`

### 4.2 Delegated writing format (`PROPOSAL_FORMAT` directory row)

```markdown
agent: {agent-id}
trace: {trace_id}
ledger: https://miscsubjects.com/admin/ledger?cards=1&card_id={id}
stance: propose | counter | support | withdraw
target: builder_queue | directory | article | intake | retirement | none

## Claim
One sentence.

## Why (this build)
Tied to OIP / proof gate — not generic advice.

## Proof
Invoke receipt, ledger event_id, or repo path.

## Overlap / cost
What exists; what duplicates.

## Ask owner
One yes/no or one choice.
```

### 4.3 Stagger loop (`ISSUE_POLL` cron)

1. `GITHUB_LIST_ISSUES` — `label:proposal,is:open,updated:>{cursor}`
2. Ledger row (even if empty)
3. New comment/issue → `tasks` row `{ issue, last_agent, next_agent, round }`
4. One agent → `GITHUB_ADD_ISSUE_COMMENT` (formatted)
5. **Stagger:** KV `proposal:{issue}:{agent}` — max 1 comment/agent/issue/hour
6. **Round cap:** 8 comments/issue → auto-label `needs-owner`
7. `PROPOSAL_DIGEST` → Blooio summary of `needs-owner` issues
8. the owner comments `approve` → `BUILDER_ADD` or `ADDTASK` (ledgered)

### 4.4 Agent rotation (default)

`grok-cli` propose → `claude-cli` critique → `kimi` extend → `codex` implementation sketch → repeat until cap.

---

## 5. Code retirement audit

### 5.1 Evidence collection (`CODE_AUDIT_COLLECT` fn)

Read-only JSON bundle:

| Signal | Source |
|--------|--------|
| Orphans / fragile / hot | `/admin/ledger?voxels=1` |
| Zero invocations 30d | `GET /api/invocations` + directory keys |
| Unproven fn rows | Selftest + `{}` vs `[]` shape audit |
| Repo files never invoked | `files_json` in agent_turns vs tree |
| Disabled rows in planner | `directory WHERE enabled=0` |
| Duplicate overlap | Category + key similarity |

### 5.2 Retirement issue format

```markdown
target: directory:KEY | file:path | row:disabled:KEY
evidence: invocations_30d=0 | duplicate_of=KEY | voxels=orphan
agents_agree: claude-cli, grok-cli
risk: low | medium | high
proof_before_delete: selftest tier N | invoke REGISTRY ok
```

### 5.3 Consensus rule

Same `target` nominated by **2+ agents** → child issue `retirement:consensus` → `CODE_AUDIT_DIGEST` → the owner.

**Never auto-delete.** Approve → `DEL_ROW` / `DELETE /api/file` / disable — each ledgered.

### 5.4 Weekly cron

```
Monday 06:00 PT:
  CODE_AUDIT_COLLECT → parent issue "Code audit YYYY-MM-DD"
  Queue retirement-vote tasks for codex, kimi, claude (readonly)
  After consensus → iMessage digest
```

---

## 6. New directory keys (v1)

| Key | Type | Purpose |
|-----|------|---------|
| `PROPOSAL_FORMAT` | agent/doc | Template reference |
| `ISSUE_POLL` | fn | Poll GitHub → queue reflex tasks |
| `PROPOSAL_OPEN` | fn | Seed debate issue |
| `PROPOSAL_COMMENT` | fn | Formatted comment as agent |
| `PROPOSAL_DIGEST` | fn | `needs-owner` → Blooio |
| `CODE_AUDIT_COLLECT` | fn | Evidence bundle → issue body |
| `CODE_AUDIT_DIGEST` | fn | Consensus retirements → Blooio |

Reuse: `GITHUB_ISSUE_*`, `BUILDER_ADD`, `MCP_ATTACH`, `issue-reflex.sh`, `cli-agent-group.sh`.

---

## 7. Prerequisites

1. **GitHub MCP attached** — `MCP_ATTACH` + green `GITHUB_LIST_ISSUES` invoke
2. **`GITHUB_TOKEN`** — already works via `/api/file` (verify `MCP_ATTACH` path)
3. **`ADD_ROW` auth grammar** — patched (blank ≠ `none`)
4. **KV flags** — `proposal_autorun`, `code_audit_autorun` on sibling cron worker

---

## 8. v1 rollout (proof order)

| Step | Deliverable | Proof |
|------|-------------|-------|
| 1 | GitHub MCP attach | Green ledger invoke |
| 2 | `CODE_AUDIT_COLLECT` | One issue with voxels + zero-invocation rows |
| 3 | Manual agent comment on audit issue | Ledger `GITHUB_ADD_ISSUE_COMMENT` |
| 4 | `ISSUE_POLL` + `proposal_autorun` | Cron queues one reflex |
| 5 | `PROPOSAL_DIGEST` | iMessage with open proposals |
| 6 | Owner `approve #N` → `BUILDER_ADD` | Two ledger rows linked by trace |

---

## 9. Anti-patterns (do not build)

- 5000 directory rows without proof invokes
- Auto-delete without `retirement:consensus` + owner approve
- GitHub writes outside dispatch
- Real-time ping-pong (use stagger + round caps)
- Separate proposal DB (GitHub + ledger is enough)

---

## 10. Success criteria

- the owner reads proposals on GitHub or phone without pasting 35k handoff
- Any model can audit another via ledger + issue thread
- Retirement candidates backed by invocation stats, not opinions
- Full session replayable from ledger if GitHub unavailable

---

## 11. Open questions for CLI review

1. Is `tasks.source` the right queue axis or separate `proposal_queue` table?
2. Round cap 8 — too low/high?
3. Should consensus require 2 agents or 3?
4. Codex readonly vs auto for retirement votes?
5. Issue repo: `miscsubjects-pages` only or org-wide?

---

*Review assignment: Inventory your last 12 ledger/agent_turns. Assess fit. Amend. Verdict: ship / amend / kill.*