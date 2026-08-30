export const canReveal = ({ choice, locked }) => Boolean(choice && locked);
export const narrativeText = (narrative, slot, fallback='Narrative analysis is not yet available.') => narrative?.[slot]?.trim() || fallback;
export const filterCases = (items, f) => items.filter(x => (!f.domain || f.domain==='all' || x.domain===f.domain) && (!f.decision_quality || f.decision_quality==='all' || x.decision_quality===f.decision_quality) && (!f.outcome_quality || f.outcome_quality==='all' || x.outcome_quality===f.outcome_quality));
export const nextProgressiveState = (state, event) => !state.initialChoice && event.progressive ? 'NEW_EVIDENCE' : 'REVEALED';
