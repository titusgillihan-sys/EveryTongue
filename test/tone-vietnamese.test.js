"use strict";
/**
 * Vietnamese tone extraction. Tone is a combining mark in ordinary
 * orthography, so this is parsing, and the traps are all Unicode traps.
 */
const test = require("node:test");
const assert = require("node:assert");
const vi = require("../tone/vietnamese.js");

const tones = (text) => vi.syllabify(text).map((s) => s.tone);

test("the six tones read from the five marks plus no mark", () => {
  assert.deepStrictEqual(tones("ma mà má mả mã mạ"), ["ngang", "huyen", "sac", "hoi", "nga", "nang"]);
});

test("trap: precomposed (NFC) and decomposed (NFD) input give the same answer", () => {
  const nfc = "Đức Giê-hô-va là Đấng chăn giữ tôi".normalize("NFC");
  const nfd = nfc.normalize("NFD");
  assert.notStrictEqual(nfc, nfd, "the two forms must actually differ for this test to mean anything");
  assert.deepStrictEqual(tones(nfd), tones(nfc));
  assert.deepStrictEqual(tones(nfc), ["sac", "ngang", "ngang", "ngang", "huyen", "sac", "ngang", "nga", "ngang"]);
});

test("trap: dot below (nặng) sorts BEFORE the circumflex in NFD and must still be found", () => {
  // ộ decomposes to o + U+0323 + U+0302 (combining class 220 before 230).
  const nfd = "ộ".normalize("NFD");
  assert.strictEqual(nfd.indexOf("̣") < nfd.indexOf("̂"), true);
  assert.deepStrictEqual(tones("Đấng ộ mộ"), ["sac", "nang", "nang"]);
});

test("trap: letter-shape diacritics are not tone", () => {
  // circumflex â ê ô, breve ă, horn ơ ư, and đ (a base letter with no decomposition)
  assert.deepStrictEqual(tones("â ê ô ă ơ ư đ"), ["ngang", "ngang", "ngang", "ngang", "ngang", "ngang", "ngang"]);
  // horn + tilde, horn + grave, breve + acute, circumflex + hook
  assert.deepStrictEqual(tones("ữ ừ ắ ổ"), ["nga", "huyen", "sac", "hoi"]);
});

test("trap: hyphenated names are several syllables", () => {
  const syl = vi.syllabify("Giê-hô-va Đa-vít");
  assert.deepStrictEqual(syl.map((s) => s.text), ["Giê", "hô", "va", "Đa", "vít"]);
});

test("trap: punctuation, verse numbers and case do not change the tone", () => {
  assert.deepStrictEqual(tones("1 NGÀI, giữ; tôi: 16"), ["huyen", "nga", "ngang"]);
  assert.deepStrictEqual(vi.syllabify("tôi:").map((s) => s.text), ["tôi"]);
});

test("a malformed syllable with two tone marks is unknown, never guessed", () => {
  const [s] = vi.syllabify("á̀");
  assert.strictEqual(s.unknown, true);
  assert.strictEqual(s.shape, null);
});

test("every syllable carries a shape from the single pitch table", () => {
  for (const s of vi.syllabify("Ngài khiến tôi an nghỉ nơi đồng cỏ xanh tươi")) {
    assert.deepStrictEqual(s.shape, vi.TONES[s.tone].shape);
    assert.strictEqual(s.shape.length, 2);
  }
  assert.strictEqual(Object.keys(vi.TONES).length, 6);
});
