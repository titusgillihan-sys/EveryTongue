/**
 * Optional serverless function (Vercel-style: POST /api/suggest).
 *
 * Not required for the static demo — index.html works fully with the
 * pre-computed suggestions in data.js on plain static hosting (e.g. GitHub
 * Pages), which has no server to run this on. Deploy this file on a
 * platform that supports Node serverless functions (Vercel, Netlify, etc.)
 * with an ANTHROPIC_API_KEY environment variable set to enable live
 * regeneration from the "Regenerate suggestions with live Claude API" button.
 *
 * The API key is only ever read here, server-side — it is never sent to
 * the browser.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

function buildPrompt({ word, pinyin, tone, direction, englishMeaning, mandarinLine }) {
  return `The Mandarin word "${word}" (pinyin: ${pinyin}, tone: ${tone}) is being sung on a melody note that goes ${direction}. This creates a tone mismatch that changes or obscures the intended meaning.

The original English line means: "${englishMeaning}"
The current Mandarin translation is: "${mandarinLine}"

Suggest 2-3 alternate Mandarin words or short phrases that:
1. Preserve the original meaning as closely as possible
2. Have a tone pattern that better matches a melody moving ${direction} at this syllable

Respond only with the alternatives and a one-sentence reason for each, in this format:
- [word] (pinyin, tone) — reason`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: "ANTHROPIC_API_KEY not configured on this deployment" });
    return;
  }

  try {
    const { song } = req.body;
    const mismatches = Object.entries(song.suggestions || {});

    const results = await Promise.all(
      mismatches.map(async ([index, entry]) => {
        const note = song.notes[Number(index)];
        const prompt = buildPrompt({
          word: entry.word,
          pinyin: entry.pinyin,
          tone: entry.tone,
          direction: note.direction,
          englishMeaning: song.englishGloss,
          mandarinLine: song.mandarinLine,
        });

        const response = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 300,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!response.ok) {
          throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.content?.[0]?.text ?? "";
        return { index: Number(index), word: entry.word, suggestion: text };
      })
    );

    res.status(200).json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
