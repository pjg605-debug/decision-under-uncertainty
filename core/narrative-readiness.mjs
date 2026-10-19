export const narrativeProseFields = [
  'hook', 'short_setup', 'why_option_a_made_sense',
  'why_option_b_made_sense', 'actual_decision_explanation',
  'outcome_story', 'hindsight_analysis', 'decision_principle', 'longform_story',
];

export function isCompleteNarrative(narrative) {
  return ['en', 'ko'].includes(narrative?.language) &&
    narrativeProseFields.every((field) =>
      typeof narrative[field] === 'string' && narrative[field].trim() &&
      (narrative.language !== 'ko' || /[가-힣]/u.test(narrative[field])));
}

// Publication requires independently authored prose in both languages.
// Callers pass only APPROVED, current database rows, never draft archives.
export function missingNarrativeLanguages(approvedCurrentRows) {
  return ['en', 'ko'].filter((language) =>
    !approvedCurrentRows.some((row) => row.language === language && isCompleteNarrative(row)));
}
