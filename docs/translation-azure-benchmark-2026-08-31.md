# Azure Translator F0 quality benchmark — 2026-08-31

This report-only benchmark sent 14 approved representative Borikí strings in
one batch request to the dedicated `boriki-translator-f0` resource. It wrote no
database rows, translation jobs, revisions, provider usage buckets, environment
variables, or production configuration.

- Source locale: Borikí `es-PR`, mapped to Azure `es`
- Target locale: Borikí `en-US`, mapped to Azure `en`
- HTTP result: 200
- Source characters: 609 Unicode code points
- Requests: 1 batch request
- Result: 10 PASS, 3 REVIEW, 1 FAIL

| Sample | Azure output | Result | Assessment |
| --- | --- | --- | --- |
| Casa con vista al mar en Ponce | Ocean View House in Ponce | PASS | Natural title; place name preserved. |
| Hermosa residencia de dos niveles con balcón y vista al mar. / Incluye tres habitaciones, dos baños y marquesina para dos vehículos. / Ubicada cerca de escuelas, comercios y vías principales. | Beautiful split-level residence with balcony and ocean view. / It includes three bedrooms, two bathrooms and a canopy for two vehicles. / Located near schools, shops and main roads. | REVIEW | Meaning and line structure are mostly retained, but Puerto Rico `marquesina` should be `carport`, not `canopy`; `dos niveles` does not necessarily mean split-level. |
| Bajo contrato | Under contract | PASS | Correct real-estate status. |
| Registro prioritario | Priority Registration | PASS | Matches the established product concept. |
| Perfil del comprador | Buyer Profile | PASS | Matches established Borikí copy. |
| Responsable del listado | Responsible for the listing | REVIEW | Understandable but less natural than the established `Listing representative`. |
| Corredor(a) de Bienes Raíces · Lic. C-25961 | Real Estate Broker · Lic. C-25961 | PASS | Role and license identifier preserved. |
| Vendedor(a) de Bienes Raíces · Lic. V-12345 | Real Estate Salesperson · Lic. V-12345 | PASS | Role and license identifier preserved. |
| Casa expandible en Coto Laurel | Expandable house in Coto Laurel | PASS | Meaning and place name preserved; `expandable home` remains the preferred product wording. |
| Finca de 5 cuerdas en Guayanilla | 5 Acres Farm in Guayanilla | FAIL | `cuerda` is a Puerto Rico land unit and is not exactly one acre; silently changing the unit is materially inaccurate. |
| Contrato de compraventa | Purchase and sale contract | PASS | Accepted real-estate/legal wording. |
| Propiedad opcionada / bajo contrato | Optioned/Contract Property | REVIEW | Awkward and ambiguous; preferred controlled wording is `Under option / under contract`. |
| Hacienda Monte Carmelo, Puerto Rico — $325,000 | Hacienda Monte Carmelo, Puerto Rico — $325,000 | PASS | Proper nouns, punctuation, and amount preserved. |
| Solicita información sobre esta propiedad y coordina una visita. | Request information about this property and arrange a viewing. | PASS | Natural CTA with meaning preserved. |

## Terminology decision

The general translation quality is sufficient for a controlled canary, but raw
provider output is not yet approved for unrestricted production use. A small,
deterministic application terminology layer is preferable to introducing a
complex custom translation model at Borikí's current scale.

The following mappings need human approval before Phase 24.2:

- `Responsable del listado` → `Listing representative`
- `marquesina` → `carport` in Puerto Rico property context
- `cuerda(s)` → preserve `cuerda(s)` rather than silently converting to acres
- `opcionada` → `under option`
- `casa expandible` → `expandable home`

Existing current/ready Google translations remain authoritative and were not
sent to Azure or modified by this benchmark.
