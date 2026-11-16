# AlignSynch v2 · Account menu and Account Settings

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Account menu and Account Settings** · prev [10-spec-design-page-assessment-v2](../10-spec-design-page-assessment-v2/README.md) · next none

<!-- bundle-nav:end -->

**Priority:** P1 · **Issues:** [#1136](https://github.com/riolabs-ai/alignsynch/issues/1136) (epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119)) · **Prepared:** 2026-11-16 · **Repo path:** `docs/specs/v2-bundles/11-spec-design-page-account-settings-v2/`

This folder is the self-contained handoff for the approved v2 Account menu and Account Settings.

The header account menu on every signed-in page and the Account Settings page (pass 10).

- Open `settings.html`; click the avatar for the account menu.
- `css/tokens.css` holds the `:root` custom properties (they port into `app/globals.css`); `js/tw-config.js` is the Tailwind theme (it ports 1:1 into `tailwind.config.ts` `theme.extend`). Page styling is Tailwind utility classes in the HTML; there is no other page CSS.
- `js/proto.js` is preview behaviour only; it is not shipped.
- `images/` holds the AlignSynch icon and logo. `reference/` holds the 390 and 1280 (and some 1920) renders of every state.
- `IMPLEMENTATION-PROMPT.md` is the detailed React, Next.js and Tailwind CSS v3 team brief.
- `ASSET-SOURCES.md` records where each bundled file came from.

The preview is static HTML. The Tailwind CDN script (`3.4.17`) and the Inter web font load from the network; everything else is local and relative. The header, sidebar and the dashed "Prototype Only" bar are visual references; the live app uses its existing shared React shell, and the prototype bar is dropped.

To preview, serve this folder with any static HTTP server (for example `python3 -m http.server`) and open `settings.html`. Links to pages in sibling bundles use `../<bundle>/…` and resolve when all bundles sit side by side, as in the `bundles/` folder.

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Account menu and Account Settings** · prev [10-spec-design-page-assessment-v2](../10-spec-design-page-assessment-v2/README.md) · next none

<!-- bundle-nav:end -->
