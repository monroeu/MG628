# MG628 lab engine: adding a new week's lab

Every lecture becomes its own week folder in the MG628 site (for example `week10/`), sharing this engine, the Monroe Supabase project and Student ID sign-in. A new lab needs three inputs and one command.

## 1. The three inputs

| Input | What it is | Where it comes from |
| --- | --- | --- |
| **Deck** (`.pptx`) | The animated lecture deck | Built for MG628 with click animations marked by shape name: shapes named `a1_…` appear on click 1, `a2_…` on click 2, and so on. Decks Claude builds for this course already follow this. |
| **Narration** (`.wav`) | One recording of the whole script | ElevenLabs, one paragraph per slide, with a natural pause between paragraphs. Loudness-match it to −14 LUFS in Audition first if you like. |
| **Content** (`content.json`) | Everything else in the lab | Ask Claude to draft it from the deck and script, then review it. Use `week09/content.json` as the model. |

`content.json` holds:

- `id`: the lab's short name, lowercase with hyphens (for example `"hypothesis-testing"`); it appears in the web address
- `title`
- `modules`: for each module, its `id`, `title`, `blurb`, the `slides` it covers, `concepts`, flip `cards`, practice `kc` questions, one `checkpoint` question tied to a slide, graded `quiz` questions (at least five per module), and optionally `generators` (names of number-generating questions already defined in `lab-engine/schema.sql`)
- `segments`: for every slide, its narration split at each click: the text spoken before the first click, then the text for each click. A slide with 4 clicks has 5 segments. This is the same split as the cue sheet in each YouTube production package.

## 2. Build it

Install once: Python 3.9+, LibreOffice, ffmpeg and poppler (`pdftoppm`), then `pip install -r lab-engine/requirements.txt`.

```bash
mkdir week10
# put content.json in that folder, then:
python lab-engine/build_lab.py --content week10/content.json \
                               --deck HypothesisTesting.pptx \
                               --audio ElevenLabs_HypothesisTesting.wav \
                               --week "Week 10"
```

The script checks the inputs first (every slide in one module, the right number of narration segments for each slide's clicks, at least five graded questions per module) and explains anything to fix. It then:

1. renders every slide build as an image (`frames/`),
2. lines the recording up with the script sentence by sentence and finds the moment each click should happen,
3. encodes the narration (`narration.mp4`),
4. writes `data.js` (lab content and timings) and `lab.sql` (slides and graded questions for Supabase), plus `index.html` and `lab-config.js` if the folder doesn't have them yet,
5. writes `alignment_report.txt`, listing any spot where the audio and script may not line up.

It takes a few minutes for a one-hour lecture. To rebuild after editing only `content.json`, add `--skip-frames`.

## 3. Publish it

1. In Supabase, open **SQL Editor**, paste `week10/lab.sql`, and run it.
2. Optionally, put the week's participation assignment ID in `week10/lab-config.js` (see `week09/README_DEPLOY.md`).
3. Commit and push with GitHub Desktop. The lab is live at `https://monroeu.github.io/MG628/week10/`.

Each lab keeps its records separate (by the `id` in `content.json`) and has its own **Class progress** dashboard.

## Notes

- **Generated questions** (fresh numbers on every attempt) are SQL functions in `lab-engine/schema.sql` (`mg628_gen`); the regression ones are listed in its `case` statement. A new lab can use static questions only, or new generators can be added there; re-run the schema afterwards.
- **Checking the alignment:** open `alignment_report.txt`. A median ratio near 1.0 and no listed spots means the clicks will land on their sentences. If spots are listed, check that the script in `segments` matches what was recorded, especially edits made after recording.
- **Slide timing:** a slide counts as watched once the student stays on it for 70% of its narration, using the durations in `lab.sql`, so re-run `lab.sql` whenever you rebuild a lab.
