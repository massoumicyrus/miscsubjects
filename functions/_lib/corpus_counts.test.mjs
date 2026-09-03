// ONE CANONICAL CORPUS COUNT — the numbers on every surface come from one query.
//
// Built from the exact failure of 2026-08-08: the homepage feed block rendered
// "1,015 articles" (its own filtered feed length) while the identity block on the SAME
// page rendered "1,173 articles" (llms.txt's own SQL), and the claims counts split the
// same way (10,479 vs 10,903). Two local queries, two truths, one page. A raw COUNT(*)
// of `articles` (~2,344) is a third wrong number — the table holds source_ledger/source/
// audit registers that are not articles.
//
// These tests pin: (1) both display surfaces import the one canonical function instead
// of carrying their own SQL, and (2) the canonical query names its register set.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { corpusCounts, CORPUS_EXCLUDED_REGISTERS, CORPUS_COUNT_LABEL } from "./corpus_counts.js";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(here, rel), "utf8");

describe("every displayed corpus number comes from corpus_counts", () => {
  it("functions/index.js imports corpus_counts and uses it", () => {
    const src = read("../index.js");
    expect(src).toMatch(/from\s+['"]\.\/_lib\/corpus_counts\.js['"]/);
    expect(src).toMatch(/corpusCounts\s*\(/);
  });

  it("functions/llms.txt.js imports corpus_counts and uses it", () => {
    const src = read("../llms.txt.js");
    expect(src).toMatch(/from\s+['"]\.\/_lib\/corpus_counts\.js['"]/);
    expect(src).toMatch(/corpusCounts\s*\(/);
    // The local SQL variant that drifted from the homepage must not come back.
    expect(src).not.toMatch(/SUM\(CASE WHEN COALESCE\(json_extract\(meta,'\$\.register'\)/);
  });

  it("the homepage labels what the number counts, so it can never be read as the feed length", () => {
    const src = read("../index.js");
    expect(src).toContain("CORPUS_COUNT_LABEL");
    expect(CORPUS_COUNT_LABEL).toMatch(/published articles/i);
    expect(CORPUS_COUNT_LABEL).toMatch(/register/i);
  });
});

describe("the canonical query names its register set", () => {
  it("counts published rows and excludes the non-article registers", async () => {
    let sql = "";
    const env = {
      DB: {
        prepare(q) {
          sql = q;
          return { first: async () => ({ articles: 1173, claims: 10903, sources: 4200 }) };
        },
      },
    };
    const got = await corpusCounts(env);
    expect(got).toEqual({ articles: 1173, claims: 10903, sources: 4200 });
    expect(sql).toMatch(/published\s*=\s*1/);
    for (const reg of CORPUS_EXCLUDED_REGISTERS) expect(sql).toContain(reg);
    expect(CORPUS_EXCLUDED_REGISTERS).toEqual(["source_ledger", "source", "audit"]);
  });

  it("returns zeros, not NaN, on an empty corpus", async () => {
    const env = { DB: { prepare: () => ({ first: async () => ({ articles: null, claims: null, sources: null }) }) } };
    expect(await corpusCounts(env)).toEqual({ articles: 0, claims: 0, sources: 0 });
  });
});
