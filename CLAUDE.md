# Project context

We fit translated hymn lyrics to a fixed Western melody so that the melody
does not fight the lexical tones of the target language.

In tone languages, pitch is part of the word. When a translated hymn is sung
to its original melody, the tune overrides word pitch and meaning degrades.
Research (Ladd & Kirby 2020) shows sung intelligibility depends mainly on
avoiding CONTRARY MOTION: the melody should not move opposite to the
language's own pitch movement between adjacent syllables.

## Language: Mandarin Chinese

The original spec said Vietnamese, chosen because tone is written as
combining diacritics so extraction is deterministic parsing. **The build went
Mandarin and we are staying Mandarin** — every file assumes it and there is
not time to redo it before the deadline.

Accept the cost of that choice honestly: Mandarin tone extraction needs a
character dictionary we only partly have (~150 entries in
`tone-dictionary.js`), and it needs tone sandhi, which `shared.js` now
handles. Characters outside the dictionary are marked unknown, never guessed.

The language's pitch model lives in exactly one place — `CHAO_TONES` in
`shared.js`. Switching languages means replacing that table and the sandhi
rule, not rewriting the app. Do not scatter tone assumptions anywhere else.

## What this is NOT
- Not a music generator. The melody is never composed or altered by us
  (proposing that a note move is a suggestion to the user, not a rewrite).
- Not a song writing tool for composers.
- Not a generic AI worship app.

## Hard constraints
- Deadline is Sunday. Two developers. Demo and video matter more than features.
- No auth, no database, no accounts, no persistence, no deployment.
- **Meaning fidelity is a separate gate from singability. Never improve a
  score by changing what a line means.** Implemented in `candidates.js`: the
  meaning gate filters candidates BEFORE ranking, so singability can only ever
  order what already passed. Never re-rank across the gate.
- **Do not commit any copyrighted hymn translation.** A public-domain tune is
  not enough — the words are what gets committed. "How Great Thou Art" was
  removed for this reason (English text: Stuart K. Hine, 1949, still in
  copyright). Amazing Grace (1779) and Silent Night (1818) are fine.
- Do not present any flagged clash as a verified real-world case until a
  fluent Mandarin speaker has confirmed it is real and audible.

## Architecture

| File | Owner | Purpose |
|---|---|---|
| `shared.js` | teammate | Tone model, sandhi, contrary-motion scorer, rendering, audio |
| `tone-dictionary.js` | teammate | Character → pinyin/tone lookup |
| `candidates.js` | Henry | Candidate generation, meaning gate, ranking |
| `songs.js` | Henry | Library source data (no suggestions — those are generated) |
| `*.html`, `style.css` | shared | Ask before restructuring |

### Rules that keep the two halves honest
- **Never hardcode analysis results.** `songs.js` carries source data only.
  Suggestions and "after" lines are generated at render time from the same
  scorer that produced the flags, so the fix shown can never contradict the
  analysis shown. This already went wrong once: hand-written suggestions
  drifted until they pointed at syllables the scorer did not flag.
- **Never assert a result the scorer can compute.** The "after" contour is
  re-scored, not painted green.
- Scoring compares ADJACENT syllables. Any function that decides whether a
  syllable clashes must see the previous syllable's tone.

## Ownership
- teammate: tone extraction + scorer
- Henry: candidate generation + ranking + demo assets

Do not edit files outside your half without saying so. Say so in the commit
message, not only in chat — the other half of this project is often being
written by a different agent that cannot see your conversation.
