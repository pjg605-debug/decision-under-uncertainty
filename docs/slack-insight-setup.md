# Insight notifications

The article publisher and review API use `SLACK_INSIGHT_WEBHOOK_URL` in
separate runtimes. Use one incoming webhook bound to #insight (`C0BTFML1BUM`).
Do not put the value in source, issue/PR text, build arguments or public env vars.

## Activation

1. Create the webhook in the Slack app's Incoming Webhooks settings and select
   #insight. The connected Slack messaging tools cannot issue this credential.
2. Register it as repository Actions secret `SLACK_INSIGHT_WEBHOOK_URL` in
   `pjg605-debug/decision-under-uncertainty`.
3. Register the same value as a **secret** production environment variable in
   the existing Decision / T0 Site. This project is managed through Sites;
   do not assume a local Wrangler environment owns the live Worker.
4. Merge the notification change, reconcile it with the actual Sites source,
   build successfully, then deploy through Sites using its existing identity.
5. Observe the next real article publication and first case approval. Do not
   publish content or approve a case solely to test a notification.

GitHub main was inspected at `8b8ccd27c23e542673af909c6096828b688a4212`.
The Sites source main and latest saved version 8 were at
`29cc4c0586d5c4e41cd5aff534253c1ff945b6da`. The review handler there matches
the older Claude branch, while GitHub main has newer Supabase authentication
and bilingual narrative fixes. This PR preserves those fixes on GitHub main;
it must not be described as an already deployed Site change.

At inspection time the Site had no `SLACK_INSIGHT_WEBHOOK_URL` entry. The
GitHub connector does not expose Actions secret management, so registration
there remains unverified. No webhook was created or Slack message sent.

## Behavior and limits

- Articles reuse the existing publish response. Only a successful publish
  step with `ok: true` and `published: true` can notify. Missing configuration,
  an empty queue or a failed publish does not notify. Slack failures are isolated.
- Cases notify after successful approval, using the framework's `after()`
  lifecycle hook. The helper catches failures and limits requests to 3 seconds.
  Existing live states and any historical live-state transition suppress the
  notification, including approval after revising an already approved case.
- The site has no case deep link, so case notifications link to the root page.
- Delivery is best effort, without retries or a durable outbox. Simultaneous
  first-approval requests can race the history read; strict cross-request
  deduplication requires an atomic database claim/outbox migration.

## Validation

`node --test tests/slack-insight.test.mjs`: 15 passing tests with mocked
network calls and a controlled framework lifecycle hook.

`node --test tests/*.test.mjs`: 94 passed, 2 failed because the existing
ingestion tests reference missing
`content/pending-articles/disposition-effect-stop-loss.json`.

The dependency-install command was stopped at the approval layer, so no
production build or live end-to-end notification test was completed.
