# AlignSynch v2 · Onboarding basics: public Templates catalog, public template page, Pricing → template pick, Counterparty join

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Onboarding basics v2 (handoff) · prev [Create Relationship wizard v2 — asset sources](../01-spec-design-page-wizard-v2/ASSET-SOURCES.md) · next [Onboarding basics v2 — audience and positioning](AUDIENCE-AND-POSITIONING.md)

<!-- docs-nav:end -->

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Onboarding basics: public Templates catalog, public template page, Pricing → template pick, Counterparty join** · prev [01-spec-design-page-wizard-v2](../01-spec-design-page-wizard-v2/README.md) · next [03-spec-design-page-relationship-detail-v2](../03-spec-design-page-relationship-detail-v2/README.md)

<!-- bundle-nav:end -->

**Priority:** **P0** · **Issues:** [#1127](https://github.com/riolabs-ai/alignsynch/issues/1127) visitor conversion, [#1125](https://github.com/riolabs-ai/alignsynch/issues/1125) Counterparty join (epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119)) · **Prepared:** 2026-11-16 · **Repo path:** `docs/specs/v2-bundles/02-spec-design-page-onboarding-v2/`

This folder is the self-contained handoff for the approved v2 Onboarding basics: public Templates catalog, public template page, Pricing → template pick, Counterparty join.

Onboarding basics are **P0**: the public Templates catalog (`/relationship-templates`, replacing `/relationship-types` with a redirect), the public template page that leads into Create Relationship, Pricing (every plan goes to a template pick, never to payment), and the three-step Counterparty join. The plan chosen on Pricing shows at wizard Stage 5 (owner decision, 2026-11-16).

- Open `relationship-templates.html` for the public catalog (`?from=pricing&plan=family` shows the Step 1 of 2 banner).
- `relationship-template-public.html` is the public template page.
- `pricing.html` is Pricing.
- `counterparty-join.html?step=1|2|3` is the invitee's join flow.
- `AUDIENCE-AND-POSITIONING.md` records the audience hierarchy and one open positioning conflict.
- `css/tokens.css` holds the `:root` custom properties (they port into `app/globals.css`); `js/tw-config.js` is the Tailwind theme (it ports 1:1 into `tailwind.config.ts` `theme.extend`). Page styling is Tailwind utility classes in the HTML; there is no other page CSS.
- `js/proto.js` is preview behaviour only; it is not shipped.
- `images/` holds the AlignSynch icon and logo. `reference/` holds the 390 and 1280 (and some 1920) renders of every state.
- `IMPLEMENTATION-PROMPT.md` is the detailed React, Next.js and Tailwind CSS v3 team brief.
- `ASSET-SOURCES.md` records where each bundled file came from.

The preview is static HTML. The Tailwind CDN script (`3.4.17`) and the Inter web font load from the network; everything else is local and relative. The header, sidebar and the dashed "Prototype Only" bar are visual references; the live app uses its existing shared React shell, and the prototype bar is dropped.

To preview, serve this folder with any static HTTP server (for example `python3 -m http.server`) and open `relationship-templates.html`. Links to pages in sibling bundles use `../<bundle>/…` and resolve when all bundles sit side by side, as in the `bundles/` folder.

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Onboarding basics: public Templates catalog, public template page, Pricing → template pick, Counterparty join** · prev [01-spec-design-page-wizard-v2](../01-spec-design-page-wizard-v2/README.md) · next [03-spec-design-page-relationship-detail-v2](../03-spec-design-page-relationship-detail-v2/README.md)

<!-- bundle-nav:end -->

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Onboarding basics v2 (handoff) · prev [Create Relationship wizard v2 — asset sources](../01-spec-design-page-wizard-v2/ASSET-SOURCES.md) · next [Onboarding basics v2 — audience and positioning](AUDIENCE-AND-POSITIONING.md)

<!-- docs-nav:end -->
