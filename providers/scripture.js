"use strict";
/**
 * providers/scripture.js — where Scripture text enters the system.
 *
 * ScriptureProvider interface:
 *   listVersions(language?)                 -> Promise<Version[]>
 *   listPassages(language?)                 -> Promise<[{ id, passageKey, reference, versionId }]>
 *   getPassage(versionId, passageKeyOrId)   -> Promise<Passage>
 *
 *   A passageKey ("PSA.23.1-2") names the same passage across versions; that
 *   is what the translation lever iterates over.
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

/**
 * SYNTHETIC SECOND VERSION — NOT SCRIPTURE.
 *
 * Only one public-domain Vietnamese translation with retrievable text exists
 * (eBible.org carries the 1925 version alone; the 1913 Catholic translation
 * is not digitised). The translation lever still has to be built and shown,
 * so a synthetic version can be derived at load time by rotating every tone
 * mark of the real text one step (ngang->sắc->huyền->hỏi->ngã->nặng->ngang).
 * The result is gibberish Vietnamese with different tone sequences: it
 * exercises the lever without anyone writing Scripture-like text, and it is
 * never committed. It is opt-in ({ includeSynthetic: true }), its chunks are
 * tagged "synthetic:" rather than "scripture:", and its copyright field says
 * what it is so every surface that shows it says so too.
 */
const SYNTHETIC_ROTATION = ["", "\u0301", "\u0300", "\u0309", "\u0303", "\u0323"]; // ngang, sắc, huyền, hỏi, ngã, nặng
const SYNTHETIC_SUFFIX = "-SYN";

function rotateTones(text) {
  return String(text)
    .split(/(\s+|[-\u2010-\u2015])/u) // keep separators; hyphenated names rotate syllable by syllable
    .map((token) => {
      if (!/\p{L}/u.test(token)) return token;
      const nfd = token.normalize("NFD");
      const marks = SYNTHETIC_ROTATION.filter((m) => m && nfd.includes(m));
      const current = marks.length === 1 ? SYNTHETIC_ROTATION.indexOf(marks[0]) : marks.length === 0 ? 0 : -1;
      if (current < 0) return token;
      const next = SYNTHETIC_ROTATION[(current + 1) % SYNTHETIC_ROTATION.length];
      let out = marks.length ? nfd.replace(marks[0], "") : nfd;
      // Put the new mark after the last vowel letter so it renders on a vowel.
      const m = /[aeiouyAEIOUY][\u0302\u0306\u031B]?(?![\s\S]*[aeiouyAEIOUY])/u.exec(out);
      if (!m) return token;
      const at = m.index + m[0].length;
      out = out.slice(0, at) + next + out.slice(at);
      return out.normalize("NFC");
    })
    .join("");
}

function syntheticVersionOf(version) {
  return Object.freeze({
    ...version,
    id: `${version.id}${SYNTHETIC_SUFFIX}`,
    abbreviation: `${version.abbreviation}${SYNTHETIC_SUFFIX}`,
    name: `SYNTHETIC tone-rotated copy of ${version.name} — NOT SCRIPTURE`,
    synthetic: true,
    derivedFrom: version.id,
    copyright:
      `SYNTHETIC TEST DATA, NOT SCRIPTURE. Every tone mark of the ${version.name} text rotated one step ` +
      `by providers/scripture.js rotateTones(), to exercise the translation lever until a second public-domain ` +
      `translation is available. Never present this text as Scripture.`,
  });
}

class FixtureScriptureProvider {
  /** @param {{ dir?: string, includeSynthetic?: boolean }} [opts] */
  constructor(opts = {}) {
    const o = typeof opts === "string" ? { dir: opts } : opts;
    this.dir = o.dir || path.join(__dirname, "..", "data", "passages");
    this.includeSynthetic = !!o.includeSynthetic;
    const real = JSON.parse(fs.readFileSync(path.join(this.dir, "versions.json"), "utf8"));
    this.versions = this.includeSynthetic
      ? real.flatMap((v) => (v.language === "vi" ? [v, syntheticVersionOf(v)] : [v]))
      : real;
  }

  async listVersions(language) {
    return this.versions.filter((v) => !language || v.language === language);
  }

  version(versionId) {
    const v = this.versions.find((x) => x.id === versionId);
    if (!v) throw new Error(`Unknown version "${versionId}"`);
    return v;
  }

  _rawPassages() {
    return fs
      .readdirSync(this.dir)
      .filter((f) => f.endsWith(".json") && f !== "versions.json")
      .sort()
      .map((f) => JSON.parse(fs.readFileSync(path.join(this.dir, f), "utf8")));
  }

  /** Real fixtures plus, when enabled, a synthetic twin of each Vietnamese one. */
  async listPassages(language) {
    const out = [];
    for (const p of this._rawPassages()) {
      const v = this.version(p.versionId);
      if (language && v.language !== language) continue;
      out.push({ id: p.id, passageKey: p.passageKey, reference: p.reference, versionId: p.versionId });
      const syn = this.versions.find((x) => x.synthetic && x.derivedFrom === p.versionId);
      if (syn) out.push({ id: `${p.id}${SYNTHETIC_SUFFIX}`, passageKey: p.passageKey, reference: p.reference, versionId: syn.id, synthetic: true });
    }
    return out;
  }

  /** Versions that have a given passage, in listVersions order. */
  async versionsWithPassage(passageKey, language) {
    const have = new Set((await this.listPassages(language)).filter((p) => p.passageKey === passageKey).map((p) => p.versionId));
    return this.versions.filter((v) => have.has(v.id));
  }

  async getPassage(versionId, passageKeyOrId) {
    const version = this.version(versionId);
    const sourceVersionId = version.synthetic ? version.derivedFrom : versionId;
    const raw = this._rawPassages().find(
      (p) => p.versionId === sourceVersionId && (p.passageKey === passageKeyOrId || p.id === passageKeyOrId || `${p.id}${SYNTHETIC_SUFFIX}` === passageKeyOrId)
    );
    if (!raw) throw new Error(`No fixture passage "${passageKeyOrId}" in version ${versionId}`);
    const transform = version.synthetic ? rotateTones : (t) => t;
    const tag = version.synthetic ? `synthetic:${versionId}` : `scripture:${versionId}`;
    const verses = (raw.verses || []).map((v) => Object.freeze({ n: v.n, text: transform(toPlainText(v.text)) }));
    return Object.freeze({
      id: version.synthetic ? `${raw.id}${SYNTHETIC_SUFFIX}` : raw.id,
      passageKey: raw.passageKey,
      reference: raw.reference,
      version,
      synthetic: !!version.synthetic,
      text: verses.map((v) => v.text).join(" "),
      textSource: tag,
      verses: Object.freeze(verses),
      chunks: (raw.chunks || []).map((text, i) =>
        Object.freeze({ index: i, text: transform(toPlainText(text)), source: tag })
      ),
    });
  }
}

module.exports = { FixtureScriptureProvider, toPlainText, scriptureChunk, rotateTones, syntheticVersionOf };
