"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { search } = require("../search.js");
const { compareTotals } = require("../scorer.js");
const { forLanguage } = require("../tone/index.js");
const { FixtureScriptureProvider } = require("../providers/scripture.js");
const { StubModelProvider, cached } = require("../providers/model.js");
const { loadMelodies } = require("../melodies.js");

const vi = forLanguage("vi");
const fakePassage = (chunks) => ({
  id: "fake",
  reference: "Fake 1:1",
  version: { id: "FAKE", name: "fake", language: "vi", copyright: "n/a" },
  chunks: chunks.map((text, index) => ({ index, text, source: "scripture:FAKE" })),
});
const flat = { id: "flat", name: "Flat", community: "-", license: "PD", sourceUrl: "-", verified: false,
  phrases: [{ midi: [60, 60, 60, 60, 60] }] };
const other = { id: "other", name: "Other flat", community: "-", license: "PD", sourceUrl: "-", verified: false,
  phrases: [{ midi: [64, 64, 64, 64, 64] }] };

test("search returns an EMPTY result set when nothing beats the baseline", async () => {
  // A flat phrase can never be in contrary motion, so the baseline is already
  // perfect and no melody or alignment can improve on it.
  const out = await search({
    passage: fakePassage(["Đức Giê-hô-va là Đấng", "chăn giữ tôi luôn luôn"]),
    melodies: [flat, other],
    toneModule: vi,
    baselineMelodyId: "flat",
    model: new StubModelProvider(),
  });
  assert.strictEqual(out.baseline.totals.conflicts, 0);
  assert.deepStrictEqual(out.results, []);
  assert.ok(out.failure && typeof out.failure.explanation === "string" && out.failure.explanation.length > 0);
  assert.strictEqual(out.attempts.length, 2, "every melody is still recorded as tried");
});

test("search never returns the baseline or anything equal to it", async () => {
  const scripture = new FixtureScriptureProvider();
  const melodies = loadMelodies();
  for (const meta of await scripture.listPassages()) {
    const passage = await scripture.getPassage(meta.versionId, meta.id);
    for (const m of melodies) {
      const out = await search({
        passage, melodies, toneModule: forLanguage(passage.version.language), baselineMelodyId: m.id,
        model: cached(new StubModelProvider()),
      });
      for (const r of out.results) {
        assert.ok(compareTotals(r.totals, out.baseline.totals) < 0, `${meta.id}/${m.id}: result must be strictly better`);
        assert.ok(r.prior && r.verdict && typeof r.verdict.rationale === "string", "prior and model verdict both recorded");
      }
      if (out.results.length === 0) assert.ok(out.failure, "empty results always come with an explanation");
      else assert.strictEqual(out.failure, null);
    }
  }
});

test("the reference demo: Psalm 23 on New Britain improves by re-alignment alone", async () => {
  const scripture = new FixtureScriptureProvider();
  const passage = await scripture.getPassage("VI1925", "psalm-23-vi1925");
  const out = await search({
    passage, melodies: loadMelodies(), toneModule: vi, baselineMelodyId: "new-britain", model: new StubModelProvider(),
  });
  assert.ok(out.baseline.totals.conflicts > 0);
  assert.ok(out.results.length > 0);
  assert.ok(out.results[0].totals.severity < out.baseline.totals.severity);
});

test("model verdicts are cached by input hash", async () => {
  const model = cached(new StubModelProvider());
  const args = { passage: fakePassage(["a"]), melody: flat, prior: { conflicts: 0, severity: 0, secondary: 0 } };
  const a = await model.judgeMelodySuitability(args);
  const b = await model.judgeMelodySuitability(JSON.parse(JSON.stringify(args)));
  assert.strictEqual(a, b, "same input hash returns the same object");
  assert.strictEqual(model.cache.size, 1);
});
