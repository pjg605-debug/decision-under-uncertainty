// Deno Edge Function. Deploy with:
//   supabase functions deploy get-narrative-queue-status
//   supabase secrets set NARRATIVE_QUEUE_SECRET=<a freshly generated random value>
//
// Purpose: let an unattended, credential-free automation session (a
// scheduled trigger) discover which cases need a bilingual narrative draft
// or revision, WITHOUT ever handing that session the full
// SUPABASE_SERVICE_ROLE_KEY. This function holds that key itself (Supabase
// provides it to every Edge Function automatically -- it is never set by
// hand here) and exposes only a narrow, read-only, single-purpose view:
// case_key/title and the structured facts needed to draft a narrative from,
// nothing else. Nothing in this function performs a write.
//
// Auth: a single shared secret in the `x-queue-secret` header, generated and
// registered once via `supabase secrets set`, then embedded directly in the
// scheduled trigger's prompt (same pattern as the article-writer routine's
// x-writer-secret / x-publish-secret). If that secret ever leaks, the worst
// case is someone can read the editorial queue -- they still cannot write
// anything, unlike a leaked service-role key.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPPORTED_LANGUAGES = ['en', 'ko'];

Deno.serve(async (req) => {
  const secret = Deno.env.get('NARRATIVE_QUEUE_SECRET');
  if (!secret) {
    return json({ error: 'NARRATIVE_QUEUE_SECRET is not configured.' }, 500);
  }
  if (req.headers.get('x-queue-secret') !== secret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const [{ data: narrativeCases, error: narrativeError }, { data: revisionReviews, error: revisionError }] =
    await Promise.all([
      supabase.rpc('get_cases_for_narrative', { p_limit: 10 }),
      supabase.rpc('get_revision_requests', { p_limit: 10 }),
    ]);
  if (narrativeError) return json({ error: narrativeError.message }, 500);
  if (revisionError) return json({ error: revisionError.message }, 500);

  const narrative_queue = await Promise.all(
    (narrativeCases || []).map((c: Record<string, unknown>) => summarizeCase(supabase, c)),
  );

  const revision_queue = [];
  for (const review of revisionReviews || []) {
    const { data: caseRow } = await supabase
      .from('decision_cases')
      .select('*')
      .eq('id', review.case_id)
      .maybeSingle();
    if (!caseRow) continue;
    const summary = await summarizeCase(supabase, caseRow);
    let reviewLanguage: string | null = null;
    if (review.narrative_id) {
      const { data: narrative } = await supabase
        .from('narratives')
        .select('language')
        .eq('id', review.narrative_id)
        .maybeSingle();
      reviewLanguage = narrative?.language || null;
    }
    revision_queue.push({
      ...summary,
      review: {
        id: review.id,
        narrative_id: review.narrative_id,
        language: reviewLanguage,
        field_name: review.field_name,
        comment: review.comment,
        suggested_change: review.suggested_change,
      },
    });
  }

  return json({ narrative_queue, revision_queue });
});

async function summarizeCase(supabase: ReturnType<typeof createClient>, caseRow: Record<string, unknown>) {
  const [{ data: information }, { data: options }, { data: evidence }, { data: narratives }] =
    await Promise.all([
      supabase.from('case_information').select('information_type,sequence,content').eq('case_id', caseRow.id),
      supabase
        .from('decision_options')
        .select('option_key,decision_key,sort_order,label,short_description,upside,downside,known_tradeoffs')
        .eq('case_id', caseRow.id),
      supabase
        .from('evidence')
        .select('evidence_key,title,author_or_institution,url,citation,evidence_class')
        .eq('case_id', caseRow.id),
      supabase.from('narratives').select('language,is_current').eq('case_id', caseRow.id),
    ]);
  const currentLanguages = new Set(
    (narratives || []).filter((n) => n.is_current).map((n) => n.language),
  );
  return {
    case_key: caseRow.case_key,
    case_id: caseRow.id,
    title: caseRow.title,
    domain: caseRow.domain,
    subdomain: caseRow.subdomain,
    actor: caseRow.actor,
    actor_role: caseRow.actor_role,
    date_or_period: caseRow.date_or_period,
    location: caseRow.location,
    t0: caseRow.t0,
    context_summary: caseRow.context_summary,
    known_information: (information || [])
      .filter((i) => i.information_type === 'KNOWN_AT_T0')
      .sort((a, b) => a.sequence - b.sequence)
      .map((i) => i.content),
    unknown_information: (information || [])
      .filter((i) => i.information_type === 'UNKNOWN_AT_T0')
      .sort((a, b) => a.sequence - b.sequence)
      .map((i) => i.content),
    options: (options || []).sort((a, b) => a.sort_order - b.sort_order),
    actual_decision_key: caseRow.actual_decision_key,
    immediate_outcome: caseRow.immediate_outcome,
    long_term_outcome: caseRow.long_term_outcome,
    evidence: evidence || [],
    missing_languages: SUPPORTED_LANGUAGES.filter((l) => !currentLanguages.has(l)),
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
