# v2 conformance — 25 requirements, and the artifact that proves each

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Specs & design briefs** › v2 conformance — 25 requirements, and the artifact that proves each · prev [Stage display](ux-stages.md) · next [v2 coverage matrix — the 23 screens, measured](v2-coverage-matrix.md)

<!-- docs-nav:end -->

**Measured:** 19 November 2026 · **Tree:** `main` at `2.0.0-rc1.3` (`5c3f2bf4d`) · **Scope:** bundle 13's
`AS-01 … AS-15` and the ten rc1.3 surfaces, `#1223 … #1232`.

Nothing in this repo used to answer _"is the app what the spec says?"_ The gate proves the tree
compiles, `data:check` proves the fixtures obey their invariants, `demo:verify` drives the app and
diffs six tables plus nine answers, `parity` proves the two brands and the brand boundary. **None of
them know a requirement exists.** Conformance was asserted in card acceptance and in PR prose, which
cannot be re-run and cannot fail.

This page is the map, and `scripts/conformance-check.mjs` is the check: every row names the artifact
that proves its requirement, and the gate reads the page in **every lane** (the `conformance` step in
`scripts/verify.sh`, beside `glossary` and `release:check`) so a citation that stopped being true is a
red build rather than a sentence nobody re-read.

**The counts are printed, never written here.** `node scripts/conformance-check.mjs` prints
`n proven · m unproven · k waived` and the ids that are unproven. A figure copied into prose has
already gone stale once in this repo — `docs/operations/gate.md` is the one home for the gate's
numbers for exactly that reason, and this page follows it.

## The three states, and the one defect

| state      | means                                                             | what the checker does                                         |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| `proven`   | the artifact exists and runs green at the measured tree           | resolves it, and fails if it is missing or the row cites none |
| `unproven` | **no artifact exists** — an honest, printed, non-failing finding  | counts it, prints the id                                      |
| `waived`   | the requirement is withdrawn, with the owner's own reason quoted  | fails a waiver that carries no quoted reason                  |
| —          | a **dangling** artifact: a file, case or script that is not there | fails: exit 1, naming the row and the locator                 |

A dangling artifact is **a defect in this document**, not a fourth state. A page that cites a test
file nobody can open is worse than a page that admits the gap, because the gap is a finding and the
bad citation is a false claim.

## What counts as an artifact

The artifact cell holds one or more code spans, each one of four shapes:

| locator                            | the checker asserts                                                        |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `test:<file>:<line> "<case name>"` | the file exists, the line declares a case, the file carries that case name |
| `file:<file>:<line>`               | the file exists and the cited line is inside it                            |
| `script:<name>`                    | `package.json` declares that script                                        |
| `waived:"<reason>"`                | the reason is quoted, at least twenty characters, on a `waived` row only   |

`—` in that column is the deliberate "no artifact". Anything else — a bare path, a command written
as prose, a screenshot in someone's head — is not a citation and the checker refuses it.

## Bundle 13 — the Admin Project Spec (15 requirements)

The requirement column is bundle 13's own words, from
`project-spec/spec-design-v2-bundles/13-admin-project-spec/DEFINED.md`; that table's third column is
the Definition of Done. The bundle is tracked by epic #1252.

| id    | requirement                                                                                                                                                                                          | proving artifact | result                                                                                                                                            | status   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| AS-01 | **Stakeholder role.** `stakeholder` between `member` and `support`; every action refuses it; only an admin grants it through `role.change`                                                           | —                | no artifact: `content/role-ladder.ts:21` carries four rungs and no `stakeholder`. The R0 spine in PR #1254 (unmerged) adds the rung and its cases | unproven |
| AS-02 | **Spec reader capability.** `spec-read` in `NAV_CAPABILITIES`, granted to the explicit set stakeholder / admin / owner, never by rung                                                                | —                | no artifact: `lib/nav.ts:45` lists two capabilities. PR #1254 (unmerged) adds the third and `navViewer`'s explicit set                            | unproven |
| AS-03 | **Route and gate.** `/admin/spec`, `/admin/spec/validation` and `/admin/spec/[group]` behind the Admin gate and a spec-reader gate; signed out to `/login`, member or support to the unknown-URL 404 | —                | no artifact: there is no `app/(mainlayout)/admin/spec/` on main. PR #1254 (unmerged) adds the surface                                             | unproven |
| AS-04 | **Landing redirect.** A stakeholder lands on `/admin/spec`; an admin keeps `/dashboard`; a safe `next` still wins                                                                                    | —                | no artifact: no stakeholder destination in `lib/auth/paths.ts`. PR #1254 (unmerged) adds it                                                       | unproven |
| AS-05 | **Admin rail row.** `admin-spec` between Email Templates and Audit log, `needs: stakeholder` and `capability: spec-read`                                                                             | —                | no artifact: `data/nav-menu.json` carries no `admin-spec` row. PR #1254 (unmerged) adds it                                                        | unproven |
| AS-06 | **Submenu.** A 208px column: Overview, Validation pinned and always expanded, Story 01–06, Around the Story 07–11, each with met / total                                                             | —                | no artifact: no surface renders it                                                                                                                | unproven |
| AS-07 | **Validation page.** A sticky status box and grouped checkmarked rows at 28 / 20 / 13 / 27, every status an icon plus a word, no red                                                                 | —                | no artifact: no surface, and `data/validation.json` does not exist                                                                                | unproven |
| AS-08 | **Story pages.** Eleven pages, in the order Agreed, v2.0 Today, Status, Evidence                                                                                                                     | —                | no artifact: no surface renders them                                                                                                              | unproven |
| AS-09 | **Data source.** The pages read `validation.json` at request time; a missing or invalid file draws the honest panel at 200                                                                           | —                | no artifact: no surface, and the file it would read is absent                                                                                     | unproven |
| AS-10 | **NDA.** Agreement quotes and mockups served only through the gated route — never in `public/`, never committed                                                                                      | —                | no artifact: no surface, so nothing serves them and nothing can leak them yet                                                                     | unproven |
| AS-11 | **Responsive.** Below `md` the rail and the submenu fold into one menu sheet; no sideways scroll at 390                                                                                              | —                | no artifact: no surface                                                                                                                           | unproven |
| AS-12 | **Suggest a Change.** A right-side drawer per row: a type, a 10–2000 character note, an optional evidence link, Send to Triage                                                                       | —                | no artifact: R1, not started                                                                                                                      | unproven |
| AS-13 | **Filed by the server.** `POST /api/admin/spec/suggest` gates, validates, rate-limits 5 per 10 minutes and files one GitHub issue as the App                                                         | —                | no artifact: R1, and no route                                                                                                                     | unproven |
| AS-14 | **Chat mode.** A Form / Chat toggle where Hermes drafts the same Type and Note, and never sends on its own                                                                                           | —                | no artifact: R1 and optional, not started                                                                                                         | unproven |
| AS-15 | **Read-only.** No server action or mutation route under `/admin/spec`; an axe pass at 390 and 1280 reports 0 violations                                                                              | —                | no artifact: nothing to be read-only yet                                                                                                          | unproven |

Fifteen `unproven` rows is the honest reading of this tree, and it is the finding this page exists to
make visible: the R0 spine (`AS-01 … AS-11`, `AS-15`) is complete and reviewed in **PR #1254 but not
merged**, and `AS-12 … AS-14` (R1, one of them optional) are not started. When #1254 lands, the six
rows it proves should move to `proven` with `test:` locators in that same change — that is a
follow-up card, not a licence to cite the PR as if it were a file.

## The ten rc1.3 surfaces (10 requirements)

From the rc1.3 handoff bundle (`spec-design-v2-rc1.3-bundle`, one folder per surface) and
`docs/specs/v2-bundles/`. Each row's id is the issue number the surface was filed under — no id is
minted here. The bundle's appendix, the Bundle 11 refresh, is a spec edit and not a screen: it is
`#1233`, it sits inside the range the card names, and it is deliberately not a row.

| id    | requirement                                                                                                     | proving artifact                                                                                                                           | result                                                                                                                                                                                                                                   | status   |
| ----- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| #1223 | Answer Screen: answering while paused or lapsed, the save chips, and no billing word for the Counterparty       | `test:tests/answer-sheet-lapsed.test.ts:173 "shows the Counterparty no billing word at all"`                                               | green — the paused pane, the gate's `lapsed` branch and each seat's own sentence are one file                                                                                                                                            | proven   |
| #1224 | Relationship Detail: each seat reads why a relationship is paused — 7 days, and no billing for the Counterparty | `test:tests/relationship-membership.test.ts:235 "tells the Counterparty the pause, the name and the promise — and no billing word"`        | green — the sentence per seat, with the trial's numbers derived from the constants and never typed                                                                                                                                       | proven   |
| #1225 | Relationship Expired email: the Counterparty reads that it ended, without the word payment                      | `test:tests/counterparty-no-leak.test.ts:236 "carries no price, plan, trial, card or extension word in the subject, the text or the HTML"` | green — the sweep covers this template's Counterparty branch; the exact sentence is not pinned by a case of its own                                                                                                                      | proven   |
| #1226 | Create Failed screen: a calm status card, Try Again and Back to Dashboard, and no database words                | `test:tests/assessment-new-create-failed.test.tsx:238 "draws the artifact's strings, verbatim"`                                            | green — the strings, the two real links, the status region, and `:251` "says nothing about the database"                                                                                                                                 | proven   |
| #1227 | Counterparty Joined email: the week starts today, and only on a free trial                                      | `test:tests/email-override.test.ts:237 "says the week starts today in the join notice to the Initiator"`                                   | green — the free-trial variant's line and the link wording                                                                                                                                                                               | proven   |
| #1228 | Help Center FAQ: the "How do I get started?" answer describes the five stages                                   | —                                                                                                                                          | no artifact: the copy shipped (`components/support/support-faq.tsx:182`) and no case pins it. `tests/support-faq.test.ts` asserts brand vocabulary, not this answer                                                                      | unproven |
| #1229 | Wizard Stage 5: a Family Initiator at 4 of 4 relationships is asked to make room before anything is written     | `waived:"CLOSING AS SUPERSEDED — owner decision 2026-11-19: the Family plan is removed."`                                                  | waived — with Family gone, capacity is 1 on every plan and the question stops existing                                                                                                                                                   | waived   |
| #1230 | Payment page: the Initiator reads their own plan's price after the trial                                        | `waived:"CLOSING AS SUPERSEDED — the defect became unobservable when the catalogue became one plan."`                                      | waived — one plan means one price, so the multi-plan defect cannot be observed                                                                                                                                                           | waived   |
| #1231 | Admin Email Templates: each template's status as an icon plus a word, and the labels in Title Case              | —                                                                                                                                          | no artifact for the icon: Title Case landed (#1242) and `tests/admin-email-templates.test.ts:271` pins the labels, but the status cell is still a word-only `Badge` (`components/admin/email-templates/email-template-registry.tsx:120`) | unproven |
| #1232 | Admin CRUD & Permissions: status cells as an icon plus a word, never red, and the labels in Title Case          | `test:tests/admin-permissions.test.ts:572 "draws every status column as a chip, carrying the fixture's word"`                              | green — the chip per status column, with the tone and the mark pinned beside it                                                                                                                                                          | proven   |

## What is unproven, and what happens to it

Every `unproven` row on this page is a specific gap rather than a shrug, and the checker prints the
ids on every run:

- **`AS-01 … AS-11` and `AS-15`** — the R0 spine is built, reviewed and open as **PR #1254**
  (`89f18e008`). It is not on `main`, so no artifact on this tree proves any of those requirements.
  This page does not cite an unmerged branch: a row whose artifact is in a PR is exactly the
  dangling citation the checker exists to refuse.
- **`AS-12 … AS-14`** — R1 (Suggest a Change, the server-side filing, chat mode), not started. One
  of the three is optional in the bundle.
- **`#1228`** — the five-stage answer shipped in `361675f5f` and nothing pins it, so the next edit to
  that panel can silently restore the v1 path.
- **`#1231`** — the Title Case half of the requirement landed (#1242) and the icon-plus-word half did
  not, while the issue closed as completed. That is the one claim on this page that disagrees with a
  closed ticket, and it is a one-component gap.

A requirement with no artifact becomes an issue, never a patch smuggled into a documentation card.

## The two waivers, quoted

**#1229 — the Family capacity rule**, closed `NOT_PLANNED` on 2026-11-19:

> **CLOSING AS SUPERSEDED — owner decision 2026-11-19: the Family plan is removed.**
>
> Family is the only plan whose capacity exceeds one relationship (`data/membership-plans.ts:128`,
> `FAMILY_CAPACITY = 4` at `:77`). With it gone, capacity is 1 on every plan and every question this
> issue was going to force … stops existing rather than needing a careful answer.

**#1230 — the per-plan price line**, closed `NOT_PLANNED` the same day, for the same decision:

> **CLOSING AS SUPERSEDED — the defect became unobservable when the catalogue became one plan.**
>
> This issue asked that the payment page show the relationship's own plan's price, because
> `lib/billing/payment-view.ts:58` fixes the source to one plan … One plan means one price.

## How this page is checked

```bash
node scripts/conformance-check.mjs        # exit 0, prints the counts and the unproven ids
node scripts/conformance-check.mjs --json # the same verdict, machine-readable
bash scripts/verify.sh                    # the `conformance` step runs in every lane
```

The step reads this file and the tree, and nothing else: no clock, no network, no database. It costs
milliseconds, which is why it sits beside `glossary` and `release:check` rather than inside a lane —
the page is `docs/`, the script is `scripts/` and the citations are `tests/`, `lib/`, `app/` and
`data/`, and those paths classify into four different lanes. A lane that skipped it would hand a
green local gate to a red CI run over exactly the change that broke a citation.

**To add a requirement:** write the row with its artifact, run the checker, and let it fail first if
you are unsure the locator resolves. **To retire one:** mark it `waived` and quote the owner — an
unquoted waiver is a silent drop and the checker refuses it.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Specs & design briefs** › v2 conformance — 25 requirements, and the artifact that proves each · prev [Stage display](ux-stages.md) · next [v2 coverage matrix — the 23 screens, measured](v2-coverage-matrix.md)

<!-- docs-nav:end -->
