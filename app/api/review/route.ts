const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'REVIEW_DASHBOARD_TOKEN',
] as const;

const constantTimeEqual = (left: string, right: string) => {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index++)
    difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
};

const config = () => {
  const values = Object.fromEntries(
    required.map((name) => [name, process.env[name] || '']),
  ) as Record<(typeof required)[number], string>;
  if (required.some((name) => !values[name]))
    throw new Error('Review dashboard is not configured.');
  return values;
};

const authorized = (request: Request, token: string) => {
  const value = request.headers.get('authorization') || '';
  return (
    value.startsWith('Bearer ') && constantTimeEqual(value.slice(7), token)
  );
};

const client =
  (url: string, key: string) =>
  async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        ...(init.headers || {}),
      },
      cache: 'no-store',
    });
    const text = await response.text();
    if (!response.ok)
      throw new Error(
        `Supabase editorial request failed (${response.status}): ${text}`,
      );
    return text ? JSON.parse(text) : null;
  };

const transition = async (
  admin: ReturnType<typeof client>,
  caseKey: string,
  status: string,
  reason: string,
) =>
  admin('rpc/transition_case_status', {
    method: 'POST',
    body: JSON.stringify({
      p_case_key: caseKey,
      p_to_status: status,
      p_actor_agent: 'codex',
      p_reason: reason,
    }),
  });

export async function GET(request: Request) {
  try {
    const env = config();
    if (!authorized(request, env.REVIEW_DASHBOARD_TOKEN))
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const admin = client(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const params = new URLSearchParams({
      select:
        'case_key,title,status,updated_at,narratives(id,version,status,author_agent,revision_summary,updated_at),reviews(id,review_type,field_name,severity,verdict,status,comment,suggested_change,findings,created_at),research_gaps(id,severity,status,description)',
      status:
        'in.(NARRATIVE_DRAFTED,CODEX_REVIEW,REVISION_REQUESTED,REVISION_DONE,HOLD,APPROVED)',
      order: 'research_priority.desc,updated_at.asc',
    });
    return Response.json(
      { cases: await admin(`decision_cases?${params}`) },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Unknown review dashboard error',
    );
    return Response.json(
      { error: 'Review queue unavailable.' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const env = config();
    if (!authorized(request, env.REVIEW_DASHBOARD_TOKEN))
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = (await request.json()) as {
      action?: string;
      case_key?: string;
      narrative_id?: string;
      summary?: string;
      findings?: unknown[];
    };
    if (
      !['approve', 'request_revision'].includes(body.action || '') ||
      !body.case_key ||
      !body.narrative_id ||
      !body.summary
    ) {
      return Response.json(
        { error: 'Invalid review request.' },
        { status: 400 },
      );
    }
    const admin = client(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const cases = await admin(
      `decision_cases?case_key=eq.${encodeURIComponent(body.case_key)}&select=id,status&limit=1`,
    );
    const current = cases?.[0];
    if (!current)
      return Response.json({ error: 'Case not found.' }, { status: 404 });
    if (body.action === 'approve' && current.status === 'REVISION_REQUESTED')
      return Response.json(
        { error: 'Submit the requested narrative revision before approval.' },
        { status: 409 },
      );
    if (['NARRATIVE_DRAFTED', 'REVISION_DONE'].includes(current.status))
      await transition(
        admin,
        body.case_key,
        'CODEX_REVIEW',
        'Codex review opened from the internal dashboard.',
      );
    const revising = body.action === 'request_revision';
    await admin('reviews', {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({
        case_id: current.id,
        narrative_id: body.narrative_id,
        reviewer_agent: 'codex',
        review_type: 'OTHER',
        field_name: null,
        severity: revising ? 'MEDIUM' : 'LOW',
        status: revising ? 'OPEN' : 'RESOLVED',
        verdict: revising ? 'REVISE' : 'APPROVE',
        comment: body.summary,
        suggested_change: revising ? body.summary : null,
        findings: body.findings || [],
        resolved_at: revising ? null : new Date().toISOString(),
      }),
    });
    if (!revising) {
      await admin(
        `narratives?case_id=eq.${encodeURIComponent(current.id)}&is_current=eq.true`,
        {
          method: 'PATCH',
          body: JSON.stringify({ is_current: false }),
        },
      );
    }
    await admin(`narratives?id=eq.${encodeURIComponent(body.narrative_id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: revising ? 'REVISION_REQUESTED' : 'APPROVED',
        is_current: !revising,
      }),
    });
    if (!(body.action === 'approve' && current.status === 'APPROVED')) {
      await transition(
        admin,
        body.case_key,
        revising ? 'REVISION_REQUESTED' : 'APPROVED',
        body.summary,
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Unknown review action error',
    );
    return Response.json({ error: 'Review action failed.' }, { status: 500 });
  }
}
