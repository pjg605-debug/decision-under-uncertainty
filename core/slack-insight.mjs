const liveStatuses = ['APPROVED', 'PROTOTYPE_READY', 'PUBLISHED'];
const siteUrl = 'https://decision-under-uncertainty.pjg605.chatgpt.site/';

export function isNewApproval(action, status) {
  return action === 'approve' && !liveStatuses.includes(status);
}

// Notification-only reads must never prevent the editorial mutation.
export async function hasNoPreviousApproval(admin, caseId) {
  try {
    const rows = await admin(
      `status_transitions?case_id=eq.${encodeURIComponent(caseId)}&to_status=in.(APPROVED,PROTOTYPE_READY,PUBLISHED)&select=id&limit=1`,
      { signal: AbortSignal.timeout(3000) },
    );
    return Array.isArray(rows) && rows.length === 0;
  } catch {
    console.warn('Insight notification skipped: approval history unavailable.');
    return false;
  }
}

export async function notifyCaseApproval({ webhookUrl, title, caseKey }) {
  if (!webhookUrl) return;
  try {
    const url = new URL(webhookUrl);
    if (url.origin !== 'https://hooks.slack.com' || !url.pathname.startsWith('/services/'))
      throw new Error('Invalid webhook configuration');
    const response = await fetch(webhookUrl, {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({
        text: `🧭 새 사건 공개: ${title || caseKey} (${caseKey})\n첫 검수 승인이 완료되었습니다.\n${siteUrl}`,
        mrkdwn: false,
        unfurl_links: false,
        unfurl_media: false,
      }),
    });
    if (!response.ok) console.warn(`Insight notification failed (HTTP ${response.status}).`);
    await response.body?.cancel();
  } catch {
    // Do not log the error object: fetch errors can contain the secret URL.
    console.warn('Insight notification failed.');
  }
}
