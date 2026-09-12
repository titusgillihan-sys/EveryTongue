# Every Tongue

**The problem:** in most of the world's languages, pitch is part of the word. When churches sing
translated Western hymns, the melody overrides the words, so the lyrics stop meaning what the
translator intended. This tool takes an existing song and a target language and finds the
translation that is both faithful and singable against that exact melody, then shows you the
difference.

This MVP is scoped to **Mandarin Chinese, one demo song** ("Amazing Grace" / tune "New Britain").
It's a static, no-login, no-database demo built to be understood in about 15 seconds.

## What it shows

1. The original English line, and its existing (commonly used) Mandarin translation.
2. A syllable-by-syllable breakdown: the Mandarin word, its tone, the melody's pitch direction at
   that note, and whether they match — flagged with ✅ or ⚠️.
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

The melody itself is hand-encoded (see `data.js`) as a simple array of relative pitches with an
"up / down / same" direction for each note versus the previous one — no audio analysis or MIDI
parsing. The comparison is a plain lookup + equality check (see `toneMatchesMelody` in `app.js`),
so the logic is fully inspectable.

## Files

- `index.html`, `style.css`, `app.js` — the whole app (no build step, no framework).
- `data.js` — the golden-path song data: lyrics, tones, melody directions, and pre-computed
  suggestion text for the flagged mismatches. This is the file to edit to change the demo song.
- `api/suggest.js` — **optional** serverless function (Vercel/Netlify-style) that proxies to the
  real Claude API server-side, for live-regenerating suggestions instead of using the pre-computed
  ones in `data.js`. Not required for the demo to work.
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

**Optional: live Claude API suggestions.** The static site works fully without this — it shows the
pre-computed suggestions in `data.js`. If you want the "Regenerate suggestions with live Claude
API" button to actually call Claude, deploy `api/suggest.js` on a platform that runs Node
serverless functions (e.g. Vercel) with an `ANTHROPIC_API_KEY` environment variable set. The key
never reaches the browser — it's only read server-side inside that function.

## An important caveat on the demo data

The build spec behind this project calls for locking the "golden path" example — the specific
line, translation, and melody clash — only after a native Mandarin speaker has verified that the
flagged mismatch is real and audible. This repo ships with a fully worked, internally-consistent
example using standard Mandarin pinyin/tones (following the CC-CEDICT convention) and a
hand-encoded approximation of the "New Britain" tune's contour, so the whole pipeline can be
demoed end-to-end today. Before presenting it as a verified real-world case (e.g. in a pitch or a
demo to judges who know Mandarin), have a fluent speaker sanity-check the specific mismatch called
out in `data.js` — it's isolated in one file specifically so it can be swapped for a verified
example without touching any app logic.

## What this deliberately does NOT do

- No multi-language support — Mandarin only.
- No general songwriting/composition tooling.
- No audio analysis or automatic melody extraction from real audio/MIDI files.
- No user accounts, database, or persistence — it's a demo, not a product.
