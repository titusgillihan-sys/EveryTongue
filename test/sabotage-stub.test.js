"use strict";
/**
 * THE SABOTAGE TEST. A model provider that returns a marker string in every
 * field is wired into the whole pipeline; the marker must never appear in
 * any Scripture text field or any Scripture line of the rendered report.
 *
 * This test can fail: if anyone ever routes model output into a text field,
 * the marker shows up there.
 */
const test = require("node:test");
const assert = require("node:assert");
const { search, searchTranslations } = require("../search.js");
const { forLanguage } = require("../tone/index.js");
const { FixtureScriptureProvider } = require("../providers/scripture.js");
const { StubModelProvider, cached } = require("../providers/model.js");
const { loadMelodies } = require("../melodies.js");
const { render } = require("../cli/report.js");

const MARKER = "«MODEL-GENERATED-7f3a»";
const TEXT_KEYS = new Set(["text", "syllables", "chunks", "reference", "name", "copyright"]);
const MODEL_KEYS = new Set(["rationale", "explanation", "verdict", "failure"]);

/** Walk an object; collect every string under a text-ish key, skipping model-output subtrees. */
function textStrings(node, key, out) {
  if (node === null || typeof node !== "object") {
    if (typeof node === "string" && TEXT_KEYS.has(key)) out.push(node);
    return out;
  }
  if (MODEL_KEYS.has(key)) return out;
  for (const [k, v] of Object.entries(node)) textStrings(v, Array.isArray(node) ? key : k, out);
  return out;
}

test("model output never reaches a Scripture text field or a Scripture line of the report", async () => {
  const scripture = new FixtureScriptureProvider();
  const melodies = loadMelodies();
  const model = cached(new StubModelProvider({ sabotageMarker: MARKER }));
  let modelWasConsulted = 0;

  for (const meta of await scripture.listPassages()) {
    const passage = await scripture.getPassage(meta.versionId, meta.id);
    for (const baseline of ["new-britain", "stille-nacht"]) {
      const out = await search({
        passage, melodies, toneModule: forLanguage(passage.version.language), baselineMelodyId: baseline, model,
      });
      // The stub really was called: the marker is in the model's own fields.
      const modelText = out.failure ? out.failure.explanation : out.results.map((r) => r.verdict.rationale).join(" ");
      assert.ok(modelText.includes(MARKER), "the sabotage stub must actually have been consulted");
      modelWasConsulted++;

      // Structured result: no text field carries the marker.
      for (const s of textStrings(out, null, [])) {
        assert.ok(!s.includes(MARKER), `marker leaked into a text field: ${s}`);
      }
      // Every chunk is still provenance-tagged as Scripture.
      for (const c of out.passage.chunks) assert.match(c.source, /^scripture:/);

      // Rendered report: the marker appears only on the lines labelled as model output.
      const lines = render(out, melodies).split("\n");
      for (const line of lines) {
        if (/^\s*(model rationale:|Explanation \()/.test(line)) continue;
        assert.ok(!line.includes(MARKER), `marker leaked into a report line: ${line}`);
      }
    }
  }
  assert.ok(modelWasConsulted >= 6);

  // The translation lever, with the synthetic version in play.
  const syn = new FixtureScriptureProvider({ includeSynthetic: true });
  const passages = [];
  for (const v of await syn.versionsWithPassage("PSA.23.1-2", "vi")) passages.push(await syn.getPassage(v.id, "PSA.23.1-2"));
  const out = await searchTranslations({ passages, baselineVersionId: "VI1925", melodies, toneModule: forLanguage("vi"), baselineMelodyId: "new-britain", model });
  for (const s of textStrings(out, null, [])) assert.ok(!s.includes(MARKER), `marker leaked (lever): ${s}`);
  const lines = render(out, melodies).split("\n");
  for (const line of lines) {
    if (/^\s*(model rationale:|Explanation \()/.test(line)) continue;
    assert.ok(!line.includes(MARKER), `marker leaked into a lever report line: ${line}`);
  }
});

test("Scripture chunks are frozen so nothing downstream can rewrite them", async () => {
  const passage = await new FixtureScriptureProvider().getPassage("VI1925", "psalm-23-vi1925");
  assert.throws(() => {
    "use strict";
    passage.chunks[0].text = MARKER;
  }, TypeError);
  assert.ok(!passage.chunks[0].text.includes(MARKER));
});
