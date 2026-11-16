# AlignSynch v2 · Design system: tokens, component sheet, shared modal/toast/kebab, flow map

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Design system: tokens, component sheet, shared modal/toast/kebab, flow map** · prev [08-spec-design-page-payment-v2](../08-spec-design-page-payment-v2/README.md) · next [10-spec-design-page-assessment-v2](../10-spec-design-page-assessment-v2/README.md)

<!-- bundle-nav:end -->

**Priority:** **P0 (dependency)** · **Issues:** [#1120](https://github.com/riolabs-ai/alignsynch/issues/1120) (epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119)) · **Prepared:** 2026-11-16 · **Repo path:** `docs/specs/v2-bundles/09-spec-design-system-tokens-v2/`

This folder is the self-contained handoff for the approved v2 Design system: tokens, component sheet, shared modal/toast/kebab, flow map.

The shared design system every bundle consumes: tokens, the component sheet, the shared interaction patterns (one neutral modal, one toast, one kebab) and the clickable flow map. Land these first (they are a dependency of the P0 bundles).

- Open `baseline.html` for the token and component sheet.
- `patterns.html` demonstrates the shared modal, toast and kebab (built for this bundle from the prototype's `AS.modal`, `AS.toast` and `kebab()`).
- `index.html` is the clickable flow map; it links into every sibling bundle.
- `css/tokens.css` holds the `:root` custom properties (they port into `app/globals.css`); `js/tw-config.js` is the Tailwind theme (it ports 1:1 into `tailwind.config.ts` `theme.extend`). Page styling is Tailwind utility classes in the HTML; there is no other page CSS.
- `js/proto.js` is preview behaviour only; it is not shipped.
- `images/` holds the AlignSynch icon and logo. `reference/` holds the 390 and 1280 (and some 1920) renders of every state.
- `IMPLEMENTATION-PROMPT.md` is the detailed React, Next.js and Tailwind CSS v3 team brief.
- `ASSET-SOURCES.md` records where each bundled file came from.

The preview is static HTML. The Tailwind CDN script (`3.4.17`) and the Inter web font load from the network; everything else is local and relative. The header, sidebar and the dashed "Prototype Only" bar are visual references; the live app uses its existing shared React shell, and the prototype bar is dropped.

To preview, serve this folder with any static HTTP server (for example `python3 -m http.server`) and open `baseline.html`. Links to pages in sibling bundles use `../<bundle>/…` and resolve when all bundles sit side by side, as in the `bundles/` folder.

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Design system: tokens, component sheet, shared modal/toast/kebab, flow map** · prev [08-spec-design-page-payment-v2](../08-spec-design-page-payment-v2/README.md) · next [10-spec-design-page-assessment-v2](../10-spec-design-page-assessment-v2/README.md)

<!-- bundle-nav:end -->
