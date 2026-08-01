# BorikiPR multilingual SEO policy

Spanish (`es-PR`) remains the default and source language. Existing Spanish
URLs do not move. English uses `/en`, `/en/listings`, and the corresponding
localized static routes; property slugs remain identical.

## Canonicals and language alternates

Every public page self-canonicalizes in its active language. When
`MULTILINGUAL_ENABLED=true`, equivalent public pages expose `es-PR`, `en-US`,
and `x-default` alternates. `x-default` points to Spanish because it is the
site's default public experience. Private, Admin, API, tokenized, and
transactional routes are not part of this alternate system.

With the flag disabled, Spanish pages emit only their Spanish canonical. They
do not expose `/en` alternates, the sitemap is Spanish-only, and the English
route group returns 404.

## English property indexability

An English property detail is indexable only when both approved fields—title
and description—are publishable: `ready`, non-empty, and generated from the
current Spanish source hash. Otherwise it remains usable with field-level
Spanish fallback but emits `noindex, follow` and is excluded from the sitemap.
Its canonical remains the English URL; it is not redirected or canonicalized
back to Spanish. `robots.txt` does not globally block English because crawlers
must be able to observe page-level directives.

Static English pages are indexable when the feature is enabled. Home,
Listings, and Testimonials may contain limited Spanish dynamic fallback while
their substantial interface and page purpose remain English.

## Sitemap and structured data

The disabled sitemap performs no translation-table reads. Enabled generation
loads all public properties, then fetches title/description translation
coverage in one batch. Complete English properties and both language
alternates are included; incomplete English properties and their alternate
references are excluded.

Page and breadcrumb URLs are locale-specific. The real-world Erickson Real
Estate entity keeps the stable identifier
`https://borikipr.com/#real-estate-agent` across languages. Property facts,
prices, USD currency, measurements, municipalities, sectors, and images are
not translated. An incomplete English property may still emit accurate JSON-LD
matching its visible fallback content; `noindex` remains the indexing control.

## Rollout prerequisites

Before activation: apply and audit migrations 0019/0020, verify translation
coverage, approve worker/provider operations, complete an isolated browser SEO
review, deploy with the flag disabled, and then activate through the approved
Phase 6 process. Sitemap discovery occurs only after activation. Do not submit
or request indexing before that point.

After launch, use the existing Search Console domain property to review live
canonicals, language alternates, sitemap discovery, indexed/noindex property
coverage, and structured-data enhancement reports. A separate Search Console
property for `/en` is not required. Known limitation: search engines decide
whether to honor alternates and indexing requests; the application can only
emit consistent signals.
