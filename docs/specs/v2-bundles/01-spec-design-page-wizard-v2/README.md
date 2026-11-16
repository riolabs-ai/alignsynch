# AlignSynch v2 · Create Relationship wizard (Stages 1–5)

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Create Relationship wizard (Stages 1–5)** · prev none · next [02-spec-design-page-onboarding-v2](../02-spec-design-page-onboarding-v2/README.md)

<!-- bundle-nav:end -->

**Priority:** **P0** · **Issues:** [#1123](https://github.com/riolabs-ai/alignsynch/issues/1123) (epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119); trial [#1115](https://github.com/riolabs-ai/alignsynch/issues/1115) / PR [#1116](https://github.com/riolabs-ai/alignsynch/pull/1116)) · **Prepared:** 2026-11-16 · **Repo path:** `docs/specs/v2-bundles/01-spec-design-page-wizard-v2/`

This folder is the self-contained handoff for the approved v2 Create Relationship wizard (Stages 1–5).

The wizard is **P0**: build it first. Owner decision of 2026-11-16, drawn in this pass 10 HTML: Stage 4 is account only, and the card-free trial sits on the Stage 5 button **Continue with 7 Days Free** (PR #1116), with the Pricing plan chip beside it. Pass 10 also adds the Aspect drawer, Add an Aspect and edit mode for draft and invited relationships. One open owner decision is flagged in the brief: does the trial start at creation (PR #1116) or at send (prototype copy)?

- Open `wizard.html` for the browser-ready page (`?stage=1..5`, `?from=my-template`, `?from=pricing&plan=family`, `?stage=1&edit=invited`).
- `css/tokens.css` holds the `:root` custom properties (they port into `app/globals.css`); `js/tw-config.js` is the Tailwind theme (it ports 1:1 into `tailwind.config.ts` `theme.extend`). Page styling is Tailwind utility classes in the HTML; there is no other page CSS.
- `js/proto.js` is preview behaviour only; it is not shipped.
- `images/` holds the AlignSynch icon and logo. `reference/` holds the 390 and 1280 (and some 1920) renders of every state.
- `IMPLEMENTATION-PROMPT.md` is the detailed React, Next.js and Tailwind CSS v3 team brief.
- `ASSET-SOURCES.md` records where each bundled file came from.

The preview is static HTML. The Tailwind CDN script (`3.4.17`) and the Inter web font load from the network; everything else is local and relative. The header, sidebar and the dashed "Prototype Only" bar are visual references; the live app uses its existing shared React shell, and the prototype bar is dropped.

To preview, serve this folder with any static HTTP server (for example `python3 -m http.server`) and open `wizard.html`. Links to pages in sibling bundles use `../<bundle>/…` and resolve when all bundles sit side by side, as in the `bundles/` folder.

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Create Relationship wizard (Stages 1–5)** · prev none · next [02-spec-design-page-onboarding-v2](../02-spec-design-page-onboarding-v2/README.md)

<!-- bundle-nav:end -->
