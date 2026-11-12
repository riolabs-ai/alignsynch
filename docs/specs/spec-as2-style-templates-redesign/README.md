# AlignSynch relationship templates redesign

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Product** › AS2 templates redesign (handoff) · prev [AS2 redesign — asset sources and credits](../spec-as2-style-home-redesign/ASSET-SOURCES.md) · next [AS2 templates redesign — implementation brief](IMPLEMENTATION-PROMPT.md)

<!-- docs-nav:end -->

This is a standalone review bundle for the public Templates listing and the reusable AlignSynch record-card language.

- Open `templates-listing-redesign.html` for the simplified public catalogue.
- Open `catalogue-components.html` to compare template, relationship, list-row, and detail-page patterns together.
- `css/templates-redesign.css` contains the shared token and public-page styling; `css/component-patterns.css` styles the component specimen.
- images/two-party-mark.svg is the small shared two-person mark. images/icons/ contains seven relationship-area outline icons for catalog and record cards.
- images/hero-connection-1536.webp is the optimized hero photo; a 768px variant serves smaller screens and the source PNG is the fallback.
- `images/alignsynch-logo.png` is the full AlignSynch logo copied from the approved home-page bundle.
- `reference/` contains the four app screenshots supplied for this design iteration.
- `CATALOG-UI-SYSTEM.md` defines the reusable design rules and rollout map.
- `IMPLEMENTATION-PROMPT.md` is the React and Tailwind CSS v3 handoff for the app team.

The listing uses all **27 currently purchasable relationship templates** from the current product catalogue: names, roles, and Aspect counts. A small search field filters by relationship, role, or authored description; the sticky realm menu jumps to the seven catalogue groups. Cards use a flat, realm-tinted outline SVG cover, a short identity/facts block, and one clear `Use template` action. Membership details appear once above the list instead of repeating across every card. Two cards offer a worked example because those are the only templates with authored demos.

The visual language follows the new home-page spec: full logo, graphite with restrained cyan and green accents, the same system-font stack, quiet borders, and flat pale surfaces. The split hero keeps its headline, explanation, actions, and framed photo visible together. A short How AlignSynch works section follows immediately, using a real Staff–Manager Aspect; the transparent header settles onto a solid surface after the hero. Catalog and workspace cards use realm-specific professional outline icons rather than initials.

The header and footer in the HTML are static stand-ins for reviewing the whole page. The React implementation should inherit the existing shared marketing header, navigation, newsletter, footer, and account state from the app layout.

The package is a design reference, not a deployment. Its card-start links show the intended selection-preserving route shape (`/register?template=<slug>`); the current public CTA goes to `/register` without carrying the selected template. The implementation brief calls that out as a conversion-flow improvement. The UI-system notes map the reusable treatment onto existing card and detail primitives; app source itself has not been changed.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Product** › AS2 templates redesign (handoff) · prev [AS2 redesign — asset sources and credits](../spec-as2-style-home-redesign/ASSET-SOURCES.md) · next [AS2 templates redesign — implementation brief](IMPLEMENTATION-PROMPT.md)

<!-- docs-nav:end -->
