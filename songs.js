/**
 * The library of pre-analyzed songs — SOURCE DATA ONLY.
 *
 * Deliberately carries no suggestions and no "corrected" line: those used to
 * be hand-written here, drifted out of sync with the scorer, and ended up
 * pointing at syllables the scorer no longer flags. They are now GENERATED at
 * render time by candidates.js, so the fix shown can never disagree with the
 * analysis shown.
 *
 * COPYRIGHT: only hymns whose text is public domain may be added here.
 * "How Great Thou Art" was removed — the English text (Stuart K. Hine, 1949)
 * is still under copyright, as are translations derived from it. Tune being
 * public domain is not sufficient; the words are the thing being committed.
 *
 * VERIFICATION CAVEAT: tones and vocabulary are standard Mandarin, but the
 * melody contours are hand-encoded approximations and the flagged clashes are
 * illustrative until a fluent speaker confirms they are real and audible.
 */

const SONGS = [
  {
    id: "amazing-grace",
    title: "Amazing Grace",
    tuneName: "New Britain (public domain)",
    englishLine: "Amazing grace, how sweet the sound",
    englishGloss: "Marvelous grace — how sweet [it sounds]",
    mandarinLine: "奇异恩典，何等甘甜",
    mandarinPinyinLine: "Qíyì ēndiǎn, héděng gāntián",
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
    /**
     * Editorial note the generator cannot derive: which real word a syllable
     * is pulled toward when the melody bends it. UNVERIFIED — needs a fluent
     * speaker before it is presented as a real-world case.
     */
    soundsLike: {
      4: { hanzi: "贺", pinyin: "hè", meaning: "to congratulate / celebrate" },
    },
  },

  {
    id: "silent-night",
    title: "Silent Night",
    tuneName: "Stille Nacht, F. Gruber (public domain)",
    englishLine: "Silent night, holy night",
    englishGloss: "Peaceful night, holy night",
    mandarinLine: "平安夜，圣善夜",
    mandarinPinyinLine: "Píng'ān yè, shèngshàn yè",
    notes: [
      { hanzi: "平", pinyin: "píng", tone: 2, gloss: "peaceful", pitch: 58, direction: null },
      { hanzi: "安", pinyin: "ān", tone: 1, gloss: "safe/calm", pitch: 53, direction: "down" },
      { hanzi: "夜", pinyin: "yè", tone: 4, gloss: "night", pitch: 48, direction: "down" },
      { hanzi: "圣", pinyin: "shèng", tone: 4, gloss: "holy", pitch: 43, direction: "down" },
      { hanzi: "善", pinyin: "shàn", tone: 4, gloss: "virtuous/good", pitch: 50, direction: "up" },
      { hanzi: "夜", pinyin: "yè", tone: 4, gloss: "night", pitch: 45, direction: "down" },
    ],
    soundsLike: {},
  },
];

function getSongById(id) {
  return SONGS.find((s) => s.id === id);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SONGS, getSongById };
}
