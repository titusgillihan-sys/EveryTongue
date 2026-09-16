"use strict";
/**
 * LEVER 1: different published translations use different words, so
 * different tone sequences. The provider exposes the same passage in several
 * versions and search() runs over each unchanged.
 */
const test = require("node:test");
const assert = require("node:assert");
const { FixtureScriptureProvider, rotateTones } = require("../providers/scripture.js");
const { searchTranslations } = require("../search.js");
const { compareTotals } = require("../scorer.js");
const { forLanguage } = require("../tone/index.js");
const { loadMelodies } = require("../melodies.js");
const { StubModelProvider } = require("../providers/model.js");
const { render } = require("../cli/report.js");

const vi = forLanguage("vi");

test("the synthetic version is opt-in, derived not committed, and tagged as not Scripture", async () => {
  const plain = new FixtureScriptureProvider();
  assert.deepStrictEqual((await plain.listVersions("vi")).map((v) => v.id), ["VI1925"]);
  assert.ok(!(await plain.listPassages()).some((p) => p.synthetic));

  const syn = new FixtureScriptureProvider({ includeSynthetic: true });
  assert.deepStrictEqual((await syn.listVersions("vi")).map((v) => v.id), ["VI1925", "VI1925-SYN"]);
  const p = await syn.getPassage("VI1925-SYN", "PSA.23.1-2");
  assert.strictEqual(p.synthetic, true);
  assert.match(p.textSource, /^synthetic:/);
  assert.match(p.version.copyright, /SYNTHETIC TEST DATA, NOT SCRIPTURE/);
  assert.match(p.version.name, /NOT SCRIPTURE/);
  for (const c of p.chunks) assert.match(c.source, /^synthetic:/);
});

test("the synthetic twin has a different tone sequence, same syllable count and punctuation", async () => {
  const syn = new FixtureScriptureProvider({ includeSynthetic: true });
  const real = await syn.getPassage("VI1925", "PSA.23.1-2");
  const fake = await syn.getPassage("VI1925-SYN", "PSA.23.1-2");
  const a = vi.syllabify(real.text);
  const b = vi.syllabify(fake.text);
  assert.strictEqual(a.length, b.length);
  assert.ok(a.some((s, i) => s.tone !== b[i].tone));
  assert.ok(a.every((s, i) => s.tone !== b[i].tone), "every tone is rotated");
  assert.strictEqual(a.map((s) => s.trailing).join(""), b.map((s) => s.trailing).join(""));
  assert.strictEqual(rotateTones(rotateTones(rotateTones(rotateTones(rotateTones(rotateTones("ma mà má mả mã mạ")))))), "ma mà má mả mã mạ");
});

test("the lever searches every version and tags each result with its version", async () => {
  const syn = new FixtureScriptureProvider({ includeSynthetic: true });
  const passages = [];
  for (const v of await syn.versionsWithPassage("PSA.23.1-2", "vi")) passages.push(await syn.getPassage(v.id, "PSA.23.1-2"));
  assert.strictEqual(passages.length, 2);
  const melodies = loadMelodies();
  const out = await searchTranslations({ passages, baselineVersionId: "VI1925", melodies, toneModule: vi,
    baselineMelodyId: "new-britain", model: new StubModelProvider() });
  assert.strictEqual(out.baseline.versionId, "VI1925");
  const versionsSeen = new Set(out.attempts.map((a) => a.versionId));
  assert.deepStrictEqual([...versionsSeen].sort(), ["VI1925", "VI1925-SYN"]);
  assert.strictEqual(out.attempts.length, melodies.length * 2);
  for (const r of out.results) {
    assert.ok(r.versionId && r.version && typeof r.synthetic === "boolean");
    assert.ok(compareTotals(r.totals, out.baseline.totals) < 0, "measured against the one baseline");
    assert.ok(r.prior && r.verdict);
    assert.match(r.kind, /^(same|different) translation, /);
  }
  // Both versions are rendered with their notices, and the synthetic one is labelled on every line it appears in.
  const text = render(out, melodies);
  assert.match(text, /VI1925: Kinh Thánh Tiếng Việt 1925/);
  assert.match(text, /VI1925-SYN: SYNTHETIC .* NOT SCRIPTURE/);
  for (const line of text.split("\n")) {
    if (/VI1925-SYN/.test(line) && !/Notice:|Text:/.test(line)) assert.match(line, /SYNTHETIC — NOT SCRIPTURE/, line);
  }
});

test("with a single version the lever degenerates to the plain search (Mandarin still passes)", async () => {
  const p = new FixtureScriptureProvider({ includeSynthetic: true });
  const versions = await p.versionsWithPassage("PSA.23.1-2", "zh");
  assert.deepStrictEqual(versions.map((v) => v.id), ["CUVS"], "no synthetic twin is made for Mandarin");
  const passages = [await p.getPassage("CUVS", "PSA.23.1-2")];
  const out = await searchTranslations({ passages, baselineVersionId: "CUVS", melodies: loadMelodies(), toneModule: forLanguage("zh"),
    baselineMelodyId: "new-britain", model: new StubModelProvider() });
  assert.strictEqual(out.language, "zh");
  assert.ok(out.results.length > 0);
});
