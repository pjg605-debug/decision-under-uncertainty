declare const Deno: { env: { get(name: string): string | undefined } };

type JsonRecord = Record<string, unknown>;

// Deno Edge Functions are deployed and type-checked independently of this
// repo's Next.js tsconfig (which disallows relative ".ts" import
// specifiers), so this mirrors core/supabase-auth.mjs's logic inline
// rather than importing it. Keep both in sync: legacy JWT service_role
// keys ("eyJ...") need both `apikey` and `Authorization: Bearer`; newer
// non-JWT Supabase keys ("sb_secret_...") are rejected by the gateway if
// sent as a Bearer JWT, so they only need `apikey`.
function supabaseAuthHeaders(key: string): Record<string, string> {
  if (!key) throw new Error('A Supabase key is required to build auth headers.');
  if (key.startsWith('sb_')) return { apikey: key };
  return { apikey: key, Authorization: `Bearer ${key}` };
}

const headers = { 'Content-Type': 'application/json; charset=utf-8' };

function json(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), { status, headers });
}

function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

function getServiceKey() {
  const named = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (named) {
    const parsed = JSON.parse(named) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

export default {
  fetch: async (request: Request) => {
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const expected = Deno.env.get('PUBLISH_SECRET') || '';
    const supplied = request.headers.get('x-publish-secret') || '';
    if (!expected || !constantTimeEqual(expected, supplied)) {
      return json(401, { error: 'Unauthorized' });
    }

    const url = Deno.env.get('SUPABASE_URL') || '';
    const key = getServiceKey();
    if (!url || !key) return json(503, { error: 'Supabase credentials unavailable' });

    try {
      const result = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/publish_next_draft_article`, {
        method: 'POST',
        headers: {
          ...supabaseAuthHeaders(key),
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      const detail = await result.text();
      if (!result.ok) throw new Error(`Publish RPC failed (${result.status}): ${detail.slice(0, 600)}`);

      const article = detail ? JSON.parse(detail) : null;
      if (!article) return json(200, { ok: true, published: false, reason: 'draft_queue_empty' });

      return json(200, {
        ok: true,
        published: true,
        article,
        url: `https://decision-under-uncertainty.pjg605.chatgpt.site/articles/${article.slug}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      return json(500, { ok: false, error: message });
    }
  },
};
