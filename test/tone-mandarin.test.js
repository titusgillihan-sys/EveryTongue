"use strict";
/**
 * Mandarin keeps working behind the same tone-module interface. This is the
 * proof that adding Vietnamese needed no change to scorer, alignment or search.
 */
const test = require("node:test");
const assert = require("node:assert");
const zh = require("../tone/mandarin.js");
const { forLanguage } = require("../tone/index.js");
const { FixtureScriptureProvider } = require("../providers/scripture.js");
const { StubModelProvider } = require("../providers/model.js");
const { loadMelodies } = require("../melodies.js");
const { search } = require("../search.js");

test("dictionary tones and third-tone sandhi come through the interface", () => {
  const syl = zh.syllabify("你好");
  assert.deepStrictEqual(syl.map((s) => s.tone), [3, 3]);
  assert.deepStrictEqual(syl.map((s) => s.effectiveTone), [2, 3]);
  assert.strictEqual(syl[0].sandhi, true);
  assert.deepStrictEqual(syl[0].shape, zh.TONES[2].shape, "shape is the SPOKEN tone");
});

test("neutral and unknown characters have no shape and are never flagged", () => {
  const syl = zh.syllabify("的龘"); // 龘 is CJK but in neither dictionary
  assert.strictEqual(syl[0].tone, 5);
  assert.strictEqual(syl[0].shape, null);
  assert.strictEqual(syl[1].unknown, true);
  assert.strictEqual(syl[1].shape, null);
});

test("both languages resolve from the registry with the same interface", () => {
  for (const code of ["vi", "zh"]) {
    const mod = forLanguage(code);
    assert.strictEqual(typeof mod.syllabify, "function");
    assert.ok(mod.TONES);
    assert.strictEqual(mod.id, code);
  }
  assert.throws(() => forLanguage("xx"));
});

test("the full engine runs on a Mandarin passage unchanged", async () => {
  const scripture = new FixtureScriptureProvider();
  const passage = await scripture.getPassage("CUVS", "psalm-23-cuvs");
  const out = await search({
    passage,
    melodies: loadMelodies(),
    toneModule: forLanguage(passage.version.language),
    baselineMelodyId: "new-britain",
    model: new StubModelProvider(),
  });
  assert.strictEqual(out.language, "zh");
  assert.ok(out.baseline.totals.conflicts > 0, "the baseline should have something to fix");
  assert.ok(out.results.length > 0, "a re-alignment should improve a naive Mandarin setting");
  for (const r of out.results) {
    assert.ok(r.totals.severity < out.baseline.totals.severity || r.totals.conflicts < out.baseline.totals.conflicts);
  }
  const rows = out.baseline.chunks.flatMap((c) => c.rows);
  assert.strictEqual(rows.length, 33, "耶和华是我的牧者 我必不致缺乏 他使我躺卧在青草地上 领我在可安歇的水边 is 33 characters");
  assert.ok(rows.some((r) => r.label.includes("sandhi")), "sandhi is visible in the breakdown");
});
