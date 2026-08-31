const qualities = new Set(['Strong', 'Reasonable', 'Weak', 'Unclear']);
const outcomes = new Set(['Good', 'Bad', 'Mixed']);
const evidenceClasses = new Set(['FACT', 'CONTEMPORARY_BELIEF', 'STATED_RATIONALE', 'INFERENCE']);
export function validateDecisionEvent(x) {
  const errors = [];
  for (const key of ['id','title','domain','t0','context_summary','actual_decision']) if (!x?.[key]) errors.push(`missing:${key}`);
  if (!Array.isArray(x?.options) || x.options.length < 2) errors.push('options:min2');
  if (!qualities.has(x?.decision_quality)) errors.push('decision_quality:invalid');
  if (!outcomes.has(x?.outcome_quality)) errors.push('outcome_quality:invalid');
  if (!Array.isArray(x?.evidence) || x.evidence.some((e) => !evidenceClasses.has(e.evidence_class))) errors.push('evidence_class:invalid');
  for (const score of Object.values(x?.scores || {})) if (score < 0 || score > 100) errors.push('score:range');
  return { valid: errors.length === 0, errors };
}
