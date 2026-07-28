# Security and privacy operations

## Browser policy

The application sends `nosniff`, a restrictive referrer policy, Permissions
Policy, `X-Frame-Options: DENY`, and a Content Security Policy in report-only
mode. Report-only is deliberate: Next.js and the three analytics providers use
runtime scripts that must be observed in Production before enforcement.

Review browser CSP reports and Vercel logs for at least one normal release
cycle. Remove unused origins, replace inline allowances with a maintained nonce
strategy where feasible, then promote the policy to
`Content-Security-Policy`. `frame-ancestors 'none'`, `object-src 'none'`,
`base-uri 'self'`, and `form-action 'self'` are the intended enforced baseline.
Cloudflare owns HSTS at the edge; verify it there before duplicating it.

## Analytics policy

- Admin and tokenized Private Showing paths are excluded.
- Public forms carrying identity, broker, comment, or document information use
  `data-clarity-mask="true"`.
- Analytics events contain route/workflow labels only, never form bodies,
  contact values, filenames, object keys, or tokens.
- Public URLs must not contain customer identity or document values.
- Consent requirements depend on the final business/legal policy for Puerto
  Rico and should be reviewed outside this technical implementation.

## Logging

Log stable event names, workflow, retryability, environment, and redacted
aggregate identifiers. Never log passwords, session/reset/private-link tokens,
names, email, phone, comments, filenames, raw R2 keys, signed URLs, or form
bodies.

