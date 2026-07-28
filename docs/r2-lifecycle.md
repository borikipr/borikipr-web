# R2 lifecycle and reconciliation

## Object classes

- `propiedades/`: public property media. An unreferenced object is eligible only
  after a seven-day safety delay and explicit reconciliation apply mode.
- `testimonios/`: public testimonial media under the same rule.
- `lead-documents/`: private financial/customer documents. Never automatically
  deleted by reconciliation, lead archival, case changes, or missing UI
  visibility.

Financial document deletion requires a separately approved retention policy,
an ownership audit, and an auditable customer-data operation. Queue attachment
reconstruction uses stable document keys and does not create another object
class.

## Reconciliation

`npm run r2:reconcile` is dry-run by default. It paginates managed prefixes and
reports aggregate missing references, orphans, duplicate references, metadata
mismatches, and redacted samples. It never prints filenames, URLs, or keys.

The only destructive mode is:

```bash
npm run r2:reconcile -- --apply --confirm=DELETE_ORPHANED_PUBLIC_MEDIA
```

It can delete only delayed, unreferenced `propiedades/` and `testimonios/`
objects. The R2 helper rejects every financial-document prefix.

