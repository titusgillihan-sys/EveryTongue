/**
 * A curated, hand-entered starter dictionary of common Mandarin characters
 * (pinyin + tone number), formatted the way CC-CEDICT records this data.
 * It's a small subset chosen for worship-song vocabulary and everyday
 * function words — enough for the Upload/Analyze demo to work on typical
 * short lines, not a full dictionary.
 *
 * A production build should replace this with a real lookup against the
 * downloaded CC-CEDICT file (https://cc-cedict.org/) for full coverage.
 * Characters not found here are marked "tone unknown" rather than guessed.
 */

const TONE_DICTIONARY = {
  // pronouns / function words
  "你": { pinyin: "nǐ", tone: 3 }, "我": { pinyin: "wǒ", tone: 3 }, "他": { pinyin: "tā", tone: 1 },
  "她": { pinyin: "tā", tone: 1 }, "们": { pinyin: "men", tone: 5 }, "的": { pinyin: "de", tone: 5 },
  "是": { pinyin: "shì", tone: 4 }, "了": { pinyin: "le", tone: 5 }, "不": { pinyin: "bù", tone: 4 },
  "都": { pinyin: "dōu", tone: 1 }, "在": { pinyin: "zài", tone: 4 }, "有": { pinyin: "yǒu", tone: 3 },
  "这": { pinyin: "zhè", tone: 4 }, "那": { pinyin: "nà", tone: 4 }, "真": { pinyin: "zhēn", tone: 1 },
  "何": { pinyin: "hé", tone: 2 }, "等": { pinyin: "děng", tone: 3 }, "如": { pinyin: "rú", tone: 2 },
  "此": { pinyin: "cǐ", tone: 3 }, "多": { pinyin: "duō", tone: 1 }, "么": { pinyin: "me", tone: 5 },
  "竟": { pinyin: "jìng", tone: 4 }, "然": { pinyin: "rán", tone: 2 }, "极": { pinyin: "jí", tone: 2 },
  "尤": { pinyin: "yóu", tone: 2 }, "诚": { pinyin: "chéng", tone: 2 }, "好": { pinyin: "hǎo", tone: 3 },
  "甚": { pinyin: "shèn", tone: 4 },

  // worship / hymn vocabulary
  "主": { pinyin: "zhǔ", tone: 3 }, "神": { pinyin: "shén", tone: 2 }, "耶": { pinyin: "yē", tone: 1 },
  "稣": { pinyin: "sū", tone: 1 }, "基": { pinyin: "jī", tone: 1 }, "督": { pinyin: "dū", tone: 1 },
  "天": { pinyin: "tiān", tone: 1 }, "父": { pinyin: "fù", tone: 4 }, "子": { pinyin: "zǐ", tone: 3 },
  "圣": { pinyin: "shèng", tone: 4 }, "灵": { pinyin: "líng", tone: 2 },
  "救": { pinyin: "jiù", tone: 4 }, "赎": { pinyin: "shú", tone: 2 }, "罪": { pinyin: "zuì", tone: 4 },
  "恩": { pinyin: "ēn", tone: 1 }, "典": { pinyin: "diǎn", tone: 3 }, "爱": { pinyin: "ài", tone: 4 },
  "光": { pinyin: "guāng", tone: 1 }, "明": { pinyin: "míng", tone: 2 }, "生": { pinyin: "shēng", tone: 1 },
  "命": { pinyin: "mìng", tone: 4 }, "心": { pinyin: "xīn", tone: 1 }, "喜": { pinyin: "xǐ", tone: 3 },
  "乐": { pinyin: "lè", tone: 4 }, "平": { pinyin: "píng", tone: 2 }, "安": { pinyin: "ān", tone: 1 },
  "夜": { pinyin: "yè", tone: 4 }, "善": { pinyin: "shàn", tone: 4 }, "良": { pinyin: "liáng", tone: 2 },
  "静": { pinyin: "jìng", tone: 4 }, "纯": { pinyin: "chún", tone: 2 }, "稳": { pinyin: "wěn", tone: 3 },
  "荣": { pinyin: "róng", tone: 2 }, "耀": { pinyin: "yào", tone: 4 }, "永": { pinyin: "yǒng", tone: 3 },
  "远": { pinyin: "yuǎn", tone: 3 }, "歌": { pinyin: "gē", tone: 1 }, "颂": { pinyin: "sòng", tone: 4 },
  "唱": { pinyin: "chàng", tone: 4 }, "赞": { pinyin: "zàn", tone: 4 }, "美": { pinyin: "měi", tone: 3 },
  "感": { pinyin: "gǎn", tone: 3 }, "谢": { pinyin: "xiè", tone: 4 }, "祈": { pinyin: "qí", tone: 2 },
  "祷": { pinyin: "dǎo", tone: 3 }, "求": { pinyin: "qiú", tone: 2 }, "望": { pinyin: "wàng", tone: 4 },
  "信": { pinyin: "xìn", tone: 4 }, "十": { pinyin: "shí", tone: 2 },
  "字": { pinyin: "zì", tone: 4 }, "架": { pinyin: "jià", tone: 4 }, "血": { pinyin: "xuè", tone: 4 },
  "羊": { pinyin: "yáng", tone: 2 }, "牧": { pinyin: "mù", tone: 4 }, "群": { pinyin: "qún", tone: 2 },
  "国": { pinyin: "guó", tone: 2 }, "度": { pinyin: "dù", tone: 4 },
  "奇": { pinyin: "qí", tone: 2 }, "异": { pinyin: "yì", tone: 4 }, "甘": { pinyin: "gān", tone: 1 },
  "甜": { pinyin: "tián", tone: 2 }, "伟": { pinyin: "wěi", tone: 3 }, "大": { pinyin: "dà", tone: 4 },
  "悦": { pinyin: "yuè", tone: 4 }, "盼": { pinyin: "pàn", tone: 4 },
  "赐": { pinyin: "cì", tone: 4 }, "福": { pinyin: "fú", tone: 2 },
  "洁": { pinyin: "jié", tone: 2 }, "洗": { pinyin: "xǐ", tone: 3 }, "净": { pinyin: "jìng", tone: 4 },
  "复": { pinyin: "fù", tone: 4 }, "活": { pinyin: "huó", tone: 2 }, "死": { pinyin: "sǐ", tone: 3 },
  "新": { pinyin: "xīn", tone: 1 }, "旧": { pinyin: "jiù", tone: 4 }, "路": { pinyin: "lù", tone: 4 },
  "道": { pinyin: "dào", tone: 4 }, "理": { pinyin: "lǐ", tone: 3 },
  "山": { pinyin: "shān", tone: 1 }, "海": { pinyin: "hǎi", tone: 3 }, "风": { pinyin: "fēng", tone: 1 },
  "雨": { pinyin: "yǔ", tone: 3 }, "花": { pinyin: "huā", tone: 1 }, "星": { pinyin: "xīng", tone: 1 },
  "云": { pinyin: "yún", tone: 2 }, "水": { pinyin: "shuǐ", tone: 3 }, "火": { pinyin: "huǒ", tone: 3 },
};

function lookupLine(line) {
  const chars = Array.from(line).filter((c) => /[一-鿿]/.test(c));
  return chars.map((hanzi) => {
    const entry = TONE_DICTIONARY[hanzi];
    return entry
      ? { hanzi, pinyin: entry.pinyin, tone: entry.tone }
      : { hanzi, pinyin: "?", tone: null };
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TONE_DICTIONARY, lookupLine };
}
