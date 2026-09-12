# Every Tongue

**The problem:** in most of the world's languages, pitch is part of the word. When churches sing
translated Western hymns, the melody overrides the words, so the lyrics stop meaning what the
translator intended. This tool takes an existing song and a target language and finds the
translation that is both faithful and singable against that exact melody, then shows you the
difference.

This MVP is scoped to **Mandarin Chinese**. It's a static, no-login, no-database site built to be
understood in about 15 seconds, with three pages:

- **Home** (`index.html`) — the golden-path example ("Amazing Grace"), front and center.
- **Library** (`library.html` → `song.html?id=...`) — two more pre-analyzed hymn lines to browse.
- **Analyze your own** (`upload.html`) — paste a Mandarin line, pick or hand-build a melody shape,
  and see it flagged live against a small starter tone dictionary.

## What it shows

1. The original English line, and its existing (commonly used) Mandarin translation.
2. The whole line as a strip of color-coded syllables (green = fine, red = a problem), so you can
   see at a glance which words the melody clashes with — the underlying tone numbers and melody
   directions are covered on the "How it works" page, not repeated here.
3. For each ⚠️ mismatch, an AI-style suggested alternate word/phrase that keeps the meaning close
   while fitting the melody's direction better.
4. A before/after pitch-contour comparison (colored markers: green = tone matches the melody,
   red = mismatch), plus optional audio: spoken Mandarin (Web Speech API) and a "melody as beeps"
   playback (Web Audio API) so you can hear the shape of the tune independent of the words.

## How the matching logic works (rules-based, not ML)

Each Mandarin syllable's tone implies an expected melodic direction relative to the previous note:

| Tone | Description   | Expected melody direction |
|------|---------------|----------------------------|
| 1    | flat / high   | same                        |
| 2    | rising        | up                          |
| 3    | dipping / low | down (loose match)          |
| 4    | falling       | down                        |
| 5    | neutral       | flexible — always matches   |

Melodies are hand-encoded (see `songs.js`) as arrays of relative pitches with an "up / down / same"
direction for each note versus the previous one — no audio analysis or MIDI parsing anywhere in
this app, by design (see "What this deliberately does NOT do" below). The comparison itself is a
plain lookup + equality check (`toneMatchesMelody` in `shared.js`), used identically by all three
pages, so the logic is fully inspectable and consistent everywhere.

## "Upload a song" — what it actually accepts, and why

The Analyze page takes a **pasted Mandarin lyric line**, not an audio or MIDI file. You pick a
melody shape from a few presets (rising, falling, wave, flat, or the "Amazing Grace" contour) and
can then hand-tune any individual note's direction by clicking it. This was a deliberate scope
call: real audio-to-pitch extraction is a hard, error-prone signal-processing/ML problem, and the
original build spec explicitly called for avoiding it in this MVP. Structured melody input keeps
the demo reliable for a live audience while still feeling interactive.

Tone lookups on this page come from `tone-dictionary.js`, a curated ~150-character starter
dictionary (worship-song vocabulary + common function words), formatted the way CC-CEDICT records
pinyin/tone data. Characters outside that list are marked "tone unknown" rather than guessed —
never silently wrong.

## Files

- `index.html`, `library.html`, `song.html`, `upload.html` — the four pages.
- `style.css` — shared styling and design tokens for all pages.
- `shared.js` — the rules engine (tone/direction matching), row/contour rendering, and audio
  helpers used by every page.
- `songs.js` — the library: three pre-analyzed songs (lyrics, tones, melody directions, and
  pre-computed suggestion text for each flagged mismatch). Add a song here to add it to the library.
- `tone-dictionary.js` — the curated pinyin/tone lookup used by the Analyze page.
- `api/suggest.js` — **optional** serverless function (Vercel/Netlify-style) that proxies to the
  real Claude API server-side, for live-generating suggestions (used by both the home page's
  "Regenerate suggestions" button and the Analyze page's "Get AI suggestions" button). Not required
  for the site to work — every page has a graceful pre-computed or "not yet configured" fallback.
- `.github/workflows/deploy-pages.yml` — auto-deploys the static site to GitHub Pages on push.

## Running locally

No build step — just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Deploying

**GitHub Pages (recommended, fully static, matches the MVP scope):**

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages** and set **Source** to "GitHub Actions" (the included
   workflow at `.github/workflows/deploy-pages.yml` will build and deploy on every push).
3. Your site will be live at `https://<username>.github.io/<repo>/`.

**Optional: live Claude API suggestions.** The static site works fully without this — the home and
library pages show pre-computed suggestions from `songs.js`, and the Analyze page shows an honest
"no suggestion yet" note. If you want the "Get AI suggestions" / "Regenerate suggestions" buttons
to actually call Claude, deploy `api/suggest.js` on a platform that runs Node serverless functions
(e.g. Vercel) with an `ANTHROPIC_API_KEY` environment variable set. The key never reaches the
browser — it's only read server-side inside that function.

## An important caveat on the demo data

The build spec behind this project calls for locking each "golden path" example — the specific
line, translation, and melody clash — only after a native Mandarin speaker has verified that the
flagged mismatch is real and audible. This repo ships with three fully worked, internally-consistent
examples using standard Mandarin pinyin/tones (following the CC-CEDICT convention) and hand-encoded
approximations of each tune's contour, so the whole pipeline can be demoed end-to-end today. Before
presenting any of them as a verified real-world case (e.g. in a pitch or a demo to judges who know
Mandarin), have a fluent speaker sanity-check the specific mismatches called out in `songs.js` —
each song is one entry in one array, specifically so it can be swapped for a verified example
without touching any app logic.

## What this deliberately does NOT do

- No multi-language support — Mandarin only.
- No general songwriting/composition tooling.
- No audio analysis or automatic melody extraction from real audio/MIDI files — melody input is
  always structured (presets + manual up/down/same editing), never inferred from a file.
- No user accounts, database, or persistence — it's a demo, not a product.
