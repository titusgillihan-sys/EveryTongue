"use strict";
/**
 * search.js — search over melody × alignment for a pre-chunked passage.
 *
 * (Lever 1, translation choice, is not searched in this stage: the caller
 * passes one passage from one version. When it lands, it is an outer loop
 * over passages from listVersions(), with nothing in here changing.)
 *
 * ASSUMPTION THAT MAKES THIS LINEAR: phrase boundaries are breaths. No
 * transition is scored across a chunk boundary, so the best alignment for
 * chunk i does not depend on chunk i-1 and every chunk is optimised on its
 * own. The cost is chunks × melodies × alignments-per-chunk, never a product
 * over chunks. Long passages cycle the melody's phrase list (chunk i sings
 * phrase i mod P).
 *
 * THE BASELINE is the passage sung to the baseline melody one syllable per
 * note (align.js naiveAlignment). A setting counts as an improvement only if
 * it is strictly better than the baseline by (severity, conflicts,
 * secondary). If nothing is, `results` is EMPTY and the failure explanation
 * says why — the tool never invents an improvement and never relabels the
 * baseline as a win.
 *
 * THE MODEL reranks after the search and only among settings that already
 * beat the baseline. Every result carries both the deterministic `prior` and
 * the model's `verdict`.
 */
const { scoreSetting, compareTotals, addTotals, ZERO_TOTALS } = require("./scorer.js");
const { feasible, enumerateAlignments, naiveAlignment, MAX_COUNT_DIFF } = require("./align.js");

function phraseIndexFor(melody, chunkIndex) {
  return chunkIndex % melody.phrases.length;
}

function evaluate(syllables, phrase, alignment) {
  const { rows, totals } = scoreSetting(syllables, phrase.midi, alignment);
  return { alignment, rows, totals };
}

/** Best bounded alignment of one chunk on one phrase, or null when infeasible. First-found wins ties (deterministic). */
function bestAlignment(syllables, phrase) {
  const n = syllables.length;
  const m = phrase.midi.length;
  if (!feasible(n, m)) return null;
  let best = null;
  for (const alignment of enumerateAlignments(n, m)) {
    const cand = evaluate(syllables, phrase, alignment);
    if (!best || compareTotals(cand.totals, best.totals) < 0) best = cand;
  }
  return best;
}

/** Set every chunk of the passage on a melody with a given alignment strategy. */
function setPassage(melody, chunkSyllables, choose) {
  const chunks = [];
  let totals = ZERO_TOTALS;
  for (let i = 0; i < chunkSyllables.length; i++) {
    const phraseIndex = phraseIndexFor(melody, i);
    const phrase = melody.phrases[phraseIndex];
    const setting = choose(chunkSyllables[i], phrase, i);
    if (!setting) {
      return {
        melodyId: melody.id,
        melodyName: melody.name,
        infeasible: true,
        reason:
          `chunk ${i + 1} has ${chunkSyllables[i].length} syllables but phrase ${phraseIndex + 1} has ` +
          `${phrase.midi.length} notes; the alignment bound allows a difference of at most ${MAX_COUNT_DIFF}`,
        chunks,
        totals: null,
      };
    }
    chunks.push({ chunkIndex: i, phraseIndex, phrase, ...setting });
    totals = addTotals(totals, setting.totals);
  }
  return { melodyId: melody.id, melodyName: melody.name, infeasible: false, chunks, totals };
}

/**
 * @param {object} args
 * @param {object} args.passage        from a ScriptureProvider
 * @param {object[]} args.melodies     from melodies.js
 * @param {object} args.toneModule     from tone/index.js
 * @param {string} args.baselineMelodyId
 * @param {object} args.model          a ModelProvider
 */
async function search({ passage, melodies, toneModule, baselineMelodyId, model }) {
  const baselineMelody = melodies.find((m) => m.id === baselineMelodyId);
  if (!baselineMelody) throw new Error(`Unknown baseline melody "${baselineMelodyId}"`);

  const chunkSyllables = passage.chunks.map((c) => toneModule.syllabify(c.text));

  // Deterministic search.
  const baseline = setPassage(baselineMelody, chunkSyllables, (syl, phrase) =>
    evaluate(syl, phrase, naiveAlignment(syl.length, phrase.midi.length))
  );
  baseline.kind = "baseline (one syllable per note)";

  const attempts = melodies.map((melody) => setPassage(melody, chunkSyllables, bestAlignment));

  const improvements = attempts
    .filter((a) => !a.infeasible && compareTotals(a.totals, baseline.totals) < 0)
    .sort((a, b) => compareTotals(a.totals, b.totals) || a.melodyId.localeCompare(b.melodyId))
    .map((a) => ({
      ...a,
      kind: a.melodyId === baseline.melodyId ? "same melody, re-aligned" : "different melody, re-aligned",
      prior: a.totals,
    }));

  const base = { passage, language: toneModule.id, chunkSyllables, baseline, attempts };

  if (improvements.length === 0) {
    const failure = await model.explainFailure({ passage, baseline, attempts });
    return { ...base, results: [], failure };
  }

  // Model rerank — after the search, only over settings that already won.
  for (const r of improvements) {
    const melody = melodies.find((m) => m.id === r.melodyId);
    r.verdict = await model.judgeMelodySuitability({ passage, melody, prior: r.prior });
  }
  const results = improvements
    .slice()
    .sort((a, b) => b.verdict.suitability - a.verdict.suitability || compareTotals(a.prior, b.prior));

  return { ...base, results, failure: null };
}

module.exports = { search, bestAlignment, setPassage, phraseIndexFor };
