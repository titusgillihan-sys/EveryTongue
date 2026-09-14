"use strict";
/**
 * scorer.js — the contrary-motion scorer, language-agnostic.
 *
 * Input is syllables carrying Chao pitch shapes ([start, end] on a 1–5
 * scale, from a tone module) and MIDI notes; the scorer never sees a
 * language. The transition rule is the same one as motionConflict() in
 * shared.js, which the web UI uses keyed by Mandarin tone number.
 * test/scorer-parity.test.js holds the two equal on every Mandarin case, and
 * test/scorer-transition.test.js (the contract test) runs against this file
 * with SCORER=../scorer.js.
 *
 * TRANSITION SEMANTICS (settled, see CLAUDE.md): the transition into
 * syllable i runs from the LAST note of syllable i-1's span to the FIRST note
 * of syllable i's span. Phrase boundaries are breaths: no transition is
 * scored across them, which is why each chunk is scored on its own.
 *
 * Two conflict types, never folded together:
 *   primary   — contrary motion between adjacent syllables (the number that
 *               matters, per Ladd & Kirby 2020).
 *   secondary — within-syllable melisma: the melody moves across a syllable's
 *               own span against the direction of that tone's own contour.
 */

const MELODY_STEP = { up: 1, same: 0, down: -1 };

/** How the speaking voice moves into a syllable: from where the previous
 *  tone ends to where this one starts. null when either side has no shape. */
function speechInterval(prevShape, shape) {
  if (!prevShape || !shape) return null;
  return shape[0] - prevShape[1];
}

function melodyDirection(fromMidi, toMidi) {
  if (fromMidi === null || fromMidi === undefined || toMidi === null || toMidi === undefined) return null;
  const d = toMidi - fromMidi;
  return d > 0 ? "up" : d < 0 ? "down" : "same";
}

function directionLabel(signed) {
  if (signed === null || signed === undefined) return null;
  if (signed > 0) return "up";
  if (signed < 0) return "down";
  return "same";
}

/**
 * Melody up while speech goes down (or vice versa) = contrary = flagged.
 * Melody flat, speech flat, or both moving the same way = fine.
 * `severity` is how far the voice has to move against the tune (1–4).
 */
function transitionConflict(prevShape, shape, direction) {
  const speech = speechInterval(prevShape, shape);
  const melody = MELODY_STEP[direction];
  if (speech === null || melody === undefined || melody === 0 || speech === 0) {
    return { contrary: false, severity: 0, speech, melody: melody ?? null };
  }
  const contrary = Math.sign(speech) !== Math.sign(melody);
  return { contrary, severity: contrary ? Math.abs(speech) : 0, speech, melody };
}

/**
 * Secondary conflict: a syllable sung across several notes whose overall
 * movement (first note -> last note) opposes the tone's own contour.
 */
function melismaConflict(shape, firstMidi, lastMidi) {
  if (!shape || firstMidi === lastMidi) return { contrary: false, severity: 0, own: null, melody: 0 };
  const own = shape[1] - shape[0];
  const melody = Math.sign(lastMidi - firstMidi);
  if (own === 0) return { contrary: false, severity: 0, own, melody };
  const contrary = Math.sign(own) !== melody;
  return { contrary, severity: contrary ? Math.abs(own) : 0, own, melody };
}

/**
 * Score one chunk under one alignment.
 *
 *   syllables — [{ text, tone, shape, unknown, ... }] from a tone module
 *   notes     — MIDI numbers for one melody phrase
 *   alignment — spans[i] = [firstNoteIndex, lastNoteIndex] for syllable i
 *
 * Returns per-syllable rows plus totals. The first syllable has nothing
 * before it and can never be flagged.
 */
function scoreSetting(syllables, notes, alignment) {
  if (alignment.length !== syllables.length) {
    throw new Error(`alignment has ${alignment.length} spans for ${syllables.length} syllables`);
  }
  const rows = syllables.map((syl, i) => {
    const [first, last] = alignment[i];
    const prev = i > 0 ? alignment[i - 1] : null;
    const fromMidi = prev ? notes[prev[1]] : null;
    const toMidi = notes[first];
    const direction = prev ? melodyDirection(fromMidi, toMidi) : null;
    const prevShape = i > 0 ? syllables[i - 1].shape : null;
    const t = prev ? transitionConflict(prevShape, syl.shape, direction) : { contrary: false, severity: 0, speech: null };
    const m = melismaConflict(syl.shape, notes[first], notes[last]);
    return {
      index: i,
      text: syl.text,
      tone: syl.tone,
      label: syl.label,
      shape: syl.shape,
      unknown: !!syl.unknown,
      noteSpan: [first, last],
      notes: notes.slice(first, last + 1),
      melody: direction,
      speech: t.speech,
      speechDir: directionLabel(t.speech),
      contrary: t.contrary,
      severity: t.severity,
      melisma: { notes: last - first + 1, contrary: m.contrary, severity: m.severity },
    };
  });
  const totals = rows.reduce(
    (acc, r) => {
      if (r.contrary) {
        acc.conflicts += 1;
        acc.severity += r.severity;
      }
      if (r.melisma.contrary) acc.secondary += 1;
      return acc;
    },
    { conflicts: 0, severity: 0, secondary: 0 }
  );
  return { rows, totals };
}

/** Lexicographic: primary severity, then primary count, then secondary count. */
function compareTotals(a, b) {
  return a.severity - b.severity || a.conflicts - b.conflicts || a.secondary - b.secondary;
}

function addTotals(a, b) {
  return {
    conflicts: a.conflicts + b.conflicts,
    severity: a.severity + b.severity,
    secondary: a.secondary + b.secondary,
  };
}

const ZERO_TOTALS = Object.freeze({ conflicts: 0, severity: 0, secondary: 0 });

/**
 * Adapter so the scorer contract test (test/scorer-transition.test.js) can be
 * pointed at this file: Mandarin notes { tone, direction } in, the same row
 * shape shared.js produces out. Shapes come from the Mandarin tone module.
 */
function analyzeNotes(notes) {
  const { CHAO_TONES, effectiveTones } = require("./shared.js");
  const eff = effectiveTones(notes);
  const shapeOf = (t) => (CHAO_TONES[t] && CHAO_TONES[t].shape) || null;
  return notes.map((note, i) => {
    const unknown = note.tone === null || note.tone === undefined;
    const t =
      unknown || i === 0
        ? { contrary: false, severity: 0, speech: null }
        : transitionConflict(shapeOf(eff[i - 1]), shapeOf(eff[i]), note.direction);
    return {
      ...note,
      index: i,
      unknown,
      effTone: eff[i],
      sandhi: !unknown && eff[i] !== note.tone,
      speech: t.speech,
      speechDir: directionLabel(t.speech),
      match: !t.contrary,
      severity: t.severity,
    };
  });
}

module.exports = {
  MELODY_STEP,
  ZERO_TOTALS,
  speechInterval,
  melodyDirection,
  directionLabel,
  transitionConflict,
  melismaConflict,
  scoreSetting,
  compareTotals,
  addTotals,
  analyzeNotes,
};
