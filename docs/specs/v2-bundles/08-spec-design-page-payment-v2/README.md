# AlignSynch v2 · Payment (standalone billing)

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Payment (standalone billing)** · prev [07-spec-design-page-chat-v2](../07-spec-design-page-chat-v2/README.md) · next [09-spec-design-system-tokens-v2](../09-spec-design-system-tokens-v2/README.md)

<!-- bundle-nav:end -->

**Priority:** P1 · **Issues:** [#1132](https://github.com/riolabs-ai/alignsynch/issues/1132), [#1121](https://github.com/riolabs-ai/alignsynch/issues/1121) (epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119)) · **Prepared:** 2026-11-16 · **Repo path:** `docs/specs/v2-bundles/08-spec-design-page-payment-v2/`

This folder is the self-contained handoff for the approved v2 Payment (standalone billing).

Standalone Payment: one trial panel per relationship, one free extra week, and a Counterparty view with no price.

- Open `payment.html` (`?role=counterparty`, `?rel=cofound#bill-cofound`).
- `css/tokens.css` holds the `:root` custom properties (they port into `app/globals.css`); `js/tw-config.js` is the Tailwind theme (it ports 1:1 into `tailwind.config.ts` `theme.extend`). Page styling is Tailwind utility classes in the HTML; there is no other page CSS.
- `js/proto.js` is preview behaviour only; it is not shipped.
- `images/` holds the AlignSynch icon and logo. `reference/` holds the 390 and 1280 (and some 1920) renders of every state.
- `IMPLEMENTATION-PROMPT.md` is the detailed React, Next.js and Tailwind CSS v3 team brief.
- `ASSET-SOURCES.md` records where each bundled file came from.

The preview is static HTML. The Tailwind CDN script (`3.4.17`) and the Inter web font load from the network; everything else is local and relative. The header, sidebar and the dashed "Prototype Only" bar are visual references; the live app uses its existing shared React shell, and the prototype bar is dropped.

To preview, serve this folder with any static HTTP server (for example `python3 -m http.server`) and open `payment.html`. Links to pages in sibling bundles use `../<bundle>/…` and resolve when all bundles sit side by side, as in the `bundles/` folder.

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Payment (standalone billing)** · prev [07-spec-design-page-chat-v2](../07-spec-design-page-chat-v2/README.md) · next [09-spec-design-system-tokens-v2](../09-spec-design-system-tokens-v2/README.md)

<!-- bundle-nav:end -->
