# Borikí Sign visual parity QA

## Reference evidence

- DocuSign audit: `docusign-full-synthetic-e2e/AUDIT.md`
- Reference captures: completed signer state, completed envelope detail/actions, template roles.
- Borikí captures: signing home, upload, recipient/routing flow, field editor, review, templates, completion, and mobile field sheet.

## Combined comparison findings

- The editor now follows the mature document-tool hierarchy: compact tools, dominant PDF, contextual properties, and one clear forward action.
- Field ownership remains visible as text and is not encoded only by color.
- Borikí intentionally improves the DocuSign completion state by removing account creation, promotion, unrelated errors, and technical evidence.
- The mobile editor uses a dedicated bottom sheet instead of compressing three desktop columns.
- Templates use compact responsive cards and never copy signer identities or evidence.

## Responsive checks

- 360 px: no horizontal document overflow; field bottom sheet reachable and fully contained.
- 390 px: no horizontal document overflow.
- 412 px: no horizontal document overflow.
- 1440 px: editor palette, document canvas, and properties remain visually distinct; PDF is the dominant surface.

## Accessibility checks

- Field tools retain accessible names and click-to-add alternatives.
- Ownership is exposed in labels and selected-field details.
- Signature adoption uses dialog semantics, Escape close, focus containment, focus return, and body scroll lock.
- Mobile sheet has an explicit close control and backdrop.
- Required-field navigation reports progress in text and moves focus to the next field.

## Final result

final result: passed
