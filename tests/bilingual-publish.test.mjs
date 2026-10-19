import test from 'node:test';
import assert from 'node:assert/strict';
import { isCompleteNarrative, missingNarrativeLanguages, narrativeProseFields } from '../core/narrative-readiness.mjs';

process.env.SUPABASE_URL ||= 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-placeholder-not-a-real-key';
const { autoApproveAndPublish } = await import('../scripts/editorial-desk.mjs');

const narrative = (language) => ({
  language,
  ...Object.fromEntries(narrativeProseFields.map((field) => [field, language === 'ko' ? '당시 정보와 결정의 근거를 설명합니다.' : 'Contemporary evidence and decision rationale.'])),
});

test('a Korean hook alone cannot disguise an English or incomplete Korean narrative', () => {
  const row = narrative('ko');
  row.longform_story = 'English prose';
  assert.equal(isCompleteNarrative(row), false);
  assert.deepEqual(missingNarrativeLanguages([narrative('en'), row]), ['ko']);
  row.longform_story = '   ';
  assert.equal(isCompleteNarrative(row), false);
});

for (const languages of [['en'], ['ko'], ['en', 'ko']]) {
  test(`publication with ${languages.join('/')} approved/current: requires the complete bilingual pair`, async () => {
    const originalFetch = globalThis.fetch;
    const transitions = [];
    globalThis.fetch = async (url, init = {}) => {
      const path = new URL(url).pathname;
      let value = [];
      if (path.endsWith('/decision_cases')) value = [{ status: 'NARRATIVE_DRAFTED', title: 'Test' }];
      if (String(url).includes('status=eq.APPROVED&is_current=eq.true')) value = languages.map(narrative);
      if (path.endsWith('/transition_case_status')) transitions.push(JSON.parse(init.body).p_to_status);
      return { ok: true, text: async () => JSON.stringify(value) };
    };
    try {
      const result = await autoApproveAndPublish({ case_id: 'case-1', case_key: 'sample', narrative_id: 'narr-1', language: languages[0], author_agent: 'codex' });
      if (languages.length === 2) {
        assert.equal(result.status, 'PUBLISHED');
        assert.deepEqual(transitions, ['CODEX_REVIEW', 'APPROVED', 'PROTOTYPE_READY', 'PUBLISHED']);
      } else {
        assert.equal(result.status, 'NARRATIVE_DRAFTED');
        assert.deepEqual(result.awaiting_languages, languages[0] === 'en' ? ['ko'] : ['en']);
        assert.deepEqual(transitions, [], 'no transition to any publicly readable status before both languages exist');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
