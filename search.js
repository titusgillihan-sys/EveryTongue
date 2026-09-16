"use strict";
/**
 * search.js — search over melody × alignment for a pre-chunked passage.
 *
 * (Lever 1, translation choice, is not searched in this stage: the caller
 * passes one passage from one version. When it lands, it is an outer loop
 * over passages from listVersions(), with nothing in here changing.)
 *
 * CHUNKING happens per melody: chunker.js proposes the top-N segmentations
 * whose chunk lengths fit that melody's cycled phrase lengths, and each is
 * aligned and scored. The chunking's break penalty is recorded as a
 * deterministic prior and used only to break ties between equal scores.
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
const { scoreSetting, compareTotals, addTotals, ZERO_TOTALS, melodyEligibility, settingEligibility } = require("./scorer.js");
const { feasible, enumerateAlignments, naiveAlignment, MAX_COUNT_DIFF } = require("./align.js");
const { chunkPassage, loadPenalties } = require("./chunker.js");

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
function setPassage(melody, chunkList, choose) {
  const chunks = [];
  let totals = ZERO_TOTALS;
  for (let i = 0; i < chunkList.length; i++) {
    const phraseIndex = phraseIndexFor(melody, i);
    const phrase = melody.phrases[phraseIndex];
    const syllables = chunkList[i].syllables;
    const setting = choose(syllables, phrase, i);
    if (!setting) {
      return {
        melodyId: melody.id,
        melodyName: melody.name,
        infeasible: true,
        reason:
          `chunk ${i + 1} has ${syllables.length} syllables but phrase ${phraseIndex + 1} has ` +
          `${phrase.midi.length} notes; the alignment bound allows a difference of at most ${MAX_COUNT_DIFF}`,
        chunks,
        totals: null,
      };
    }
    chunks.push({ chunkIndex: i, phraseIndex, phrase, text: chunkList[i].text, ...setting });
    totals = addTotals(totals, setting.totals);
  }
  return { melodyId: melody.id, melodyName: melody.name, infeasible: false, chunks, totals };
}

/**
 * Candidate chunkings of the passage for one melody.
 *   "dp"   — chunker.js top-N segmentations (needs passage.text)
 *   "hand" — the passage's own pre-made chunks
 * Each is { source, penalty, breaks, chunks: [{ text, syllables }] }.
 */
function chunkingsFor(passage, melody, toneModule, { chunking, penalties, topN }) {
  if (chunking === "dp") {
    const syllables = toneModule.syllabify(passage.text);
    return chunkPassage(syllables, melody, { penalties, topN, separator: toneModule.separator }).map((seg) => ({
      source: "dp",
      penalty: seg.penalty,
      breaks: seg.breaks,
      chunks: seg.chunks.map((c) => ({ text: c.text, syllables: c.syllables })),
    }));
  }
  return [
    {
      source: "hand",
      penalty: null,
      breaks: null,
      chunks: passage.chunks.map((c) => ({ text: c.text, syllables: toneModule.syllabify(c.text) })),
    },
  ];
}

const chunkTexts = (setting) => setting.chunks.map((c) => c.text).join(" | ");

/**
 * @param {object} args
 * @param {object} args.passage        from a ScriptureProvider
 * @param {object[]} args.melodies     from melodies.js
 * @param {object} args.toneModule     from tone/index.js
 * @param {string} args.baselineMelodyId
 * @param {object} args.model          a ModelProvider
 * @param {"dp"|"hand"} [args.chunking]  default "dp" when the passage has text, else "hand"
 * @param {object} [args.penalties]    break-penalty table (data/break-penalties.json)
 * @param {number} [args.topN]         segmentations kept per melody
 */
async function search({ passage, melodies, toneModule, baselineMelodyId, model, chunking, penalties, topN = 5 }) {
  const baselineMelody = melodies.find((m) => m.id === baselineMelodyId);
  if (!baselineMelody) throw new Error(`Unknown baseline melody "${baselineMelodyId}"`);
  chunking = chunking || (passage.text ? "dp" : "hand");
  if (chunking === "hand" && !(passage.chunks && passage.chunks.length)) {
    throw new Error(`Passage ${passage.id} has no hand chunks; use the DP chunker`);
  }
  if (chunking === "dp" && !passage.text) throw new Error(`Passage ${passage.id} has no text to chunk`);
  const opts = { chunking, penalties: penalties || (chunking === "dp" ? loadPenalties() : null), topN };

  // THE BASELINE: the baseline melody, its cheapest chunking, one syllable per
  // note. If no bounded chunking exists for it, the whole passage is one chunk
  // on the first phrase, still one syllable per note — the baseline must
  // always exist and must never be dressed up as a considered setting.
  let baselineChunking = chunkingsFor(passage, baselineMelody, toneModule, opts)[0];
  if (!baselineChunking) {
    baselineChunking = {
      source: "fallback (no bounded chunking fits; whole passage as one chunk)",
      penalty: null,
      breaks: [],
      chunks: [{ text: passage.text, syllables: toneModule.syllabify(passage.text) }],
    };
  }
  const baseline = setPassage(baselineMelody, baselineChunking.chunks, (syl, phrase) =>
    evaluate(syl, phrase, naiveAlignment(syl.length, phrase.midi.length))
  );
  baseline.chunking = baselineChunking;
  baseline.chunks.forEach((c, i) => (c.text = baselineChunking.chunks[i].text));
  baseline.kind = "baseline (one syllable per note)";

  baseline.eligibility = { melody: melodyEligibility(baselineMelody), setting: settingEligibility(baseline.totals) };

  // Deterministic search: every melody × its candidate chunkings × bounded alignments per chunk.
  const attempts = melodies.map((melody) => {
    // THE MELODIC-INTEREST FLOOR: a melody that barely moves avoids the test
    // and is reported as ineligible, never as optimal.
    const melodyCheck = melodyEligibility(melody);
    if (!melodyCheck.eligible) {
      return { melodyId: melody.id, melodyName: melody.name, infeasible: false, ineligible: true, chunks: [], totals: null,
        eligibility: { melody: melodyCheck, setting: null }, reason: `melody ineligible: ${melodyCheck.reasons.join("; ")}` };
    }
    const chunkings = chunkingsFor(passage, melody, toneModule, opts);
    if (!chunkings.length) {
      return { melodyId: melody.id, melodyName: melody.name, infeasible: true, chunks: [], totals: null,
        reason: "no chunking of the passage fits this melody's phrase lengths within the alignment bound" };
    }
    let bestSetting = null;
    let firstInfeasible = null;
    for (const ck of chunkings) {
      const setting = setPassage(melody, ck.chunks, bestAlignment);
      if (setting.infeasible) { firstInfeasible = firstInfeasible || setting; continue; }
      setting.chunking = ck;
      setting.chunks.forEach((c, i) => (c.text = ck.chunks[i].text));
      if (!bestSetting || compareTotals(setting.totals, bestSetting.totals) < 0 ||
          (compareTotals(setting.totals, bestSetting.totals) === 0 && (ck.penalty ?? 0) < (bestSetting.chunking.penalty ?? 0))) {
        bestSetting = setting;
      }
    }
    if (!bestSetting) return firstInfeasible;
    // A setting that parked its tone changes on repeated notes dodged the test.
    const settingCheck = settingEligibility(bestSetting.totals);
    bestSetting.eligibility = { melody: melodyCheck, setting: settingCheck };
    if (!settingCheck.eligible) {
      bestSetting.ineligible = true;
      bestSetting.reason = `best setting ineligible: ${settingCheck.reasons.join("; ")}`;
    }
    return bestSetting;
  });

  const improvements = attempts
    .filter((a) => !a.infeasible && !a.ineligible && compareTotals(a.totals, baseline.totals) < 0)
    .sort((a, b) => compareTotals(a.totals, b.totals) || a.melodyId.localeCompare(b.melodyId))
    .map((a) => {
      const sameMelody = a.melodyId === baseline.melodyId;
      const sameChunks = chunkTexts(a) === chunkTexts(baseline);
      const kind = `${sameMelody ? "same melody" : "different melody"}, ${sameChunks ? "re-aligned" : "re-chunked and re-aligned"}`;
      return { ...a, kind, prior: a.totals };
    });

  const base = { passage, language: toneModule.id, chunking, baseline, attempts };

  if (improvements.length === 0) {
    const failure = await model.explainFailure({ passage, baseline, attempts });
    return { ...base, results: [], failure };
  }

  // Model rerank — after the search, only over settings that already won.
  for (const r of improvements) {
    const melody = melodies.find((m) => m.id === r.melodyId);
    r.verdict = await model.judgeMelodySuitability({ passage, melody, prior: r.prior, chunkCount: r.chunks.length });
  }
  const results = improvements
    .slice()
    .sort((a, b) => b.verdict.suitability - a.verdict.suitability || compareTotals(a.prior, b.prior));

  return { ...base, results, failure: null };
}

module.exports = { search, bestAlignment, setPassage, phraseIndexFor };
