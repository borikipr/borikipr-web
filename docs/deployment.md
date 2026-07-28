# Production deployment runbook

## Pre-deployment

- Clean worktree and reviewed phase-scoped commits.
- `npm ci`, tests, migration validation, lint, type-check, build, browser E2E,
  accessibility checks, and `git diff --check`.
- Compare required variables in `.env.example` with Vercel Production and
  Preview names. Never print values.
- Run schema audit, availability recovery dry run, and R2 reconciliation dry
  run. Review aggregate output.
- Confirm email queue has no stale processing rows.

## Release order

1. Create/confirm Neon restore point.
2. Apply and verify required migrations in numeric order.
3. Push reviewed commits and deploy through the linked Vercel project.
4. Confirm deployment status is `READY` and both `borikipr.com` aliases target
   the intended deployment.
5. Run GET-only public/admin smoke tests. Use isolated fixtures for mutations.
6. Verify cron schedules and authorization, queue health, headers, R2 access,
   and analytics exclusions.

## Rollback

Promote the previous compatible Vercel deployment. Avoid schema rollback for
additive changes unless necessary. If the new release produced durable rows,
do not discard them; deploy a forward-compatible fix. Disable only the affected
cron if it is unsafe, preserving pending queue/outbox intent.

