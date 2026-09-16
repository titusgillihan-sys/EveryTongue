"use strict";
/**
 * providers/index.js — which ModelProvider runs.
 *
 * The stub is the default and the demo path. Gloo AI Studio is selected only
 * when BOTH a credential (GLOO_API_KEY) and an explicit opt-in (ET_MODEL=gloo
 * or --model gloo) are present. A missing credential with an explicit opt-in
 * is an error, never a silent fallback, so nobody demos the stub thinking it
 * is the model.
 */
const { StubModelProvider, cached } = require("./model.js");
const { GlooModelProvider } = require("./gloo.js");

function selectModelProvider({ env = process.env, choice, fetch } = {}) {
  const want = choice || env.ET_MODEL || "stub";
  if (want === "stub") return cached(new StubModelProvider());
  if (want === "gloo") {
    if (!env.GLOO_API_KEY) throw new Error("--model gloo needs GLOO_API_KEY; the offline demo uses --model stub");
    return cached(new GlooModelProvider({ apiKey: env.GLOO_API_KEY, fetch, modelFamily: env.GLOO_MODEL_FAMILY, model: env.GLOO_MODEL, tradition: env.GLOO_TRADITION }));
  }
  throw new Error(`Unknown model provider "${want}" (stub | gloo)`);
}

module.exports = { selectModelProvider };
