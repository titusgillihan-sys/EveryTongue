/**
 * Optional serverless function (Vercel-style: POST /api/suggest).
 *
 * Not required for the static demo — every page works fully with the
 * pre-computed suggestions in songs.js (or, on the Upload page, an honest
 * "no suggestion yet" message) on plain static hosting like GitHub Pages,
 * which has no server to run this on. Deploy this file on a platform that
 * supports Node serverless functions (Vercel, Netlify, etc.) with an
 * ANTHROPIC_API_KEY environment variable set to enable live suggestions.
 *
 * The API key is only ever read here, server-side — it is never sent to
 * the browser.
 *
 * Request body: { mandarinLine, englishMeaning, mismatches: [{ index, hanzi, pinyin, tone, direction }] }
 * (the home/library pages instead send { song }, using that song's own
 * mismatch list — both shapes are normalized below.)
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

function buildPrompt({ word, pinyin, tone, direction, englishMeaning, mandarinLine }) {
  return `The Mandarin word "${word}" (pinyin: ${pinyin}, tone: ${tone}) is being sung on a melody note that goes ${direction}. This creates a tone mismatch that changes or obscures the intended meaning.

The original English line means: "${englishMeaning || "(not provided)"}"
The current Mandarin translation is: "${mandarinLine}"

Suggest 2-3 alternate Mandarin words or short phrases that:
1. Preserve the original meaning as closely as possible
2. Have a tone pattern that better matches a melody moving ${direction} at this syllable

Respond only with the alternatives and a one-sentence reason for each, in this format:
- [word] (pinyin, tone) — reason`;
}

function normalizeRequest(body) {
  if (body.song) {
    const song = body.song;
    const mismatches = Object.entries(song.suggestions || {}).map(([index, entry]) => ({
      index: Number(index),
      hanzi: entry.word,
      pinyin: entry.pinyin,
      tone: entry.tone,
      direction: song.notes[Number(index)]?.direction,
    }));
    return { mandarinLine: song.mandarinLine, englishMeaning: song.englishGloss, mismatches };
  }
  return {
    mandarinLine: body.mandarinLine,
    englishMeaning: body.englishMeaning,
    mismatches: body.mismatches || [],
  };
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
    const { mandarinLine, englishMeaning, mismatches } = normalizeRequest(req.body);

    const results = await Promise.all(
      mismatches.map(async (m) => {
        const prompt = buildPrompt({
          word: m.hanzi,
          pinyin: m.pinyin,
          tone: m.tone,
          direction: m.direction,
          englishMeaning,
          mandarinLine,
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
        return { index: m.index, word: m.hanzi, suggestion: text };
      })
    );

    res.status(200).json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
