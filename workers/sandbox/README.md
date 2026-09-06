# miscsubjects-sandbox — the cloud execution plane

This Worker runs the same shell contract inside a **Cloudflare Container**
(Sandbox SDK), so ordinary compute — git, node, python, grep, tests, file work —
has no laptop in its dependency chain.

## What it is not

It is not "Cloud Terminal, the app". It is a substrate behind the existing
capability system. A capability row says WHAT it does; `directory.execution` says
WHERE it may run; `functions/_lib/execution_routing.js` decides. Nothing calls
this Worker directly.

## Shape

```
directory row  →  dispatch  →  execution routing  →  ┬→ CLOUD  /api/cloud/*  →  SANDBOX binding  →  this Worker  →  container
                                                     └→ MAC    agent.miscsubjects.com            →  bridge/server.js
```

## Three invariants

1. **The container is never the record.** Workspaces and jobs are D1 rows in
   `miscsubjects-content` (`cloud_workspace`, `cloud_job`, `cloud_terminal`).
   Cloudflare may evict or replace a container at any time; the record of what
   ran must survive that. Destroying a workspace destroys the container and
   *keeps* the row.
2. **A tenant cannot address another tenant's workspace.** The sandbox id is
   `<tenant>--<workspace>`, so a different tenant is a different container and a
   different Durable Object. Every lookup re-checks ownership against the row,
   never against the caller's claim. The tenant header is written by the front
   door from the credential; a body cannot set it.
3. **Nothing reports green that was not green.** Non-zero exit is `ok:false` with
   the real exit code. A timeout is `error:"timeout"`, never success. A container
   replaced mid-job is `interrupted`, never `done`.

## Deploy

```bash
cd workers/sandbox
env -u CLOUDFLARE_API_TOKEN -u CF_API_TOKEN npx wrangler deploy
```

The vault's `CF_API_TOKEN` does **not** carry `Workers Containers Write`; wrangler's
own OAuth credentials do. Unsetting the token env vars is what makes the deploy work.

The image is pulled from public Docker Hub (`docker.io/cloudflare/sandbox:0.12.9`),
so no local Docker build and no push to the account registry is needed. `Dockerfile`
holds the richer image (jq, ripgrep, sqlite3) to build once the deploy credential
carries container-registry write.

Deploy this Worker **before** the Pages project, which binds it as `SANDBOX`.

## Secrets

`SANDBOX_KEY` — shared with the Pages front door. This Worker has `workers_dev = false`;
the key is the second lock, so a mistaken route is still not an open shell.
