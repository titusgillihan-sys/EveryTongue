"use strict";
/**
 * melodies.js — the curated melody library (data/melodies/*.json).
 *
 * Every melody carries name, community, composer, license and sourceUrl so
 * provenance is recorded, and `verified: false` until a human has checked the
 * notes against a score. Phrases are MIDI note lists; the parallel `names`
 * string exists so a human can check against a score, and loading fails if
 * the two disagree, so they cannot drift.
 */
const fs = require("node:fs");
const path = require("node:path");

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NAME_TO_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function noteName(midi) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function nameToMidi(name) {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(name);
  if (!m) throw new Error(`Bad note name "${name}"`);
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + NAME_TO_SEMITONE[m[1]] + acc;
}

const REQUIRED = ["id", "name", "community", "license", "sourceUrl", "phrases"];

function validate(melody, file) {
  for (const key of REQUIRED) {
    if (melody[key] === undefined) throw new Error(`${file}: missing "${key}"`);
  }
  if (melody.verified !== false && melody.verified !== true) {
    throw new Error(`${file}: "verified" must be an explicit true or false`);
  }
  melody.phrases.forEach((p, i) => {
    if (!Array.isArray(p.midi) || p.midi.length === 0) throw new Error(`${file}: phrase ${i} has no midi notes`);
    if (p.names) {
      const fromNames = p.names.trim().split(/\s+/).map(nameToMidi);
      if (fromNames.join(",") !== p.midi.join(",")) {
        throw new Error(`${file}: phrase ${i} names "${p.names}" disagree with midi [${p.midi}]`);
      }
    }
  });
  return melody;
}

function loadMelodies(dir = path.join(__dirname, "data", "melodies")) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => validate(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")), f));
}

module.exports = { loadMelodies, noteName, nameToMidi, validate };
