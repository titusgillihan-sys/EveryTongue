"use strict";
/**
 * Model-backed layers: the Gloo AI Studio provider behind the same interface
 * as the stub, tested with a fake fetch (zero network); provider selection;
 * chunk reranking recorded next to the deterministic prior.
 */
const test = require("node:test");
const assert = require("node:assert");
const { GlooModelProvider, DEFAULT_ENDPOINT } = require("../providers/gloo.js");
const { selectModelProvider } = require("../providers/index.js");
const { StubModelProvider, cached } = require("../providers/model.js");
const { FixtureScriptureProvider } = require("../providers/scripture.js");
const { search } = require("../search.js");
const { forLanguage } = require("../tone/index.js");
const { loadMelodies } = require("../melodies.js");
const { render } = require("../cli/report.js");

const MARKER = "«GLOO-MARKER-91c»";

/** A fake Gloo endpoint: records requests, answers from a function of the prompt. */
function fakeGloo(answer) {
  const calls = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, headers: init.headers, body });
    const prompt = body.messages[1].content;
    const content = typeof answer === "function" ? answer(prompt, calls.length) : answer;
    return { ok: true, status: 200, json: async () => ({ model: "gloo-fake", choices: [{ message: { role: "assistant", content } }] }), text: async () => "" };
  };
  return { fetch, calls };
}

const vi = forLanguage("vi");
const melodies = loadMelodies();
const fixtures = new FixtureScriptureProvider();

test("Gloo requests carry the bearer key, the system rule, and a routing choice", async () => {
  const { fetch, calls } = fakeGloo('{"suitability": 0.8, "rationale": "fits"}');
  const gloo = new GlooModelProvider({ apiKey: "k-test", fetch, modelFamily: "anthropic" });
  const passage = await fixtures.getPassage("VI1925", "PSA.23.1-2");
  const v = await gloo.judgeMelodySuitability({ passage, melody: melodies[1], prior: { conflicts: 0, constrained: 5, severity: 0 }, chunkCount: 4 });
  assert.deepStrictEqual([v.suitability, v.rationale, v.source], [0.8, "fits", "gloo:anthropic"]);
  assert.strictEqual(calls[0].url, DEFAULT_ENDPOINT);
  assert.strictEqual(calls[0].headers.Authorization, "Bearer k-test");
  assert.strictEqual(calls[0].body.model_family, "anthropic");
  assert.strictEqual(calls[0].body.stream, false);
  assert.match(calls[0].body.messages[0].content, /NEVER write, reword, translate or paraphrase Scripture/);
  assert.ok(calls[0].body.messages[1].content.includes(passage.text), "the model sees the verbatim text it is judging");
});

test("malformed or failing Gloo replies degrade to a neutral verdict, never a throw", async () => {
  const bad = new GlooModelProvider({ apiKey: "k", fetch: fakeGloo("not json at all").fetch });
  const passage = await fixtures.getPassage("VI1925", "PSA.23.1-2");
  const v = await bad.judgeMelodySuitability({ passage, melody: melodies[1], prior: { conflicts: 0, constrained: 1, severity: 0 }, chunkCount: 1 });
  assert.strictEqual(v.suitability, 0.5);
  assert.match(v.rationale, /Unparseable/);
  const r = await bad.rankChunkings({ passage, melody: melodies[1], candidates: [{ index: 0, penalty: 1, chunks: ["a"] }, { index: 1, penalty: 2, chunks: ["b"] }] });
  assert.deepStrictEqual(r.order, [0, 1]);

  const down = new GlooModelProvider({ apiKey: "k", fetch: async () => ({ ok: false, status: 503, text: async () => "unavailable" }) });
  const f = await down.explainFailure({ passage, baseline: { melodyId: "x", totals: { conflicts: 1, constrained: 2, severity: 2 } }, attempts: [] });
  assert.match(f.explanation, /Model unavailable/);
  assert.strictEqual(f.error, true);
  const r2 = await down.rankChunkings({ passage, melody: melodies[1], candidates: [{ index: 0, penalty: 0, chunks: ["a"] }] });
  assert.deepStrictEqual(r2.order, [0]);
});

test("Gloo output never reaches a Scripture text field or a Scripture line (sabotage through the real provider)", async () => {
  const { fetch } = fakeGloo((prompt) =>
    prompt.includes('"order"')
      ? `{"order": [1, 0], "unnatural": [], "rationale": "${MARKER} reversed"}`
      : prompt.includes('"explanation"')
        ? `{"explanation": "${MARKER} blocked"}`
        : `{"suitability": 0.9, "rationale": "${MARKER} suits"}`
  );
  const model = cached(new GlooModelProvider({ apiKey: "k", fetch }));
  const TEXT_KEYS = new Set(["text", "chunks", "reference", "name", "copyright"]);
  const MODEL_KEYS = new Set(["rationale", "explanation", "verdict", "failure", "chunkingVerdict", "verdictOnChunkings"]);
  const walk = (node, key, out) => {
    if (node === null || typeof node !== "object") { if (typeof node === "string" && TEXT_KEYS.has(key)) out.push(node); return out; }
    if (MODEL_KEYS.has(key)) return out;
    for (const [k, v] of Object.entries(node)) walk(v, Array.isArray(node) ? key : k, out);
    return out;
  };
  for (const id of ["psalm-23-1-4-vi1925", "john-3-16-vi1925"]) {
    const passage = await fixtures.getPassage("VI1925", id);
    const out = await search({ passage, melodies, toneModule: vi, baselineMelodyId: "new-britain", model });
    assert.ok(out.results.length > 0);
    assert.ok(out.results.every((r) => r.verdict.rationale.includes(MARKER)), "the real provider was consulted");
    assert.ok(out.results.some((r) => r.chunkingVerdict && r.chunkingVerdict.rationale.includes(MARKER)), "chunk reranking was consulted");
    for (const s of walk(out, null, [])) assert.ok(!s.includes(MARKER), `leaked: ${s}`);
    for (const line of render(out, melodies).split("\n")) {
      if (/^\s*(model rationale:|Explanation \(|chunking verdict \()/.test(line)) continue;
      assert.ok(!line.includes(MARKER), `leaked into report line: ${line}`);
    }
  }
});

test("the model's chunking order breaks ties and its flags exclude a candidate; prior and verdict are both recorded", async () => {
  const passage = await fixtures.getPassage("VI1925", "psalm-23-1-4-vi1925");
  // Stub-driven run: chosen chunking is the best-scoring one; record what index it was.
  const plain = await search({ passage, melodies, toneModule: vi, baselineMelodyId: "new-britain", model: new StubModelProvider() });
  const chosen = plain.results.find((r) => r.melodyId === "new-britain");
  assert.ok(Number.isInteger(chosen.chunking.index));
  assert.strictEqual(typeof chosen.chunking.penalty, "number", "DP prior recorded");
  assert.strictEqual(chosen.chunking.modelRank, chosen.chunking.index + 1, "stub keeps DP order");
  assert.match(chosen.chunkingVerdict.rationale, /Stub verdict/);

  // A model that flags the chosen candidate as unnatural forces a different chunking (if any other fits).
  const flagging = {
    source: "fake",
    async rankChunkings({ candidates }) { return { order: candidates.map((_, i) => i), unnatural: [chosen.chunking.index], rationale: "flagged", source: "fake" }; },
    async judgeMelodySuitability() { return { suitability: 0.5, rationale: "-", source: "fake" }; },
    async explainFailure() { return { explanation: "-", source: "fake" }; },
  };
  const out = await search({ passage, melodies, toneModule: vi, baselineMelodyId: "new-britain", model: flagging });
  const nb = out.attempts.find((a) => a.melodyId === "new-britain");
  assert.notStrictEqual(nb.chunking.index, chosen.chunking.index, "the flagged chunking was not used");
  assert.strictEqual(nb.chunking.modelUnnatural, false);
  assert.deepStrictEqual(nb.chunkingVerdict.unnatural, [chosen.chunking.index]);
});

test("provider selection: stub by default; Gloo only with credential AND opt-in; opt-in without credential is an error", () => {
  assert.strictEqual(selectModelProvider({ env: {} }).source, "stub");
  assert.strictEqual(selectModelProvider({ env: { GLOO_API_KEY: "k" } }).source, "stub", "a key alone does not wire the model");
  assert.strictEqual(selectModelProvider({ env: { GLOO_API_KEY: "k", ET_MODEL: "gloo" }, fetch: async () => {} }).source, "gloo:anthropic");
  assert.strictEqual(selectModelProvider({ env: { GLOO_API_KEY: "k" }, choice: "gloo", fetch: async () => {} }).source, "gloo:anthropic");
  assert.throws(() => selectModelProvider({ env: {}, choice: "gloo" }), /needs GLOO_API_KEY/);
});

test("verdicts are cached by input hash so a run replays identically without a second call", async () => {
  const { fetch, calls } = fakeGloo('{"suitability": 0.7, "rationale": "ok"}');
  const model = cached(new GlooModelProvider({ apiKey: "k", fetch }));
  const passage = await fixtures.getPassage("VI1925", "PSA.23.1-2");
  const args = { passage, melody: melodies[1], prior: { conflicts: 0, constrained: 3, severity: 0 }, chunkCount: 4 };
  const a = await model.judgeMelodySuitability(args);
  const b = await model.judgeMelodySuitability(JSON.parse(JSON.stringify(args)));
  assert.strictEqual(a, b);
  assert.strictEqual(calls.length, 1);
});
