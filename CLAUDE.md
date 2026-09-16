# Project context

We set SCRIPTURE to melodies a community already knows, by SEARCHING existing
published translations and melodies for a combination that sings correctly.

In tone languages, pitch is part of the word. When a translated text is sung to
a fixed melody, the tune overrides word pitch and meaning degrades. Research
(Ladd & Kirby 2020) shows sung intelligibility depends mainly on avoiding
CONTRARY MOTION: the melody should not move opposite to the language's own
pitch movement between adjacent syllables.

## WE NEVER REWORD SCRIPTURE

Every word displayed must come verbatim from a published translation.
Generating or paraphrasing Scripture text is a hard prohibition, not a
preference. No model may produce Scripture text at any point, for any reason.

This is the constraint the whole architecture exists to protect, and it is
tested with a mechanism that can actually fail: text is provenance-tagged at
the provider boundary, the model provider may never return into a text field,
and the test installs a **sabotage stub** model that returns a marker string,
then asserts the marker appears nowhere in any rendered Scripture. A test that
cannot fail is decoration.

## The three levers

A conflict is a transition where the melody moves opposite to the language's
lexical tone movement. Conflicts are resolved using ONLY:

1. **Translation choice** — different published translations use different
   words, so different tone sequences.
2. **Melody choice** — a curated library. A passage that fights one tune may
   fit another.
3. **Syllable alignment** — same words, same notes, different placement of
   syllables across the phrase.

If none of the three yields an improvement, the tool reports that honestly and
returns nothing. It must never invent an improvement, and must never relabel
the baseline as a win.

## Competition

Gloo Hackathon, **Track 2 "Scripture Beyond the App", Access lane.**
Track advocate is YouVersion.

| Judging criterion | Weight |
|---|---|
| Concept / Product | 25 |
| Impact and Execution | 25 |
| Innovation | 20 |
| AI | 20 |
| Presentation | 10 |

**Dates — the deadline is NOT Sunday.** Design submission **Sept 18**; final
submission **Oct 7**; finals **Oct 8 in Boulder**. Do not cut scope for a
deadline that does not exist. Earlier versions of this file said "deadline is
Sunday"; that was wrong.

## Rules where correctness is required, models where judgment is required

AI is 20% of the score, so a fully deterministic build scores near zero there.
But correctness-critical logic stays deterministic and inspectable.

**Deterministic, never a model:** tone extraction, the contrary-motion scorer,
alignment generation, and Scripture text itself.

**Model-backed, each behind an interface with a deterministic fallback so the
tool still runs with no credentials:**

1. **Chunk ranking** — the DP proposes the top N segmentations; a model ranks
   them for whether the break sounds natural to a native speaker. The penalty
   table is a prior, not the verdict.
2. **Failure explanation** — when search returns nothing, a model explains
   which constraint blocked it and what the user could change. This is the
   human-in-the-loop surface.
3. **Melody suitability** — whether a tune's character suits a passage is
   judgment a note list cannot make.

Model layer is **Gloo AI Studio** (the challenge's values-aligned models).
No credentials yet — build the provider interface with a stub now.

**Rules for the model layer:**
- The model reranks **after** the deterministic search, never inside it.
  Inside the loop the call count is translations x melodies x chunkings.
- Every result records **both** the deterministic prior score and the model's
  rationale. A judge will ask why a setting won; "the model preferred it" is
  not an answer.
- **Cache model verdicts by input hash** so a demo replays identically.

## THE DEMO RUNS OFFLINE. THIS IS A HARD REQUIREMENT.

The demo runs on hackathon venue wifi in front of judges. The entire tool must
run from local fixtures with **zero network calls** — no Scripture fetch, no
model call, nothing.

This is not a fallback path that exists in case the network fails. It is the
path the demo takes. Live providers are the enhancement; offline is the
default. If a code path can only work online, it cannot be in the demo.

## Scripture comes from a provider, never from fixtures

`ScriptureProvider` interface with two implementations: local fixtures (now)
and the **YouVersion API** (platform.youversion.com for the key,
developers.youversion.com for docs) once the key lands. Nothing downstream
knows which is in use.

**HIGHEST-PRIORITY TECHNICAL UNKNOWN: how many Vietnamese versions does our
key actually expose?** Lever 1 needs at least two. The ~1,475 figure is the
catalogue, not necessarily what a free app key grants for one language under
per-version licensing. **Enumerate Vietnamese versions the day the key lands.**
If the answer is one, the headline lever collapses to melody x alignment, and
the design document submitted on **Sept 18 has to say so.** Find out in
September, not October.

- **We commit no Scripture text at all.**
- Provider terms will forbid storing or caching Scripture text. Fetch at run
  time, hold in memory, never write to disk.
- Returned text is HTML or structured. **Parse to plain syllable text at the
  provider boundary**, so nothing downstream ever sees markup.
- The version's **copyright notice must be displayed wherever Bible content
  appears**, including the CLI report. Carry it through the data model from the
  start — retrofitting this is painful.
- `license` and `sourceUrl` fields stay on melodies, which must be public
  domain or permissioned, with provenance recorded.

## Language

**Vietnamese is the reference language.** Tone is written as combining
diacritics in ordinary orthography, so extraction is deterministic parsing
(NFD-normalise, scan for the five tone marks, ignore the letter-shape
diacritics ă â ê ô ơ ư). Syllables are space-delimited, so syllable counting is
free.

Mandarin stays working behind the same tone-module interface. That is not
sentiment — it is the proof that **adding a language is a new tone module plus
data tables, with no changes to the scorer, chunker, alignment or search.** If
a change to any of those four is needed to keep Mandarin working, the
abstraction is wrong and the change is the bug.

## Hard constraints

- No auth, no database, no accounts, no persistence, no deployment.
- Melody data must be public domain or permissioned, with provenance recorded.
- Every result must be **explainable**: which translation, which melody, which
  alignment, and the per-syllable conflict breakdown. A judge will ask why a
  given setting won.
- Do not present any flagged conflict as a verified real-world case until a
  fluent speaker has confirmed it is real and audible.

## Engine design decisions (settled)

- **Transition semantics:** the transition into syllable *i* runs from the LAST
  note of syllable *i−1*'s span to the FIRST note of syllable *i*'s span.
  Slot == note; alignment is a mapping, not a property of the melody.
- **Phrase boundaries are breaths** — no transition is scored across them. This
  is what makes per-chunk optimisation independent and the search linear rather
  than exponential. Keep this assumption documented in code.
- **Chunking** is exact DP over break positions with a data-driven penalty
  table, not greedy. Cycle the phrase list for long passages.
- **Alignment** is bounded: melisma and note-sharing capped at 2 each,
  `|m−n| > 2` rejected outright.
- Within-syllable melisma conflicts are scored as a **separate secondary type**,
  never folded into the primary number.
- **Never hardcode analysis results.** Suggestions and "after" states are
  generated from the same scorer that produced the flags. This already went
  wrong once: hand-written suggestions drifted until they pointed at syllables
  the scorer no longer flagged.
- **Never assert a result the scorer can compute.**

## Architecture

| File | Owner | Purpose |
|---|---|---|
| `shared.js` | teammate | Contrary-motion scorer (language-agnostic) |
| `tone/vietnamese.js` | teammate | Diacritic tone reader + Chao table |
| `tone/mandarin.js` | teammate | Existing dictionary reader, same interface |
| `chunker.js`, `align.js`, `search.js` | Henry | Engine |
| `cli/report.js` | Henry | CLI report — the demo surface |
| `data/` | shared | Melody + break-table fixtures |
| Web UI (`*.html`, `style.css`) | **teammate** | **Henry does not touch without being asked** |

**The website is kept, not retired, and repointed to Vietnamese.** Concept and
Product is 25% and explicitly covers how user-friendly the approach is, so a
working interface is worth real points and one already exists. The teammate
keeps ownership and does the repointing.

The engine is exposed as a clean module boundary the web UI can call.

`candidates.js` is **slated for retirement** — it generated reworded
alternatives, which is now prohibited. It stays only until the web UI is
repointed, because the current pages still call it. The honest-refusal pattern
it implemented moves into `search`.

## Ownership

- teammate: tone extraction, scorer, web UI
- Henry: chunking, alignment, search, CLI, providers

Do not edit files outside your half without saying so. Say so in the commit
message, not only in chat — the other half of this project is often being
written by a different agent that cannot see your conversation.

## Tests that must exist

- Tone extraction, per language module.
- Search returns an **empty result set** when nothing improves on the baseline.
- The sabotage-stub test above: no Scripture text is ever model generated.
- Mandarin keeps working, as proof the language abstraction holds.
