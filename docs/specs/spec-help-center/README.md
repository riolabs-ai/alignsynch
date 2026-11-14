# AlignSynch Help Center design spec

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Specs & design briefs** › Help Center design spec (handoff) · prev [Help Center — implementation brief](IMPLEMENTATION-BRIEF.md) · next [Stages](../stages.md)

<!-- docs-nav:end -->

**Version:** 1.0 · **Prepared:** 12 November 2026\
**Status:** Private page and implementation handoff

This package turns the supplied glossary into a professional, user-centered Help Center direction. It keeps AlignSynch's current business-first audience, explains the two-person flow, and makes useful product language searchable without reproducing legacy internal terminology.

## Preview

- Open [help-center.html](help-center.html) for the responsive page preview.
- [css/help-center.css](css/help-center.css) contains the visual design.
- [js/help-center.js](js/help-center.js) provides the preview's tabs, topic filters, quick links, and cross-library search.
- [GLOSSARY-CONTENT-MAP.md](GLOSSARY-CONTENT-MAP.md) records how the supplied PDF terms were adapted or omitted.
- [IMPLEMENTATION-BRIEF.md](IMPLEMENTATION-BRIEF.md) maps the design to the existing Next.js help route and its shared components.
- [images/alignsynch-logo.png](images/alignsynch-logo.png) is a local copy of the approved full AlignSynch logo.
- `reference/AlignSynch.com - Glossary v2-01-01h 2023.docx.pdf` is a bundled, unchanged source copy.

Serve this directory with a local static server if the browser blocks local CSS, JavaScript, or images. The preview's application links use the real AlignSynch paths. Its contact form is a visual prototype and displays a note instead of sending; the app implementation must reuse the connected form already mounted on `/help`.

## Audience and page intent

The page addresses people using AlignSynch together, with business and corporate relationships first. Personal upskilling, personal relationships, and friendships remain available as secondary paths. Counselors, therapists, and coaches appear in one quiet note about optional reflection alongside existing support.

The glossary PDF is vocabulary source material, not a current product spec. The preview highlights terms that help people choose a template, answer questions, and understand their report. It leaves historical branded-coach, stage-code, and billing-currency concepts out of the public help experience.

## Product flow

One person starts and invites the other. Both answer the same Aspects privately. Each reviews and explicitly accepts their own answers. The shared report opens after both accept.

## Package map

| File                      | Purpose                                                                         |
| ------------------------- | ------------------------------------------------------------------------------- |
| `help-center.html`        | Complete static design preview.                                                 |
| `css/help-center.css`     | Responsive brand styling and interaction states.                                |
| `js/help-center.js`       | Tab navigation, FAQ / glossary filters, search results, and anchor handling.    |
| `GLOSSARY-CONTENT-MAP.md` | Selected definitions, wording decisions, and exclusions from the old reference. |
| `IMPLEMENTATION-BRIEF.md` | Team handoff for integrating the page into the current app.                     |
| `reference/`              | Original glossary PDF, retained for traceability.                               |

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Specs & design briefs** › Help Center design spec (handoff) · prev [Help Center — implementation brief](IMPLEMENTATION-BRIEF.md) · next [Stages](../stages.md)

<!-- docs-nav:end -->
