export const NARRATIVE_SLOTS = ['hook','short_setup','why_option_a_made_sense','why_option_b_made_sense','actual_decision_explanation','outcome_story','hindsight_analysis','decision_principle','longform_story'];
export const EVALUATION_KEYS = ['PLAYER_FAIRNESS','DILEMMA_BALANCE','CONTEXT_COMPRESSION','REVEAL_PAYOFF'];

export function validateProductionNarrative(narrative, evidenceIds = new Set()) {
  const errors = [];
  for (const slot of NARRATIVE_SLOTS) if (typeof narrative?.[slot] !== 'string' || !narrative[slot].trim()) errors.push(`slot:${slot}`);
  for (const key of EVALUATION_KEYS) {
    const value = narrative?.evaluations?.[key];
    if (!value || !Number.isInteger(value.score) || value.score < 0 || value.score > 100 || !value.status || !value.rationale) errors.push(`evaluation:${key}`);
  }
  if (!Array.isArray(narrative?.evidence_refs) || !narrative.evidence_refs.length) errors.push('evidence_refs:missing');
  else for (const ref of narrative.evidence_refs) if (!evidenceIds.has(ref)) errors.push(`evidence_ref:unresolved:${ref}`);
  return { valid: errors.length === 0, errors };
}
