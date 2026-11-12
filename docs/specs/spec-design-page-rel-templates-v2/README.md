# AlignSynch home and audience package · V2

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Product** › V2 home and brand package (handoff) · prev [AS2 redesign — asset sources and credits](../spec-as2-style-home-redesign/ASSET-SOURCES.md) · next [V2 home page (handoff)](home/README.md)

<!-- docs-nav:end -->

**Prepared:** 12 November 2026  
**Status:** Private design and implementation handoff  
**Audience direction:** Business and corporate relationships first

This version packages the current home-page redesign with the private brand and audience profile. It combines the latest audience direction with the page reference, implementation brief, styles, and local image assets. The original spec folders remain available as prior working versions.

## Start here

- [Home-page preview](home/homepage-redesign.html) — the full page design and content flow.
- [Private brand and audience profile](brand-profile/brand-and-audience-profile.html) — company story, value proposition, audiences, calls to action, workflow, and reusable company/app descriptions.
- **Audience and positioning source** (`AUDIENCE-AND-POSITIONING.md`, an out-of-tree handoff held outside this repository) — canonical copy direction for both pages and future handoffs.
- [React and Tailwind implementation brief](home/IMPLEMENTATION-PROMPT.md) — page structure, integration map, implementation guidance, and review criteria.

## Audience hierarchy

1. **Primary:** business and corporate relationships. Address the two people in a working relationship; describe corporate use as context, not as an enterprise feature set.
2. **Secondary:** personal upskilling, personal relationships, and friendships.
3. **Supporting callout:** counselors, therapists, and coaches may use AlignSynch as an optional reflection structure alongside existing support.

AlignSynch is not positioned as a practitioner platform, clinical assessment, diagnosis, or therapy service.

## Product flow to preserve

One person starts and invites the other. Both people answer the same relationship Aspects privately, review their own answers, and explicitly accept. The shared report opens after both accept. It organizes perspectives for discussion; it does not produce a single relationship score or decide what either person should do.

## Package contents

| Path | Purpose |
| --- | --- |
| `home/homepage-redesign.html` | Responsive static preview of the complete home page. |
| `home/css/` | Home-page preview styles. |
| `home/images/` | Local logo and page photography used in the preview. |
| `home/reference/alignsynch_home.jpg` | Supplied source screenshot. |
| `home/IMPLEMENTATION-PROMPT.md` | React, Tailwind CSS v3, integration, rollout, and review brief. |
| `home/ASSET-SOURCES.md` | Local image source and attribution notes. |
| `brand-profile/brand-and-audience-profile.html` | Private, responsive company and app profile page. It includes `noindex,nofollow,noarchive`. |
| `brand-profile/css/` and `brand-profile/images/` | Profile page styling and logo. |
| `banner/README.md` | Admin notice bar: placement, the sticky offsets it moves, heights, the one link, the visibility rule, no dismiss. |
| `admin-brand/README.md` | `/admin/brand`: the eleven sections it clones from the profile page, the gate, the fixture, and the token gaps. |

The nested home and profile folders each retain a copy of the audience note so either preview can be handed off independently; the note itself is held outside this repository as an out-of-tree handoff and is not committed. The root-level audience note is the canonical copy source for this V2 package.

## Preview and privacy

Open either HTML file in a browser, or serve this folder with a local static server if the browser restricts local assets. All preview assets are bundled locally. The pages are design references; the home preview includes destination routes that are intended to resolve in the application.

This is a private working spec. It has not been wired into or published to the live application. Keep the brand-profile page private; its `noindex,nofollow,noarchive` metadata is an additional safeguard, not a publishing control.

## Implementation boundary

Use the existing AlignSynch app's shared header, footer, route constants, brand tokens, relationship data, and page-copy conventions. Keep the QuizHub experience unchanged. Treat the user's current audience direction and product flow above as authoritative when reconciling older drafts or reference material.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Product** › V2 home and brand package (handoff) · prev [AS2 redesign — asset sources and credits](../spec-as2-style-home-redesign/ASSET-SOURCES.md) · next [V2 home page (handoff)](home/README.md)

<!-- docs-nav:end -->
