# Every Tongue

**The problem:** in most of the world's languages, pitch is part of the word. When churches sing
translated Western hymns, the melody overrides the words, so the lyrics stop meaning what the
translator intended. This tool takes an existing hymn line and a melody shape, finds every place the
tune fights the language, and proposes fixes that are ranked for singability *without* being allowed
to quietly change what the line says.

Scoped to **Mandarin Chinese**. Static, no login, no database, no build step.

- **Home** (`index.html`) — the golden-path example ("Amazing Grace").
- **How it works** (`process.html`) — the methodology in plain English.
- **Library** (`library.html` → `song.html?id=...`) — pre-analyzed hymn lines.
- **Analyze your own** (`upload.html`) — paste a line, shape a melody, get ranked fixes live.

## What you see

The whole line renders as a strip of colour-coded syllables (green = fine, red = a problem), so you
can see at a glance which words the melody clashes with. Each conflict then gets one focused card
explaining what breaks and what to do about it. The underlying tone numbers and melody directions
are covered on the "How it works" page rather than repeated for every syllable.

## What the check actually measures

Not "does this tone match this note." Sung intelligibility depends mainly on avoiding **contrary
motion** (Ladd & Kirby 2020): the melody moving *opposite* to the way the speaking voice moves
between two adjacent syllables.

So every judgement is about a **transition**. Each tone is stored as Chao tone letters — where it
starts and ends on a 1-5 pitch scale:

| Tone | Shape | Starts → ends |
|------|---------------|----------------|
| 1    | flat / high   | high → high    |
| 2    | rising        | mid → high     |
| 3    | dipping / low | low → lowest   |
| 4    | falling       | high → lowest  |
| 5    | neutral       | no inherent shape; never flagged |

The voice's movement into a syllable is *where the previous tone ended* versus *where this one
starts*. If the melody moves the opposite way, that is a flag, with a severity of 1-4. If both move
the same way, or either is flat, there is no conflict — regardless of the individual tones.

Two details matter. The first syllable of a line has nothing before it and can never be flagged. And
third-tone sandhi is applied before scoring: 你好 is written nǐ hǎo but spoken ní hǎo, so scoring the
written tone would flag the wrong syllable.

The whole language model is `CHAO_TONES` in `shared.js`. Changing languages means replacing that
table and the sandhi rule.

## Meaning is a gate, not a tiebreaker

It is always possible to improve a singability score by saying something else. So candidate
replacements carry a **meaning distance** — 0 interchangeable, 1 a nuance shift, 2 a different claim
— and anything over the budget is removed *before* ranking begins. Ranking only ever orders what
survived. A candidate cannot buy its way past the gate by scoring well.

Set phrases are gated structurally too: swapping one syllable of 恩典 ("grace") produces gibberish,
not a synonym, so `LOCKED_COMPOUNDS` refuses rather than inventing something plausible-looking.

When nothing survives the gate, the tool says so and offers the fix that costs no meaning at all:
move that one note instead.

Everything is rules-based and inspectable. No model is called at any point.

## Files

- `index.html`, `process.html`, `library.html`, `song.html`, `upload.html` — the five pages.
- `style.css` — shared styling and design tokens.
- `shared.js` — tone model, sandhi, the contrary-motion scorer, rendering, audio helpers.
- `tone-dictionary.js` — curated ~150-character pinyin/tone lookup. Unknown characters are marked
  "tone unknown", never guessed.
- `candidates.js` — candidate generation, the meaning gate, locked compounds, ranking.
- `songs.js` — library **source data only**. Suggestions and "after" lines are generated at render
  time so they can never drift out of sync with the scorer.
- `api/suggest.js` — legacy optional serverless function, currently unreferenced by any page. Either
  wire it up or delete it; see FINDINGS.md.
- `FINDINGS.md` — what was wrong before, with the measurements.
- `CLAUDE.md` — working agreement for both developers and both agents. Read it first.

## Running locally

No build step:

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080.

Use this to preview work on a feature branch. The Pages workflow deliberately deploys only the
integration branch — adding feature branches to it would let one person's branch overwrite the live
site, since the deploy uses a single `pages` concurrency group.

## Deploying

GitHub Pages via the included workflow. In the repo, set **Settings → Pages → Source** to "GitHub
Actions". (The deploy is currently failing; this setting is the most likely cause.)

## Caveats that matter

**Nothing here is native-speaker verified.** Tones and vocabulary are standard Mandarin, but the
melody contours are hand-encoded approximations, and the substitution lexicon's glosses and meaning
distances are hand-entered from dictionary senses. Before presenting any specific clash as a real
case — in a pitch, a video, or to judges who know Mandarin — have a fluent speaker confirm that the
flagged clash is real and audible. Each song is one entry in one array so it can be swapped for a
verified example without touching app logic.

**Copyright.** Only public-domain hymn text may be committed. A public-domain *tune* is not
sufficient — the words are what gets committed. "How Great Thou Art" was removed for this reason.

## What this deliberately does NOT do

- No multi-language support — Mandarin only.
- No general songwriting or composition tooling. Suggesting that a note move is advice to the user,
  never a rewrite of the tune.
- No audio analysis or melody extraction from audio/MIDI — melody input is always structured.
- No user accounts, database, or persistence.

## The engine (stage one, Vietnamese reference language)

The site above is the Mandarin demo. The engine underneath has been repointed
to Vietnamese and runs fully offline: fixture Scripture, a stub model, no
credentials, no network.

```bash
npm test
node cli/report.js --list
node cli/report.js --passage psalm-23-vi1925 --melody new-britain
node cli/report.js --passage psalm-23-cuvs            # Mandarin, same engine
node cli/report.js --json
```

| File | What it is |
|---|---|
| `tone/vietnamese.js`, `tone/mandarin.js`, `tone/index.js` | Tone modules behind one interface. Vietnamese reads the five combining marks; Mandarin wraps the dictionary and sandhi. |
| `scorer.js` | Language-agnostic contrary-motion scorer over Chao shapes. Same rule as `shared.js`; a parity test holds them equal. |
| `align.js` | Bounded syllable-to-note alignment (melisma ≤ 2, note-sharing ≤ 2, count difference ≤ 2) and the naive baseline. |
| `search.js` | Melody × alignment search, per chunk. Empty result set when nothing beats the baseline. |
| `providers/scripture.js` | `ScriptureProvider`: fixtures now, YouVersion later. Markup parsed to plain text at the boundary; copyright notice carried through. |
| `providers/model.js` | `ModelProvider`: deterministic stub now, Gloo AI Studio later. Reranks after the search; verdicts cached by input hash. |
| `melodies.js`, `data/melodies/` | Public-domain melody library with provenance, phrases as MIDI lists. |
| `data/passages/` | Pre-chunked public-domain passages. No chunker yet. |
| `cli/report.js` | The report: baseline against best setting, per-syllable breakdown. |

### Unverified, on purpose

- **Melody note lists are encoded from memory.** Every melody is `verified: false`
  and carries a `confidenceNote` naming the phrases most likely to be wrong.
  Least confident: Stille Nacht phrases 5–8, New Britain phrase 3, Ode to Joy
  phrases 5–6. Check against a score before any is called verified.
- **The Vietnamese pitch table** in `tone/vietnamese.js` is a judgment call
  pending a native speaker. It is one table; one conversation should change it.
- **Scripture text** is public domain: Kinh Thánh Tiếng Việt 1925 and the
  Chinese Union Version, both copied verbatim from eBible.org, which states
  their public-domain status. Nothing else may be committed.
- **No flagged conflict is a confirmed real-world case** until a fluent
  speaker has heard it.
