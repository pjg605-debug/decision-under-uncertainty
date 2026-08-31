# Narrative Pilot Report

## Scope

The pilot reviewed the six real-event records currently connected in `data/cases.ts`: Austerlitz (1805), the Cuban Missile Crisis (1962), Challenger (1986), Netflix streaming (2007), New Coke (1985), and Apollo 13 (1970). USS *Johnston* at the Battle off Samar (1944) was used as a lower-fame stress test. No UI implementation or structured `DecisionEvent` fact was changed.

The acceptance test was stricter than factual recognizability:

> The player must receive enough information to make a serious judgment, while both options remain genuinely defensible at T0.

An event fails if its difficulty comes from withholding information the represented actor actually had, if one option is dominated, or if the card compresses several actors and decision moments into a fictional single choice.

## Method

Each candidate was audited across four editorial measures:

- `PLAYER_FAIRNESS`: information presented before the choice reflects what the represented actor could know.
- `DILEMMA_BALANCE`: neither card is made foolish by the facts already shown.
- `CONTEXT_COMPRESSION`: compression preserves the real decision rather than inventing one.
- `REVEAL_PAYOFF`: the reveal changes understanding without turning history into an answer key.

Evidence was classified as `FACT`, `CONTEMPORARY_BELIEF`, `STATED_RATIONALE`, or `INFERENCE`. Production narratives connect to source IDs rather than placing uncited historical claims in prose.

## Results

### Ready — Cuban Missile Crisis

The central air-strike-versus-quarantine choice is directly supported by ExComm and NSC records. The October 22 minutes record uncertainty that an air strike would destroy every missile and Kennedy's concern about a surprise attack. The quarantine was a real, selected course of action, not a retrospective simplification. The later discovery that U.S. intelligence had not located all Soviet nuclear warheads provides a strong unknown-information reveal without being leaked into T0.

- PLAYER_FAIRNESS: 95 / PASS
- DILEMMA_BALANCE: 92 / PASS
- CONTEXT_COMPRESSION: 90 / PASS
- REVEAL_PAYOFF: 97 / PASS
- Narrative: `data/narratives/cuban-missile-1962.json`
- Evidence: `data/evidence/cuban-missile-1962.json`

### Ready — New Coke

The case contains two distinct forms of customer evidence: blind taste preference and attachment to the incumbent product. Replacement is understandable because the taste evidence was relevant; retention is understandable because replacement forced consumers to give up identity-rich value not fully represented by sip tests. The 79-day return of the original formula produces a clear reveal, while the long-term outcome remains `Mixed` rather than being rewritten as a secret success.

- PLAYER_FAIRNESS: 91 / PASS
- DILEMMA_BALANCE: 88 / PASS
- CONTEXT_COMPRESSION: 87 / PASS
- REVEAL_PAYOFF: 91 / PASS
- Narrative: `data/narratives/new-coke-1985.json`
- Evidence: `data/evidence/new-coke-1985.json`

### Conditionally ready — Netflix streaming

The source record strongly supports the January 2007 phased launch, the constraints of streaming rights and delivery, and the later strategic shift. It does **not** establish a single executive vote between the exact cards “Invest now” and “Optimize DVDs.” The narrative therefore labels the binary choice as editorial reconstruction and treats the phased rollout—not an invented all-in bet—as the actual decision.

- PLAYER_FAIRNESS: 83 / PASS_WITH_CAVEAT
- DILEMMA_BALANCE: 80 / PASS_WITH_CAVEAT
- CONTEXT_COMPRESSION: 84 / PASS_WITH_CAVEAT
- REVEAL_PAYOFF: 86 / PASS
- Narrative: `data/narratives/netflix-2007.json`
- Evidence: `data/evidence/netflix-2007.json`

### Hold — Austerlitz

The current card combines at least two moments: the Allied council's decision to execute Weyrother's attack plan and the later battlefield movement off the Pratzen Heights. The plan primarily aimed at the French right; the current setup instead says the French center appeared weak. “Allied command” also merges Tsar Alexander, Weyrother, Kutuzov, and column commanders who did not share authority or beliefs. A production narrative would conceal these structural defects rather than solve them.

Required before reconsideration: choose a single T0 (preferably the December 1 council), name the decision owner, reconstruct the actual plan versus waiting/retreating, and rebuild known information from contemporary sources.

- Evidence review: `data/evidence/austerlitz-1805.json`
- Existing `data/narratives/austerlitz-1805.json` remains a legacy demo, not a production-approved pilot narrative.

### Hold — Challenger

The Rogers Commission provides unusually strong evidence, but the current viewpoint is not stable. The card gives the player engineer-level warnings while assigning the role “NASA and contractor managers.” The Commission found that senior decisionmakers did not receive the complete history and continuing engineer opposition. Giving the player more coherent warning than the represented composite actor makes the test unfair in a different direction and leaves “launch” weakly defensible.

Required before reconsideration: select a precise actor and moment—such as Morton Thiokol management during the teleconference—and reproduce exactly which charts, objections, and organizational constraints that actor possessed.

- Evidence review: `data/evidence/challenger-1986.json`

### Reject in current binary form — Apollo 13

Once oxygen loss and fuel-cell failure were established, remaining in the command module was not a balanced operational alternative. The case's interest lies in a sequence of constrained decisions: diagnose the failure, power down, activate the lunar module, choose a return profile, manage consumables, and restore the command module. As one A/B card, the player is asked to choose between the viable lifeboat and a dominated option.

Apollo 13 may return only as a progressive multi-decision crisis case.

- Evidence review: `data/evidence/apollo-13-1970.json`

## Low-fame stress test — USS Johnston, Battle off Samar

The low-fame test succeeded on evidence availability and reveal potential but failed as a balanced player dilemma. Official U.S. Navy histories document Commander Ernest Evans ordering an attack on a much stronger Japanese force while Johnston defended vulnerable escort carriers. However, “attack” versus “withdraw” becomes morally and operationally loaded: mission duty, immediate threat, and the carriers' vulnerability make withdrawal a dominated card. Low fame alone does not create uncertainty.

Decision: reject; do not add to `data/cases.ts`.

- Evidence: `data/evidence/low-fame-uss-johnston-1944.json`

## Validation

The production validator requires all nine narrative slots, all four editorial evaluations, and at least one resolvable evidence reference. Automated tests also confirm that approved narrative IDs are connected in `data/cases.ts` and that the low-fame rejected case is not connected.

## Source-quality notes

- Cuban Missile Crisis: strongest tier; government meeting records, presidential archive, State Department history, and declassified-document analysis.
- Netflix: strong for actions and outcomes; weaker for undocumented internal motives. The reconstruction caveat is mandatory.
- New Coke: company histories establish sequence and timing; academic cases and analysis are used to interpret research framing. Company retrospective claims are not treated as neutral proof of motive.
- Austerlitz: a contemporary account and military history are available, but actor/T0 reconstruction still requires specialist review.
- Challenger and Apollo 13: primary official reports are strong; the current product framing, not evidence scarcity, causes failure.
