# Phase 2A PDF compatibility prototype

This code is an isolated, non-production prototype. It creates no signing routes,
database tables, R2 objects, email, or production state.

## Document classification gate

`lib/signatures/document-classification.ts` distinguishes candidate, legal-review,
and blocked documents. Every candidate remains `pending_counsel_review`. Future
production code must accept a type only when it is an `ALLOWED_CANDIDATE`, counsel
has explicitly marked it `approved_by_counsel`, and a counsel reference is present.

The configuration is not a legal determination and enables no production signing.

## Dependencies and licenses

- `pdfjs-dist` 6.2.108 - Apache-2.0 - structural inspection and rendering.
- `pdf-lib` 1.17.1 - MIT - deterministic placement and PDF finalization.
- `@pdf-lib/fontkit` 1.1.1 - MIT - embedding the local typed-signature font.
- Great Vibes Regular - SIL Open Font License 1.1 - locally bundled from the
  official Google Fonts repository at commit
  `2d85e20401920891efb7cd6272d6339685df2820`.

No font or PDF dependency is fetched at runtime.

## Prototype command

```powershell
npx tsx scripts/signatures/run-phase2a-compatibility.ts
```

Generated compatibility artifacts are written only to `tmp/pdfs/phase2a-compatibility/`.
The source fixtures are never overwritten.

The detached evidence manifest records the field-definition hash, each capture
method, the adopted value for typed signatures/initials, and a SHA-256 digest of
each complete capture payload. Drawn stroke coordinates are not duplicated into
the manifest.

## Initial MVP technical limits

- Source PDF: 3,000,000 bytes.
- Final PDF: 4,000,000 bytes.
- Pages: 25.
- Participants: 8.
- Fields: 100 total and no more than 40 for one participant.
- Drawn signature: 32 strokes and 2,000 normalized points.
- Future raster fallback: maximum 1,600 by 600 pixels and 500 KB.
- Typed signature: 120 Unicode characters.
- Initials: 8 Unicode characters.
- Ordinary text field: 500 Unicode characters.
- Server finalization budget: 45 seconds, with an application timeout below the
  Vercel Function limit.

These conservative limits keep request and response bodies below Vercel's 4.5 MB
boundary. If representative operational documents exceed them, use a separate
private Cloudflare Worker/R2 streaming gateway. The gateway would authenticate a
short-lived participant session, map opaque document IDs to R2 keys server-side,
stream only the authorized bytes, and apply `private, no-store` without exposing an
R2 object key or public bucket URL. That gateway is not implemented in Phase 2A.
