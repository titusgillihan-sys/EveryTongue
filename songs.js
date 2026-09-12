/**
 * The library of pre-analyzed songs. Each entry follows the same schema
 * consumed by shared.js's renderers. See README.md for the verification
 * caveat that applies to all three: tones/vocabulary are standard Mandarin,
 * but the specific melody contours are hand-encoded approximations and the
 * flagged clashes are illustrative until checked by a native speaker.
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
    suggestions: {
      4: {
        word: "何", pinyin: "hé", tone: 2,
        alternates: [
          { hanzi: "竟", pinyin: "jìng", tone: 4, reason: "Pairs with 然 (below) to form 竟然 (\"surprisingly, of all things\"). Its falling tone lands naturally on the melody's downward step, unlike 何's rising tone, which the same descending note flattens toward homophones like 河 (river) or 合 (to close/fit)." },
          { hanzi: "好", pinyin: "hǎo", tone: 3, reason: "Standalone alternative forming 好甜 (\"how sweet\"), an everyday exclamatory pattern in spoken Mandarin. Its dipping tone also sits comfortably on the melody's downward note." },
        ],
      },
      5: {
        word: "等", pinyin: "děng", tone: 3,
        alternates: [
          { hanzi: "然", pinyin: "rán", tone: 2, reason: "Completes 竟然 (\"surprisingly\") when paired with 竟 above. Its rising tone rides naturally up with the melody's ascending note, unlike 等's dipping tone." },
          { hanzi: "极", pinyin: "jí", tone: 2, reason: "Standalone alternative meaning \"extremely\" (as in 甜极了, \"impossibly sweet\"). Also rises to match the melody's upward step." },
        ],
      },
    },
    correctedLine: "奇异恩典，竟然甘甜",
    correctedPinyinLine: "Qíyì ēndiǎn, jìngrán gāntián",
    correctedGloss: "Marvelous grace — surprisingly sweet!",
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
    suggestions: {
      1: {
        word: "安", pinyin: "ān", tone: 1,
        alternates: [
          { hanzi: "静", pinyin: "jìng", tone: 4, reason: "Means \"calm, still\" — 平静夜 (\"calm night\") stays close to \"peaceful night.\" Its falling tone matches the melody's downward step, unlike 安's flat tone, which the same descending note can blur toward its exact tonal twin 岸 (àn, \"shore\")." },
          { hanzi: "稳", pinyin: "wěn", tone: 3, reason: "Means \"stable, secure.\" Its dipping tone loosely fits the downward note as well, giving \"a settled, secure night\" as a secondary reading." },
        ],
      },
      4: {
        word: "善", pinyin: "shàn", tone: 4,
        alternates: [
          { hanzi: "良", pinyin: "liáng", tone: 2, reason: "Means \"good, fine\" (the second half of 善良 itself). Its rising tone matches the melody's upward step, unlike 善's falling tone, which the same rising note can blur toward its tonal twin 闪 (shǎn, \"to flash/dodge\") — trading \"holy goodness\" for something fleeting." },
          { hanzi: "纯", pinyin: "chún", tone: 2, reason: "Means \"pure.\" Also rises with the melody, giving \"holy-pure night\" as an alternate reading close to the original sense." },
        ],
      },
    },
    correctedLine: "平静夜，圣良夜",
    correctedPinyinLine: "Píngjìng yè, shèngliáng yè",
    correctedGloss: "Calm night, night of holy goodness",
  },

  {
    id: "how-great-thou-art",
    title: "How Great Thou Art",
    tuneName: "O Store Gud, Swedish folk melody (public domain)",
    englishLine: "How great Thou art (refrain)",
    englishGloss: "You are truly great",
    mandarinLine: "你真伟大",
    mandarinPinyinLine: "Nǐ zhēn wěidà",
    notes: [
      { hanzi: "你", pinyin: "nǐ", tone: 3, gloss: "you", pitch: 55, direction: null },
      { hanzi: "真", pinyin: "zhēn", tone: 1, gloss: "truly", pitch: 60, direction: "up" },
      { hanzi: "伟", pinyin: "wěi", tone: 3, gloss: "great (1/2)", pitch: 55, direction: "down" },
      { hanzi: "大", pinyin: "dà", tone: 4, gloss: "great (2/2)", pitch: 50, direction: "down" },
    ],
    suggestions: {
      1: {
        word: "真", pinyin: "zhēn", tone: 1,
        alternates: [
          { hanzi: "诚", pinyin: "chéng", tone: 2, reason: "Means \"sincerely, truly\" (as in 诚然). Its rising tone matches the refrain's famous upward leap, unlike 真's flat tone, which the same rising note pulls out of shape." },
          { hanzi: "尤", pinyin: "yóu", tone: 2, reason: "Means \"especially, all the more.\" Also rises with the melody, giving \"you are all the more great\" as an intensified alternate reading." },
        ],
      },
    },
    correctedLine: "你诚伟大",
    correctedPinyinLine: "Nǐ chéng wěidà",
    correctedGloss: "You are truly/sincerely great",
  },
];

function getSongById(id) {
  return SONGS.find((s) => s.id === id);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SONGS, getSongById };
}
