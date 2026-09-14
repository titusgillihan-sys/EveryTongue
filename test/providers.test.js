"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { FixtureScriptureProvider, toPlainText } = require("../providers/scripture.js");
const { loadMelodies, validate } = require("../melodies.js");

test("markup is parsed to plain text at the provider boundary", () => {
  // Shaped like eBible.org chapter markup, the source of the fixtures.
  const html =
    `<div class='p'> <span class="verse" id="V1">1&#160;</span>Đức Giê-hô-va là Đấng chăn giữ tôi:` +
    ` <span class="notemark">a</span> tôi sẽ chẳng thi&#7871;u thốn gì.   <span class="verse" id="V2">2&#160;</span>Ngài</div>` +
    `<div class="footnote"><p>a: note</p></div>`;
  const plain = toPlainText(html);
  assert.strictEqual(plain, "Đức Giê-hô-va là Đấng chăn giữ tôi: tôi sẽ chẳng thiếu thốn gì. Ngài");
  assert.strictEqual(plain, plain.normalize("NFC"));
  assert.ok(!/[<>&]/.test(plain));
});

test("every version carries a copyright notice and every passage carries its version", async () => {
  const p = new FixtureScriptureProvider();
  for (const v of await p.listVersions()) {
    assert.ok(v.copyright && v.copyright.length > 20, `${v.id} needs a displayable notice`);
    assert.ok(v.sourceUrl);
  }
  for (const meta of await p.listPassages()) {
    const passage = await p.getPassage(meta.versionId, meta.id);
    assert.ok(passage.version.copyright);
    assert.ok(passage.chunks.length > 0);
    for (const c of passage.chunks) {
      assert.strictEqual(c.source, `scripture:${meta.versionId}`);
      assert.ok(!/\d/.test(c.text), "no verse numbers downstream");
    }
  }
  assert.deepStrictEqual((await p.listVersions("vi")).map((v) => v.language), ["vi"]);
  await assert.rejects(p.getPassage("CUVS", "psalm-23-vi1925"), /is from VI1925/);
});

test("melodies record provenance and their note names cannot drift from the MIDI list", () => {
  for (const m of loadMelodies()) {
    for (const key of ["name", "community", "license", "sourceUrl"]) assert.ok(m[key], `${m.id} missing ${key}`);
    assert.strictEqual(m.verified, false, "nothing is verified until a human checks it against a score");
    assert.ok(m.confidenceNote, `${m.id} must say how confident the encoding is`);
    assert.ok(m.phrases.every((p) => p.midi.every(Number.isInteger)));
  }
  assert.throws(
    () => validate({ id: "x", name: "x", community: "x", license: "x", sourceUrl: "x", verified: false,
      phrases: [{ names: "C4 D4", midi: [60, 60] }] }, "x.json"),
    /disagree/
  );
  assert.throws(() => validate({ id: "x", name: "x", phrases: [] }, "x.json"), /missing/);
});
