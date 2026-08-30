import type { DecisionEvent } from '../schemas/decision-event';

export function shortsPotential(event: DecisionEvent) {
  const s = event.scores;
  return Math.round(s.curiosity * .22 + s.decision * .22 + s.stakes * .18 + s.mystery * .18 + s.explainability * .12 + s.evidence * .08);
}
