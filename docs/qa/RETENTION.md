# The `qa/` capture shelf — what stays, what went, and the rule that decides

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › The qa/ capture shelf · next [The welcome tiles on /register too, #971](971-tiles/README.md)

<!-- docs-nav:end -->

`docs/qa/` is the pre-atlas evidence shelf: one directory per measurement, and for a long time
nothing governed it. `docs:check`'s only invariant is _every `.md` is indexed_, and a capture
directory with no page is outside that invariant by construction — so a directory nobody could reach
accumulated silently, 81 of them, 118.85 MB, 84 % of `docs/`. This page is the register the shelf
did not have: **every directory, its weight, and either the reason it stays or the reason it went.**

The rule is `scripts/capture-retention.mjs`. It has two callers, and neither is a comment:

| command                    | what it does                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm docs:check`          | **fails** on a capture directory the rule cannot justify, and names it with the three ways to justify it. This is the step the gate already runs, not a new one. |
| `pnpm qa:retention:prune`  | removes the directories this register marks `archived`, with their `docs.json` rows, in one run. It refuses anything the rule still keeps.                       |
| `pnpm qa:retention:report` | prints the classification the rule reaches today — for a reader, or before adding a capture                                                                      |

## The rule

A capture survives **if something can name it**, in this order:

1. **An open issue.** The directory is named for an issue that is still open (`975`, `975-d12`,
   `979-flow-entries`). The gate cannot ask GitHub — it has no network and no `gh` — so the claim is
   recorded here, in a row whose reason opens `open issue #<n>`, and the check verifies the row's
   shape while a reader verifies the state in one click. Three directories rest on this today, all
   on #975.
2. **A live pointer.** A tracked file outside the capture names it: a component comment, a
   `next.config.mjs` trace, a test, a changelog figure, a stylesheet note. All three spellings count
   — `docs/qa/payment`, the relative `../qa/payment` a page writes, and the pre-#965 flat
   `docs/qa-971-tiles` a comment beside a script still carries — because each names the same file
   and stops resolving the day the directory goes. Generated docs regions, `docs/docs.json`, the
   markdown-hash snapshot and this page are **not** readers: they are derived from the tree, so
   counting them would keep everything forever.
3. **The current or previous release.** `KEEP_RELEASES = 2`, and the cuts come from
   `docs/qa-atlas/` — the atlas is the release capture now, so its two newest cuts (`v1.19.0`,
   `v1.18.0`) are the window. A release cut nothing points at yet is still the record of a shipped
   build.

Everything else is archived. The delete commit takes the directory **and its `docs/docs.json` row in
the same commit**, because `docs:check` fails on either half alone — a listed page with no file, or a
file with no row.

The window is measured, never felt: `docs/qa` is 118.85 MB across 81 directories today, 58.78 MB of
it kept and 60.07 MB removed by this pass.

## The register

`keep` means the directory is still on disk and the rule justifies it. `archived` means it was
removed, with its `docs.json` row, in the commit that introduced this page — the bytes are in
`git log`, which is the archive. Weights are what the directory held on the day of the pass; the
check compares every `keep` weight against the disk, so a capture that grows has to be re-measured
and re-justified.

| directory                  | weight   | fate     | why it stays (or went)                                                                                                        |
| -------------------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `542`                      | 2.59 MB  | archived | `/help`, `/library` and the replay band, before and after — no open issue, no pointer, no release cut                         |
| `542-phase2`               | 1.45 MB  | archived | the rail as role-constrained data and the focused-flow chrome (#542, closed) — no open issue, no pointer, no release cut      |
| `717-column`               | 1.17 MB  | archived | the console's three shelves at three widths (#717, closed) — no open issue, no pointer, no release cut                        |
| `858-columns`              | 3.44 MB  | archived | the dashboard, help and relationship column sweep (#858, closed) — no open issue, no pointer, no release cut                  |
| `873`                      | 0.94 MB  | archived | the counterparty's read-only door (#873, closed) — no open issue, no pointer, no release cut                                  |
| `904`                      | 0.95 MB  | archived | side-by-side strips for #904 (closed) — no open issue, no pointer, no release cut                                             |
| `905`                      | 0.47 MB  | archived | side-by-side strips for #905 (closed) — no open issue, no pointer, no release cut                                             |
| `906`                      | 3.05 MB  | archived | admin brand, dashboard and home at two widths (#906, closed) — no open issue, no pointer, no release cut                      |
| `935-aspects-once`         | 2.11 MB  | keep     | cited by `lib/docs/features.ts`                                                                                               |
| `957-assessment-one-click` | 2.60 MB  | archived | one-click create on `/assessment` (#957, closed) — no open issue, no pointer, no release cut                                  |
| `958-no-initiator-member`  | 0.79 MB  | archived | the pay modal with no initiator member (#958, closed) — no open issue, no pointer, no release cut                             |
| `971-tiles`                | 0.49 MB  | keep     | cited by `docs/qa/979-flow-dialog/capture.mjs` and 2 other file(s)                                                            |
| `975`                      | 0.51 MB  | keep     | open issue #975 — kept while that issue is open                                                                               |
| `975-d12`                  | 1.41 MB  | keep     | open issue #975 — kept while that issue is open                                                                               |
| `975-detail-identity`      | 1.99 MB  | keep     | open issue #975 — kept while that issue is open                                                                               |
| `976-sent-none`            | 0.29 MB  | archived | the Sent screen with no invitation row (#976, closed) — no open issue, no pointer, no release cut                             |
| `979-flow-dialog`          | 0.13 MB  | keep     | cited by `docs/qa/979-flow-entries/capture.mjs` and 1 other file                                                              |
| `979-flow-entries`         | 2.76 MB  | keep     | cited by `components/assessment-flow/flow-entry-link.tsx` and 2 other file(s)                                                 |
| `979-flow-parity`          | 0.32 MB  | keep     | cited by `lib/flow/dialog-origin.ts`                                                                                          |
| `admin-audit`              | 1.02 MB  | archived | the audit log's empty, filtered and populated states — no open issue, no pointer, no release cut                              |
| `admin-billing`            | 0.69 MB  | archived | the billing comp, limit and live/test refusal states — no open issue, no pointer, no release cut                              |
| `admin-console`            | 1.09 MB  | archived | the console's three shelves at one width — no open issue, no pointer, no release cut                                          |
| `admin-health`             | 1.95 MB  | archived | the health page and its two alarms — no open issue, no pointer, no release cut                                                |
| `admin-template-authoring` | 0.98 MB  | archived | the template editor's four states — no open issue, no pointer, no release cut                                                 |
| `as2-home`                 | 5.28 MB  | keep     | cited by `app/globals.css` and 3 other file(s)                                                                                |
| `aspects`                  | 0.60 MB  | archived | the Aspects editor collapsed, open, reordered and saved — no open issue, no pointer, no release cut                           |
| `brand-lockup`             | 0.70 MB  | archived | the lockup back in the chrome and the auth mark at a seal's size — no open issue, no pointer, no release cut                  |
| `broadcast`                | 1.65 MB  | archived | the broadcast composer, dry run, send, cooldown and test-key refusals — no open issue, no pointer, no release cut             |
| `comments-mockup`          | 2.46 MB  | archived | the comments mockup, both placements (#921) — no open issue, no pointer, no release cut                                       |
| `conformance`              | 2.77 MB  | archived | a 32-file conformance sweep of the assessment surfaces — no open issue, no pointer, no release cut                            |
| `contact-land`             | 1.01 MB  | archived | `/help`, `/support` and `/contact`, looked at — no open issue, no pointer, no release cut                                     |
| `counterparty-onboarding`  | 0.88 MB  | archived | the counterparty's onboarding steps and confirmation — no open issue, no pointer, no release cut                              |
| `create-stages`            | 0.60 MB  | archived | the create flow's Who and Mode stages — no open issue, no pointer, no release cut                                             |
| `demo-flow`                | 10.07 MB | keep     | cited by `CHANGELOG.md` and 14 other file(s)                                                                                  |
| `docs-pretty`              | 0.67 MB  | keep     | cited by `tests/docs-renderer.test.tsx`                                                                                       |
| `flow-stages`              | 0.65 MB  | archived | the six-stage flow (#735), a model `docs/specs/flow-stages.md` has since replaced — no open issue, no pointer, no release cut |
| `flow-ui`                  | 0.20 MB  | keep     | cited by `docs/changelog/v1-11-0.md`                                                                                          |
| `flow-validation`          | 0.02 MB  | keep     | cited by `docs/specs/pay-to-complete/RESEARCH.md`                                                                             |
| `help-two-column`          | 1.79 MB  | archived | `/help`'s two-column layout at four widths — no open issue, no pointer, no release cut                                        |
| `hero-leadership`          | 0.39 MB  | archived | the hero's leadership band — no open issue, no pointer, no release cut                                                        |
| `home-comments`            | 5.26 MB  | keep     | cited by `tests/as2-home.test.tsx`                                                                                            |
| `home-polish`              | 0.70 MB  | archived | the home hero's six defects, before and after — no open issue, no pointer, no release cut                                     |
| `home-v2`                  | 3.22 MB  | archived | the home page's second cut at 1440 — no open issue, no pointer, no release cut                                                |
| `invite-response`          | 0.29 MB  | archived | the invite-response path's first and third steps — no open issue, no pointer, no release cut                                  |
| `leaving-links`            | 0.26 MB  | archived | the leaving-link audit: footer, marketing links and the login form — no open issue, no pointer, no release cut                |
| `lockup-2rem`              | 0.25 MB  | archived | the chrome lockup at 2rem in three viewports — no open issue, no pointer, no release cut                                      |
| `modal`                    | 0.88 MB  | keep     | cited by `docs/changelog/v1-8-0.md`                                                                                           |
| `modal-mobile`             | 1.09 MB  | keep     | cited by `components/assessment-flow/stage-shell.tsx` and 2 other file(s)                                                     |
| `nav-ordering`             | 0.27 MB  | archived | the rail's ordering, with its measurements — no open issue, no pointer, no release cut                                        |
| `noun-crud`                | 0.52 MB  | keep     | cited by `docs/changelog/v1-9-0.md`                                                                                           |
| `og-card`                  | 0.09 MB  | keep     | cited by `docs/assets/screens/README.md`                                                                                      |
| `ongoing`                  | 0.76 MB  | archived | the Ongoing stage, drawn as it was before the flow dropped it — no open issue, no pointer, no release cut                     |
| `p4-screenshots`           | 11.27 MB | keep     | cited by `docs/qa/qa-dogfood-p4.md`                                                                                           |
| `pay-flow`                 | 1.50 MB  | keep     | cited by `docs/changelog/v1-12-0.md`                                                                                          |
| `payment`                  | 2.44 MB  | keep     | cited by `docs/changelog/v1-10-0.md` and 1 other file                                                                         |
| `pricing-trio`             | 0.87 MB  | archived | the pricing band, CTA and header — no open issue, no pointer, no release cut                                                  |
| `prod-captures`            | 1.02 MB  | archived | seven production screenshots of settings and relationships — no open issue, no pointer, no release cut                        |
| `public-templates`         | 1.43 MB  | archived | the public templates pages at two widths — no open issue, no pointer, no release cut                                          |
| `rail-handle`              | 1.39 MB  | keep     | cited by `components/layout/sidebar.tsx`                                                                                      |
| `rail-v4`                  | 1.69 MB  | archived | the rail's fourth cut: labels, icons and the drawer — no open issue, no pointer, no release cut                               |
| `recharts-3`               | 0.14 MB  | archived | recharts 3 render evidence (#571 deferred) — no open issue, no pointer, no release cut                                        |
| `rel-detail-edit`          | 0.75 MB  | keep     | cited by `docs/qa/979-flow-parity/capture.mjs`                                                                                |
| `release-1.16.0`           | 0.47 MB  | keep     | cited by `docs/changelog/v1-16-0.md`                                                                                          |
| `release-1.17.0`           | 0.71 MB  | keep     | cited by `docs/changelog/v1-17-0.md` and 1 other file                                                                         |
| `review-admin`             | 0.82 MB  | keep     | cited by `docs/changelog/v1-7-0.md`                                                                                           |
| `screenshots`              | 3.26 MB  | archived | twelve route screenshots at two widths — no open issue, no pointer, no release cut                                            |
| `sent`                     | 0.24 MB  | archived | the Sent screen at two widths — no open issue, no pointer, no release cut                                                     |
| `stage-shell`              | 0.18 MB  | archived | the flow's stage shell at two widths — no open issue, no pointer, no release cut                                              |
| `stage5`                   | 0.41 MB  | keep     | cited by `tests/admin-docs.test.ts`                                                                                           |
| `support-inbox`            | 0.37 MB  | archived | the support inbox's refusal states — no open issue, no pointer, no release cut                                                |
| `surface-sweep-913`        | 0.82 MB  | archived | #913's modal rule across eight surfaces — no open issue, no pointer, no release cut                                           |
| `swiper-12`                | 3.50 MB  | keep     | cited by `CHANGELOG.md` and 1 other file                                                                                      |
| `template-catalogue`       | 1.91 MB  | archived | the template catalogue, filtered and unfiltered — no open issue, no pointer, no release cut                                   |
| `templates-redesign`       | 3.94 MB  | archived | the Templates catalogue rebuild (#889) — no open issue, no pointer, no release cut                                            |
| `tour`                     | 0.72 MB  | archived | the first-run tour's steps — no open issue, no pointer, no release cut                                                        |
| `tour-demo`                | 0.50 MB  | archived | the tour demo's five states — no open issue, no pointer, no release cut                                                       |
| `v1-13-0`                  | 0.27 MB  | keep     | cited by `docs/changelog/v1-13-0.md`                                                                                          |
| `v1-14-0`                  | 0.32 MB  | keep     | cited by `docs/changelog/v1-14-0.md`                                                                                          |
| `v1-15-0`                  | 0.25 MB  | keep     | cited by `docs/changelog/v1-15-0.md`                                                                                          |
| `v1x-ui-cohort`            | 0.86 MB  | keep     | cited by `app/globals.css`                                                                                                    |
| `welcome-copy`             | 0.28 MB  | archived | the welcome panel's copy and the two noun tiles — no open issue, no pointer, no release cut                                   |

## Adding a capture

A new directory under `docs/qa/` fails `pnpm docs:check` until it has a row here, and the row has to
survive the rule:

- **Named after the issue it is evidence for, and the issue is open** — link the row's reason to
  `open issue #<n>`. This is the only claim the gate takes on trust, so the note says when it was
  last confirmed.
- **Cited by something that ships** — a comment beside the screen it measures, the changelog entry
  it belongs to, a test that reads it. A capture nobody can name is a capture nobody reads, and the
  atlas is where a _surface_ sweep belongs now.
- **The current or previous release cut** — the atlas's own cuts, so a release capture lands there
  rather than here.

Then re-run `pnpm qa:retention:report`, copy the row it prints, and let `pnpm docs:check` referee.

## What this pass removed, and what it left

Re-measured on `main` at `aa43daca` (the issue's own count was 82 directories and 51 with no page — the
tree carries 81 and 49 today): 81 directories, **49 of them carrying no indexed page at all** — 454
files and 72.29 MB outside the only docs invariant. This pass archived **49 directories, 60.07 MB**
and dropped 21 `docs/docs.json` rows with them in the same commit; `pnpm docs:nav` regenerated the
hub and the prev/next chain around the pages that went. What is left is 32 directories, 58.78 MB,
every one of them named by a file, an open issue or a release cut.

Two things the issue named were **left in place**, and the reasons are measurable rather than
sentimental:

- **`docs/qa-release-1.18.0/`** is cited by a figure in `docs/changelog/v1-18-0.md` — the published
  release note for 1.18.0 embeds `assessment-one-click-1440.png` from it. The atlas carried a
  `v1.18.0` cut the same day, but its full-size bytes live in an uncommitted 57 MB archive
  (`manifest.archive.url` is `null`), so deleting the PNG would leave the release note pointing at a
  thumbnail or at nothing. It is a live pointer, so by this page's own rule it stays.
- **`docs/review/artifacts/prototype-relationship-lifecycle-v1…v8.html`** are not loose drafts: each
  is a registered review artifact — a row in `data/review-artifacts.ts`, served at
  `/review-artifacts/<slug>`, described in `docs/review/artifacts.json`, and mirrored into the
  `review_artifact` table by `pnpm db:seed`. `v8`'s row says in words that it is _the drawing the
  reference was cut from, kept as history_, and `v1…v6` are the series behind it. Deleting them is a
  decision about what the review shelf publishes, not a docs chore, so it is not taken here.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › The qa/ capture shelf · next [The welcome tiles on /register too, #971](971-tiles/README.md)

<!-- docs-nav:end -->
