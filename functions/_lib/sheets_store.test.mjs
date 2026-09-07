// Pins the A1 grammar behind /api/sheets. One address math shared by the API, the grid UI,
// and the run lane — a second copy of column arithmetic is a second sheet coordinate system.

import test from "node:test";
import assert from "node:assert/strict";
import { MAX_COLS, colToLetter, letterToCol, parseCellRef, parseRange, rangeToA1 } from "./sheets_store.js";

test("column letters round-trip like Google Sheets", () => {
  assert.equal(colToLetter(1), "A");
  assert.equal(colToLetter(26), "Z");
  assert.equal(colToLetter(27), "AA");
  assert.equal(colToLetter(52), "AZ");
  assert.equal(colToLetter(53), "BA");
  assert.equal(colToLetter(104), "CZ");
  for (const n of [1, 2, 25, 26, 27, 51, 52, 53, 77, 104]) {
    assert.equal(letterToCol(colToLetter(n)), n);
  }
  assert.equal(letterToCol("a"), 1);
  assert.equal(letterToCol("!"), null);
  assert.equal(letterToCol(""), null);
});

test("a native sheet can address the full Google Sheets column span", () => {
  assert.equal(MAX_COLS, 18278);
  assert.equal(colToLetter(MAX_COLS), "ZZZ");
  assert.equal(letterToCol("ZZZ"), MAX_COLS);
});

test("cell refs parse: B3, bare column, bare row", () => {
  assert.deepEqual(parseCellRef("B3"), { r: 3, c: 2 });
  assert.deepEqual(parseCellRef("b3"), { r: 3, c: 2 });
  assert.deepEqual(parseCellRef("AA10"), { r: 10, c: 27 });
  assert.deepEqual(parseCellRef("D"), { r: null, c: 4 });
  assert.deepEqual(parseCellRef("7"), { r: 7, c: null });
  assert.equal(parseCellRef(""), null);
  assert.equal(parseCellRef("B0"), null);
  assert.equal(parseCellRef("3B"), null);
});

test("ranges parse: single cell, rectangle, whole columns, whole rows, open bottom", () => {
  assert.deepEqual(parseRange("A1"), { r1: 1, c1: 1, r2: 1, c2: 1 });
  assert.deepEqual(parseRange("A1:C10"), { r1: 1, c1: 1, r2: 10, c2: 3 });
  assert.deepEqual(parseRange("C10:A1"), { r1: 1, c1: 1, r2: 10, c2: 3 }); // reversed corners normalize
  assert.deepEqual(parseRange("B:D"), { r1: null, r2: null, c1: 2, c2: 4 });
  assert.deepEqual(parseRange("2:5"), { r1: 2, r2: 5, c1: null, c2: null });
  assert.deepEqual(parseRange("A2:C"), { r1: 2, r2: null, c1: 1, c2: 3 });
  assert.equal(parseRange(""), null);
  assert.equal(parseRange(":"), null);
});

test("rangeToA1 collapses single cells", () => {
  assert.equal(rangeToA1(1, 1, 1, 1), "A1");
  assert.equal(rangeToA1(3, 2, 10, 4), "B3:D10");
});

test("a private native sheet grants access only for its password and signed sheet cookie", async () => {
  const page = await import("../sheet/[id].js");
  assert.equal(typeof page.hashSheetPassword, "function");
  assert.equal(typeof page.issueSheetAccessCookie, "function");
  assert.equal(typeof page.hasSheetAccess, "function");
  const passwordHash = await page.hashSheetPassword("owner-chosen-password");
  const sheet = { id: "sh_daily", col_meta: { access: { password_sha256: passwordHash } } };
  assert.equal(await page.sheetPasswordMatches(sheet, "owner-chosen-password"), true);
  assert.equal(await page.sheetPasswordMatches(sheet, "wrong-password"), false);
  const setCookie = await page.issueSheetAccessCookie(sheet, "server-signing-secret", 1_000_000);
  const cookie = setCookie.split(";", 1)[0];
  const request = new Request("https://miscsubjects.com/sheet/sh_daily", { headers: { cookie } });
  assert.equal(await page.hasSheetAccess(request, sheet, "server-signing-secret", 1_000_001), true);
  assert.equal(await page.hasSheetAccess(request, { ...sheet, id: "sh_other" }, "server-signing-secret", 1_000_001), false);
  assert.equal(await page.hasSheetAccess(request, sheet, "server-signing-secret", 1_000_000 + 86_400_001), false);
});

test("the native sheet link pages to the last column without dropping it", async () => {
  const page = await import("../sheet/[id].js");
  assert.equal(typeof page.sheetWindow, "function");
  const window = page.sheetWindow(new URL("https://miscsubjects.com/sheet/sh_daily?row_start=202&column_start=6101"), {
    used_rows: 439,
    used_cols: 6157,
  });
  assert.deepEqual(window, { rowStart: 202, rowEnd: 401, colStart: 6101, colEnd: 6157, rowLimit: 200, colLimit: 100 });
});

test("sparse imports accept wide coordinates and refuse any silent truncation", async () => {
  const { normalizeSparseCells } = await import("./sheets_store.js");
  assert.equal(typeof normalizeSparseCells, "function");
  assert.deepEqual(normalizeSparseCells([[2, 6157, "last daily field"], { r: 3, c: 18278, value: 9 }]), {
    cells: [[2, 6157, "last daily field"], [3, 18278, "9"]],
  });
  assert.equal(normalizeSparseCells([[1, 18279, "outside"]]).error, "cell_out_of_bounds");
  assert.equal(normalizeSparseCells(Array.from({ length: 2001 }, (_, i) => [i + 1, 1, "x"])).error, "too_many_cells");
});
