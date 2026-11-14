# Research specifications

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Specs & design briefs** › Specifications index · prev [Prototype wiring](prototype-wiring.md) · next [AS2 redesign — asset sources and credits](spec-as2-style-home-redesign/ASSET-SOURCES.md)

<!-- docs-nav:end -->

These are research specifications produced during a drift review of the two documents in `docs/`
(the glossary and the website specification PDF) against the build. Each one takes a single open
question, surveys what the accessibility, design-system and survey-methodology literature says about
it, states a recommendation, and records the alternatives that were rejected and why. **They are
recommendations, not decisions already taken** — nothing here is built, and where a choice carries a
product or schema consequence the decision still belongs to §4 of `docs/operations/spec-drift.md`.

| file                                             | one line                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| [`ux-input.md`](ux-input.md)                     | The answer input: a five-segment radio group over the spec's slider — accessibility, cost and survey-method evidence.    |
| [`ux-report.md`](ux-report.md)                   | The Gap report: three named groups per Aspect, verdict summary first, no composite "alignment score".                    |
| [`ux-stages.md`](ux-stages.md)                   | The stage display: no stepper — one derived status sentence, with Aligned shown as the report's verdict.                 |
| [`flow-reinvite.md`](flow-reinvite.md)           | Expired invitations: one action, re-invite (revoke-and-replace), with no void and no delete.                             |
| [`flow-emails.md`](flow-emails.md)               | The email lifecycle: the two senders that exist (invitation, unlock) are the complete set; ship no new types.            |
| [`catalogue.md`](catalogue.md)                   | The template catalogue: six entries — five playable, one blank starting point — in three categories, with no search.     |
| [`maintenance-fields.md`](maintenance-fields.md) | Relationship maintenance fields: keep today's create form, add one optional relationship name pre-filled from the title. |

## Design and audience handoffs

| Package                                                                             | Use                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`spec-help-center/`](spec-help-center/README.md)                                   | Private Help Center redesign that adapts the supplied glossary into searchable answers, guides, and a plain-language relationship glossary.                  |
| [`spec-design-page-rel-templates-v2/`](spec-design-page-rel-templates-v2/README.md) | **Current package.** V2 combines the business-first home-page design and private company/app profile with one audience direction and implementation handoff. |
| [`spec-as2-style-home-redesign/`](spec-as2-style-home-redesign/README.md)           | Business-first home-page redesign, audience hierarchy, and React/Tailwind implementation brief.                                                              |
| [`spec-design-page-rel-templates/`](spec-design-page-rel-templates/README.md)       | Private brand and audience profile page with reusable company and app descriptions.                                                                          |

### Held outside the repository

An artefact is not cloned with this repository when it is too large to be worth every contributor's
checkout, or when it is private by policy. These live in the owner's `project-spec/` directory,
beside the checkout, and are named here so they stay findable:

| Artefact                                            | Size     | Why it is out                                                                                                 |
| --------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `AlignSynch-Logged-In-Webapp-User-Guide.docx`       | 10.87 MB | Word manual — too large to version a copy per clone.                                                          |
| `AlignSynch-Member-Experience-Manual-Volume-1.docx` | 7.16 MB  | Word manual — same reason.                                                                                    |
| `alignsynch_home.jpg`                               | 3.08 MB  | The supplied home-page screenshot, referenced by both home-redesign packages.                                 |
| `AUDIENCE-AND-POSITIONING.md`                       | 6.4 KB   | Private copy handoff; kept out of the **public** repository by [`.gitignore`](../../.gitignore), not by size. |

`project-spec/` is not under version control: it has no git history and no remote backup, so the
owner's disk is the only copy. The manuals were committed here once and taken back out for that
reason — a handbook is read, not cloned.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Specs & design briefs** › Specifications index · prev [Prototype wiring](prototype-wiring.md) · next [AS2 redesign — asset sources and credits](spec-as2-style-home-redesign/ASSET-SOURCES.md)

<!-- docs-nav:end -->
