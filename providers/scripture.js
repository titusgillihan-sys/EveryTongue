"use strict";
/**
 * providers/scripture.js — where Scripture text enters the system.
 *
 * ScriptureProvider interface:
 *   listVersions(language?)            -> Promise<Version[]>
 *   getPassage(versionId, passageId)   -> Promise<Passage>
 *
 *   Version = { id, name, abbreviation, language, year, publisher, copyright, sourceUrl }
 *   Passage = { id, reference, version, text, verses: [{ n, text }],
 *               chunks: [{ index, text, source }] }   // hand chunks, may be empty
 *
 *   `text` is the whole passage as plain text and is what the chunker works
 *   on; `chunks` are hand-made phrase units kept from stage one (empty when
 *   the passage has none).
 *
 * Two implementations are planned: FixtureScriptureProvider (this file, reads
 * committed public-domain fixtures, zero network) and a YouVersion provider
 * once the API key lands. Nothing downstream knows which is in use.
 *
 * THE BOUNDARY RULES:
 *   - Text is parsed to plain syllable text HERE. Downstream never sees
 *     markup, verse numbers, or footnote markers. toPlainText() is the
 *     function a YouVersion provider will call on its HTML.
 *   - Every chunk is provenance-tagged with `source: "scripture:<versionId>"`.
 *     That tag is the only legitimate origin of a `text` field. The model
 *     provider (providers/model.js) never returns into a text field, and
 *     test/sabotage-stub.test.js proves it with a stub that returns a marker.
 *   - The version's copyright notice rides on the passage so every surface
 *     that shows Bible content can show it.
 *   - The chunker (chunker.js) works on `text`; hand `chunks` are optional.
 */
const fs = require("node:fs");
const path = require("node:path");

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/**
 * HTML/structured -> plain text. Drops tags, footnote/verse-number spans,
 * decodes entities, normalises to NFC and collapses whitespace.
 * Written against eBible.org's markup (verse numbers in <span class="verse">,
 * notes in <span class="notemark">/<div class="footnote">) because that is the
 * source of the fixtures; a YouVersion provider will extend this.
 */
function toPlainText(html) {
  let s = String(html);
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<span[^>]*class="[^"]*\b(verse|notemark|cnote|fn)\b[^"]*"[^>]*>[\s\S]*?<\/span>/gi, " ");
  s = s.replace(/<div[^>]*class="[^"]*\bfootnote\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi, " ");
  s = s.replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Tag a piece of text as Scripture from a given version. Frozen so nothing downstream can rewrite it. */
function scriptureChunk(text, index, versionId) {
  return Object.freeze({ index, text: toPlainText(text), source: `scripture:${versionId}` });
}

class FixtureScriptureProvider {
  constructor(dir = path.join(__dirname, "..", "data", "passages")) {
    this.dir = dir;
    this.versions = JSON.parse(fs.readFileSync(path.join(dir, "versions.json"), "utf8"));
  }

  async listVersions(language) {
    return this.versions.filter((v) => !language || v.language === language);
  }

  version(versionId) {
    const v = this.versions.find((x) => x.id === versionId);
    if (!v) throw new Error(`Unknown version "${versionId}"`);
    return v;
  }

  async listPassages(language) {
    return fs
      .readdirSync(this.dir)
      .filter((f) => f.endsWith(".json") && f !== "versions.json")
      .sort()
      .map((f) => JSON.parse(fs.readFileSync(path.join(this.dir, f), "utf8")))
      .filter((p) => !language || this.version(p.versionId).language === language)
      .map((p) => ({ id: p.id, reference: p.reference, versionId: p.versionId }));
  }

  async getPassage(versionId, passageId) {
    const file = path.join(this.dir, `${passageId}.json`);
    if (!fs.existsSync(file)) throw new Error(`No fixture passage "${passageId}"`);
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (raw.versionId !== versionId) {
      throw new Error(`Passage "${passageId}" is from ${raw.versionId}, not ${versionId}`);
    }
    const version = this.version(versionId);
    const verses = (raw.verses || []).map((v) => Object.freeze({ n: v.n, text: toPlainText(v.text) }));
    return Object.freeze({
      id: raw.id,
      reference: raw.reference,
      version,
      text: verses.map((v) => v.text).join(" "),
      textSource: `scripture:${versionId}`,
      verses: Object.freeze(verses),
      chunks: (raw.chunks || []).map((text, i) => scriptureChunk(text, i, versionId)),
    });
  }
}

module.exports = { FixtureScriptureProvider, toPlainText, scriptureChunk };
