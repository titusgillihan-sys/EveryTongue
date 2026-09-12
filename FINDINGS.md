# Orientation findings — 2026-09-11

A read-only pass over the repo at commit `823b121`, with the claims checked by
running the code rather than reading it. Written for whoever picks this up
next, human or agent.

## 1. The scorer was measuring the wrong thing

**Was:** `toneMatchesMelody(tone, direction)` mapped a syllable's absolute tone
category to one "expected" melody direction and checked equality. It received
only the current syllable's tone and never saw the previous syllable.

**Why that is wrong:** contrary motion is by definition a relation *between*
adjacent syllables. A function that cannot see the previous syllable is
structurally incapable of computing it, whatever the constants are tuned to.

**Measured impact.** Running both scorers over the library as it stood:

| Song | Old scorer flagged | Contrary motion flags | Overlap |
|---|---|---|---|
| Amazing Grace | 何, 等 | 何, 等, 甜 | partial |
| Silent Night | 安, 善 | 圣, 夜 | **none** |
| How Great Thou Art | 真 | 大 | **none** |

7 of 18 syllables disagreed. On two of three songs the two models shared zero
flagged syllables — the demo pointed at syllables the cited research says are
fine and stayed silent on the ones it says are broken. Amazing Grace agreeing
was luck; it is the golden path, which is why nobody noticed.

**Now:** `motionConflict(prevTone, tone, direction)` in `shared.js` compares
where the previous tone ends against where this one starts (Chao tone letters
in `CHAO_TONES`) and flags only genuine opposition, with a severity of 1-4 used
to rank fixes. Third-tone sandhi is applied first, so 你好 is scored as spoken
(ní hǎo), not as written.

## 2. The meaning gate did not exist, and the "fixes" proved it

CLAUDE.md requires meaning fidelity to be a separate gate. There was no meaning
check anywhere in the codebase. All three shipped "corrected" lines changed
what the line said, and measured against the corrected scorer:

| Song | Correction | Line tension | Verdict |
|---|---|---|---|
| Amazing Grace | 何等 → 竟然 | 7 → 6 | marginal gain |
| Silent Night | 平安 → 平静, 圣善 → 圣良 | 8 → 8 | **no gain** |
| How Great Thou Art | 真 → 诚 | 4 → 4 | **no gain** |

Two of three changed the meaning of a hymn line for zero singability gain.
平安夜 is also the standard Chinese name of the carol and of Christmas Eve;
replacing it destroys the recognition the demo depends on.

**Now:** `candidates.js` applies the gate before ranking. Each substitution
carries a meaning distance (0 interchangeable / 1 nuance shift / 2 different
claim); anything over budget is removed *before* ranking, so singability can
only order what already passed. 竟 and 然 — the exact characters the old
hardcoded fix used — are now rejected by the gate as distance 2.

Set phrases are gated structurally as well: `LOCKED_COMPOUNDS` refuses to swap
one syllable of 恩典, 何等, 平安 and so on, because that yields gibberish rather
than a synonym. When nothing survives, the tool says so and offers the fix that
costs no meaning at all — move the note instead.

## 3. Copyright

"How Great Thou Art" was removed from `songs.js`. The tune (*O Store Gud*) is
public domain but the English text is Stuart K. Hine, 1949, still under
copyright, as are translations derived from it. The repo labelled only the tune
as public domain, which is true and beside the point — the words are what was
committed. This violated a stated hard constraint.

## 4. Hardcoded analysis was the root cause

The suggestions lived in `songs.js` as hand-written arrays keyed by syllable
index. When the scorer changed, they silently pointed at the wrong syllables.
`songs.js` is now source data only; everything else is generated at render time
from the same scorer that produced the flags. A fix can no longer contradict
the analysis above it.

The "after" contour had the same defect in miniature: it painted every marker
green unconditionally rather than re-scoring. It now re-runs the scorer, and
recomputes pitches when a melody fix is applied so the drawn curve matches the
claim.

## 5. Smaller things fixed

- **Analyze page dead end.** Every flagged syllable rendered "deploy
  `api/suggest.js` with an Anthropic API key" — on GitHub Pages there is no
  server, so that was the only thing a visitor ever saw. It now generates and
  ranks candidates locally. The serverless path and its unescaped
  `innerHTML` of model output are gone from the UI.
- **Silent speech failure.** `speakMandarin` called a `zh-CN` voice that many
  machines do not have and failed silently. It now checks and explains.
- **Suspended AudioContext** is resumed before playback.
- `process.html` explained the old, wrong model to visitors. Rewritten.

## Still open

- **Nothing here is native-speaker verified.** The melody contours are
  hand-encoded approximations, and the substitution lexicon's glosses and
  distances are hand-entered from dictionary senses. Before any of this is
  presented as a real-world case, a fluent speaker must confirm at least the
  golden-path clash is real and audible. This is the single highest remaining
  risk to the demo.
- **Scorer tuning is a judgement call.** Edge-to-edge comparison makes 4th →
  4th transitions prominent, because a falling tone ends low and the next
  starts high, so the voice leaps up between them. That is real, but whether
  severity 4 is the right weight is worth a look. Everything needed to tune it
  is in `CHAO_TONES`.
- **Lexicon coverage is thin** (~25 headwords) and hymn lines are dense with
  locked compounds, so the word-fix path fires mostly on user-entered lines.
- `api/suggest.js` is now unreferenced. Delete it or wire it up; do not leave
  it as ambiguous scope.
- The Pages deploy is failing. Most likely Settings → Pages → Source is not set
  to "GitHub Actions". Repo-owner action.
