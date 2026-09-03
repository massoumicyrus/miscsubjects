// Self-audit endpoint (audit 2026-07-24, P2-1/P2-2): the site's core promise is "every
// sentence on this page ends in something you can open." Nothing enforced that before this —
// which is exactly how a homepage link to a 404 shipped. This runs the checks live, in public,
// and gives the /careers "Protocol Conformance Engineer" role a machine target instead of a
// posted description with no surface.
const BASE = "https://miscsubjects.com";
const TEST_ID_PATTERN = /^__|^TEST_ROW$|^TEST_ALL$|^AUDIT_TEST_ROW$|DUMMY|SCRATCH/i;

async function checkLinks() {
  const res = await fetch(BASE + "/");
  // Scan only real markup: the homepage builds its article feed in inline JS, and href-shaped
  // string fragments inside <script> ('/a/' + esc(f.slug) + ') are code, not links. Scanning
  // them produced false 404s that failed every scheduled conformance run on 2026-07-25.
  const html = (await res.text()).replace(/<script[\s\S]*?<\/script>/gi, "");
  const found = new Set();
  const hrefRe = /(?:href|src)="(\/[^"#?]*(?:\?[^"#]*)?)"/g;
  let m;
  while ((m = hrefRe.exec(html))) found.add(m[1]);
  const apiRe = /\/api\/[a-zA-Z0-9/_\-?=&]+/g;
  while ((m = apiRe.exec(html))) found.add(m[0]);
  const urls = [...found].filter((u) => !u.startsWith("//"));
  const results = [];
  for (const u of urls) {
    try {
      const r = await fetch(BASE + u, { redirect: "manual" });
      results.push({ url: u, status: r.status, ok: r.status < 400 });
    } catch (e) {
      results.push({ url: u, status: null, ok: false, error: String(e && e.message || e) });
    }
  }
  return results;
}

async function checkCorpusCounts() {
  const [g, a] = await Promise.all([
    fetch(BASE + "/api/metrics/grounding").then((r) => r.json()).catch(() => null),
    fetch(BASE + "/api/articles?limit=1").then((r) => r.json()).catch(() => null),
  ]);
  const groundingArticles = g ? Number(g.articles) : null;
  const apiArticlesTotal = a ? Number(a.total) : null;
  return {
    grounding_articles: groundingArticles,
    api_articles_total: apiArticlesTotal,
    agree: groundingArticles != null && apiArticlesTotal != null && groundingArticles === apiArticlesTotal,
  };
}

async function checkRegistryClean() {
  const r = await fetch(BASE + "/api/dispatch?registry=1").then((r) => r.json()).catch(() => null);
  const objects = (r && r.objects) || [];
  const bad = objects.filter((o) => TEST_ID_PATTERN.test(String(o.id || ""))).map((o) => o.id);
  return { count: objects.length, test_pattern_ids_found: bad };
}

export async function onRequestGet(context) {
  const [links, counts, registry] = await Promise.all([
    checkLinks(),
    checkCorpusCounts(),
    checkRegistryClean(),
  ]);
  const brokenLinks = links.filter((l) => !l.ok);
  const checks = {
    homepage_links_resolve: { pass: brokenLinks.length === 0, broken: brokenLinks, checked: links.length },
    corpus_counts_agree: { pass: counts.agree, detail: counts },
    registry_has_no_test_ids: { pass: registry.test_pattern_ids_found.length === 0, detail: registry },
  };
  const pass = Object.values(checks).every((c) => c.pass);
  const body = {
    computed_at: new Date().toISOString(),
    pass,
    checks,
    note: "this is the machine target for the /careers Protocol Conformance Engineer role: the site audits itself in public instead of describing that as future work.",
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
