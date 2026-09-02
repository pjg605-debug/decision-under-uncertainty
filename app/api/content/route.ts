import { fetchApprovedContent } from '../../../core/supabase-content.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const requested = new URL(request.url).searchParams.get('lang');
    const language = requested === 'ko' ? 'ko' : 'en';
    const content = await fetchApprovedContent({
      url: process.env.SUPABASE_URL || '',
      key: process.env.SUPABASE_ANON_KEY || '',
      language,
    });
    return Response.json(
      { ...content, source: 'supabase', language, fetched_at: new Date().toISOString() },
      {
        headers: {
          'cache-control': 'public, max-age=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    console.error(
      'Supabase content fallback:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return Response.json(
      { source: 'local', error: 'Remote content is temporarily unavailable.' },
      {
        status: 503,
        headers: { 'cache-control': 'no-store' },
      },
    );
  }
}
