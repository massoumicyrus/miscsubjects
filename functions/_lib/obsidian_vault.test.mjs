// The one property of an exported note that cannot be caught by reading it: YAML has
// to be at byte 0. Obsidian parses properties only from the opening `---` of the
// file, so a single character in front of it silently costs the note its identity,
// its revision, its content hash, and every Bases view that queries them.
//
// Regression test for a defect that shipped: frontmatter was generated correctly for
// every note, and then wrapMarkdown() placed the §SELF preamble in front of it — so
// no note in the vault had readable properties. The wrapper won over the content,
// which is the same shape as the authored-prose defect in the invariants.

import test from "node:test";
import assert from "node:assert/strict";
import { frontmatterFirst, wantsAll, paging, zipFiles } from "./obsidian_vault.js";

const FM = ['---', 'id: "ms:article:bpc-157"', 'slug: "bpc-157"', 'revision: 3', '---'].join("\n");
const INNER = FM + "\n\n# BPC-157\n\nprose about the compound.\n";

test("the YAML block ends up at byte 0", () => {
  const out = frontmatterFirst("obsidian_article", INNER, { slug: "bpc-157" });
  assert.equal(
    out.startsWith("---\n"),
    true,
    "note does not begin with ---; Obsidian reads no properties. First 80: " +
      JSON.stringify(out.slice(0, 80)),
  );
});

test("every identity property survives the move", () => {
  const out = frontmatterFirst("obsidian_article", INNER, { slug: "bpc-157" });
  const fm = out.slice(0, out.indexOf("\n---", 4));
  for (const k of ["id:", "slug:", "revision:"]) {
    assert.ok(fm.includes(k), "frontmatter lost " + k);
  }
  assert.ok(fm.includes("ms:article:bpc-157"), "id is not the durable prefixed form");
});

test("the self-explaining preamble is kept, and follows the YAML", () => {
  const out = frontmatterFirst("obsidian_article", INNER, { slug: "bpc-157" });
  assert.ok(out.includes("§SELF"), "the §SELF block was dropped, not moved");
  assert.ok(
    out.indexOf("---") < out.indexOf("§SELF"),
    "the §SELF block must come after the frontmatter",
  );
});

test("the prose is kept", () => {
  const out = frontmatterFirst("obsidian_article", INNER, { slug: "bpc-157" });
  assert.ok(out.includes("prose about the compound."), "body text was lost");
  assert.ok(out.includes("# BPC-157"), "heading was lost");
});

test("a note with no frontmatter is wrapped unchanged, not corrupted", () => {
  const plain = "# just a heading\n\nno properties here.\n";
  const out = frontmatterFirst("obsidian_article", plain, { slug: "x" });
  assert.ok(out.includes("no properties here."), "body lost when there is no YAML");
  assert.equal(out.startsWith("---\n"), false, "invented a frontmatter block");
});

// ── Downloading the whole build ───────────────────────────────────────────────
// Three defects shipped together and made "download the build" impossible while
// answering ok:true the whole time. ?all=1 was not recognised, because only the
// literal string "true" counted, so a caller asking for 1,191 articles silently
// received the two-slug example list. ?all=true was recognised and exceeded the
// Worker's CPU limit, answering error 1102 after 104 seconds. And the export
// handed back a JSON array of files, so there was no archive a person could open.

const asUrl = (q) => new URL("https://miscsubjects.com/api/articles/obsidian-vault" + q);

test("every spelling of all means the whole corpus", () => {
  for (const q of ["?all=1", "?all=true", "?all=yes", "?all", "?all=TRUE"]) {
    assert.equal(wantsAll(asUrl(q)), true, `${q} should mean the whole corpus`);
  }
});

test("all can still be turned off, and is off when absent", () => {
  for (const q of ["?all=0", "?all=false", "?all=no", "?slugs=bpc-157", ""]) {
    assert.equal(wantsAll(asUrl(q)), false, `${q} should not mean the whole corpus`);
  }
});

test("the corpus is paged, so no single request has to render 1,191 articles", () => {
  const p = paging(asUrl("?all=1"), 1191);
  assert.equal(p.pageSize, 50, "default page size");
  assert.equal(p.pages, 24, "1,191 articles at 50 a page is 24 pages");
  assert.equal(p.page, 1);
});

test("page size is clamped, and a page past the end lands on the last page", () => {
  assert.equal(paging(asUrl("?page_size=5000"), 1191).pageSize, 100, "page size must be capped");
  assert.equal(paging(asUrl("?page_size=0"), 1191).pageSize, 50, "zero falls back to the default");
  assert.equal(paging(asUrl("?page_size=abc"), 1191).pageSize, 50, "garbage falls back");
  assert.equal(paging(asUrl("?page=9999"), 1191).page, 24, "past the end clamps to the last page");
  assert.equal(paging(asUrl("?page=0"), 1191).page, 1, "before the start clamps to the first page");
});

test("a small request is still one page, exactly as before", () => {
  const p = paging(asUrl("?slugs=protocol,bpc-157"), 2);
  assert.equal(p.pages, 1);
  assert.equal(p.page, 1);
});

test("the export is a real ZIP an unzip program can open", () => {
  const files = [
    { path: "README.md", content: "# miscsubjects\n" },
    { path: "Peptides/bpc-157/claims.md", content: "café ✓ unicode survives\n".repeat(20) },
  ];
  const z = zipFiles(files);

  assert.deepEqual([...z.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04], "must start with the local file header magic");

  // End of central directory: last 22 bytes, and it must count both entries.
  const eocd = z.slice(z.length - 22);
  assert.deepEqual([...eocd.slice(0, 4)], [0x50, 0x4b, 0x05, 0x06], "must end with the EOCD magic");
  const ev = new DataView(eocd.buffer, eocd.byteOffset, eocd.byteLength);
  assert.equal(ev.getUint16(10, true), 2, "EOCD must record both files");

  // The central directory offset it advertises must actually point at a central
  // directory header — an archive that lies here opens as empty in some tools.
  const cdOffset = ev.getUint32(16, true);
  assert.deepEqual([...z.slice(cdOffset, cdOffset + 4)], [0x50, 0x4b, 0x01, 0x02], "CD offset must point at a CD header");
});

test("an empty file list still produces a valid, empty archive", () => {
  const z = zipFiles([]);
  assert.equal(z.length, 22, "an empty zip is just the EOCD");
  assert.deepEqual([...z.slice(0, 4)], [0x50, 0x4b, 0x05, 0x06]);
});
