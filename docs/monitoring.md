# Operational monitoring

The protected `/api/cron/operational-health` audit runs daily at 09:47 UTC
(05:47 Puerto Rico). It detects stale queue claims, a failed-queue threshold,
missing availability intents, and missing daily heartbeats from email processing
or authentication cleanup.

Conditions are fingerprinted in Neon. A changed incident or an incident older
than the six-hour cooldown emits one structured `operational_health_alert`
event; healthy checks emit no alert. Recovery resolves the stored state. This
avoids recursive email alerts when the email queue itself is unhealthy.

Configure a Vercel log alert for:

- `operational_health_alert`
- `operational_health_audit_failed`
- unhandled Function errors and 5xx rate
- deployment health failures

Vercel cron failure visibility is the independent alert channel. Resend and
Neon provider alerts remain useful provider-level signals. Structured events
must contain condition codes/error classes only, never PII, form bodies, object
keys, document names, or tokens.

