"use strict";
const test = require("node:test");
const assert = require("node:assert");
const align = require("../align.js");

function check(spans, n, m) {
  assert.strictEqual(spans.length, n);
  assert.strictEqual(spans[0][0], 0);
  assert.strictEqual(spans[n - 1][1], m - 1);
  const onNote = {};
  for (let i = 0; i < n; i++) {
    const [a, b] = spans[i];
    assert.ok(b - a + 1 <= align.MAX_MELISMA, "melisma bound");
    if (i > 0) {
      const [pa, pb] = spans[i - 1];
      assert.ok(a === pb + 1 || (a === pb && pa === pb && a === b), "monotone; shared notes are single notes on both sides");
    }
    if (a === b) onNote[a] = (onNote[a] || 0) + 1;
  }
  assert.ok(Object.values(onNote).every((c) => c <= align.MAX_SHARE), "share bound");
}

test("every enumerated alignment respects the bounds and covers the phrase", () => {
  for (const [n, m] of [[3, 3], [4, 3], [3, 4], [8, 8], [8, 10], [10, 8], [7, 9], [9, 7]]) {
    const all = align.enumerateAlignments(n, m);
    assert.ok(all.length > 0, `${n}x${m} should be feasible`);
    for (const spans of all) check(spans, n, m);
    const seen = new Set(all.map((s) => JSON.stringify(s)));
    assert.strictEqual(seen.size, all.length, "no duplicates");
  }
});

test("a count difference over the bound is rejected outright", () => {
  assert.deepStrictEqual(align.enumerateAlignments(6, 9), []);
  assert.deepStrictEqual(align.enumerateAlignments(9, 6), []);
  assert.strictEqual(align.feasible(6, 8), true);
});

test("the naive baseline is one syllable per note with the tail held or crowded", () => {
  assert.deepStrictEqual(align.naiveAlignment(3, 3), [[0, 0], [1, 1], [2, 2]]);
  assert.deepStrictEqual(align.naiveAlignment(3, 6), [[0, 0], [1, 1], [2, 5]]);
  assert.deepStrictEqual(align.naiveAlignment(5, 3), [[0, 0], [1, 1], [2, 2], [2, 2], [2, 2]]);
});

test("enumeration order is deterministic", () => {
  assert.deepStrictEqual(align.enumerateAlignments(8, 9), align.enumerateAlignments(8, 9));
});
