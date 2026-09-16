"use strict";
/**
 * chunker.js — exact DP over break positions.
 *
 * Splits a passage's syllables into chunks that fit a melody's phrases,
 * cycling the phrase list for long passages (chunk c sings phrase c mod P).
 * The cost of a segmentation is the sum of, per chunk:
 *
 *   lengthMismatch[|syllables - notes|]   (forbidden beyond the table)
 *   breakAfter[class of the punctuation after the chunk's last syllable]
 *   runOver[class] for every punctuation mark sung across inside the chunk
 *
 * and a break is never placed inside a hyphenated name (joinedToNext).
 * The table lives in data/break-penalties.json and is a PRIOR, unverified
 * by a native speaker; the model reranks the top N segmentations afterwards
 * (never inside the DP).
 *
 * The DP is exact and k-best: state (syllables consumed, next phrase index)
 * keeps the K cheapest distinct partial segmentations. test/chunker.test.js
 * checks it against brute force.
 */
const fs = require("node:fs");
const path = require("node:path");
const { feasible } = require("./align.js");

const CLASS_RANK = { sentence: 3, clause: 2, comma: 1, none: 0 };

function loadPenalties(file = path.join(__dirname, "data", "break-penalties.json")) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Strongest punctuation class in a trailing string. */
function punctuationClass(trailing, penalties) {
  let best = "none";
  for (const ch of trailing || "") {
    const cls = penalties.punctuationClass[ch];
    if (cls && CLASS_RANK[cls] > CLASS_RANK[best]) best = cls;
  }
  return best;
}

/** Cost of one chunk spanning syllables [i, j) sung to a phrase of m notes. Infinity if forbidden. */
function chunkCost(syllables, i, j, m, penalties) {
  const L = j - i;
  if (!feasible(L, m)) return Infinity;
  const d = Math.abs(L - m);
  if (d >= penalties.lengthMismatch.length) return Infinity;
  let cost = penalties.lengthMismatch[d];
  const last = syllables[j - 1];
  if (j < syllables.length) {
    if (last.joinedToNext) return Infinity;
    cost += penalties.breakAfter[punctuationClass(last.trailing, penalties)];
  }
  for (let k = i; k < j - 1; k++) {
    cost += penalties.runOver[punctuationClass(syllables[k].trailing, penalties)];
  }
  return cost;
}

/** Rejoin syllables into display text: separator between syllables, hyphen inside names, punctuation kept. */
function rejoin(syllables, separator) {
  let out = "";
  syllables.forEach((s, k) => {
    out += s.text + (s.trailing || "");
    if (k < syllables.length - 1) out += s.joinedToNext ? "-" : separator;
  });
  return out;
}

/**
 * @returns the K cheapest segmentations, cheapest first:
 *   { breaks: [j1, j2, ...], penalty, chunks: [{ start, end, phraseIndex, syllables, text }] }
 */
function chunkPassage(syllables, melody, { penalties = loadPenalties(), topN = 5, separator = " " } = {}) {
  const n = syllables.length;
  const P = melody.phrases.length;
  if (n === 0) return [];
  const maxDiff = penalties.lengthMismatch.length - 1;

  // best[i][p]: up to topN partials { cost, breaks } covering syllables [0, i) with the next chunk on phrase p.
  const best = Array.from({ length: n + 1 }, () => Array.from({ length: P }, () => []));
  best[0][0] = [{ cost: 0, breaks: [] }];

  const push = (list, item) => {
    const key = item.breaks.join(",");
    if (list.some((x) => x.breaks.join(",") === key)) return;
    list.push(item);
    list.sort((a, b) => a.cost - b.cost || a.breaks.join(",").localeCompare(b.breaks.join(",")));
    if (list.length > topN) list.length = topN;
  };

  for (let i = 0; i < n; i++) {
    for (let p = 0; p < P; p++) {
      if (!best[i][p].length) continue;
      const m = melody.phrases[p].midi.length;
      for (let L = Math.max(1, m - maxDiff); L <= m + maxDiff && i + L <= n; L++) {
        const j = i + L;
        const c = chunkCost(syllables, i, j, m, penalties);
        if (c === Infinity) continue;
        for (const partial of best[i][p]) {
          push(best[j][(p + 1) % P], { cost: partial.cost + c, breaks: j < n ? [...partial.breaks, j] : partial.breaks });
        }
      }
    }
  }

  const finals = [];
  for (let p = 0; p < P; p++) for (const item of best[n][p]) push(finals, item);

  return finals.map(({ cost, breaks }) => {
    const bounds = [0, ...breaks, n];
    const chunks = [];
    for (let c = 0; c + 1 < bounds.length; c++) {
      const part = syllables.slice(bounds[c], bounds[c + 1]);
      chunks.push({ start: bounds[c], end: bounds[c + 1], phraseIndex: c % P, syllables: part, text: rejoin(part, separator) });
    }
    return { breaks, penalty: cost, chunks };
  });
}

module.exports = { loadPenalties, punctuationClass, chunkCost, chunkPassage, rejoin };
