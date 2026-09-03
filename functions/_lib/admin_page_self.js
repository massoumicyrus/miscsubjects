// Admin page §SELF registry — single source of truth for per-page self-description.
// ?build=1 derives admin.pages from here (no curated drift). GET /api/admin/self crawls it.

const BASE = "https://miscsubjects.com";
const OIP_VERSION = "0.1";

/** Canonical admin surfaces — paths match functions/admin/* routes. */
export const ADMIN_PAGE_REGISTRY = [
  { id: "directory", path: "/admin/directory", name: "Directory", what: "Every capability row + prompt — browse, search, open one key.", alter: "PATCH " + BASE + "/api/directory/<KEY> {content}" },
  { id: "directory_key", path: "/admin/directory/<key>", name: "Directory row", what: "One capability or agent prompt — read content, invoke, edit.", alter: "PATCH " + BASE + "/api/directory/<KEY> {content}" },
  { id: "directory_graph", path: "/admin/directory/graph", name: "Directory graph", what: "Visual graph of directory rows and relationships." },
  { id: "directory_models", path: "/admin/directory/models", name: "Models", what: "Model registry tied to directory ASK_* and provider rows." },
  { id: "directory_new", path: "/admin/directory/new", name: "New directory row", what: "Create a new capability / agent / flow row.", alter: "POST " + BASE + "/api/directory {key,type,content}" },
  { id: "ledger", path: "/admin/ledger", name: "Ledger", what: "Turns, state cards, chronology, voxels, bundles — every payload in/out.", read_query: "?cards=1&limit=20" },
  { id: "ledger_event", path: "/admin/ledger/<id>", name: "Ledger event", what: "One raw ledger event with full request/response." },
  { id: "content_map", path: "/admin/content-map", name: "Content map", what: "Article graph — slugs, links, ontology slice." },
  { id: "content_index", path: "/admin/content", name: "Content index", what: "Admin lens over published articles." },
  { id: "content_slug", path: "/admin/content/<slug>", name: "Content article", what: "One article admin view — slots, meta, editorial controls." },
  { id: "map", path: "/admin/map", name: "Map", what: "Build topology map — Mac bridge, deploy, storage bindings." },
  { id: "models_catalog", path: "/admin/models-catalog", name: "Model catalog", what: "Provider models available to the build." },
  { id: "vault", path: "/admin/vault", name: "Vault", what: "Obsidian vault sync + session scan cron bounds." },
  { id: "owner", path: "/admin/owner", name: "Owner", what: "Owner kernel — hash-chained boolean rules models read, cannot edit." },
  { id: "dojo", path: "/admin/dojo", name: "Dojo", what: "Agent training / experiment surface." },
  { id: "tasks", path: "/admin/tasks", name: "Tasks", what: "Task queue + writer-queue work state." },
  { id: "assets", path: "/admin/assets", name: "Assets", what: "R2 / image assets lens." },
  { id: "generate", path: "/admin/generate", name: "Generate", what: "Generation controls for content/assets." },
  { id: "cloaker", path: "/admin/cloaker", name: "Cloaker", what: "Root-domain cloaker settings — money page vs safe page." },
  { id: "selftest", path: "/admin/selftest", name: "Self-Test", what: "Graded self-test suite — build health checks." },
  { id: "agents", path: "/admin/agents", name: "Agents", what: "CLI agent team room + spawn controls." },
  { id: "cc", path: "/admin/cc", name: "Claude Code", what: "Claude Code session lens." },
  { id: "grok", path: "/admin/grok", name: "Grok CLI", what: "Grok CLI session lens — grok_turns, same shape as Claude Code." },
  { id: "kimi", path: "/admin/kimi", name: "Kimi CLI", what: "Kimi CLI session lens — kimi_turns, same shape as Grok/Claude." },
  { id: "handoff", path: "/api/handoff", name: "Unified handoff", what: "Content + backend in one self-explaining URL for any model + share token.", read_query: "?format=markdown" },
  { id: "manual", path: "/admin/manual", name: "Manual", what: "Operator manual — REST inventory for the build." },
  { id: "run", path: "/admin/run", name: "Run", what: "Dispatch runner — fire directory rows from admin." },
  { id: "trace", path: "/admin/trace", name: "Trace", what: "Trace id lookup — one conversation thread." },
  { id: "pages", path: "/admin/pages", name: "Pages", what: "CMS-style pages admin." },
  { id: "pages_slug", path: "/admin/pages/<slug>", name: "Page", what: "One CMS page edit view." },
  { id: "seed", path: "/admin/seed", name: "Seed", what: "Article seed — generate, write, ledger tabs.", alter: "POST " + BASE + "/api/protocol/write | /api/protocol/draft" },
  { id: "pipeline", path: "/admin/pipeline", name: "Pipeline", what: "Read-only writer-queue prompt mirror per article slug." },
  { id: "bind_secrets", path: "/admin/bind-secrets", name: "Bind secrets", what: "Cloudflare secrets store binding UI." },
];

export function listAdminPages() {
  return ADMIN_PAGE_REGISTRY.map((p) => ({
    ...p,
    read: BASE + p.path + (p.read_query || ""),
    self_url: BASE + "/api/admin/self?page=" + encodeURIComponent(p.id),
  }));
}

export function adminPageSelf(pageId) {
  const page = listAdminPages().find((p) => p.id === pageId);
  if (!page) return null;
  return {
    protocol: "OIP",
    version: OIP_VERSION,
    kind: "admin-page-self",
    principle: "No external context required. This block describes one admin surface — how to read it, how to alter it, where to look next.",
    page: page.id,
    name: page.name,
    path: page.path,
    what: page.what,
    read: page.read,
    alter: page.alter || null,
    self: page.self_url,
    proof_chain: [
      { step: 1, claim: "This admin page is one lens over the build.", verify: page.read },
      { step: 2, claim: "The full admin map is derived from /api/admin/self (no curation drift).", verify: BASE + "/api/admin/self" },
      { step: 3, claim: "The whole build self-model includes every admin page _self.", verify: BASE + "/api/dispatch?build=1" },
    ],
    related: [
      { id: "admin_map", what: "All admin pages", url: BASE + "/api/admin/self" },
      { id: "build", what: "Whole build god-map", url: BASE + "/api/dispatch?build=1" },
      { id: "ledger", what: "Turns + cards", url: BASE + "/admin/ledger?cards=1" },
    ],
    not_project_knowledge: true,
  };
}

export function adminPageSelfMarkdown(self) {
  if (!self) return "";
  const lines = [
    "## §SELF — admin page `" + self.page + "` (paste without context)",
    "",
    "**Principle:** " + self.principle,
    "",
    "**Page:** " + self.name + " — " + self.what,
    "- **path:** " + self.path,
    "- **read:** " + self.read,
    self.alter ? "- **alter:** " + self.alter : "",
    "- **self JSON:** " + self.self,
    "",
    "### Logical proof",
    ...(self.proof_chain || []).map((p) => p.step + ". " + p.claim + " → " + p.verify),
    "",
    "### Related",
    ...(self.related || []).map((r) => "- **" + r.id + "** — " + r.what + " · " + r.url),
    "",
    "*Derived from admin_page_self registry — not hand-curated per response.*",
  ].filter(Boolean);
  return lines.join("\n");
}

/** Crawler index — ?build=1 admin.pages derives from this. */
export function deriveAdminPagesForBuild() {
  return listAdminPages().map((p) => ({
    id: p.id,
    name: p.name,
    path: p.path,
    read: p.read,
    self: p.self_url,
    alter: p.alter || undefined,
    what: p.what,
  }));
}

export function adminPagesIndexPayload() {
  const pages = listAdminPages();
  return {
    protocol: "OIP",
    version: OIP_VERSION,
    kind: "admin-pages-index",
    principle: "Every admin surface self-describes. This index is derived from the registry — not hand-curated.",
    count: pages.length,
    pages: pages.map((p) => ({
      id: p.id,
      name: p.name,
      path: p.path,
      read: p.read,
      self: p.self_url,
      alter: p.alter || null,
      what: p.what,
    })),
    build: BASE + "/api/dispatch?build=1",
  };
}

const HANDOFF_SKIP_ADMIN_PAGE_IDS = new Set(["cloaker"]);

export function adminPagesIndexMarkdown({ forHandoff = false } = {}) {
  const idx = adminPagesIndexPayload();
  const pages = forHandoff ? idx.pages.filter((p) => !HANDOFF_SKIP_ADMIN_PAGE_IDS.has(p.id)) : idx.pages;
  const lines = [
    "## §SELF — miscsubjects admin pages (derived index)",
    "",
    "**Principle:** " + idx.principle,
    "",
    "**Count:** " + pages.length,
    "",
    "### Pages",
  ];
  for (const p of pages) {
    lines.push("- **" + p.name + "** (`" + p.id + "`) — " + p.what);
    lines.push("  - read: " + p.read);
    lines.push("  - self: " + p.self);
    if (p.alter) lines.push("  - alter: " + p.alter);
  }
  lines.push("", "*Derived from admin_page_self.js — crawler source for ?build=1.*");
  return lines.join("\n");
}