# Pay to complete — the v1.6.0 document set

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

## The one-paragraph version

A relationship is free to create and free to answer. A payment method is offered at the end of the create
stages and never blocks the invitation. Publishing a sheet requires a method on file, which starts a seven-day
trial; the charge lands when the trial ends or when both sheets seal, and the Gap report opens on payment. One
fee covers every round and the relationship's original initiator always pays. A declined charge retries three
times across a week; an unpaid seal reminds at day 3 and day 10 and expires at day 14. The counterparty is
never shown billing. Every deadline is derived from a stored instant and driven by a daily cron, never by a
render.

## Status

- **Decided:** all product questions, recorded on #619 (2026-11-07).
- **Approved:** migration `0036` may reach production after a snapshot; a daily cron at 09:00 is wanted.
- **In flight:** PR #634 — see [SPEC §9](SPEC.md#9-what-remains-in-pr-634) for the exact remaining work.
- **Not yet answered:** the Free-plan consequence, the provider for the release, and the path for a charge that
  needs the payer present ([RESEARCH §6](RESEARCH.md#6-open-research-questions-unmeasured-carried-into-the-prd)).
