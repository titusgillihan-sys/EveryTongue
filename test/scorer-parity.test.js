"use strict";
/**
 * scorer.js is language-agnostic; shared.js is the web UI's Mandarin-keyed
 * scorer. They must agree on every Mandarin case, and scorer.js must satisfy
 * the scorer contract test (test/scorer-transition.test.js), which is run
 * here as a child process with SCORER pointed at it.
 */
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const shared = require("../shared.js");
const scorer = require("../scorer.js");

test("scorer.js agrees with shared.js motionConflict on every Mandarin tone pair and direction", () => {
  const tones = [1, 2, 3, 4, 5];
  let cases = 0;
  for (const prev of tones) {
    for (const cur of tones) {
      for (const dir of ["up", "same", "down"]) {
        const a = shared.motionConflict(prev, cur, dir);
        const b = scorer.transitionConflict(shared.CHAO_TONES[prev].shape, shared.CHAO_TONES[cur].shape, dir);
        assert.strictEqual(b.contrary, a.contrary, `contrary differs for ${prev}->${cur} ${dir}`);
        assert.strictEqual(b.severity, a.severity, `severity differs for ${prev}->${cur} ${dir}`);
        cases++;
      }
    }
  }
  assert.strictEqual(cases, 75);
});

test("scorer.js analyzeNotes agrees with shared.js analyzeNotes on a sandhi line", () => {
  const notes = [
    { hanzi: "你", tone: 3, direction: null, pitch: 50 },
    { hanzi: "好", tone: 3, direction: "down", pitch: 45 },
    { hanzi: "吗", tone: 5, direction: "up", pitch: 50 },
    { hanzi: "天", tone: 1, direction: "up", pitch: 55 },
  ];
  const a = shared.analyzeNotes(notes).map((n) => [n.match, n.severity, n.effTone, n.sandhi]);
  const b = scorer.analyzeNotes(notes).map((n) => [n.match, n.severity, n.effTone, n.sandhi]);
  assert.deepStrictEqual(b, a);
});

test("scorer.js passes the scorer contract test", () => {
  // Run the contract file directly (node:test runs on plain execution) with
  // the parent test context removed, otherwise node refuses to nest runs.
  const env = { ...process.env, SCORER: "../scorer.js" };
  delete env.NODE_TEST_CONTEXT;
  const out = execFileSync(process.execPath, [path.join(__dirname, "scorer-transition.test.js")], { env, encoding: "utf8" });
  assert.match(out, /(#|ℹ) pass 4/);
  assert.match(out, /(#|ℹ) fail 0/);
});

test("melisma conflicts are a separate, secondary type", () => {
  const syllables = [
    { text: "a", tone: "sac", shape: [3, 5] },
    { text: "b", tone: "huyen", shape: [2, 1] },
  ];
  // b is held across a rising pair of notes while its own tone falls.
  const { rows, totals } = scorer.scoreSetting(syllables, [60, 62, 64], [[0, 0], [1, 2]]);
  assert.strictEqual(rows[1].melisma.contrary, true);
  assert.strictEqual(totals.secondary, 1);
  // The transition into b is down (5 -> 2) while the melody goes up: primary.
  assert.strictEqual(rows[1].contrary, true);
  assert.strictEqual(totals.conflicts, 1);
  assert.strictEqual(totals.severity, 3, "primary severity never includes the melisma conflict");
});
