# AlignSynch home redesign package

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Specs & design briefs** › AS2 home redesign (handoff) · prev [AS2 home redesign — implementation brief](IMPLEMENTATION-PROMPT.md) · next [AS2 catalogue UI system](../spec-as2-style-templates-redesign/CATALOG-UI-SYSTEM.md)

<!-- docs-nav:end -->

This folder is the self-contained handoff for the approved home-page redesign.

The audience hierarchy is business and corporate relationships first, personal growth and personal relationships/friendships second, with a brief callout for counselors, therapists, and coaches. `AUDIENCE-AND-POSITIONING.md` is the copy source for this direction, the story, profile descriptions, CTAs, and claim boundaries. The page and React handoff should follow it. AlignSynch is not a clinical assessment, diagnosis, therapy service, or practitioner platform.

- Open `homepage-redesign.html` for the browser-ready page.
- `css/homepage-redesign.css` contains the page styles.
- `images/` contains the logo and four locally bundled page photos.
- The supplied source screenshot, `alignsynch_home.jpg`, is held outside this repository in `project-spec/`, not committed with this package.
- `IMPLEMENTATION-PROMPT.md` is the detailed React and Tailwind CSS v3 team brief.
- `AUDIENCE-AND-POSITIONING.md` records the intended audience hierarchy and reusable copy direction.
- `ASSET-SOURCES.md` records the source URLs for the bundled images.

The preview is static HTML. Its header, newsletter form, footer, and hard-coded version are visual references; the live app should use its existing shared React components for those pieces.

To preview from this directory, serve the folder with any static HTTP server and open `homepage-redesign.html`. The external routes in the header and footer are intended for the live app.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Specs & design briefs** › AS2 home redesign (handoff) · prev [AS2 home redesign — implementation brief](IMPLEMENTATION-PROMPT.md) · next [AS2 catalogue UI system](../spec-as2-style-templates-redesign/CATALOG-UI-SYSTEM.md)

<!-- docs-nav:end -->
