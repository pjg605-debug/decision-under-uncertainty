# Narrative Pilot Report (Claude research pilot — 16 cases)

> Note on naming: `NARRATIVE_PILOT_REPORT.md` (repo root) is Codex's own
> pilot report for the 6-case MVP demo set in `data/narratives/` /
> `data/evidence/` — a separate, independently-authored content model.
> This report covers the 16 hand-researched cases in `data/cases/<id>/`
> (schema: `schema/*.json`). Both are real; neither should be merged into
> or overwrite the other. Where the two pilots independently looked at
> the same real-world event (Apollo 13, Challenger), that's noted below —
> it's a useful cross-check, not a duplicate.

## 0. Read this before generalizing anything below

Two selection biases apply to every number in this report:

1. **This is a curated sample, not a survey of history.** 12 of the 16
   cases (`pilot_batch: CURATED_HIGH_POTENTIAL`) were deliberately picked
   because their decision points looked unusually strong going in — clean
   T0, real alternatives, good documentation. A 50-75% hit rate on a
   hand-picked sample says "the format works when the underlying case is
   good," not "most historical decisions make good content." No claim
   here should be read as "history is full of cases like this."
2. **A separate 4-case batch (`LOW_FAME_STRESS_TEST`) was added
   specifically to pressure-test point 1** — genuinely obscure cases
   (Panama Canal design 1906, Karluk expedition 1914, Seikanron debate
   1873, Barry Marshall's self-experiment 1984), scored on the identical
   rubric. See §8 for what that comparison actually showed; it complicates
   the "famous cases are just easier" intuition more than it confirms it.

## 1. Headline numbers

16 cases researched, all schema-validated, all with real cited sources.
**8 landed `VIABLE`, 8 landed `WEAK`, 0 landed `FAILED` outright** —
`WEAK` (real, honestly-sourced content that doesn't clear the fairness
bar as a guessing game) turned out to be the actual floor, not "unusable."
No case was abandoned; every `WEAK` case still has a complete, honest
file set with its shortfall documented in `production_verdict.reasoning`.

Decision-quality × outcome-quality pairing, across all 16 (this is the
core philosophy check — did the pilot actually find "surprising" pairings,
not just "good decision → good outcome" every time):

| Pairing | Count | Cases |
|---|---:|---|
| STRONG / GOOD | 4 | Cuban Missile Crisis, D-Day, Apollo 13, Petrov |
| REASONABLE / BAD | 3 | Midway, Cannae, Shackleton |
| REASONABLE / MIXED | 3 | Molotov-Ribbentrop, Karluk, Seikanron |
| WEAK / BAD | 3 | Challenger, Tetraethyl lead, Whaleship Essex |
| REASONABLE / GOOD | 2 | Panama Canal, Barry Marshall |
| STRONG / MIXED | 1 | Mawson |
| **WEAK / GOOD** | **0** | *(none found)* |

The "good judgment, bad luck" pairing (REASONABLE/BAD, 3 cases) is well
represented — this is the pairing the project cares about most, and it
shows up organically, not forced. The inverse ("bad judgment, lucky
outcome") never turned up in this batch. That's worth naming honestly as
a gap rather than pretending the matrix is balanced: either it's rarer in
well-documented history (bad judgment that gets lucky tends to not get
carefully recorded/studied the way disasters and successes do), or this
batch simply didn't go looking for it specifically. A future round should
deliberately hunt for it.

## 2. Which case type worked best / worst (avg of all 4 quality scores)

| case_type | n | avg score | cases |
|---|---:|---:|---|
| crisis | 2 | 76.9 | Cuban Missile Crisis, Petrov |
| military | 4 | 73.5 | Cannae, Midway, D-Day, Petrov |
| political / diplomacy | 3 | 69.8 | Cuban Missile Crisis, Molotov-Ribbentrop, Seikanron |
| science | 5 | 66.5 | Apollo 13, Marshall, Challenger, Panama Canal, Tetraethyl lead |
| exploration / survival | 5 | 65.7 | Apollo 13, Karluk, Mawson, Shackleton, Essex |
| industry | 3 | 62.7 | Challenger, Panama Canal, Tetraethyl lead |

**Crisis and military decisions were the easiest to make fair and
compelling** — they tend to have one clearly-identified decision-maker, a
short deliberation window, and a genuinely binary choice already
recognized as such at the time. **Industry and exploration/survival cases
were hardest**, for two different reasons that matter for planning future
batches:

- *Industry* cases (Challenger, tetraethyl lead) suffer from **hindsight
  obviousness**: the "correct" answer is a now-uncontroversial safety
  fact (don't launch in the cold; don't sell known poison), so even
  faithfully reconstructed T0 information doesn't feel like a fair fight
  once a modern viewer's prior knowledge is factored in.
- *Exploration/survival* cases (Karluk, Mawson, Shackleton) suffer from
  **command/context sprawl**: multiple actors, ambiguous authority, and a
  slow-burn multi-week ordeal resist compression into one clean T0 more
  than a single meeting or a single order does.

## 3. Where context compression broke down hardest

Lowest `context_compression` scores: Molotov-Ribbentrop (45), Karluk
(50), Panama Canal (55), Mawson (55), Cannae/Seikanron/Shackleton (58
each). The pattern: any case that needs the viewer to understand a
*standing prior strategy* before the dilemma makes sense (Fabian
avoidance strategy before Cannae; the stalled Triple Alliance talks
before Molotov-Ribbentrop; a multi-week sledging plan before Mawson)
loses several seconds of hook time to throat-clearing that a
single-meeting decision (Petrov, Challenger, Cuban Missile Crisis — all
90) never needs.

## 4. Where source thinness was the biggest problem

Every case cleared the sourcing bar (all have real, cited evidence
packages), but two cases were explicitly flagged by the research agents
as the shakiest reconstructions: **Karluk expedition (1914)** and
**Mawson's Far Eastern Party (1912)** — both have genuine command
breakdown / small-party fragmentation in the record that resists a clean
two-option framing, and both carry unresolved scholarly disagreement on
a load-bearing detail (Mertz's cause of death is still disputed between
a 1969 hypervitaminosis-A hypothesis and a 2005 malnutrition
re-evaluation). Sourcing existed; a *clean, uncontested* two-option
structure did not.

## 5. Where A/B reconstruction was hardest

Same two cases (Karluk, Mawson), plus **Molotov-Ribbentrop** — not
because alternatives didn't exist, but because one alternative (continue
the stalled Triple Alliance talks) requires several extra facts (the
Poland/Romania transit refusal, the low-authority British/French
delegations) to even register as a real option rather than an obviously
naive one. This is the same underlying failure mode as the industry
cases in §2, from a different direction: instead of hindsight making one
option obviously *right*, missing context makes one option obviously
*naive*.

## 6. Which cases suited Progressive Information

Four cases got a `progressive.json`: **Cuban Missile Crisis, Apollo 13,
Petrov, and Tetraethyl lead.** The first three are strong natural fits —
each one has a real, documented moment where the actors' own
understanding measurably escalated in stages (Cuban Missile Crisis:
initial "strike" lean → new intel on strike scope → switch to blockade;
Apollo 13: suspected instrument glitch → confirmed dual tank loss →
lifeboat decision; Petrov: 1 missile → escalation to 5 missiles →
judgment holds). **Tetraethyl lead is the weaker fit of the four** — its
"new information" (the 1924 Bayway deaths) is a single discrete event
rather than a graduated escalation, so the progressive structure works
but feels more like two static frames than a real unfolding sequence.

## 7. Which shorts length felt most natural

This is a qualitative read (no controlled side-by-side test was run),
offered plainly as impression rather than measured data:

- **45-60s** consistently delivered the project's actual differentiator
  (the "why it was hard" beat plus a real unknown-at-T0 reveal) without
  cutting anything load-bearing. This was the most natural default.
- **20-25s** worked cleanly only for the highest-context-compression
  cases (Cuban Missile Crisis, D-Day, Petrov, Challenger — all ≥88 `cc`)
  where zero setup is needed. On lower-`cc` cases (Molotov-Ribbentrop,
  Karluk, Cannae) the 20-25s cut consistently had to sacrifice fairness
  (dropping a piece of context that made an option look naive rather than
  reasonable) to hit length — a real trade-off, not just a stylistic one.
- **30-40s** functioned as a reasonable default across the board but
  rarely felt like the *best* version of any given case — more a safe
  middle than a distinct strength.

## 8. Did low-fame cases hold up? (the famous-case bias check)

| | n | avg player_fairness | avg dilemma_balance | avg context_compression | avg reveal_payoff | VIABLE rate |
|---|---:|---:|---:|---:|---:|---:|
| CURATED_HIGH_POTENTIAL | 12 | 70.1 | 60.8 | 74.7 | 70.7 | 6/12 (50%) |
| LOW_FAME_STRESS_TEST | 4 | 68.0 | 62.0 | 62.8 | 68.2 | 2/4 (50%) |

This is the most important empirical result in this report: **fame
barely moved player_fairness or dilemma_balance at all** (both batches
land within 2 points of each other, and the low-fame batch's
dilemma_balance is actually marginally *higher*). The `VIABLE` rate is
identical. What fame does clearly buy is **context_compression** (74.7
vs. 62.8, an ~12-point gap) — a famous case needs less throat-clearing
because the audience already half-knows the setting. That's a real,
specific advantage, not a blanket one. **Conclusion: low fame does not
by itself produce a worse dilemma; it produces a harder compression
problem**, which is a solvable writing/hook problem, not a sourcing or
fairness problem.

This converges independently with Codex's own low-fame stress test
(`low-fame-uss-johnston-1944`, in `data/evidence/`, unrelated to this
pilot's 4 cases): it was rejected for a *different* reason — a morally
dominated option ("abandon the carriers you're escorting" isn't a fair
alternative to "attack"), not for lack of fame-driven compression. Two
independent low-fame tests, two different failure modes, both non-fame
-related — further evidence that "low fame → hard to make fair" isn't
the right mental model.

## 9. Answering the new required questions directly

**A. Of the 12 curated high-potential cases, what fraction are actually
production-ready?** 6/12 = **50%**, at `VIABLE`. Not the 12/12 a "pick
famous, well-documented events" strategy might optimistically predict.

**B. Does the low-fame stress test hold up to the same quality bar?**
Yes, on fairness/balance (§8) — 2/4 = 50%, statistically indistinguishable
from the curated batch's rate. No, on raw ease of writing — it took
measurably more context to compress fairly.

**C. What is the single biggest bottleneck?** **Genuine alternatives /
dilemma balance** — not historical research (sourcing was strong in all
16 cases; every `WEAK` case is honestly and solidly cited) and not
narrative writing (prose quality was consistent across VIABLE and WEAK
cases alike). The actual failure mode, every time, was structural: either
hindsight has already answered the question for a modern viewer
(Challenger, tetraethyl lead, Marshall's "underdog vindicated" story
shape), or the fair alternative needs more front-loaded context than a
short format wants to carry (Molotov-Ribbentrop, Karluk, Cannae, Mawson,
Shackleton). Source disagreement was present in 15/16 cases but never
the thing that sank a verdict — real, minor scholarly disputes coexist
fine with a strong dilemma (Cuban Missile Crisis, D-Day, Midway all carry
`source_disagreements` and are `VIABLE`).

**D. Of the original six self-check questions (§26 of the brief), which
mattered most in practice?** Question 3 — *"would someone who picked the
losing option feel tricked?"* — was the one every `WEAK` verdict actually
failed on, even when phrased differently by different research agents
("the correct answer is too obvious," "one option reads as commercially
self-interested rather than a strong case," "the maverick-vindicated
story shape pre-answers itself"). Question 1 (would you choose without
knowing the outcome) is really the same question from a different angle.
The other four (both options plausible, judgment differs pre/post
reveal, 30-second compression, sourced facts) were useful checks but
never independently the deciding factor once Question 3 was already
answered.

**E. Of the four new scores, which best separated real quality?**
By the numbers: **`dilemma_balance` had the largest VIABLE-vs-WEAK gap**
(70.8 avg for VIABLE vs. 51.5 for WEAK — a 19.2-point spread, the widest
of the four) and was the single lowest-scoring metric in 6 of the 8
`WEAK` cases. `player_fairness` was a close second (78.2 vs. 60.9, a
17.4-point spread). `context_compression` and `reveal_payoff` separated
the two groups by roughly 11-12 points each — real, but smaller.

Read plainly, `dilemma_balance` was the more *statistically* decisive
metric here. But it's worth being honest about why that's not quite the
same as saying it's the more *important* one: in this dataset the two
are heavily entangled — nearly every case that failed on dilemma_balance
failed for a player_fairness reason underneath it (an option looks
weak specifically because the viewer effectively already has fairness
-relevant information baked into their prior knowledge). Per the
project's own stated goal — a viewer should feel "I had enough
information and it was still genuinely hard," never "I got tricked into
guessing wrong" — **player_fairness is the correct one to treat as the
governing metric**, with dilemma_balance read as its most sensitive
symptom rather than a separate, competing signal. A case that scores
well on dilemma_balance but poorly on player_fairness (none appeared in
this batch, but it's a live risk on the "make two options equally
tempting" instinct) would still be the wrong kind of engaging — that's
exactly the guessing-game failure mode the project explicitly disallows.

## 10. What's automatable vs. what still needs a person

**Reasonably automatable now**, based on this pilot:
- First-pass web research and source triage (all 16 cases got real,
  correctly-classified citations without hand-holding).
- FACT/CONTEMPORARY_BELIEF/STATED_RATIONALE/INFERENCE tagging discipline
  — agents consistently applied this correctly once given the rubric.
- Schema validation and structural completeness (case.json/evidence.json
  /narrative.json/shorts.json/progressive.json) — fully automatable, zero
  manual fixes needed across 16 cases × 5 file types.
- A first-pass `quality_scores` self-assessment, as a triage signal.

**Still needs a person (or a materially more adversarial second-pass
review) before publishing anything:**
- The actual `production_verdict` call, especially on borderline
  `player_fairness`/`dilemma_balance` scores — this is a judgment about
  how a real, hindsight-loaded human audience will *feel*, which is
  exactly the kind of thing a single research pass tends to be
  overconfident about (every `WEAK` verdict in this batch was self
  -reported by the same agent that did the research — a second,
  independent pass would be healthier than trusting self-grading long
  -term).
  - **Case in point already in this repo:** two of this pilot's `WEAK`
    verdicts (Challenger, and Apollo 13's binary framing per Codex's
    separate rejection) were reached *independently* by Codex's own QA
    process too. That convergence is reassuring evidence the scoring
    rubric is finding real problems, not noise — but it's still only two
    independent AI passes agreeing, not a human historian's sign-off.
- Resolving genuine source disagreements on contested facts (troop
  counts, exact wording, who-said-what) — flagging them is automatable;
  deciding how much weight to give each side, or when to escalate to a
  specialist, is not.
- Sensitivity/tone review on cases involving mass death or graphic
  content (Whaleship Essex's cannibalism, Cannae's casualties) — the
  narrative content here was written soberly, but that's a judgment call
  worth a second set of eyes, every time, not a one-time check.
- Checking that "why option A/B made sense" prose doesn't quietly leak
  hindsight favoritism toward whichever option actually happened
  historically — an easy, subtle failure mode for any writer (human or
  model) who already knows the ending while drafting the "before" case.

## 11. Verdict

**PROMISING BUT SCHEMA NEEDS REVISION.**

The content itself validates the format: 8 of 16 cases (50%) reached a
genuinely fair, balanced, well-sourced `VIABLE` dilemma across a
deliberately mixed portfolio (military, political, exploration, science,
crisis, industry; famous and obscure alike), and the failures are
informative rather than embarrassing — every `WEAK` case has an honest,
specific, structural reason rather than a vague "didn't work out." The
low-fame stress test (§8) is the strongest evidence here: it did **not**
reveal that this project only works with pre-famous material.

The schema call is separate from the content call, though, and this
session's actual DB-integration work surfaced it directly:
`CODEX_INTEGRATION_HANDOFF.md` independently lists missing fields
(`editorial_status`, `option_provenance`, `t0_precision`,
`information_provenance[]`, `claim_evidence_refs`,
`content_warning`/`sensitivity_notes`, per-step decision_quality for
progressive cases, locale-stable narrative IDs) discovered from testing
*real* content against the deployed product — the same real content this
pilot produced. This pilot's own schema (`schema/*.json`) also only
gained its four editorial scores (`quality_scores`) and `production_verdict`
partway through, once it became clear the original schema had no way to
say "this case is well-sourced but shouldn't ship as-is." Both signals
point the same direction: the writing/research process is solid; the
data model describing *editorial confidence and provenance* around that
writing needs another pass before this scales past a hand-run pilot.
