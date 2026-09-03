// Pins the A1 grammar behind /api/sheets. One address math shared by the API, the grid UI,
// and the run lane — a second copy of column arithmetic is a second sheet coordinate system.

import test from "node:test";
import assert from "node:assert/strict";
import { colToLetter, letterToCol, parseCellRef, parseRange, rangeToA1 } from "./sheets_store.js";

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
