# Pay to complete — the v1.6.0 document set

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Specs & design briefs** › Pay-to-complete set · prev [PRD](PRD.md) · next [Research](RESEARCH.md)

<!-- docs-nav:end -->

Milestone [`v1.6.0 — pay to complete`](https://github.com/riolabs-ai/alignsynch/milestone/10) ·
Issues [#619](https://github.com/riolabs-ai/alignsynch/issues/619) (payment) and
[#623](https://github.com/riolabs-ai/alignsynch/issues/623) (CRUD).

Four documents, read in this order. Each one argues from the previous.

| file                       | answers                                                                                                                                                                                                  | read it when                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [RESEARCH.md](RESEARCH.md) | **what is true** — what the tree does today, what the in-flight branch exposed, how delayed charges work elsewhere, and which repo constraints decide the design before preference does                  | you want the evidence, or you doubt a premise                     |
| [PRD.md](PRD.md)           | **what we are building and why** — the problem, the state machine, R1–R10 with acceptance lines, the copy that must change, metrics, risks, and the three questions that block a _release_ (not a build) | you are deciding scope, or reviewing whether the feature is right |
| [SPEC.md](SPEC.md)         | **how it is built** — the table, the modules, the job ladder including the branch that is missing today, the refusal codes, the server-side enforcement points, rollout, and the test plan               | you are implementing or reviewing the code                        |
| [ADR.md](ADR.md)           | **what we chose and what it cost** — eleven decisions, each with the alternative it beat, its reversibility, and its consequences                                                                        | you disagree with something, or you are about to change it        |

One artifact sits beside the documents: [`mockup-pay-to-complete-v1.html`](mockup-pay-to-complete-v1.html)
draws the payer surfaces #619 asks for — the method choice at the end of the create stages, the capture
widget, and the `needs-action` band after an off-session decline. It is a mockup: no route renders it,
every string carries a source, and the strings with no source are marked for approval. Open it in a
browser; screen 8 audits itself.

## The one-paragraph version

A relationship is free to create and free to answer. A payment method is offered at the end of the create
stages and never blocks the invitation. Publishing a sheet requires a method on file, which starts a seven-day
trial; the pair completes when **both** sheets are sealed, and the charge lands from the day the trial ends —
never before both sheets are sealed, because the fee buys a completed assessment. One
fee covers every round and the relationship's original initiator always pays. A declined charge retries three
times across a week; an unpaid seal reminds at day 3 and day 10 and expires at day 14. The counterparty is
never shown billing. Every deadline is derived from a stored instant and driven by a daily cron, never by a
render.

## Status

- **Decided:** all product questions, recorded on #619 (2026-11-07).
- **Approved:** migration `0036` may reach production after a snapshot; a daily cron at 09:00 is wanted.
- **Landed:** PR #634 squash-merged as `7508f71b` (2026-11-07); `0036` applied to production after the
  `production-preserved-20261107-195905` snapshot, `db:verify` green, production serving it. Reminder
  delivery landed as #638 ([SPEC §11](SPEC.md#11-reminder-delivery--the-paymentnotice-seam-filled-638));
  remaining work is [SPEC §9](SPEC.md#9-what-remains-in-pr-634): the payer's UI.
- **Not yet answered:** the Free-plan consequence, the provider for the release, and the path for a charge that
  needs the payer present ([RESEARCH §6](RESEARCH.md#6-open-research-questions-unmeasured-carried-into-the-prd)).

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Specs & design briefs** › Pay-to-complete set · prev [PRD](PRD.md) · next [Research](RESEARCH.md)

<!-- docs-nav:end -->
