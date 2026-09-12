/**
 * Every Tongue — shared rules engine, rendering helpers, and audio helpers.
 * Used by every page (home, library, song detail, upload) so the matching
 * logic is defined exactly once and stays transparent/inspectable.
 */

const TONE_EXPECTATION = {
  1: { direction: "same", label: "flat / high" },
  2: { direction: "up", label: "rising" },
  3: { direction: "down", label: "dipping / low" },
  4: { direction: "down", label: "falling" },
  5: { direction: null, label: "neutral (flexible)" },
};

const TONE_NAMES = {
  1: "1st (flat)",
  2: "2nd (rising)",
  3: "3rd (dipping)",
  4: "4th (falling)",
  5: "neutral",
};

const DIRECTION_ARROW = { up: "↗", down: "↘", same: "→", null: "•" };

function expectedDirectionForTone(tone) {
  return TONE_EXPECTATION[tone] ? TONE_EXPECTATION[tone].direction : null;
}

/**
 * Returns true if a syllable's tone is compatible with the melody's pitch
 * direction at that note. Tone 5 (neutral) and unknown tones always match
 * (nothing to flag); the first note of a line can't clash (no previous
 * note to compare against).
 */
function toneMatchesMelody(tone, direction) {
  if (!tone || tone === 5) return true;
  if (direction === null || direction === undefined) return true;
  const expected = expectedDirectionForTone(tone);
  if (expected === null) return true;
  return expected === direction;
}

/**
 * notes: [{ hanzi, pinyin, tone, gloss?, pitch, direction }]
 * Returns the same notes annotated with `match` (bool) and `index`.
 * A note with tone === null (character not found in the dictionary) is
 * marked `unknown: true` and never flagged as a mismatch.
 */
function analyzeNotes(notes) {
  return notes.map((note, i) => ({
    ...note,
    index: i,
    unknown: note.tone === null || note.tone === undefined,
    match: note.tone ? toneMatchesMelody(note.tone, note.direction) : true,
  }));
}

function summaryText(analyzed) {
  const mismatches = analyzed.filter((n) => !n.unknown && !n.match).length;
  if (mismatches === 0) {
    return { text: "✅ Every syllable's tone fits the melody's direction — no mismatches found.", cls: "ok" };
  }
  return {
    text: `⚠️ ${mismatches} tone/melody mismatch${mismatches > 1 ? "es" : ""} found — the melody is pulling a word's pitch away from its correct tone, which can change its meaning.`,
    cls: "warn",
  };
}

function renderAnalysisRows(container, analyzed, suggestions) {
  container.innerHTML = "";
  analyzed.forEach((n) => {
    const row = document.createElement("div");
    const state = n.unknown ? "unknown" : n.match ? "match" : "mismatch";
    row.className = `row ${state}`;
    const dirLabel = n.direction ? n.direction : "start";

    let flagHtml;
    if (n.unknown) {
      flagHtml = `<div class="cell flag">❔ tone unknown</div>`;
    } else if (n.match) {
      flagHtml = `<div class="cell flag">✅ match</div>`;
    } else {
      flagHtml = `<div class="cell flag">⚠️ mismatch</div>`;
    }

    const toneCell = n.unknown
      ? `<div class="cell tone">not in dictionary</div>`
      : `<div class="cell tone">Tone ${n.tone} <span class="sub">${TONE_NAMES[n.tone] || ""}</span></div>`;

    row.innerHTML = `
      <div class="syllable">
        <span class="hanzi">${n.hanzi}</span>
        <span class="pinyin">${n.pinyin || ""}</span>
      </div>
      ${toneCell}
      <div class="cell direction">${DIRECTION_ARROW[dirLabel] || "•"} <span class="sub">melody ${dirLabel}</span></div>
      ${flagHtml}
    `;
    container.appendChild(row);

    if (!n.unknown && !n.match && suggestions && suggestions[n.index]) {
      const suggestion = suggestions[n.index];
      const box = document.createElement("div");
      box.className = "suggestion-box";
      box.innerHTML = `
        <div class="suggestion-title">AI-suggested alternatives for "${suggestion.word}" (${suggestion.pinyin}, tone ${suggestion.tone})</div>
        <ul>
          ${suggestion.alternates
            .map((alt) => `<li><strong>${alt.hanzi}</strong> (${alt.pinyin}, tone ${alt.tone}) — ${alt.reason}</li>`)
            .join("")}
        </ul>
      `;
      container.appendChild(box);
    } else if (!n.unknown && !n.match) {
      const box = document.createElement("div");
      box.className = "suggestion-box pending";
      box.innerHTML = `<div class="suggestion-title">No suggestion yet for "${n.hanzi}" (${n.pinyin}, tone ${n.tone})</div>
        <div class="sub">Deploy <code>api/suggest.js</code> with an Anthropic API key to generate one live, or add it by hand to the song data.</div>`;
      container.appendChild(box);
    }
  });
}

function buildContourSVG(analyzed, useCorrectedLabels, suggestions) {
  const width = 560;
  const height = 140;
  const padX = 30;
  const padY = 20;
  const n = analyzed.length;
  if (n === 0) return "";
  const pitches = analyzed.map((d) => d.pitch);
  const minP = Math.min(...pitches);
  const maxP = Math.max(...pitches);
  const range = maxP - minP || 1;

  const xFor = (i) => (n === 1 ? width / 2 : padX + (i * (width - 2 * padX)) / (n - 1));
  const yFor = (p) => height - padY - ((p - minP) / range) * (height - 2 * padY);

  const points = analyzed.map((d, i) => `${xFor(i)},${yFor(d.pitch)}`).join(" ");

  const markers = analyzed
    .map((d, i) => {
      const isMismatch = useCorrectedLabels ? false : !d.unknown && !d.match;
      const color = d.unknown ? "#9a8f80" : isMismatch ? "#e0483e" : "#2f9e5b";
      const label =
        useCorrectedLabels && suggestions && suggestions[d.index]
          ? suggestions[d.index].alternates[0].hanzi
          : d.hanzi;
      return `
        <circle cx="${xFor(i)}" cy="${yFor(d.pitch)}" r="7" fill="${color}" stroke="white" stroke-width="1.5" />
        <text x="${xFor(i)}" y="${yFor(d.pitch) - 14}" text-anchor="middle" font-size="15" fill="var(--ink)">${label}</text>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="contour-svg" role="img" aria-label="Melody pitch contour">
      <polyline points="${points}" fill="none" stroke="var(--line)" stroke-width="2.5" />
      ${markers}
    </svg>
  `;
}

// ---- Audio helpers ----

function speakMandarin(text) {
  if (!("speechSynthesis" in window)) {
    alert("This browser doesn't support speech synthesis.");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

let _audioCtx;
function playMelodyBeeps(notes) {
  _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (notes.length === 0) return;
  const pitches = notes.map((n) => n.pitch);
  const minP = Math.min(...pitches);
  const noteDuration = 0.35;
  notes.forEach((n, i) => {
    const freq = 220 + (n.pitch - minP) * 12;
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    const startTime = _audioCtx.currentTime + i * noteDuration;
    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration * 0.9);
    osc.connect(gain).connect(_audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + noteDuration);
  });
}

// ---- Melody contour generators (for the Upload/Analyze page) ----

const MELODY_PRESETS = {
  rising: { label: "Rising line", gen: (n) => Array.from({ length: n }, (_, i) => (i === 0 ? null : "up")) },
  falling: { label: "Falling line", gen: (n) => Array.from({ length: n }, (_, i) => (i === 0 ? null : "down")) },
  wave: {
    label: "Wave (up / down alternating)",
    gen: (n) => Array.from({ length: n }, (_, i) => (i === 0 ? null : i % 2 === 1 ? "up" : "down")),
  },
  flat: { label: "Mostly flat (chant-like)", gen: (n) => Array.from({ length: n }, (_, i) => (i === 0 ? null : "same")) },
  amazingGrace: {
    label: "“Amazing Grace” shape",
    gen: (n) => {
      const base = [null, "down", "same", "down", "down", "up", "same", "up"];
      return Array.from({ length: n }, (_, i) => base[i % base.length] ?? (i === 0 ? null : "same"));
    },
  },
};

function directionsToPitches(directions, startPitch = 55, step = 5) {
  let pitch = startPitch;
  return directions.map((dir) => {
    if (dir === "up") pitch += step;
    else if (dir === "down") pitch -= step;
    return pitch;
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    TONE_EXPECTATION,
    toneMatchesMelody,
    analyzeNotes,
    MELODY_PRESETS,
    directionsToPitches,
  };
}
