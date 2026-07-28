# BorikíPR / Erickson Real Estate

Production web application for Erickson Real Estate in Puerto Rico. It combines
the public property catalog and qualification forms with an authenticated admin,
canonical Lead 360 identities, shared client cases, secure financial documents,
follow-up workflows, analytics, and recoverable email delivery.

## Architecture

- **Next.js 16 / React 19**: App Router public and admin experiences.
- **Neon PostgreSQL**: source of truth for properties, leads, form submissions,
  admin authentication metadata, email queue, audit history, and rate limits.
- **Cloudflare R2**: private financial documents and managed media. Neon stores
  metadata and ownership references, never document bytes.
- **Resend**: immediate transactional delivery. Retryable failures use the
  durable `email_queue`.
- **Vercel**: production hosting and protected cron execution.
- **Analytics**: GA4, Microsoft Clarity, and Vercel Analytics on eligible public
  routes. Admin and private-token workflows are excluded.

The mature identity, Shared Case 360, Lead 360, document authorization, and
email queue designs are shared infrastructure; do not create parallel versions.

## Main modules

- Public: home, listings, property details, About, Contact, testimonials,
  Priority Registration, Buyer Profile, Open House, and Private Showing.
- Admin: properties, testimonials, analytics, unified leads, Lead 360, Shared
  Case 360, follow-ups, secure documents, profile, and password recovery.
- Operations: email processing, availability-intent recovery, authentication
  cleanup, schema audit, health monitoring, and R2 reconciliation.

## Local setup

Requirements: Node.js 24 LTS-compatible runtime, npm, and isolated development
credentials for Neon and R2. Never point automated tests at production.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Public tests use isolated PGlite fixtures and do
not require production secrets.

## Validation

```bash
npm test
npm run migration:validate
npm run lint
npm run type-check
npm run build
npm run test:e2e
git diff --check
```

Operational read-only commands:

```bash
npm run schema:audit
npm run availability:recovery:dry-run
npm run r2:reconcile
```

## Deployment

Database migrations are reviewed and applied before deploying code that depends
on them. Application requests never auto-apply migrations. Vercel Production
and Preview must use the same durable persistence architecture and have all
required server-only variables configured.

See:

- [Migration runbook](docs/migrations.md)
- [Deployment runbook](docs/deployment.md)
- [Incident runbook](docs/incidents.md)
- [Security and privacy operations](docs/security-privacy.md)
- [R2 lifecycle policy](docs/r2-lifecycle.md)
- [Operational monitoring](docs/monitoring.md)

## Security

Never commit `.env.local`, credentials, signed URLs, private object keys,
customer PII, form bodies, session/reset/private-showing tokens, or financial
documents. Public mutations are server-validated and durably rate limited.
Admin authorization and document ownership checks must remain server-side.
