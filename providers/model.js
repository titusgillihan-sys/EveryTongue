"use strict";
/**
 * providers/model.js — the judgment layer, behind an interface.
 *
 * ModelProvider interface (all async, all return plain objects):
 *   judgeMelodySuitability({ passage, melody, prior }) -> { suitability: 0..1, rationale, source }
 *   explainFailure({ passage, baseline, attempts })     -> { explanation, source }
 *   rankChunkings({ candidates })                      -> { order: [indices], rationale, source }
 *                                                        (unused until the chunker exists)
 *
 * Two implementations are planned: StubModelProvider (this file, deterministic,
 * zero network, no credentials) and Gloo AI Studio once credentials land.
 * Nothing downstream knows which is in use.
 *
 * RULES (see CLAUDE.md):
 *   - The model reranks AFTER the deterministic search, never inside it.
 *   - Every result records both the deterministic prior and the model's
 *     rationale, so "the model preferred it" is never the whole answer.
 *   - Model output goes into rationale/explanation fields ONLY. It is never
 *     Scripture text and never written into a text field. The stub can be
 *     built with a sabotage marker so a test can prove that.
 *   - Verdicts are cached by input hash (in memory, no persistence) so a demo
 *     replays identically.
 */
const crypto = require("node:crypto");

class StubModelProvider {
  /** @param {{ sabotageMarker?: string }} [opts] every string the stub returns will contain the marker */
  constructor(opts = {}) {
    this.marker = opts.sabotageMarker || "";
    this.source = "stub";
  }

  _s(text) {
    return this.marker ? `${this.marker} ${text}` : text;
  }

  async judgeMelodySuitability({ passage, melody, prior }) {
    // Deterministic placeholder judgment: neutral suitability, rationale built
    // from the melody's own metadata and the deterministic score, so the
    // pipeline exercises the interface without pretending to have taste.
    const rationale =
      `Stub verdict (no model credentials): "${melody.name}" is ${melody.license}; ` +
      `deterministic prior is ${prior.severity} severity over ${prior.conflicts} contrary transition(s) ` +
      `across ${passage.chunks.length} chunk(s). A live model would judge whether the tune's character suits ${passage.reference}.`;
    return { suitability: 0.5, rationale: this._s(rationale), source: this.source };
  }

  async explainFailure({ passage, baseline, attempts }) {
    const infeasible = attempts.filter((a) => a.infeasible);
    const noGain = attempts.filter((a) => !a.infeasible);
    const parts = [
      `No melody-and-alignment setting improves on the baseline for ${passage.reference} ` +
        `(baseline: ${baseline.totals.conflicts} contrary transition(s), severity ${baseline.totals.severity}).`,
    ];
    if (infeasible.length) {
      parts.push(
        `${infeasible.length} melody(ies) could not be tried at all because a chunk's syllable count ` +
          `and a phrase's note count differ by more than the alignment bound: ` +
          infeasible.map((a) => `${a.melodyId} (${a.reason})`).join("; ") +
          ". Re-chunking the passage to match those phrase lengths is the constraint to change."
      );
    }
    if (noGain.length) {
      parts.push(
        `${noGain.length} melody(ies) were fully searched and none beat the baseline: ` +
          noGain.map((a) => `${a.melodyId} best severity ${a.totals.severity}`).join("; ") +
          ". Adding a melody to the library, or a second translation, are the remaining levers."
      );
    }
    return { explanation: this._s(parts.join(" ")), source: this.source };
  }

  async rankChunkings({ candidates }) {
    return {
      order: candidates.map((_, i) => i),
      rationale: this._s("Stub: deterministic order kept."),
      source: this.source,
    };
  }
}

/** Wrap a provider so every method is memoised by a hash of its arguments. In-memory only. */
function cached(provider) {
  const cache = new Map();
  const wrap = (name) => async (args) => {
    const key = `${name}:${crypto.createHash("sha256").update(JSON.stringify(args)).digest("hex")}`;
    if (!cache.has(key)) cache.set(key, await provider[name](args));
    return cache.get(key);
  };
  return {
    source: provider.source,
    cache,
    judgeMelodySuitability: wrap("judgeMelodySuitability"),
    explainFailure: wrap("explainFailure"),
    rankChunkings: wrap("rankChunkings"),
  };
}

module.exports = { StubModelProvider, cached };
