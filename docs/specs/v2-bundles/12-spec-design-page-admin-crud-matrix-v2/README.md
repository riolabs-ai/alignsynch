# AlignSynch v2 · Admin CRUD & Permissions matrix

<!-- bundle-nav:begin -->\n\n[Bundles index](../README.md) › **Admin CRUD & Permissions matrix** · prev [11-spec-design-page-account-settings-v2](../11-spec-design-page-account-settings-v2/README.md) · next none\n\n<!-- bundle-nav:end -->

**Priority:** P2 · **Issues:** [#1126](https://github.com/riolabs-ai/alignsynch/issues/1126) (epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119)) · **Prepared:** 2026-11-16 · **Repo path:** `docs/specs/v2-bundles/12-spec-design-page-admin-crud-matrix-v2/`

This folder is the self-contained handoff for the approved v2 admin CRUD & Permissions matrix.

An admin-only, read-only spec reference in the Admin rail, placed directly after Docs. It shows who may do what, whether the v2 prototype covers it, and the P0 gaps and upstream conflicts every #1119 child must honour.

- Open `admin-crud-matrix.html` for the browser-ready page. Filters are shareable in the URL (`?object=`, `?role=`, `?status=`, `?upstream=`, `?priority=`). `?broken=1` is the honest failure state (prototype only).
- `css/tokens.css` holds the `:root` custom properties (they port into `app/globals.css`); `js/tw-config.js` is the Tailwind theme (it ports 1:1 into `tailwind.config.ts` `theme.extend`). Page styling is Tailwind utility classes in the HTML; there is no other page CSS.
- `js/crud-matrix.json` is the pass 10 snapshot generated from `crud-matrix.md` (169 rows; 69 covered / 9 hinted / 46 missing). `js/crud-matrix.js` is preview render and filter behaviour; the product should parse the source file at request time, not ship this script.
- `js/proto.js` is the shared preview shell behaviour only; it is not shipped.
- `images/` holds the AlignSynch icon and logo. `reference/` holds the 390 and 1280 renders of the default, filtered and failure states.
- `IMPLEMENTATION-PROMPT.md` is the detailed React, Next.js and Tailwind CSS v3 team brief, including the `data/nav-menu.json` row, `data/pages/shell.ts` label, `content/routes.ts` entry and the `requireAdminProduct()` then `requireAdmin()` gates.
- `ASSET-SOURCES.md` records where each bundled file came from.

The preview is static HTML. The Tailwind CDN script (`3.4.17`) and the Inter web font load from the network; everything else is local and relative. The header, sidebar and any dashed "Prototype Only" bar are visual references; the live app uses its existing shared React shell, and the prototype bar is dropped.

To preview, serve this folder with any static HTTP server (for example `python3 -m http.server`) and open `admin-crud-matrix.html`. Links to pages in sibling bundles use `../<bundle>/` and resolve when all bundles sit side by side, as in the `bundles/` folder.

<!-- bundle-nav:begin -->\n\n[Bundles index](../README.md) › **Admin CRUD & Permissions matrix** · prev [11-spec-design-page-account-settings-v2](../11-spec-design-page-account-settings-v2/README.md) · next none\n\n<!-- bundle-nav:end -->
