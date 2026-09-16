"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { chunkPassage, chunkCost, loadPenalties, rejoin } = require("../chunker.js");
const { forLanguage } = require("../tone/index.js");
const { loadMelodies } = require("../melodies.js");
const { FixtureScriptureProvider } = require("../providers/scripture.js");
const { search } = require("../search.js");
const { StubModelProvider } = require("../providers/model.js");

const vi = forLanguage("vi");
const zh = forLanguage("zh");
const penalties = loadPenalties();
const melody = (lengths) => ({ id: "m", phrases: lengths.map((n) => ({ midi: Array(n).fill(60) })) });

/** Every segmentation of n syllables, scored the same way, for brute-force comparison. */
function bruteForce(syllables, mel) {
  const n = syllables.length;
  const P = mel.phrases.length;
  const out = [];
  const go = (i, c, breaks, cost) => {
    if (i === n) return out.push({ cost, breaks: breaks.join(",") });
    for (let j = i + 1; j <= n; j++) {
      const k = chunkCost(syllables, i, j, mel.phrases[c % P].midi.length, penalties);
      if (k !== Infinity) go(j, c + 1, j < n ? [...breaks, j] : breaks, cost + k);
    }
  };
  go(0, 0, [], 0);
  return out.sort((a, b) => a.cost - b.cost || a.breaks.localeCompare(b.breaks));
}

test("the DP is exact: its top-N matches brute force on many small inputs", () => {
  let seed = 7;
  const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const puncts = ["", "", "", ",", ".", ";", ":"];
  let compared = 0;
  for (let trial = 0; trial < 60; trial++) {
    const n = 4 + Math.floor(rand() * 9);
    const syllables = Array.from({ length: n }, (_, i) => ({
      text: "s" + i, trailing: puncts[Math.floor(rand() * puncts.length)], joinedToNext: rand() < 0.15 && i < n - 1,
    }));
    const mel = melody([2 + Math.floor(rand() * 4), 2 + Math.floor(rand() * 4)]);
    const expected = bruteForce(syllables, mel);
    const got = chunkPassage(syllables, mel, { penalties, topN: 4 });
    assert.strictEqual(got.length, Math.min(4, expected.length), `trial ${trial}: count`);
    got.forEach((g, k) => {
      assert.strictEqual(g.penalty, expected[k].cost, `trial ${trial}: cost of rank ${k}`);
      assert.strictEqual(g.breaks.join(","), expected[k].breaks, `trial ${trial}: breaks of rank ${k}`);
    });
    compared++;
  }
  assert.strictEqual(compared, 60);
});

test("a break is never placed inside a hyphenated name", () => {
  const syl = vi.syllabify("xin Giê-hô-va Đức Chúa Trời nghe");
  // phrases of 2 notes force a break every 2 syllables unless forbidden
  for (const seg of chunkPassage(syl, melody([2, 3]), { penalties, topN: 10 })) {
    for (const c of seg.chunks) assert.strictEqual(c.syllables[c.syllables.length - 1].joinedToNext, false);
  }
});

test("breaks prefer punctuation: the cheapest chunking of Psalm 23:1-2 on New Britain is the hand chunking", async () => {
  const passage = await new FixtureScriptureProvider().getPassage("VI1925", "psalm-23-vi1925");
  const nb = loadMelodies().find((m) => m.id === "new-britain");
  const [top] = chunkPassage(vi.syllabify(passage.text), nb, { penalties, separator: vi.separator });
  assert.deepStrictEqual(top.chunks.map((c) => c.text), passage.chunks.map((c) => c.text));
});

test("long passages cycle the phrase list", async () => {
  const passage = await new FixtureScriptureProvider().getPassage("VI1925", "psalm-23-1-4-vi1925");
  const nb = loadMelodies().find((m) => m.id === "new-britain");
  const [top] = chunkPassage(vi.syllabify(passage.text), nb, { penalties, separator: vi.separator });
  assert.ok(top.chunks.length > nb.phrases.length);
  top.chunks.forEach((c, i) => assert.strictEqual(c.phraseIndex, i % nb.phrases.length));
});

test("chunk texts rejoin to the passage text verbatim, in both languages", async () => {
  const p = new FixtureScriptureProvider();
  for (const [id, mod] of [["psalm-23-1-4-vi1925", vi], ["john-3-16-vi1925", vi], ["psalm-23-cuvs", zh]]) {
    const passage = await p.getPassage(passage_version(id), id);
    const syl = mod.syllabify(passage.text);
    assert.strictEqual(rejoin(syl, mod.separator), passage.text.replace(/\s+/g, mod.separator === "" ? "" : " "));
    for (const seg of chunkPassage(syl, loadMelodies()[1], { penalties, separator: mod.separator })) {
      assert.strictEqual(seg.chunks.map((c) => c.text).join(mod.separator), rejoin(syl, mod.separator));
    }
  }
  function passage_version(id) { return id.endsWith("cuvs") ? "CUVS" : "VI1925"; }
});

test("top-N segmentations are distinct and in non-decreasing penalty", async () => {
  const passage = await new FixtureScriptureProvider().getPassage("VI1925", "psalm-23-1-4-vi1925");
  for (const mel of loadMelodies()) {
    const segs = chunkPassage(vi.syllabify(passage.text), mel, { penalties, topN: 5 });
    const keys = new Set(segs.map((s) => s.breaks.join(",")));
    assert.strictEqual(keys.size, segs.length);
    for (let i = 1; i < segs.length; i++) assert.ok(segs[i].penalty >= segs[i - 1].penalty);
  }
});

test("the DP path runs through search for Mandarin unchanged", async () => {
  const passage = await new FixtureScriptureProvider().getPassage("CUVS", "psalm-23-cuvs");
  const out = await search({ passage, melodies: loadMelodies(), toneModule: zh, baselineMelodyId: "new-britain",
    model: new StubModelProvider(), chunking: "dp" });
  assert.strictEqual(out.chunking, "dp");
  assert.ok(out.baseline.chunking.source === "dp");
  assert.ok(out.results.length > 0);
});
