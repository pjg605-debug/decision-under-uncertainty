const narrativeFields = [
  'hook',
  'short_setup',
  'why_option_a_made_sense',
  'why_option_b_made_sense',
  'actual_decision_explanation',
  'outcome_story',
  'hindsight_analysis',
  'decision_principle',
  'longform_story',
];

const sortByPosition = (rows = []) =>
  [...rows].sort(
    (a, b) =>
      Number(a.sort_order ?? a.sequence ?? a.position) -
      Number(b.sort_order ?? b.sequence ?? b.position),
  );
const first = (value) => (Array.isArray(value) ? value[0] : value);

export function transformSupabaseRows(rows) {
  const narratives = {};
  const cases = rows.map((row) => {
    const narrative = [...(row.narratives || [])].sort(
      (a, b) => Number(b.version) - Number(a.version),
    )[0];
    if (narrative) {
      narratives[row.narrative_key] = Object.fromEntries(
        narrativeFields.map((field) => [field, narrative[field]]),
      );
    }
    const information = sortByPosition(row.case_information);
    const score = first(row.case_scores) || {};
    return {
      id: row.case_key,
      title: row.title,
      domain: row.domain,
      subdomain: row.subdomain,
      actor: row.actor,
      actor_role: row.actor_role,
      date_or_period: row.date_or_period,
      era: row.era,
      location: row.location,
      t0: row.t0,
      context_summary: row.context_summary,
      known_information: information
        .filter((item) => item.information_type === 'KNOWN_AT_T0')
        .map((item) => item.content),
      unknown_information: information
        .filter((item) => item.information_type === 'UNKNOWN_AT_T0')
        .map((item) => item.content),
      options: sortByPosition(row.decision_options).map((option) => ({
        id: option.decision_key,
        label: option.label,
        short_description: option.short_description,
        upside: option.upside,
        downside: option.downside,
        known_tradeoffs: option.known_tradeoffs || [],
      })),
      actual_decision:
        row.decision_options.find(
          (option) => option.option_key === row.actual_decision_key,
        )?.decision_key || row.actual_decision_key,
      immediate_outcome: row.immediate_outcome,
      long_term_outcome: row.long_term_outcome,
      decision_quality: row.decision_quality,
      outcome_quality: row.outcome_quality,
      uncertainty_factors: row.uncertainty_factors || [],
      evidence: (row.evidence || []).map((item) => ({
        id: item.evidence_key,
        source_type: item.source_type,
        title: item.title,
        author_or_institution: item.author_or_institution,
        publication_date: item.publication_date || undefined,
        url: item.url || undefined,
        accessed_at: item.accessed_at || undefined,
        evidence_class: item.evidence_class,
      })),
      narrative_id: row.narrative_key,
      scores: {
        curiosity: score.curiosity ?? 0,
        decision: score.decision ?? 0,
        stakes: score.stakes ?? 0,
        mystery: score.mystery ?? 0,
        explainability: score.explainability ?? 0,
        evidence: score.evidence ?? 0,
      },
      metadata: {
        ...(row.metadata || {}),
        popularity: row.popularity,
        controversy_risk: row.controversy_risk,
        context_compression: row.context_compression,
        visualizability: row.visualizability,
        source_disagreement: row.source_disagreement,
      },
      progressive:
        row.progressive ||
        (information.find(
          (item) => item.information_type === 'PROGRESSIVE_EVIDENCE',
        )
          ? {
              evidence: information.find(
                (item) => item.information_type === 'PROGRESSIVE_EVIDENCE',
              ).content,
              prompt: 'Keep your decision or change it?',
            }
          : undefined),
    };
  });
  return { cases, narratives };
}

// Narratives are independently authored per language (never a translation of
// the other -- see CODEX_INTEGRATION_HANDOFF.md's bilingual-narratives
// section), so the read path must pick a single language explicitly rather
// than silently returning whichever row happens to have the highest version
// number across languages.
export const SUPPORTED_LANGUAGES = ['en', 'ko'];

export async function fetchApprovedContent({
  url,
  key,
  fetchImpl = fetch,
  language = 'en',
}) {
  if (!url || !key)
    throw new Error('Supabase content reader is not configured.');
  if (!SUPPORTED_LANGUAGES.includes(language))
    throw new Error(
      `Unsupported language "${language}". Use one of: ${SUPPORTED_LANGUAGES.join(', ')}.`,
    );
  const params = new URLSearchParams({
    select:
      '*,decision_options(*),case_information(*),evidence(*),case_scores(*),narratives(*)',
    status: 'in.(APPROVED,PROTOTYPE_READY,PUBLISHED)',
    order: 'research_priority.desc,created_at.asc',
    'narratives.language': `eq.${language}`,
  });
  const response = await fetchImpl(
    `${url.replace(/\/$/, '')}/rest/v1/decision_cases?${params}`,
    {
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    },
  );
  if (!response.ok)
    throw new Error(`Supabase content request failed (${response.status}).`);
  const rows = await response.json();
  if (!Array.isArray(rows))
    throw new Error('Supabase returned an invalid content payload.');
  return transformSupabaseRows(rows);
}
