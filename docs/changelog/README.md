# The release blog

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Release notes** › Release blog · next [v1.17.1](v1-17-1.md)

<!-- docs-nav:end -->

`CHANGELOG.md` is the record: 8 release entries, generated from the conventional commits on `main`,
and each `## [x.y.z] - <date>` block is also the body of its GitHub Release, byte for byte. It is
correct, and it is unreadable as a story — 595 lines of commit subjects in the order they merged.

This directory is the same eight releases told as eight pages: what was painful before, what the
release does now, one diagram of the mechanism that earns it, and the screens the change landed on.
It is a **view**, not a second record.

## The rule

`CHANGELOG.md` stays the source of truth and `pnpm release:check` owns it. Nothing here retypes a
fact the entry already carries:

- **the date** — the entry's heading.
- **the tag and its URL** — the entry's version.
- **how many pull requests the entry names** — the entry's own PR links.
- **what the release changed, section by section** — the entry's bullets, verbatim.
- **the Known limits block** — the entry's Known limits, verbatim.

`scripts/changelog-view.mjs` fills those five things between `<!-- changelog-view:begin … -->`
markers, and `pnpm changelog:check` — a step in `scripts/verify.sh`, in every lane — fails when a
page and the entry disagree. The prose, the diagrams, the screenshots and the two one-line
judgements per release (its `theme` and `headline`, in `releases.json`) are authored, because a
generator cannot know what was painful before; that is the same split `docs/ui-registry.md` makes
between what the tree votes and what a person decides.

To change a fact, change the entry. To change the story, change the page.

```bash
pnpm changelog          # rewrite every generated block from CHANGELOG.md
pnpm changelog:check    # fail, naming the page and line, when one has drifted
```

## Releases

<!-- changelog-view:begin index -->
<!-- generated from CHANGELOG.md by scripts/changelog-view.mjs — edit the entry, not this block -->

### [v1.17.1](v1-17-1.md)

- **Released** 2026-11-13
- **Tag** [`v1.17.1`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.17.1)
- **Pull requests named** 8
- **Theme:** the patch the last note promised
- **Headline:** `fix(flow)` — /assessment's one-click create is the flow's door, not a publish (#957) (#964)

### [v1.17.0](v1-17-0.md)

- **Released** 2026-11-13
- **Tag** [`v1.17.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.17.0)
- **Pull requests named** 27
- **Theme:** the pay-flow ship
- **Headline:** `feat(flow)` — stage 5 is the three-step payment walk and the send it gates (#911) (#918)

### [v1.16.0](v1-16-0.md)

- **Released** 2026-11-12
- **Tag** [`v1.16.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.16.0)
- **Pull requests named** 34
- **Theme:** the relationship is a destination and the shell gets out of the way — its detail page stops being a flow step and carries its own door, the rail folds to a handle on any width, /assessments lists the member's sessions beside their relationships, and the front page, header and footer each say one thing.
- **Headline:** `fix(flow)` — stage 5 is not a dead end — payment walk, send/draft, and the template guard at stage 1 (#870) (#878)

### [v1.15.0](v1-15-0.md)

- **Released** 2026-11-12
- **Tag** [`v1.15.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.15.0)
- **Pull requests named** 4
- **Theme:** the create flow is five stages — the account becomes stage 4 and is the app's own sign-in form, the invitation becomes stage 5 and is the only place anything is sent, and the rail, the spec and the tests all count to five.
- **Headline:** `feat(flow)` — Account is stage 4 and Invite is stage 5 — the five-cell rail (#825) (#828)

### [v1.14.0](v1-14-0.md)

- **Released** 2026-11-11
- **Tag** [`v1.14.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.14.0)
- **Pull requests named** 17
- **Theme:** the public catalogue owns the relationship noun — /relationship-types replaces /templates and the worked example moves under it, every card prices the plan instead of the relationship, and one chip and one member card replace three constants and four tiles.
- **Headline:** `feat(ia)` — the worked example lives at /relationship-types/<slug>/demo (#794 follow-up) (#809)

### [v1.13.0](v1-13-0.md)

- **Released** 2026-11-11
- **Tag** [`v1.13.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.13.0)
- **Pull requests named** 9
- **Theme:** the templates directory becomes a directory — every one of the twenty-seven relationship templates gets a public page, My Templates lists only the templates a member owns, and the copy stops calling a session an instance.
- **Headline:** `feat(templates)` — every template has a page, not just a card (#782) (#782)

### [v1.12.0](v1-12-0.md)

- **Released** 2026-11-09
- **Tag** [`v1.12.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.12.0)
- **Pull requests named** 6
- **Theme:** the payment decision moves into the stage that asks for it, and the create saves a draft that pays when its opinions publish.
- **Headline:** `feat(flow)` — stage 4 walks the payment in place, and the create is a draft that pays at publish (#771)

### [v1.11.0](v1-11-0.md)

- **Released** 2026-11-09
- **Tag** [`v1.11.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.11.0)
- **Pull requests named** 4
- **Theme:** the build draws what the review approved — the create flow's panel stops at 880px, one stage foot carries [Back][Cancel] and the advance, Settings asks its two questions side by side, and an Aspect row reads 01 · grip · name · opinions · edit.
- **Headline:** `feat(flow)` — the build matches the v7 artifact — shell width, footers, Settings peers, Aspect rows (#760) (#761)

### [v1.10.0](v1-10-0.md)

- **Released** 2026-11-09
- **Tag** [`v1.10.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.10.0)
- **Pull requests named** 1
- **Theme:** the capture moves into a frame — Stripe's form mounts inside the dialog, so paying never leaves the relationship, while the membership checkout stays hosted.
- **Headline:** `feat(payment)` — the capture is an embedded form in the dialog, not a hosted link (#748) (#751)

### [v1.9.0](v1-9-0.md)

- **Released** 2026-11-09
- **Tag** [`v1.9.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.9.0)
- **Pull requests named** 5
- **Theme:** the payer can pay — a method is captured and a relationship completes, an invited counterparty answers inside the same modal, templates publish revisions instead of being destroyed, and paying still opens Stripe's own page rather than a frame.
- **Headline:** `feat(crud)` — templates publish revisions and are retired, never destroyed in use (#711) (#742)

### [v1.8.0](v1-8-0.md)

- **Released** 2026-11-08
- **Tag** [`v1.8.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.8.0)
- **Pull requests named** 16
- **Theme:** the flow conforms to its six-stage spec — Details · Settings · Aspects · Invite · Connect · Align — opens as one modal, and no action form asks for a Reason.
- **Headline:** `feat(flow)` — conform to the six-stage spec — Details · Settings · Aspects · Invite · Connect · Align (#735) (#737)

### [v1.7.0](v1-7-0.md)

- **Released** 2026-11-08
- **Tag** [`v1.7.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.7.0)
- **Pull requests named** 418
- **Theme:** the review shelf goes live — every prototype grouped by the release it ships with, with the approved six-stage flow as its first artifact.
- **Headline:** `feat(admin)` — the /admin/review shelf: the review store, the release-grouped list and the writes, with the six-stage prototype as its v5 artifact (#670) (#673) (#677)

### [v1.6.0](v1-6-0.md)

- **Released** 2026-11-07
- **Tag** [`v1.6.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.6.0)
- **Pull requests named** 6
- **Theme:** pay-to-complete: the fee moves from creation to completion, and the member rail stops asking three shelves apart.
- **Headline:** `feat(billing)` — pay-to-complete: the counterparty submits, the initiator picks a plan and pays, and the Gap opens (#619)

### [v1.5.1](v1-5-1.md)

- **Released** 2026-11-07
- **Tag** [`v1.5.1`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.5.1)
- **Pull requests named** 7
- **Theme:** the gate notices when its own evidence has aged, and the screens a real flow needed get a door.
- **Headline:** `fix(health)` — a stale platform-health record fails the gate instead of rendering as current (#599)

### [v1.5.0](v1-5-0.md)

- **Released** 2026-11-07
- **Tag** [`v1.5.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.5.0)
- **Pull requests named** 31
- **Theme:** account deletion a person can perform themselves, with the intent recorded before anything is destroyed.
- **Headline:** `feat(privacy)` — account deletion: 0033 indexes, the auth-user delete, one transactional scrub, an in-app control (#597)

### [v1.4.0](v1-4-0.md)

- **Released** 2026-11-04
- **Tag** [`v1.4.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.4.0)
- **Pull requests named** 55
- **Theme:** the operator's console — one audited write path — and relationship templates become products a member can own.
- **Headline:** an audited operations console: every write passes `act()`, every action carries a reason, and `product.admin` is a capability (#500)

### [v1.3.0](v1-3-0.md)

- **Released** 2026-11-03
- **Tag** [`v1.3.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.3.0)
- **Pull requests named** 38
- **Theme:** the two-party flow closes — create, answer blind, accept, and the Gap opens on the second acceptance.
- **Headline:** `feat(flow)` — acceptance is the completion hinge, and Steps are derived on the transition (#427)

### [v1.2.0](v1-2-0.md)

- **Released** 2026-11-02
- **Tag** [`v1.2.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.2.0)
- **Pull requests named** 64
- **Theme:** five read surfaces go live from Postgres, and every write surface says on screen that it cannot write.
- **Headline:** five read surfaces server-rendered from the database — relationships, their sessions, the template catalogue and the report (#412)

### [v1.1.0-rc1](v1-1-0-rc1.md)

- **Released** 2026-10-31
- **Tag** [`v1.1.0-rc1`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.1.0-rc1)
- **Pull requests named** 107
- **Theme:** the template becomes a product: a brand record, a parity gate, and the two-party assessment flow on six tables.
- **Headline:** `feat(db)` — six content tables, the database-backed assessment screen, and the db scripts (#145)

### [v1.0.0](v1-0-0.md)

- **Released** 2026-10-30
- **Tag** [`v1.0.0`](https://github.com/riolabs-ai/alignsynch/releases/tag/v1.0.0)
- **Pull requests named** 81
- **Theme:** one record type, two brands and no database — the webapp stops being a mock of a business nobody ran.
- **Headline:** `feat(content)` — one record type, two templates: a quiz and an assessment (#128)
<!-- changelog-view:end -->

## What the screenshots are, and are not

Every frame here comes from [`docs/assets/screens/`](../assets/screens/README.md): the current set,
captured 2026-11-07 from a production build of each brand on the demo branch, with a registry that
says which commit each file was taken at. They are **pictures of the product now**, not of the
release they sit beside — a release page from October shows today's layout of the surface that
release created, and each caption says which surface it is. Where a release changed something the
set has no frame for, the page says so rather than borrowing a nearby one.

## Reading order

Newest first, the same order as the changelog. A reader who wants the argument rather than the
history should read v1.3.0 (the flow closes), v1.4.0 (the console and the audited write) and v1.6.0
(the payment ladder) in that order: those three are where the product stops being a prototype.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Release notes** › Release blog · next [v1.17.1](v1-17-1.md)

<!-- docs-nav:end -->
