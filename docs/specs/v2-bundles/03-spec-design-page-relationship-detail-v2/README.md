# AlignSynch v2 · Relationship Detail (every state, both roles)

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Relationship Detail v2 (handoff) · prev [Onboarding basics v2 — asset sources](../02-spec-design-page-onboarding-v2/ASSET-SOURCES.md) · next [Relationship Detail v2 — implementation brief](IMPLEMENTATION-PROMPT.md)

<!-- docs-nav:end -->

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Relationship Detail (every state, both roles)** · prev [02-spec-design-page-onboarding-v2](../02-spec-design-page-onboarding-v2/README.md) · next [04-spec-design-page-align-v2](../04-spec-design-page-align-v2/README.md)

<!-- bundle-nav:end -->

**Priority:** P1 · **Issues:** [#1124](https://github.com/riolabs-ai/alignsynch/issues/1124), [#1121](https://github.com/riolabs-ai/alignsynch/issues/1121) (epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119)) · **Prepared:** 2026-11-16 · **Repo path:** `docs/specs/v2-bundles/03-spec-design-page-relationship-detail-v2/`

This folder is the self-contained handoff for the approved v2 Relationship Detail (every state, both roles).

Relationship Detail in every state for both roles: draft, invite sent, joined, waiting, live, trial ended (paused) and the extra week. The bundled HTML has state and role links in its "Prototype Only" bar.

- Open `relationship-detail.html` (`?state=…&role=initiator|counterparty`, tab hashes such as `#payment`).
- `css/tokens.css` holds the `:root` custom properties (they port into `app/globals.css`); `js/tw-config.js` is the Tailwind theme (it ports 1:1 into `tailwind.config.ts` `theme.extend`). Page styling is Tailwind utility classes in the HTML; there is no other page CSS.
- `js/proto.js` is preview behaviour only; it is not shipped.
- `images/` holds the AlignSynch icon and logo. `reference/` holds the 390 and 1280 (and some 1920) renders of every state.
- `IMPLEMENTATION-PROMPT.md` is the detailed React, Next.js and Tailwind CSS v3 team brief.
- `ASSET-SOURCES.md` records where each bundled file came from.

The preview is static HTML. The Tailwind CDN script (`3.4.17`) and the Inter web font load from the network; everything else is local and relative. The header, sidebar and the dashed "Prototype Only" bar are visual references; the live app uses its existing shared React shell, and the prototype bar is dropped.

To preview, serve this folder with any static HTTP server (for example `python3 -m http.server`) and open `relationship-detail.html`. Links to pages in sibling bundles use `../<bundle>/…` and resolve when all bundles sit side by side, as in the `bundles/` folder.

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Relationship Detail (every state, both roles)** · prev [02-spec-design-page-onboarding-v2](../02-spec-design-page-onboarding-v2/README.md) · next [04-spec-design-page-align-v2](../04-spec-design-page-align-v2/README.md)

<!-- bundle-nav:end -->

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Relationship Detail v2 (handoff) · prev [Onboarding basics v2 — asset sources](../02-spec-design-page-onboarding-v2/ASSET-SOURCES.md) · next [Relationship Detail v2 — implementation brief](IMPLEMENTATION-PROMPT.md)

<!-- docs-nav:end -->
