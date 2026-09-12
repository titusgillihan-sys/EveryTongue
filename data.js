/**
 * Golden-path demo data for Every Tongue.
 *
 * Hymn: "Amazing Grace" (tune: New Britain, public domain)
 * Line: "Amazing grace, how sweet the sound"
 * Mandarin translation: 奇异恩典，何等甘甜 (Qíyì Ēndiǎn, héděng gāntián)
 *   — a commonly used Mandarin rendering of this line.
 *
 * Tone entries below follow the CC-CEDICT convention (simplified character,
 * pinyin, tone number 1-5). Only the syllables used in this demo are
 * hand-entered here; a production build would look these up directly in
 * the downloaded CC-CEDICT file.
 *
 * NOTE: the melody's note-to-note directions are hand-encoded to reflect
 * the general shape of the "New Britain" tune's opening phrase, and the
 * specific tone/melody clash flagged below is the illustrative example
 * this MVP is built around. Per the project's build spec, a real deployment
 * of this demo should have that clash double-checked against sheet music
 * and by a native Mandarin speaker before being presented as a verified,
 * real-world case — swap the NOTES/LYRICS arrays below once that's done.
 */

const SONG = {
  title: "Amazing Grace",
  tuneName: "New Britain (public domain)",
  englishLine: "Amazing grace, how sweet the sound",
  englishGloss: "Marvelous grace — how sweet [it sounds]",
  mandarinLine: "奇异恩典，何等甘甜",
  mandarinPinyinLine: "Qíyì ēndiǎn, héděng gāntián",

  // Relative pitch numbers (arbitrary scale, direction is what matters).
  notes: [
    { hanzi: "奇", pinyin: "qí", tone: 2, gloss: "marvelous", pitch: 60, direction: null },
    { hanzi: "异", pinyin: "yì", tone: 4, gloss: "extraordinary", pitch: 55, direction: "down" },
    { hanzi: "恩", pinyin: "ēn", tone: 1, gloss: "grace", pitch: 55, direction: "same" },
    { hanzi: "典", pinyin: "diǎn", tone: 3, gloss: "(of grace)", pitch: 50, direction: "down" },
    { hanzi: "何", pinyin: "hé", tone: 2, gloss: "how", pitch: 45, direction: "down" },
    { hanzi: "等", pinyin: "děng", tone: 3, gloss: "(intensifier)", pitch: 52, direction: "up" },
    { hanzi: "甘", pinyin: "gān", tone: 1, gloss: "sweet", pitch: 52, direction: "same" },
    { hanzi: "甜", pinyin: "tián", tone: 2, gloss: "sweet", pitch: 57, direction: "up" },
  ],

  // Rules-based tone -> expected melody direction map.
  toneExpectation: {
    1: { direction: "same", label: "flat / high" },
    2: { direction: "up", label: "rising" },
    3: { direction: "down", label: "dipping / low" },
    4: { direction: "down", label: "falling" },
    5: { direction: null, label: "neutral (flexible)" },
  },

  // Pre-computed AI-style suggestions for the two flagged mismatches
  // (used as a static fallback; api/suggest.js can regenerate these live
  // against the Claude API if that function is deployed with a key).
  suggestions: {
    4: {
      // index of "何" in notes[]
      word: "何",
      pinyin: "hé",
      tone: 2,
      alternates: [
        {
          hanzi: "竟",
          pinyin: "jìng",
          tone: 4,
          reason:
            "Pairs with 然 (below) to form 竟然 (\"surprisingly, of all things\"). Its falling tone lands naturally on the melody's downward step, unlike 何's rising tone, which the same descending note flattens toward homophones like 河 (river) or 合 (to close/fit).",
        },
        {
          hanzi: "好",
          pinyin: "hǎo",
          tone: 3,
          reason:
            "Standalone alternative forming 好甜 (\"how sweet\"), an everyday exclamatory pattern in spoken Mandarin. Its dipping tone also sits comfortably on the melody's downward note.",
        },
      ],
    },
    5: {
      // index of "等" in notes[]
      word: "等",
      pinyin: "děng",
      tone: 3,
      alternates: [
        {
          hanzi: "然",
          pinyin: "rán",
          tone: 2,
          reason:
            "Completes 竟然 (\"surprisingly\") when paired with 竟 above. Its rising tone rides naturally up with the melody's ascending note, unlike 等's dipping tone.",
        },
        {
          hanzi: "极",
          pinyin: "jí",
          tone: 2,
          reason:
            "Standalone alternative meaning \"extremely\" (as in 甜极了, \"impossibly sweet\"). Also rises to match the melody's upward step.",
        },
      ],
    },
  },

  // The full corrected line using each mismatch's top-ranked suggestion.
  correctedLine: "奇异恩典，竟然甘甜",
  correctedPinyinLine: "Qíyì ēndiǎn, jìngrán gāntián",
  correctedGloss: "Marvelous grace — surprisingly sweet!",
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SONG };
}
