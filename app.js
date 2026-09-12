/**
 * Every Tongue — rules-based tone/melody matcher + rendering.
 * All logic here is deliberately simple and inspectable: no ML, no black box.
 */

function expectedDirectionForTone(tone) {
  return SONG.toneExpectation[tone].direction;
}

/**
 * Returns true if a syllable's tone is compatible with the melody's
 * pitch direction at that note.
 *   - Tone 5 (neutral) always matches (flexible).
 *   - The first note of a line has no previous note, so it can't clash.
 *   - Tone 1 wants "same", tone 2 wants "up", tone 3 and 4 want "down"
 *     (tone 3's dip is treated as a loose match for "down").
 */
function toneMatchesMelody(tone, direction) {
  if (tone === 5) return true;
  if (direction === null || direction === undefined) return true;
  const expected = expectedDirectionForTone(tone);
  if (expected === null) return true;
  return expected === direction;
}

function analyzeSong(song) {
  return song.notes.map((note, i) => ({
    ...note,
    index: i,
    match: toneMatchesMelody(note.tone, note.direction),
  }));
}

const DIRECTION_ARROW = { up: "↗", down: "↘", same: "→", null: "•" };
const TONE_NAMES = { 1: "1st (flat)", 2: "2nd (rising)", 3: "3rd (dipping)", 4: "4th (falling)", 5: "neutral" };

function renderMeta() {
  document.getElementById("english-line").textContent = SONG.englishLine;
  document.getElementById("english-gloss").textContent = SONG.englishGloss;
  document.getElementById("mandarin-line").textContent = SONG.mandarinLine;
  document.getElementById("mandarin-pinyin").textContent = SONG.mandarinPinyinLine;
  document.getElementById("tune-name").textContent = `${SONG.title} — tune: ${SONG.tuneName}`;
}

function renderAnalysis(analyzed) {
  const container = document.getElementById("analysis-rows");
  container.innerHTML = "";

  analyzed.forEach((n) => {
    const row = document.createElement("div");
    row.className = `row ${n.match ? "match" : "mismatch"}`;

    const dirLabel = n.direction ? n.direction : "start";

    row.innerHTML = `
      <div class="syllable">
        <span class="hanzi">${n.hanzi}</span>
        <span class="pinyin">${n.pinyin}</span>
      </div>
      <div class="cell tone">Tone ${n.tone} <span class="sub">${TONE_NAMES[n.tone]}</span></div>
      <div class="cell direction">${DIRECTION_ARROW[dirLabel] || "•"} <span class="sub">melody ${dirLabel}</span></div>
      <div class="cell flag">${n.match ? "✅ match" : "⚠️ mismatch"}</div>
    `;
    container.appendChild(row);

    if (!n.match) {
      const suggestion = SONG.suggestions[n.index];
      if (suggestion) {
        const box = document.createElement("div");
        box.className = "suggestion-box";
        box.innerHTML = `
          <div class="suggestion-title">AI-suggested alternatives for "${suggestion.word}" (${suggestion.pinyin}, tone ${suggestion.tone})</div>
          <ul>
            ${suggestion.alternates
              .map(
                (alt) =>
                  `<li><strong>${alt.hanzi}</strong> (${alt.pinyin}, tone ${alt.tone}) — ${alt.reason}</li>`
              )
              .join("")}
          </ul>
        `;
        container.appendChild(box);
      }
    }
  });
}

function buildContourSVG(analyzed, useCorrectedTones) {
  const width = 560;
  const height = 140;
  const padX = 30;
  const padY = 20;
  const n = analyzed.length;
  const pitches = analyzed.map((d) => d.pitch);
  const minP = Math.min(...pitches);
  const maxP = Math.max(...pitches);
  const range = maxP - minP || 1;

  const xFor = (i) => padX + (i * (width - 2 * padX)) / (n - 1);
  const yFor = (p) => height - padY - ((p - minP) / range) * (height - 2 * padY);

  const points = analyzed.map((d, i) => `${xFor(i)},${yFor(d.pitch)}`).join(" ");

  const markers = analyzed
    .map((d, i) => {
      const isMismatch = useCorrectedTones ? false : !d.match;
      const color = isMismatch ? "#e0483e" : "#2f9e5b";
      const label = useCorrectedTones && SONG.suggestions[d.index] ? SONG.suggestions[d.index].alternates[0].hanzi : d.hanzi;
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

function renderContours(analyzed) {
  document.getElementById("contour-before").innerHTML = buildContourSVG(analyzed, false);
  document.getElementById("contour-after").innerHTML = buildContourSVG(analyzed, true);
  document.getElementById("before-line").textContent = `${SONG.mandarinLine} (${SONG.mandarinPinyinLine})`;
  document.getElementById("after-line").textContent = `${SONG.correctedLine} (${SONG.correctedPinyinLine})`;
  document.getElementById("after-gloss").textContent = SONG.correctedGloss;
}

function renderSummary(analyzed) {
  const mismatches = analyzed.filter((n) => !n.match).length;
  const el = document.getElementById("summary-banner");
  if (mismatches === 0) {
    el.textContent = "✅ Every syllable's tone fits the melody's direction — no mismatches found.";
    el.className = "summary ok";
  } else {
    el.textContent = `⚠️ ${mismatches} tone/melody mismatch${mismatches > 1 ? "es" : ""} found — the melody is pulling a word's pitch away from its correct tone, which can change its meaning.`;
    el.className = "summary warn";
  }
}

// ---- Audio: Web Speech API for spoken Mandarin, Web Audio for melody beeps ----

function speak(text) {
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

let audioCtx;
function playMelodyBeeps(notes) {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const pitches = notes.map((n) => n.pitch);
  const minP = Math.min(...pitches);
  const noteDuration = 0.35;
  notes.forEach((n, i) => {
    const freq = 220 + (n.pitch - minP) * 12; // map relative pitch to an audible range
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    const startTime = audioCtx.currentTime + i * noteDuration;
    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration * 0.9);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + noteDuration);
  });
}

// ---- Live AI regeneration (optional serverless function, static-safe fallback) ----

async function regenerateWithLiveAI() {
  const status = document.getElementById("live-ai-status");
  status.textContent = "Contacting Claude API…";
  try {
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song: SONG }),
    });
    if (!res.ok) throw new Error("no server function available");
    const data = await res.json();
    status.textContent = "Live suggestions received (see console).";
    console.log("Live AI suggestions:", data);
  } catch (err) {
    status.textContent =
      "Live AI regeneration needs the included /api/suggest function deployed with an Anthropic API key (see README). Showing the pre-computed suggestions above instead.";
  }
}

function init() {
  renderMeta();
  const analyzed = analyzeSong(SONG);
  renderSummary(analyzed);
  renderAnalysis(analyzed);
  renderContours(analyzed);

  document.getElementById("speak-before").addEventListener("click", () => speak(SONG.mandarinLine));
  document.getElementById("speak-after").addEventListener("click", () => speak(SONG.correctedLine));
  document.getElementById("play-melody").addEventListener("click", () => playMelodyBeeps(SONG.notes));
  document.getElementById("live-ai-button").addEventListener("click", regenerateWithLiveAI);
}

document.addEventListener("DOMContentLoaded", init);
