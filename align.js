"use strict";
/**
 * align.js — bounded syllable-to-note alignment.
 *
 * An alignment maps each syllable of a chunk to a span of consecutive notes
 * in a melody phrase: spans[i] = [firstNoteIndex, lastNoteIndex]. Slot == note;
 * the alignment is a mapping, not a property of the melody. Spans are
 * monotone and together cover every note of the phrase exactly once, except
 * that two adjacent syllables may share one note.
 *
 * BOUNDS (settled, see CLAUDE.md):
 *   - melisma: one syllable over at most MAX_MELISMA notes
 *   - note-sharing: one note under at most MAX_SHARE syllables
 *   - |notes - syllables| > MAX_COUNT_DIFF is rejected outright
 *
 * A shared note is never also part of a melisma: sharing means both syllables
 * sit on exactly that one note.
 *
 * Phrase boundaries are breaths, so no transition is scored across a chunk
 * boundary; that is what lets each chunk be aligned on its own, making the
 * search linear in the number of chunks rather than exponential.
 */

const MAX_MELISMA = 2;
const MAX_SHARE = 2;
const MAX_COUNT_DIFF = 2;

/** True when a chunk of n syllables may be set on a phrase of m notes at all. */
function feasible(n, m) {
  return n > 0 && m > 0 && Math.abs(m - n) <= MAX_COUNT_DIFF;
}

/**
 * Every bounded alignment of n syllables onto m notes, in a fixed
 * deterministic order. Returns [] when the pair is infeasible.
 */
function enumerateAlignments(n, m) {
  if (!feasible(n, m)) return [];
  const out = [];
  const spans = [];

  // i = syllables placed, j = next unused note, sharers = syllables already on note j-1
  function place(i, j, sharers) {
    if (i === n) {
      if (j === m) out.push(spans.map((s) => s.slice()));
      return;
    }
    const left = n - i;
    const notesLeft = m - j;
    // Each remaining syllable covers at most MAX_MELISMA notes...
    if (notesLeft > left * MAX_MELISMA) return;
    // ...and each remaining note holds at most MAX_SHARE syllables (the
    // current shared note can still take MAX_SHARE - sharers more).
    if (left > notesLeft * MAX_SHARE + (sharers > 0 ? MAX_SHARE - sharers : 0)) return;

    // share the previous syllable's note
    if (sharers > 0 && sharers < MAX_SHARE) {
      spans.push([j - 1, j - 1]);
      place(i + 1, j, sharers + 1);
      spans.pop();
    }
    // one note, or a melisma over several
    for (let len = 1; len <= MAX_MELISMA && j + len <= m; len++) {
      spans.push([j, j + len - 1]);
      place(i + 1, j + len, len === 1 ? 1 : 0);
      spans.pop();
    }
  }

  place(0, 0, 0);
  return out;
}

/**
 * THE BASELINE: how a congregation sings a text to a tune when nobody has
 * thought about it — one syllable per note, in order. If the text has more
 * syllables than the phrase has notes, the extras crowd onto the last note;
 * if it has fewer, the last syllable is held across the leftover notes.
 * Unbounded on purpose: the baseline must always exist so there is always
 * something to beat, and it must not be dressed up as a considered setting.
 */
function naiveAlignment(n, m) {
  if (n <= 0 || m <= 0) throw new Error("naiveAlignment needs at least one syllable and one note");
  const spans = [];
  for (let i = 0; i < n; i++) {
    const note = Math.min(i, m - 1);
    if (i === n - 1 && m > n) spans.push([note, m - 1]); // hold the tail across leftover notes
    else spans.push([note, note]); // one per note; extras crowd the last note
  }
  return spans;
}

/** "Chúa[G4] là[A4 F4]" style notation for one alignment. */
function describeAlignment(syllables, notes, spans, noteName) {
  return syllables
    .map((s, i) => {
      const [a, b] = spans[i];
      return `${s.text}[${notes.slice(a, b + 1).map(noteName).join(" ")}]`;
    })
    .join(" ");
}

module.exports = {
  MAX_MELISMA,
  MAX_SHARE,
  MAX_COUNT_DIFF,
  feasible,
  enumerateAlignments,
  naiveAlignment,
  describeAlignment,
};
