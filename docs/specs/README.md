# Research specifications

These are research specifications produced during a drift review of the two documents in `docs/`
(the glossary and the website specification PDF) against the build. Each one takes a single open
question, surveys what the accessibility, design-system and survey-methodology literature says about
it, states a recommendation, and records the alternatives that were rejected and why. **They are
recommendations, not decisions already taken** — nothing here is built, and where a choice carries a
product or schema consequence the decision still belongs to §4 of `docs/SPEC-DRIFT.md`.

| file                                             | one line                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| [`ux-input.md`](ux-input.md)                     | The answer input: a five-segment radio group over the spec's slider — accessibility, cost and survey-method evidence.    |
| [`ux-report.md`](ux-report.md)                   | The Gap report: three named groups per Aspect, verdict summary first, no composite "alignment score".                    |
| [`ux-stages.md`](ux-stages.md)                   | The stage display: no stepper — one derived status sentence, with Aligned shown as the report's verdict.                 |
| [`flow-reinvite.md`](flow-reinvite.md)           | Expired invitations: one action, re-invite (revoke-and-replace), with no void and no delete.                             |
| [`flow-emails.md`](flow-emails.md)               | The email lifecycle: the two senders that exist (invitation, unlock) are the complete set; ship no new types.            |
| [`catalogue.md`](catalogue.md)                   | The template catalogue: six entries — five playable, one blank starting point — in three categories, with no search.     |
| [`maintenance-fields.md`](maintenance-fields.md) | Relationship maintenance fields: keep today's create form, add one optional relationship name pre-filled from the title. |
