// Round-trip integrity: the vault export must not lose links, ids, or
// structure, and the wikilink mapping must invert cleanly:
//   site:   [[slug]]            -> /a/slug
//   export: /a/slug, [[slug]]   -> [[<ontology path>/README|label]]
// Run: node --test functions/_lib/knowledge_loop.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { extractBodyLinks } from "./knowledge_loop.js";
import { bodyToWikilinks, vaultFolder } from "./obsidian_vault.js";

const REG = {
  protocol: vaultFolder("protocol"),
  "bpc-157": vaultFolder("bpc-157"),
};

test("extractBodyLinks finds typed links and wikilinks, skips reserved grammars", () => {
  const body = [
    "See [[protocol]] and [[bpc-157|the peptide]] for context.",
    "Canonical link: [the protocol](/a/protocol) and [abs](https://miscsubjects.com/a/bpc-157).",
    "[[embed:source:s1]]",
    "[[object:rows:tenant:t_x]]",
    "[[stack-embed:wolverine]]",
    "[[graph]]",
    "A missing page: [[not-written-yet]].",
  ].join("\n");
  const { wiki, typed } = extractBodyLinks(body);
  assert.deepEqual(wiki.sort(), ["bpc-157", "not-written-yet", "protocol"]);
  assert.deepEqual(typed.sort(), ["bpc-157", "protocol"]);
  assert.ok(!wiki.includes("graph"));
});

test("bodyToWikilinks converts canonical links and typed wikilinks, keeps unknown + reserved intact", () => {
  const body =
    "Read [the protocol](/a/protocol), [[bpc-157|the peptide]], [[not-exported]], " +
    "[ext](https://example.com/a/protocol), [[embed:source:s1]] and [[graph]].";
  const out = bodyToWikilinks(body, REG);
  assert.ok(out.includes(`[[${REG.protocol}/README|the protocol]]`));
  assert.ok(out.includes(`[[${REG["bpc-157"]}/README|the peptide]]`));
  assert.ok(out.includes("[[not-exported]]"), "unknown slug stays as typed (recorded gap)");
  assert.ok(out.includes("[ext](https://example.com/a/protocol)"), "foreign hosts untouched");
  assert.ok(out.includes("[[embed:source:s1]]"), "reserved block grammar untouched");
  assert.ok(out.includes("[[graph]]"), "graph marker untouched");
});

test("round trip preserves every link target", () => {
  const body =
    "Alpha [[protocol]] beta [p](/a/protocol) gamma [[bpc-157|label]] delta " +
    "[q](https://miscsubjects.com/a/bpc-157) epsilon [[missing-page]].";
  const before = extractBodyLinks(body);
  const exported = bodyToWikilinks(body, REG);
  // Every exported vault wikilink names the ontology path of the same slug.
  for (const slug of ["protocol", "bpc-157"]) {
    assert.ok(exported.includes(`[[${REG[slug]}/README|`), slug + " survived export");
  }
  // The site-direction mapping (/a/<slug>) recovers every original target.
  const recovered = exported
    .replace(/\[\[([A-Za-z]+\/[a-z0-9_-]+)\/README\|([^\]]+)\]\]/g, (m, p, label) => {
      const slug = p.split("/").pop();
      return `[${label}](/a/${slug})`;
    });
  const after = extractBodyLinks(recovered);
  const targetsBefore = new Set([...before.wiki, ...before.typed]);
  const targetsAfter = new Set([...after.wiki, ...after.typed]);
  for (const t of targetsBefore) assert.ok(targetsAfter.has(t), t + " lost in round trip");
});

test("site wikilink regex maps [[slug]] and [[slug|label]] to /a/<slug> anchors", () => {
  // Mirror of the reader-route inline() replacement in functions/a/[slug].js.
  const WIKILINK_RE = /\[\[([a-z0-9][a-z0-9_-]{1,80})(?:\|([^\]\n]{1,160}))?\]\]/gi;
  const wikiMap = { protocol: "The Protocol" };
  const renderInline = (t) =>
    t.replace(WIKILINK_RE, (m0, target, label) => {
      const key = target.toLowerCase();
      if (key === "graph") return m0;
      const title = wikiMap[key];
      const text = label || title || target;
      return title === undefined
        ? `<span class="wl-unresolved">${text}</span>`
        : `<a class="wikilink" href="/a/${key}">${text}</a>`;
    });
  assert.equal(
    renderInline("see [[protocol]] now"),
    'see <a class="wikilink" href="/a/protocol">The Protocol</a> now',
  );
  assert.equal(
    renderInline("see [[protocol|the law]]"),
    'see <a class="wikilink" href="/a/protocol">the law</a>',
  );
  assert.equal(
    renderInline("gap [[missing-page]]"),
    'gap <span class="wl-unresolved">missing-page</span>',
  );
  assert.equal(renderInline("block [[graph]]"), "block [[graph]]");
});
