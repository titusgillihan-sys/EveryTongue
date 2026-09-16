#!/usr/bin/env node
"use strict";
/**
 * cli/report.js — the demo surface.
 *
 * Runs fully offline: fixture Scripture, stub model, no credentials, no
 * network. Prints the baseline against the best setting found: conflict
 * count and severity before and after, which melody, which alignment, and a
 * per-syllable breakdown. Every number on the page comes from scorer.js.
 *
 *   node cli/report.js                       # default passage and baseline
 *   node cli/report.js --passage john-3-16-vi1925 --melody stille-nacht
 *   node cli/report.js --list
 *   node cli/report.js --json
 */
const path = require("node:path");
const { FixtureScriptureProvider } = require("../providers/scripture.js");
const { StubModelProvider, cached } = require("../providers/model.js");
const { loadMelodies, noteName } = require("../melodies.js");
const { forLanguage } = require("../tone/index.js");
const { describeAlignment } = require("../align.js");
const { search } = require("../search.js");

function parseArgs(argv) {
  const args = { passage: "psalm-23-vi1925", melody: "new-britain", json: false, list: false, chunks: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--passage") args.passage = argv[++i];
    else if (a === "--melody") args.melody = argv[++i];
    else if (a === "--json") args.json = true;
    else if (a === "--chunks") args.chunks = argv[++i]; // dp | hand
    else if (a === "--list") args.list = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unknown argument ${a}`);
  }
  return args;
}

/** Column width that counts CJK characters as two cells so the table lines up. */
function width(s) {
  let w = 0;
  for (const ch of String(s)) w += /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/u.test(ch) ? 2 : 1;
  return w;
}
const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - width(s)));
/** Every total shows conflicts out of CONSTRAINED transitions out of all transitions. */
const fmtTotals = (t) =>
  `${t.conflicts} contrary of ${t.constrained} constrained (of ${t.voiceMoving} voice-moving, ${t.transitions} transitions` +
  `${t.rate === null ? ", nothing tested" : `, rate ${t.rate.toFixed(2)}`}), net ${t.net >= 0 ? "+" : ""}${t.net}, severity ${t.severity}, ${t.secondary} melisma conflict(s)`;
const fmtShort = (t) => `${t.conflicts}/${t.constrained} constrained of ${t.voiceMoving} voice-moving of ${t.transitions} (net ${t.net >= 0 ? "+" : ""}${t.net})`;

function breakdownTable(setting) {
  const lines = [];
  lines.push(`    ${pad("#", 3)}${pad("syllable", 10)}${pad("tone", 26)}${pad("notes", 12)}${pad("voice", 7)}${pad("melody", 8)}verdict`);
  for (const chunk of setting.chunks) {
    lines.push(`    -- chunk ${chunk.chunkIndex + 1} "${chunk.text}", phrase ${chunk.phraseIndex + 1} (${chunk.phrase.midi.map(noteName).join(" ")})`);
    for (const r of chunk.rows) {
      let verdict = "";
      if (r.index === 0) verdict = "(phrase start)";
      else if (r.unknown) verdict = "unconstrained (no tone)";
      else if (!r.constrained) verdict = r.melody === "same" ? "unconstrained (melody flat)" : "unconstrained (voice flat)";
      else if (r.contrary) verdict = `CONTRARY  severity ${r.severity}`;
      else verdict = "ok (constrained, with the voice)";
      if (r.melisma.contrary) verdict += "  + melisma against tone";
      lines.push(
        `    ${pad(r.index + 1, 3)}${pad(r.text, 10)}${pad(r.label || r.tone, 26)}${pad(r.notes.map(noteName).join(" "), 12)}` +
          `${pad(r.speechDir || "-", 7)}${pad(r.melody || "-", 8)}${verdict}`
      );
    }
  }
  return lines.join("\n");
}

function settingBlock(title, setting) {
  const lines = [title];
  lines.push(`  ${fmtTotals(setting.totals)}`);
  const ck = setting.chunking;
  if (ck) {
    const pen = ck.penalty === null || ck.penalty === undefined ? "" : `, break penalty ${ck.penalty}`;
    lines.push(`  chunking: ${ck.source} (${setting.chunks.length} chunks${pen})`);
  }
  for (const chunk of setting.chunks) {
    const syl = chunk.rows;
    lines.push(`  ${chunk.chunkIndex + 1}. ${describeAlignment(syl, chunk.phrase.midi, chunk.alignment, noteName)}`);
  }
  return lines.join("\n");
}

function render(out, melodies) {
  const { passage, baseline, results, attempts, failure } = out;
  const L = [];
  L.push("EVERY TONGUE — setting report (offline: fixture Scripture, stub model)");
  L.push("=".repeat(72));
  L.push(`Passage:  ${passage.reference}`);
  L.push(`Version:  ${passage.version.name}`);
  L.push(`Notice:   ${passage.version.copyright}`);
  L.push("");
  L.push(`Text:     ${passage.text || passage.chunks.map((c) => c.text).join(" ")}`);
  L.push(`Chunking: ${out.chunking === "dp" ? "DP chunker (data/break-penalties.json, unverified prior)" : "hand-made chunks"}`);
  L.push("");

  const baselineMelody = melodies.find((m) => m.id === baseline.melodyId);
  L.push(settingBlock(`BASELINE — ${baselineMelody.name}, ${baseline.kind}`, baseline));
  L.push("");

  if (results.length === 0) {
    L.push("BEST SETTING — none. No melody-and-alignment setting beats the baseline.");
    L.push(`  Explanation (${failure.source}): ${failure.explanation}`);
  } else {
    const best = results[0];
    const bestMelody = melodies.find((m) => m.id === best.melodyId);
    L.push(settingBlock(`BEST SETTING — ${bestMelody.name} (${best.kind})`, best));
    L.push(
      `  before -> after: ${fmtShort(baseline.totals)} -> ${fmtShort(best.totals)}; ` +
        `severity ${baseline.totals.severity} -> ${best.totals.severity}; ` +
        `melisma conflicts ${baseline.totals.secondary} -> ${best.totals.secondary}`
    );
    const mv = best.eligibility.melody.movement;
    L.push(`  eligibility: melody moves on ${mv.moving}/${mv.pairs} steps over ${mv.rangeSemitones} semitones; ` +
      `melody engages ${best.eligibility.setting.constrainedFraction.toFixed(2)} of voice-moving transitions (floors in data/scoring-thresholds.json, unverified)`);
    L.push(`  deterministic prior: severity ${best.prior.severity}; model verdict (${best.verdict.source}): suitability ${best.verdict.suitability.toFixed(2)}`);
    L.push(`  model rationale: ${best.verdict.rationale}`);
    if (!bestMelody.verified) L.push(`  melody UNVERIFIED (${bestMelody.confidence}): ${bestMelody.confidenceNote}`);
    L.push("");
    L.push("  Per-syllable breakdown — best setting:");
    L.push(breakdownTable(best));
  }
  L.push("");
  L.push("  Per-syllable breakdown — baseline:");
  L.push(breakdownTable(baseline));
  L.push("");

  L.push("All melodies tried (best bounded alignment for each):");
  for (const a of attempts) {
    if (a.infeasible) L.push(`  - ${a.melodyName}: infeasible — ${a.reason}`);
    else if (a.ineligible) L.push(`  - ${a.melodyName}: INELIGIBLE — ${a.reason}${a.totals ? ` (${fmtTotals(a.totals)})` : ""}`);
    else {
      const r = results.find((x) => x.melodyId === a.melodyId);
      const tag = r ? `beats baseline${r === results[0] ? " (chosen)" : ""}` : "does not beat baseline";
      L.push(`  - ${a.melodyName}: ${fmtTotals(a.totals)} — ${tag}`);
    }
  }
  L.push("");
  L.push("Caveats: melody note lists are encoded from memory and unverified; the Vietnamese tone pitch");
  L.push("table (tone/vietnamese.js), the break penalties and the scoring thresholds are unvalidated");
  L.push("priors; no flagged conflict is a confirmed real-world case until a fluent speaker has heard it.");
  return L.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("usage: node cli/report.js [--passage <id>] [--melody <baseline-melody-id>] [--chunks dp|hand] [--list] [--json]");
    return;
  }
  const scripture = new FixtureScriptureProvider();
  const melodies = loadMelodies();
  if (args.list) {
    console.log("Passages:");
    for (const p of await scripture.listPassages()) console.log(`  ${p.id}  (${p.reference}, ${p.versionId})`);
    console.log("Melodies:");
    for (const m of melodies) console.log(`  ${m.id}  (${m.name}; ${m.phrases.length} phrases; verified: ${m.verified})`);
    return;
  }
  const passages = await scripture.listPassages();
  const meta = passages.find((p) => p.id === args.passage);
  if (!meta) throw new Error(`Unknown passage "${args.passage}" (try --list)`);
  const passage = await scripture.getPassage(meta.versionId, meta.id);
  const toneModule = forLanguage(passage.version.language);
  const model = cached(new StubModelProvider());

  const out = await search({ passage, melodies, toneModule, baselineMelodyId: args.melody, model, chunking: args.chunks });

  if (args.json) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(render(out, melodies));
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { render, main, parseArgs };
