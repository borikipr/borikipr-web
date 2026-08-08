# Cloudflare translation scheduler

`borikipr-translation-scheduler` is a schedule-only Cloudflare Worker. Every
five minutes it makes one authenticated `POST` request to the existing BorikiPR
translation worker endpoint:

`https://borikipr.com/api/cron/process-translation-jobs`

It never receives Neon, Google, Admin, customer, source-text, or translated-text
credentials or data. It does not parse or log the Vercel response body and does
not retry within a scheduled execution.

## Configuration

- Worker name: `borikipr-translation-scheduler`
- Cron: `*/5 * * * *` (UTC)
- Required Cloudflare secret: `TRANSLATION_CRON_SECRET`
- Matching Vercel Production secret: `TRANSLATION_CRON_SECRET`
- Source/config: `cloudflare/translation-scheduler`

The BorikiPR endpoint prefers the dedicated translation secret and retains
`CRON_SECRET` only as a backwards-compatible fallback. Never put a secret value
in Git, `wrangler.jsonc`, logs, or shell history.

## Deployment

Authenticate Wrangler to the approved Cloudflare account, then configure the
same secret independently in Cloudflare and Vercel encrypted Production secret
storage. Deploy with:

```sh
npx wrangler@4.120.0 deploy --config cloudflare/translation-scheduler/wrangler.jsonc
```

The five-minute Cron Trigger is source-controlled in `wrangler.jsonc`. Confirm
the account remains on Workers Free before deployment.

## Operations

- Disable: remove or disable the Cron Trigger in Cloudflare, or deploy a config
  without `triggers.crons`. Set `TRANSLATION_WORKER_ENABLED=false` in Vercel for
  an immediate processing stop.
- Rotate: create a new random secret, update the Vercel Production secret first,
  redeploy, then replace the Cloudflare Worker secret. Confirm an authenticated
  zero-work invocation before retiring the old value.
- Manual test: call the existing protected endpoint once with the secret while
  batch size and concurrency remain `1`. Never loop or retry manually.
- Recovery: HTTP 401/403, 429, 5xx, timeout, and network failures are terminal
  for that scheduled execution. A later five-minute trigger may try again.

The translation worker remains responsible for claiming at most one job,
atomic usage reservation, Google calls, source hashes, stale-result rejection,
review/protection enforcement, and retry scheduling.
