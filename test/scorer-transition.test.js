/**
 * THE SCORER CONTRACT.
 *
 * CLAUDE.md defines a conflict as CONTRARY MOTION: the melody moving opposite
 * to the language's own pitch movement BETWEEN ADJACENT SYLLABLES.
 *
 * That definition has a property any correct implementation must have, and it
 * can be tested without appealing to anyone's judgement about a specific pair
 * of words: the verdict on a syllable MUST depend on the syllable before it.
 *
 * Point this at a scorer with SCORER=<path> to check it against the contract.
 */
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const SCORER = process.env.SCORER || "../shared.js";
const { analyzeNotes } = require(path.resolve(__dirname, SCORER));

/** Two syllables; only the FIRST one's tone differs between the two lines. */
function verdictForPrevTone(prevTone, tone, direction) {
  const notes = [
    { hanzi: "·", tone: prevTone, direction: null, pitch: 50 },
    { hanzi: "·", tone, direction, pitch: 50 },
  ];
  return analyzeNotes(notes)[1].match;
}

test("verdict depends on the preceding syllable", () => {
  // Identical current syllable (tone 2) and identical melody move (up).
  // Only the previous tone changes.
  //
  // Contrary motion says these are different situations:
  //   after tone 1 (ends high 5), tone 2 starts mid 3 -> the voice steps DOWN
  //     into it, while the melody goes UP. Opposite directions: a conflict.
  //   after tone 3 (ends low 1),  tone 2 starts mid 3 -> the voice steps UP
  //     into it, with the melody. Same direction: no conflict.
  const afterHigh = verdictForPrevTone(1, 2, "up");
  const afterLow = verdictForPrevTone(3, 2, "up");

  assert.notStrictEqual(
    afterHigh,
    afterLow,
    "A scorer that returns the same verdict here is not measuring motion " +
      "between syllables at all — it cannot see the previous syllable, so it " +
      "cannot compute contrary motion by any tuning of its constants."
  );
});

test("the voice's upward reset between two falling tones conflicts with a descending melody", () => {
  // A falling tone ends at the bottom of the range and the next one starts
  // back at the top, so the voice leaps UP between them. A melody descending
  // across that pair pulls the opposite way.
  const flagged = verdictForPrevTone(4, 4, "down") === false;
  assert.ok(flagged, "tone 4 -> tone 4 under a descending melody should be flagged");
});

test("a line-initial syllable is never flagged", () => {
  // Nothing precedes it, so there is no transition to judge.
  const notes = [{ hanzi: "·", tone: 4, direction: null, pitch: 50 }];
  assert.strictEqual(analyzeNotes(notes)[0].match, true);
});

test("an unknown tone is never flagged", () => {
  const notes = [
    { hanzi: "·", tone: 1, direction: null, pitch: 50 },
    { hanzi: "·", tone: null, direction: "down", pitch: 45 },
  ];
  assert.strictEqual(analyzeNotes(notes)[1].match, true);
});
