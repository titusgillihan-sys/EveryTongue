"use strict";
/**
 * providers/gloo.js — Gloo AI Studio behind the ModelProvider interface.
 *
 * UNWIRED BY DEFAULT. providers/index.js selects this class only when
 * GLOO_API_KEY is set AND the caller opts in (--model gloo / ET_MODEL=gloo).
 * The demo path never reaches it. Same three methods as the stub; nothing
 * downstream knows which is in use.
 *
 * Endpoint (docs.gloo.com/api-guides/completions-v2, read 2026-09-15):
 *   POST https://platform.ai.gloo.com/ai/v2/guarded/chat/completions
 *   Authorization: Bearer <key>
 *   body: { messages, model_family | model | auto_routing, temperature, max_tokens, tradition }
 *   reply: choices[0].message.content
 *
 * RULES THIS FILE KEEPS:
 *   - The model is asked for JUDGMENTS in JSON: an order, a score, an
 *     explanation. Its output goes into rationale/explanation fields only.
 *     It is never Scripture and never a text field; the sabotage test runs
 *     this class with a fake fetch to prove it.
 *   - Any malformed reply degrades to a neutral verdict with the raw text
 *     as rationale. A model failure never stops the deterministic result.
 *   - `fetch` is injectable so the class is tested with zero network.
 */

const DEFAULT_ENDPOINT = "https://platform.ai.gloo.com/ai/v2/guarded/chat/completions";

const SYSTEM =
  "You are a judge assisting a tool that sets existing Bible translations to existing melodies for a tone language. " +
  "You NEVER write, reword, translate or paraphrase Scripture; every word of Scripture shown to you is quoted verbatim from a published translation and must not be altered. " +
  "You only give judgments about naturalness, suitability, or what blocked a search. " +
  "Answer with a single JSON object and nothing else.";

class GlooModelProvider {
  /**
   * @param {{ apiKey: string, fetch?: Function, endpoint?: string, modelFamily?: string, model?: string,
   *           tradition?: string, temperature?: number, maxTokens?: number }} opts
   */
  constructor(opts) {
    if (!opts || !opts.apiKey) throw new Error("GlooModelProvider needs an apiKey");
    this.apiKey = opts.apiKey;
    this.fetch = opts.fetch || globalThis.fetch;
    this.endpoint = opts.endpoint || DEFAULT_ENDPOINT;
    this.routing = opts.model ? { model: opts.model } : { model_family: opts.modelFamily || "anthropic" };
    this.tradition = opts.tradition || "not_faith_specific";
    this.temperature = opts.temperature ?? 0;
    this.maxTokens = opts.maxTokens ?? 600;
    this.source = `gloo:${opts.model || opts.modelFamily || "anthropic"}`;
  }

  async _ask(userPrompt) {
    const body = {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
      ...this.routing,
      tradition: this.tradition,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: false,
    };
    const res = await this.fetch(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Gloo AI Studio ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return { text: typeof content === "string" ? content : "", model: data && data.model };
  }

  /** First JSON object in a reply, or null. */
  static parseJson(text) {
    const m = /\{[\s\S]*\}/.exec(text || "");
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }

  async judgeMelodySuitability({ passage, melody, prior, chunkCount }) {
    const prompt =
      `Passage: ${passage.reference} (${passage.version.name}${passage.synthetic ? ", SYNTHETIC TEST DATA, NOT SCRIPTURE" : ""}).\n` +
      `Text (verbatim, do not alter): ${passage.text}\n` +
      `Melody: ${melody.name}; community: ${melody.community}; meter ${melody.meter || "unknown"}; ${melody.phrases.length} phrases.\n` +
      `Deterministic prior: ${prior.conflicts} contrary of ${prior.constrained} constrained transitions, severity ${prior.severity}, over ${chunkCount} chunks.\n` +
      `Judge whether this melody's character and associations suit this passage for congregational singing. ` +
      `Reply as {"suitability": <0..1>, "rationale": "<two sentences>"}.`;
    try {
      const { text, model } = await this._ask(prompt);
      const j = GlooModelProvider.parseJson(text);
      const suitability = j && typeof j.suitability === "number" ? Math.min(1, Math.max(0, j.suitability)) : 0.5;
      const rationale = j && typeof j.rationale === "string" ? j.rationale : `Unparseable model reply: ${text.slice(0, 300)}`;
      return { suitability, rationale, source: this.source, model };
    } catch (err) {
      return { suitability: 0.5, rationale: `Model unavailable (${err.message}); neutral verdict.`, source: this.source, error: true };
    }
  }

  async explainFailure({ passage, baseline, attempts }) {
    const b = baseline.totals;
    const tried = attempts
      .map((a) => `${a.melodyId}: ${a.infeasible ? `infeasible (${a.reason})` : a.ineligible ? `ineligible (${a.reason})` : `${a.totals.conflicts} contrary of ${a.totals.constrained} constrained`}`)
      .join("; ");
    const prompt =
      `Passage: ${passage.reference} (${passage.version.name}).\nText (verbatim, do not alter): ${passage.text}\n` +
      `Baseline: ${b.conflicts} contrary of ${b.constrained} constrained transitions (severity ${b.severity}) on ${baseline.melodyId}.\n` +
      `Every melody tried: ${tried}.\n` +
      `No setting beat the baseline. Explain to the user which constraint blocked it and what they could change ` +
      `(another published translation, another melody, different chunking). Reply as {"explanation": "<3-4 sentences>"}.`;
    try {
      const { text, model } = await this._ask(prompt);
      const j = GlooModelProvider.parseJson(text);
      return { explanation: j && typeof j.explanation === "string" ? j.explanation : text, source: this.source, model };
    } catch (err) {
      return { explanation: `Model unavailable (${err.message}). No setting beat the baseline; see the attempts list.`, source: this.source, error: true };
    }
  }

  /**
   * candidates: [{ index, penalty, chunks: [text] }] from the DP, cheapest first.
   * Returns the model's preferred order plus flags for breaks it finds unnatural.
   */
  async rankChunkings({ passage, melody, candidates }) {
    const listing = candidates
      .map((c, i) => `#${i} (break penalty ${c.penalty}): ${c.chunks.map((t) => `[${t}]`).join(" ")}`)
      .join("\n");
    const prompt =
      `Passage: ${passage.reference} (${passage.version.name}), language ${passage.version.language}. Melody: ${melody.name}.\n` +
      `Each candidate below splits the verbatim text into sung phrases (breaths). Judge which splits sound natural to a native speaker: ` +
      `a break should not fall inside a tight word group. Do not alter any text.\n${listing}\n` +
      `Reply as {"order": [<candidate indices, best first>], "unnatural": [<indices whose breaks are unacceptable>], "rationale": "<two sentences>"}.`;
    const identity = candidates.map((_, i) => i);
    try {
      const { text, model } = await this._ask(prompt);
      const j = GlooModelProvider.parseJson(text);
      const valid = (arr) => Array.isArray(arr) && arr.every((i) => Number.isInteger(i) && i >= 0 && i < candidates.length);
      let order = j && valid(j.order) ? j.order.filter((v, i, a) => a.indexOf(v) === i) : identity;
      for (const i of identity) if (!order.includes(i)) order.push(i);
      const unnatural = j && valid(j.unnatural) ? j.unnatural : [];
      const rationale = j && typeof j.rationale === "string" ? j.rationale : `Unparseable model reply: ${text.slice(0, 300)}`;
      return { order, unnatural, rationale, source: this.source, model };
    } catch (err) {
      return { order: identity, unnatural: [], rationale: `Model unavailable (${err.message}); deterministic order kept.`, source: this.source, error: true };
    }
  }
}

module.exports = { GlooModelProvider, DEFAULT_ENDPOINT, SYSTEM };
