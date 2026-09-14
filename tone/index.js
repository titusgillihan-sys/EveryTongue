"use strict";
/**
 * Tone module registry.
 *
 * A tone module turns plain text into syllables carrying a Chao pitch shape:
 *
 *   {
 *     id: "vi",                     // BCP-47-ish language code
 *     name: "Vietnamese",
 *     TONES: { <toneId>: { shape: [start, end] | null, label } },
 *     syllabify(text) -> [{ text, tone, shape, unknown, label, ... }]
 *   }
 *
 * `shape` is the only field the engine reads. `null` means "no inherent
 * pitch" (neutral tone, unknown character, malformed syllable) and such a
 * syllable is never flagged — nothing is guessed.
 */
const MODULES = {
  vi: require("./vietnamese.js"),
  zh: require("./mandarin.js"),
};

function forLanguage(code) {
  const mod = MODULES[code];
  if (!mod) throw new Error(`No tone module for language "${code}" (have: ${Object.keys(MODULES).join(", ")})`);
  return mod;
}

module.exports = { MODULES, forLanguage };
