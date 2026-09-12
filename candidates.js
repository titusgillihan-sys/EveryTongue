/**
 * Every Tongue — candidate generation and ranking.
 *
 * Given a line that the scorer has flagged for contrary motion, this proposes
 * concrete ways to fix it and ranks them.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE (see CLAUDE.md):
 * meaning fidelity is a SEPARATE GATE from singability. A candidate that
 * drifts too far in meaning is removed before ranking ever happens — it can
 * never be rescued by scoring well. Singability only orders what survives the
 * gate. Nothing here can improve a score by changing what a line means.
 *
 * Two kinds of fix are produced:
 *   1. WORD fixes    — swap a syllable for a near-synonym whose tone moves
 *                      with the melody instead of against it. Costs meaning.
 *   2. MELODY fixes  — move that one note the other way instead. Costs nothing
 *                      in meaning, but changes the tune.
 *
 * VERIFICATION CAVEAT: the glosses and distances below are hand-entered from
 * standard dictionary senses and have NOT been checked by a fluent speaker.
 * Treat any specific recommendation as illustrative until it has been.
 */

/**
 * The substitution lexicon. For each headword, near-meaning replacements.
 *
 * `distance` is the meaning gate's unit:
 *   0 — interchangeable in this context
 *   1 — close; shifts nuance but not the claim of the line
 *   2 — loose; recognisably changes what the line says
 *
 * MEANING_BUDGET is the highest distance allowed through the gate.
 */
const MEANING_BUDGET = 1;

const SUBSTITUTIONS = {
  // --- intensifiers / function words ---
  "何": [
    { hanzi: "多", pinyin: "duō", tone: 1, gloss: "how / so", distance: 0 },
    { hanzi: "真", pinyin: "zhēn", tone: 1, gloss: "truly, really", distance: 1 },
    { hanzi: "好", pinyin: "hǎo", tone: 3, gloss: "how (exclamatory)", distance: 1 },
    { hanzi: "竟", pinyin: "jìng", tone: 4, gloss: "surprisingly, of all things", distance: 2 },
  ],
  "等": [
    { hanzi: "么", pinyin: "me", tone: 5, gloss: "(intensifier particle)", distance: 0 },
    { hanzi: "般", pinyin: "bān", tone: 1, gloss: "so, in such a way", distance: 1 },
    { hanzi: "极", pinyin: "jí", tone: 2, gloss: "extremely", distance: 1 },
    { hanzi: "然", pinyin: "rán", tone: 2, gloss: "(adverbial suffix)", distance: 2 },
  ],
  "真": [
    { hanzi: "诚", pinyin: "chéng", tone: 2, gloss: "sincerely, truly", distance: 0 },
    { hanzi: "实", pinyin: "shí", tone: 2, gloss: "truly, in truth", distance: 1 },
    { hanzi: "甚", pinyin: "shèn", tone: 4, gloss: "very, exceedingly", distance: 1 },
  ],

  // --- worship vocabulary ---
  "甜": [
    { hanzi: "美", pinyin: "měi", tone: 3, gloss: "lovely, beautiful", distance: 1 },
    { hanzi: "醇", pinyin: "chún", tone: 2, gloss: "mellow, rich", distance: 2 },
  ],
  "甘": [
    { hanzi: "香", pinyin: "xiāng", tone: 1, gloss: "fragrant, sweet", distance: 1 },
    { hanzi: "醇", pinyin: "chún", tone: 2, gloss: "mellow", distance: 2 },
  ],
  "圣": [
    { hanzi: "神", pinyin: "shén", tone: 2, gloss: "divine, of God", distance: 1 },
    { hanzi: "洁", pinyin: "jié", tone: 2, gloss: "pure, clean", distance: 1 },
    { hanzi: "灵", pinyin: "líng", tone: 2, gloss: "spiritual", distance: 2 },
  ],
  "夜": [
    { hanzi: "宵", pinyin: "xiāo", tone: 1, gloss: "night (literary)", distance: 0 },
    { hanzi: "晚", pinyin: "wǎn", tone: 3, gloss: "evening, night", distance: 1 },
    { hanzi: "暮", pinyin: "mù", tone: 4, gloss: "dusk, nightfall", distance: 2 },
  ],
  "安": [
    { hanzi: "宁", pinyin: "níng", tone: 2, gloss: "peaceful, tranquil", distance: 0 },
    { hanzi: "静", pinyin: "jìng", tone: 4, gloss: "calm, still", distance: 1 },
    { hanzi: "稳", pinyin: "wěn", tone: 3, gloss: "settled, secure", distance: 2 },
  ],
  "善": [
    { hanzi: "良", pinyin: "liáng", tone: 2, gloss: "good, fine", distance: 0 },
    { hanzi: "纯", pinyin: "chún", tone: 2, gloss: "pure", distance: 1 },
    { hanzi: "美", pinyin: "měi", tone: 3, gloss: "good, fair", distance: 1 },
  ],
  "恩": [
    { hanzi: "慈", pinyin: "cí", tone: 2, gloss: "loving-kindness", distance: 1 },
    { hanzi: "福", pinyin: "fú", tone: 2, gloss: "blessing", distance: 2 },
  ],
  "爱": [
    { hanzi: "慈", pinyin: "cí", tone: 2, gloss: "loving-kindness", distance: 1 },
    { hanzi: "恩", pinyin: "ēn", tone: 1, gloss: "grace, kindness", distance: 1 },
    { hanzi: "惠", pinyin: "huì", tone: 4, gloss: "kindness, favour", distance: 1 },
    { hanzi: "怜", pinyin: "lián", tone: 2, gloss: "compassion", distance: 2 },
  ],
  "光": [
    { hanzi: "明", pinyin: "míng", tone: 2, gloss: "brightness", distance: 0 },
    { hanzi: "辉", pinyin: "huī", tone: 1, gloss: "radiance", distance: 1 },
    { hanzi: "耀", pinyin: "yào", tone: 4, gloss: "shining, radiance", distance: 1 },
  ],
  "明": [
    { hanzi: "亮", pinyin: "liàng", tone: 4, gloss: "bright", distance: 0 },
    { hanzi: "辉", pinyin: "huī", tone: 1, gloss: "radiance", distance: 1 },
    { hanzi: "光", pinyin: "guāng", tone: 1, gloss: "light", distance: 1 },
  ],
  "心": [
    { hanzi: "灵", pinyin: "líng", tone: 2, gloss: "spirit, inner self", distance: 1 },
    { hanzi: "怀", pinyin: "huái", tone: 2, gloss: "bosom, heart", distance: 1 },
    { hanzi: "衷", pinyin: "zhōng", tone: 1, gloss: "innermost feeling", distance: 1 },
    { hanzi: "意", pinyin: "yì", tone: 4, gloss: "mind, intent", distance: 2 },
  ],
  "好": [
    { hanzi: "佳", pinyin: "jiā", tone: 1, gloss: "good, fine", distance: 0 },
    { hanzi: "良", pinyin: "liáng", tone: 2, gloss: "good", distance: 1 },
    { hanzi: "善", pinyin: "shàn", tone: 4, gloss: "good, kind", distance: 1 },
  ],
  "主": [
    { hanzi: "神", pinyin: "shén", tone: 2, gloss: "God", distance: 1 },
    { hanzi: "王", pinyin: "wáng", tone: 2, gloss: "king", distance: 2 },
  ],
  "喜": [
    { hanzi: "欢", pinyin: "huān", tone: 1, gloss: "joy, gladness", distance: 0 },
    { hanzi: "悦", pinyin: "yuè", tone: 4, gloss: "delight", distance: 1 },
  ],
  "大": [
    { hanzi: "高", pinyin: "gāo", tone: 1, gloss: "lofty, exalted", distance: 1 },
    { hanzi: "宏", pinyin: "hóng", tone: 2, gloss: "grand, vast", distance: 1 },
  ],
  "平": [
    { hanzi: "宁", pinyin: "níng", tone: 2, gloss: "peaceful", distance: 0 },
    { hanzi: "和", pinyin: "hé", tone: 2, gloss: "harmonious, calm", distance: 1 },
  ],
  "永": [{ hanzi: "长", pinyin: "cháng", tone: 2, gloss: "lasting, long", distance: 1 }],
  "美": [
    { hanzi: "佳", pinyin: "jiā", tone: 1, gloss: "fine, lovely", distance: 0 },
    { hanzi: "良", pinyin: "liáng", tone: 2, gloss: "good", distance: 1 },
  ],
  "奇": [
    { hanzi: "神", pinyin: "shén", tone: 2, gloss: "wondrous", distance: 1 },
    { hanzi: "妙", pinyin: "miào", tone: 4, gloss: "marvellous", distance: 1 },
  ],
  "异": [{ hanzi: "妙", pinyin: "miào", tone: 4, gloss: "marvellous", distance: 1 }],
};

const OPPOSITE_DIRECTION = { up: "down", down: "up" };

/**
 * Fixed compounds that must not be broken apart.
 *
 * A substitution that is individually reasonable can still be nonsense inside
 * a set phrase: 恩典 ("grace") is one word, so swapping 典 alone does not
 * produce a different word for "grace" — it produces gibberish. When a flagged
 * syllable sits inside one of these, the generator REFUSES to offer a word fix
 * and says the melody (or a full retranslation by a fluent speaker) is the
 * only honest option.
 *
 * This is the meaning gate operating structurally rather than by distance.
 */
const LOCKED_COMPOUNDS = [
  "奇异", "恩典", "何等", "甘甜",
  "平安", "圣善", "伟大", "永远",
  "耶稣", "基督", "圣灵", "十字架", "喜乐", "荣耀",
];

/** Index range of a locked compound containing `index`, or null. */
function lockedCompoundAt(notes, index) {
  const text = notes.map((n) => n.hanzi).join("");
  for (const compound of LOCKED_COMPOUNDS) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(compound, from);
      if (at === -1) break;
      if (index >= at && index < at + compound.length) {
        return { compound, start: at, end: at + compound.length - 1 };
      }
      from = at + 1;
    }
  }
  return null;
}

function _engine() {
  if (typeof module !== "undefined" && module.exports) return require("./shared.js");
  return {
    analyzeNotes: window.analyzeNotes,
    lineTension: window.lineTension,
    directionsToPitches: window.directionsToPitches,
  };
}

/**
 * Swap one syllable and report what it does to the whole line's tension.
 * Substituting at index i can change the transition into i AND out of i,
 * so the entire line is re-scored rather than just that one note.
 */
function _tensionWith(notes, index, replacement, lineTension) {
  const copy = notes.map((n, i) =>
    i === index ? { ...n, hanzi: replacement.hanzi, pinyin: replacement.pinyin, tone: replacement.tone } : { ...n }
  );
  return lineTension(copy);
}

/**
 * All the ways to fix the flag at `index`, ranked.
 *
 * Returns:
 *   wordFixes   — ranked substitutions that PASSED the meaning gate
 *   rejected    — candidates that would have helped but cost too much meaning,
 *                 kept so the UI can show the gate doing its job
 *   melodyFix   — the note change that removes the clash without touching meaning
 *   unfixable   — true when no substitution in budget improves the line
 */
function generateFixes(notes, index, options) {
  const opts = options || {};
  const budget = opts.meaningBudget === undefined ? MEANING_BUDGET : opts.meaningBudget;
  const { analyzeNotes, lineTension } = _engine();

  const note = notes[index];
  const baseline = lineTension(notes);
  const locked = lockedCompoundAt(notes, index);
  const pool = locked ? [] : SUBSTITUTIONS[note.hanzi] || [];

  const scored = pool.map((cand) => {
    const after = _tensionWith(notes, index, cand, lineTension);
    const stillFlagged = analyzeNotes(
      notes.map((n, i) => (i === index ? { ...n, tone: cand.tone } : n))
    )[index];
    return {
      ...cand,
      tensionBefore: baseline,
      tensionAfter: after,
      improvement: baseline - after,
      resolves: stillFlagged.match,
      withinBudget: cand.distance <= budget,
    };
  });

  // THE GATE. Applied before ranking, never after — a candidate that costs too
  // much meaning is out regardless of how well it sings.
  const passed = scored.filter((c) => c.withinBudget);
  const rejected = scored.filter((c) => !c.withinBudget && c.improvement > 0);

  const wordFixes = passed
    .filter((c) => c.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement || a.distance - b.distance);

  // A melody fix costs no meaning at all: move this one note the other way.
  let melodyFix = null;
  const flipped = OPPOSITE_DIRECTION[note.direction];
  if (flipped) {
    const candidates = [flipped, "same"];
    for (const dir of candidates) {
      const copy = notes.map((n, i) => (i === index ? { ...n, direction: dir } : { ...n }));
      const after = lineTension(copy);
      if (after < baseline) {
        melodyFix = { direction: dir, tensionAfter: after, improvement: baseline - after };
        break;
      }
    }
  }

  return {
    index,
    hanzi: note.hanzi,
    pinyin: note.pinyin,
    tone: note.tone,
    baseline,
    wordFixes,
    rejected,
    melodyFix,
    unfixable: wordFixes.length === 0,
    noLexiconEntry: !locked && pool.length === 0,
    locked: locked ? locked.compound : null,
  };
}

/**
 * Run generateFixes over every flagged syllable in a line and shape the result
 * the way the row renderer expects, so the library pages show generated
 * candidates instead of hand-written ones.
 */
function bestFixes(notes, options) {
  const { analyzeNotes } = _engine();
  const out = {};
  analyzeNotes(notes).forEach((n) => {
    if (n.unknown || n.match) return;
    const fixes = generateFixes(notes, n.index, options);
    const alternates = fixes.wordFixes.map((f) => ({
      hanzi: f.hanzi,
      pinyin: f.pinyin,
      tone: f.tone,
      distance: f.distance,
      improvement: f.improvement,
      resolves: f.resolves,
      reason:
        `"${f.gloss}" — meaning distance ${f.distance}/${MEANING_BUDGET} allowed. ` +
        (f.resolves
          ? `Its tone moves with the melody here, clearing the clash (line tension ${f.tensionBefore} → ${f.tensionAfter}).`
          : `Eases but does not clear the clash (line tension ${f.tensionBefore} → ${f.tensionAfter}).`),
    }));
    out[n.index] = {
      word: n.hanzi,
      pinyin: n.pinyin,
      tone: n.tone,
      becomes: null,
      alternates,
      melodyFix: fixes.melodyFix,
      rejected: fixes.rejected,
      unfixable: fixes.unfixable,
      noLexiconEntry: fixes.noLexiconEntry,
      locked: fixes.locked,
    };
  });
  return out;
}

/** Apply the top-ranked word fix at every index that has one. */
function applyBestFixes(notes, fixes) {
  return notes.map((n, i) => {
    const f = fixes[i];
    if (!f || !f.alternates || !f.alternates.length) return { ...n };
    const top = f.alternates[0];
    return { ...n, hanzi: top.hanzi, pinyin: top.pinyin, tone: top.tone };
  });
}

/**
 * Apply the melody fix at every flagged index — changes the tune, not the words.
 * Pitches are recomputed from the new directions so the drawn contour actually
 * shows the adjusted tune rather than the original one.
 */
function applyMelodyFixes(notes, fixes) {
  const { directionsToPitches } = _engine();
  const moved = notes.map((n, i) => {
    const f = fixes[i];
    if (!f || !f.melodyFix) return { ...n };
    return { ...n, direction: f.melodyFix.direction };
  });
  const startPitch = notes.length ? notes[0].pitch : 55;
  const pitches = directionsToPitches(moved.map((n) => n.direction), startPitch);
  return moved.map((n, i) => ({ ...n, pitch: pitches[i] }));
}

function lineToText(notes) {
  return notes.map((n) => n.hanzi).join("");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SUBSTITUTIONS,
    LOCKED_COMPOUNDS,
    MEANING_BUDGET,
    lockedCompoundAt,
    generateFixes,
    bestFixes,
    applyBestFixes,
    applyMelodyFixes,
    lineToText,
  };
}
