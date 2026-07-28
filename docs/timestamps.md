# Timestamp inventory and migration policy

The lead, queue, authentication, rate-limit, monitoring, and typed-form
migrations use `timestamptz` with server-side `now()` defaults. Historical
property and testimonial tables predate the migration catalog and may contain
legacy timestamp definitions.

This release does not rewrite historical timestamps. Such a rewrite could
change the meaning of values entered under Puerto Rico local time. Before any
future conversion:

1. inventory data type, default, nullability, and observed timezone;
2. identify every reader/writer and export;
3. agree on the historical interpretation;
4. backfill on an isolated Neon branch;
5. compare aggregate boundary dates;
6. deploy a staged read/write transition.

The sitemap now uses a property `updated_at` value when available and otherwise
the truthful creation timestamp. Static pages omit `lastModified` rather than
fabricating a current request time.

