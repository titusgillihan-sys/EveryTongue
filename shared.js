/**
 * Every Tongue — shared rules engine, rendering helpers, and audio helpers.
 * Used by every page (home, library, song detail, upload) so the matching
 * logic is defined exactly once and stays transparent/inspectable.
 */

/**
 * THE LANGUAGE PITCH MODEL — the only place a language's tone shapes live.
 *
 * Chao tone letters: each tone as [startLevel, endLevel] on a 1-5 pitch scale.
 * To add a language, swap this table (and the sandhi rule below); nothing
 * downstream knows which language it is looking at.
 *
 * Mandarin:
 *   1st  55  high level        2nd  35  rising
 *   3rd  21  low dipping       4th  51  falling
 *   neutral — no inherent shape, carries the pitch of its context.
 */
const CHAO_TONES = {
  1: { shape: [5, 5], label: "flat / high" },
  2: { shape: [3, 5], label: "rising" },
  3: { shape: [2, 1], label: "dipping / low" },
  4: { shape: [5, 1], label: "falling" },
  5: { shape: null, label: "neutral (flexible)" },
};

const TONE_NAMES = {
  1: "1st (flat)",
  2: "2nd (rising)",
  3: "3rd (dipping)",
  4: "4th (falling)",
  5: "neutral",
};

const DIRECTION_ARROW = { up: "↗", down: "↘", same: "→", null: "•" };

const MELODY_STEP = { up: 1, same: 0, down: -1 };

/**
 * Third-tone sandhi: a 3rd tone directly before another 3rd tone is spoken
 * as a 2nd (rising) tone. 你好 is written nǐ + hǎo but said ní hǎo.
 *
 * Scoring the written tone here would flag the wrong syllable, so every
 * analysis runs on the *effective* (spoken) tone while the row display still
 * shows the citation tone the dictionary records.
 *
 * Returns a parallel array of effective tones; never mutates its input.
 */
function effectiveTones(notes) {
  const tones = notes.map((n) => n.tone ?? null);
  const out = tones.slice();
  for (let i = 0; i < tones.length - 1; i++) {
    if (tones[i] === 3 && tones[i + 1] === 3) out[i] = 2;
  }
  return out;
}

/**
 * Which way the speaking voice actually moves between two adjacent syllables:
 * from where the previous tone ends to where this one starts.
 * Returns a signed level difference (+ up, - down, 0 level), or null when
 * either syllable has no inherent shape (neutral/unknown/line-initial).
 */
function speechInterval(prevTone, tone) {
  const prev = CHAO_TONES[prevTone];
  const cur = CHAO_TONES[tone];
  if (!prev || !cur || !prev.shape || !cur.shape) return null;
  return cur.shape[0] - prev.shape[1];
}

/**
 * CONTRARY MOTION — the thing that actually degrades sung intelligibility
 * (Ladd & Kirby 2020). A syllable is not judged on its own tone; what matters
 * is whether the melody moves *opposite* to the way the voice moves into it.
 *
 * Melody up while speech goes down (or vice versa) = contrary = flagged.
 * Melody flat, speech flat, or both moving the same way = fine.
 *
 * `severity` is how far apart they pull (1-4); used to rank candidate fixes.
 */
function motionConflict(prevTone, tone, direction) {
  const speech = speechInterval(prevTone, tone);
  const melody = MELODY_STEP[direction];
  if (speech === null || melody === undefined || melody === 0 || speech === 0) {
    return { contrary: false, severity: 0, speech, melody: melody ?? null };
  }
  const contrary = Math.sign(speech) !== Math.sign(melody);
  return {
    contrary,
    severity: contrary ? Math.abs(speech) : 0,
    speech,
    melody,
  };
}

function speechDirectionLabel(speech) {
  if (speech === null) return null;
  if (speech > 0) return "up";
  if (speech < 0) return "down";
  return "same";
}

/**
 * notes: [{ hanzi, pinyin, tone, gloss?, pitch, direction }]
 * Returns the same notes annotated with:
 *   index, unknown, effTone (after sandhi), sandhi (bool),
 *   speech / speechDir (how the voice moves into this syllable),
 *   match (false only when melody and speech are in contrary motion),
 *   severity (0-4).
 *
 * The first syllable of a line has no preceding syllable, so there is no
 * transition to judge and it can never be flagged. Unknown and neutral tones
 * are never flagged either — nothing is guessed.
 */
function analyzeNotes(notes) {
  const eff = effectiveTones(notes);
  return notes.map((note, i) => {
    const unknown = note.tone === null || note.tone === undefined;
    const prevTone = i > 0 ? eff[i - 1] : null;
    const { contrary, severity, speech } = unknown
      ? { contrary: false, severity: 0, speech: null }
      : motionConflict(prevTone, eff[i], note.direction);
    return {
      ...note,
      index: i,
      unknown,
      effTone: eff[i],
      sandhi: !unknown && eff[i] !== note.tone,
      speech,
      speechDir: speechDirectionLabel(speech),
      match: !contrary,
      severity,
    };
  });
}

/** Total contrary-motion pressure across a line. Lower is more singable. */
function lineTension(notes) {
  return analyzeNotes(notes).reduce((sum, n) => sum + n.severity, 0);
}

function summaryText(analyzed) {
  const mismatches = analyzed.filter((n) => !n.unknown && !n.match).length;
  if (mismatches === 0) {
    return { text: "✅ No contrary motion — the melody moves with the words everywhere.", cls: "ok" };
  }
  return {
    text: `⚠️ ${mismatches} place${mismatches > 1 ? "s" : ""} where the melody moves against the words — the tune pulls the voice opposite the direction the language needs, which is what makes a sung line stop being understood.`,
    cls: "warn",
  };
}

function renderAnalysisRows(container, analyzed, suggestions, soundsLike) {
  container.innerHTML = "";
  analyzed.forEach((n) => {
    const row = document.createElement("div");
    const state = n.unknown ? "unknown" : n.match ? "match" : "mismatch";
    row.className = `row ${state}`;
    const dirLabel = n.direction ? n.direction : "start";

    let flagHtml;
    if (n.unknown) {
      flagHtml = `<div class="cell flag">❔ tone unknown</div>`;
    } else if (n.index === 0) {
      flagHtml = `<div class="cell flag">• line start</div>`;
    } else if (n.match) {
      flagHtml = `<div class="cell flag">✅ moves together</div>`;
    } else {
      flagHtml = `<div class="cell flag">⚠️ contrary motion</div>`;
    }

    const sandhiNote = n.sandhi
      ? ` <span class="sub">→ spoken as tone ${n.effTone} (sandhi)</span>`
      : "";
    const toneCell = n.unknown
      ? `<div class="cell tone">not in dictionary</div>`
      : `<div class="cell tone">Tone ${n.tone} <span class="sub">${TONE_NAMES[n.tone] || ""}</span>${sandhiNote}</div>`;

    const motionCell =
      n.index === 0 || n.speechDir === null
        ? `<div class="cell direction">${DIRECTION_ARROW[dirLabel] || "•"} <span class="sub">melody ${dirLabel}</span></div>`
        : `<div class="cell direction">${DIRECTION_ARROW[dirLabel] || "•"} <span class="sub">melody ${dirLabel}</span>
           <br />${DIRECTION_ARROW[n.speechDir] || "•"} <span class="sub">voice ${n.speechDir}</span></div>`;

    row.innerHTML = `
      <div class="syllable">
        <span class="hanzi">${n.hanzi}</span>
        <span class="pinyin">${n.pinyin || ""}</span>
      </div>
      ${toneCell}
      ${motionCell}
      ${flagHtml}
    `;
    container.appendChild(row);

    if (!n.unknown && !n.match) {
      const suggestion = suggestions && suggestions[n.index];
      const glossPart = n.gloss ? ` ("${n.gloss}")` : "";
      const pulled = soundsLike && soundsLike[n.index];

      const changeBox = document.createElement("div");
      changeBox.className = "change-box";
      changeBox.innerHTML = pulled
        ? `<span class="change-label">What changes:</span>
           The melody moves ${n.direction} here while the voice needs to go ${n.speechDir}.
           Pulled that far off shape, <strong>${n.hanzi}</strong>${glossPart} lands closer to
           <strong>${pulled.hanzi}</strong> (${pulled.pinyin}, "${pulled.meaning}").`
        : `<span class="change-label">What changes:</span>
           The melody moves ${n.direction} here while the voice needs to go ${n.speechDir}.
           They pull against each other at <strong>${n.hanzi}</strong>${glossPart}, so its tone
           flattens out and the syllable stops carrying the word it should.`;
      container.appendChild(changeBox);

      const box = document.createElement("div");
      box.className = "suggestion-box";

      if (suggestion && suggestion.locked) {
        box.innerHTML = `
          <div class="suggestion-title">No word swap offered — 「${suggestion.locked}」 is a fixed compound</div>
          <div class="sub">Replacing one syllable of a set phrase produces gibberish rather than a
          different way to say the same thing, so the meaning gate refuses it. The honest options
          here are the melody, or a full retranslation of the phrase by a fluent speaker.</div>`;
      } else if (suggestion && suggestion.alternates && suggestion.alternates.length) {
        box.innerHTML = `
          <div class="suggestion-title">Ranked alternatives for "${suggestion.word}" (${suggestion.pinyin}, tone ${suggestion.tone})</div>
          <ol class="candidate-list">
            ${suggestion.alternates
              .map(
                (alt) => `<li>
                  <span class="cand-word"><strong>${alt.hanzi}</strong> <span class="sub">${alt.pinyin}, tone ${alt.tone}</span></span>
                  <span class="cand-badges">
                    <span class="badge ${alt.resolves ? "badge-clear" : "badge-partial"}">${alt.resolves ? "clears the clash" : "eases it"}</span>
                    <span class="badge badge-meaning">meaning distance ${alt.distance}</span>
                  </span>
                  <div class="sub">${alt.reason}</div>
                </li>`
              )
              .join("")}
          </ol>`;
      } else if (suggestion && suggestion.noLexiconEntry) {
        box.innerHTML = `
          <div class="suggestion-title">No alternatives in the lexicon for "${n.hanzi}"</div>
          <div class="sub">This syllable has no entries in the substitution lexicon yet, so nothing
          is proposed rather than something guessed.</div>`;
      } else {
        box.innerHTML = `
          <div class="suggestion-title">No word swap improves this line within the meaning budget</div>
          <div class="sub">Every candidate that would sing better changes what the line says by more
          than the gate allows. Singability never overrides meaning here.</div>`;
      }
      container.appendChild(box);

      if (suggestion && suggestion.rejected && suggestion.rejected.length) {
        const gate = document.createElement("div");
        gate.className = "gate-box";
        gate.innerHTML = `<span class="change-label">Meaning gate rejected:</span>
          ${suggestion.rejected
            .map((r) => `<strong>${r.hanzi}</strong> (${r.pinyin}, "${r.gloss}") — would have improved
              singability by ${r.improvement}, but meaning distance ${r.distance} exceeds the budget.`)
            .join(" ")}`;
        container.appendChild(gate);
      }

      if (suggestion && suggestion.melodyFix) {
        const mel = document.createElement("div");
        mel.className = "melody-fix-box";
        mel.innerHTML = `<span class="change-label">Or change the melody, not the words:</span>
          move this note <strong>${suggestion.melodyFix.direction}</strong> instead and the clash
          resolves with no change in meaning at all.`;
        container.appendChild(mel);
      }
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
      const color = d.unknown ? "#9a8f80" : !d.match ? "#e0483e" : "#2f9e5b";
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

/**
 * Swap in the first listed alternate at every suggested index and return the
 * rewritten notes, so the "after" contour is *computed* from the corrected
 * line rather than asserted green. If a substitution fails to fix the line,
 * the after-picture says so.
 */
function correctedNotes(notes, suggestions) {
  return notes.map((note, i) => {
    const s = suggestions && suggestions[i];
    if (!s || !s.alternates || !s.alternates.length) return { ...note };
    const alt = s.alternates[0];
    return { ...note, hanzi: alt.hanzi, pinyin: alt.pinyin, tone: alt.tone };
  });
}

// ---- Audio helpers ----

function speakMandarin(text) {
  if (!("speechSynthesis" in window)) {
    alert("This browser doesn't support speech synthesis.");
    return;
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length && !voices.some((v) => /^zh/i.test(v.lang))) {
    alert(
      "No Mandarin (zh) voice is installed in this browser, so playback would be wrong or silent.\n\n" +
        "On macOS: System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → add Chinese."
    );
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
  if (_audioCtx.state === "suspended") _audioCtx.resume();
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
      return Array.from({ length: n }, (_, i) => (i === 0 ? null : base[i % base.length] || "same"));
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
    CHAO_TONES,
    TONE_NAMES,
    effectiveTones,
    speechInterval,
    motionConflict,
    analyzeNotes,
    lineTension,
    correctedNotes,
    MELODY_PRESETS,
    directionsToPitches,
  };
}
