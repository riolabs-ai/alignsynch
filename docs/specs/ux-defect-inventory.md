# UX defect inventory — #975

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Specs & design briefs** › UX defect inventory (#975) · prev [UI/UX audit](ui-ux-audit.md) · next [Answer input](ux-input.md)

<!-- docs-nav:end -->

The defect list produced for issue #975 (Initiator/Counterparty flow, the create-relationship modal,
the member dashboard), **with the outcome of every row**. The list was measured once, on
`origin/main` at `45488329` (version 1.17.1, brand `alignsynch`) by card `t_df8c157e`, and that list
is reproduced here unchanged. What this file adds is the second half the issue asked for: **which
commit shipped each row, and which rows are still uncarded.**

It exists because the inventory was first delivered as a card comment and screenshots, so the list
was findable only in card history. **Row ids (`D1`–`D16`) are the citation key** — a build card
names the rows it closes, and this file is where a reader finds out whether that happened.

Status of this file: a **record**, not a spec. Nothing here is a recommendation, and no row is
closed on a card's say-so — every `shipped` row names the commit that made it true, and every
`uncarded` row names the file a fix would touch.

## How the audit was run (reproducible)

| Step          | Command                                                                                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tree          | `git fetch origin --prune && git merge --ff-only origin/main` → `45488329`, `package.json` 1.17.1                                                                                                                                 |
| Deps          | `pnpm install --frozen-lockfile`                                                                                                                                                                                                  |
| Env           | `.env.local` / `.env` symlinked from the main checkout (gitignored) — demo branch `ep-crimson-truth`, `NEON_BRANCH=demo`, `DEMO_AUTH=1`                                                                                           |
| Server        | `pnpm dev --port 3413` (the HIL rig owns 3411 and was not touched)                                                                                                                                                                |
| Two accounts  | the product's own demo door — `/demo` PIN → `/login` → role button **Initiator** (`initiator@demo.alignsynch.test`) and **Counterparty** (`counterparty@demo.alignsynch.test`), separate sessions, cookies cleared between phases |
| Walker        | a raw-CDP script (`WebSocket`), the shape `scripts/demo-flow.mjs` established; `--phase=a\|b\|c`, `--serve`, one PNG + one geometry probe per screen                                                                              |
| Harness reuse | `BASE_URL=http://localhost:3413 DEMO_FLOW_OUT=… DEMO_FLOW_SKIP_SEED=1 pnpm demo:flow` (55 steps, 7 findings, its own screenshots)                                                                                                 |

Geometry is measured, never eyeballed: every record takes `getBoundingClientRect()`, the first
visible `h1` (x, font-size), the set of content-column left edges,
`documentElement.scrollWidth - clientWidth`, and any element crossing the viewport.

**The dataset under test** (demo branch, read-only queries only):

```text
relationship 4 · session 4 · party 8 · opinion 40 · session_invite 0
every relationship: status=draft, initiator_user_id=NULL, counterparty_user_id=NULL
party rows for assessment-instance-avery-rowan: initiator→initiator@demo…, counterparty→counterparty@demo… (both accepted_at set)
```

Two drafts created while walking were deleted afterwards; the branch went back to its seeded 4
relationships. `relationship_payment` and `session_invite` were empty, as found.

The screenshot bundle (98 PNG, plus the per-screen geometry probes) is held off-repo, outside this
checkout, under the `qa/` capture shelf of the machine that ran the walk. **Every row below stands
without it**: a row carries its URL, its expected/actual pair and the measurement that separated
them, so it can be re-driven from this file alone.

## Counts

**By classification** — `data` 6 · `copy` 3 · `state` 3 · `behaviour` 3 · `layout` 1

**By surface** — lifecycle/roles 4 · create modal 6 · member dashboard 6

**By severity** — blocks the flow 4 · confusing 10 · cosmetic 2

**By outcome** — shipped by a commit 8 · shipped in part 1 · closed as not-a-defect 1 ·
**uncarded 6**

Of 16 rows, **4 blocked the flow and 6 were the demo dataset contradicting itself.** The modal's own
mechanics were largely correct (see _Expected and not found_); the pain was in what the data said and
in what the dashboard told each role about the same relationship.

## The rows

| #   | surface                                   | role                       | URL                                                                                                                                                       | expected                                                                                                                                             | actual                                                                                                                                                                                                                                                                                                                                                                                                                          | class     | severity        | outcome                                                                                                     |
| --- | ----------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| D1  | lifecycle · relationship detail (seeded)  | initiator                  | `/dashboard/relationships/relationship-assessment-instance-avery-rowan`                                                                                   | A relationship whose initiator seat is bound to this account reads as the initiator's, with the publish and invite controls the initiator owns       | `relationship.initiator_user_id` is `NULL` on **all four** seeded relationships, so `isInitiator` is false: the page draws the read-only band and offers no publish/invite control at all                                                                                                                                                                                                                                       | data      | blocks the flow | **shipped** — `ada118bc` (#981, #958)                                                                       |
| D2  | lifecycle · relationship detail (seeded)  | initiator                  | same as D1                                                                                                                                                | One role, stated once: either the chip says Initiator and the initiator's controls are drawn, or the band says Counterparty                          | the state band chips **`Initiator`** and, 300px below, the read-only band says **"You are the Counterparty on this relationship"** — the same screen claims both seats                                                                                                                                                                                                                                                          | copy      | confusing       | **shipped** — `fab204aa` (#986), band half in `ada118bc` (#981)                                             |
| D3  | lifecycle · detail vs assessments         | both                       | `/dashboard/relationships/relationship-assessment-instance-avery-rowan` · `/assessments` · `/assessment/instances/assessment-instance-avery-rowan/report` | One truth about the pair: a draft that was never sent has no answers, so no Gap; a pair that has both accepted with a Gap has a sent relationship    | `relationship.status='draft'` and the detail says "Not sent yet — nothing has been invited or charged", while `/assessments` says "You have both accepted — the Gap is open", the instance view says "You have both answered … the report is open to both of you", and `/report` renders **6 Gaps**                                                                                                                             | data      | blocks the flow | **shipped** — `260e4684` (#985)                                                                             |
| D4  | dashboard · Overview counters             | both                       | `/dashboard`                                                                                                                                              | The counters count the same relationships `/assessments` lists, so "Needs your answers" / "Reports open" agree with "Gap ready"                      | initiator: **Needs your answers 1 · Reports open 0** while `/assessments` reads **Gap ready 1** for the same relationship; counterparty: **0 / 0 / 0** while `/assessments` reads **Gap ready 1**                                                                                                                                                                                                                               | data      | confusing       | **closed, not a defect** — re-measured equal over the same rows (see _D4_ below)                            |
| D5  | dashboard · relationships list            | both                       | `/dashboard/relationships`                                                                                                                                | A bound counterparty who is signed in and has answered is named on the initiator's row                                                               | the initiator's row reads "Relationship Basics with · **Not claimed yet**", while the counterparty — signed in, `party.user_id` set, `accepted_at` set — sees the same relationship as "with · **Avery**"                                                                                                                                                                                                                       | data      | confusing       | **shipped** — `fab204aa` (#986)                                                                             |
| D6  | dashboard · My Assessments                | initiator                  | `/assessments`                                                                                                                                            | A relationship kept as a draft (nothing sent, nothing charged) is not listed as an invited assessment                                                | the draft created in this walk is listed with the status **`Invited`** and "Yours to answer", while its own detail page says "Not sent yet — nothing has been invited or charged"                                                                                                                                                                                                                                               | data      | confusing       | **uncarded** — `lib/flow/state.ts` / the `/assessments` read predicate                                      |
| D7  | modal · stage 2 Settings                  | initiator                  | `/templates/relationship/relationship-basics/create/mode`                                                                                                 | The stage either arrives with the Mode and Setting the draft carries, or its advance says what is missing                                            | all four radios arrive **unchecked** (`mode=basic/advanced`, `alignmentSetting=soft/full`, all `required`; `form.checkValidity()===false`), and pressing **Continue to Stage 3** does nothing visible — the only feedback is the browser's native bubble, which is not on the screen                                                                                                                                            | state     | blocks the flow | **shipped** — `b34d09b8` (#984)                                                                             |
| D8  | modal · stage 1 Details                   | initiator                  | `/templates/relationship/relationship-basics/create` · empty submit                                                                                       | An advance that is refused says which field refused it (`lib/flow/create-copy.ts`'s band)                                                            | pressing **Continue to Stage 2** with the form empty re-renders the same screen with **no band, no field message** — the refusal is the browser's `required` tooltip only                                                                                                                                                                                                                                                       | state     | confusing       | **uncarded** — stage 1's `<form>` in `components/assessment-flow/create-relationship.tsx` (no `noValidate`) |
| D9  | dashboard · relationship detail header    | both                       | `/dashboard/relationships/<any id>`                                                                                                                       | The page is headed by the title the creator gave the relationship, and names the two people                                                          | the `h1` is the **template's** name ("Relationship Basics") on every relationship made from that template — five records share one heading — and neither party's name appears in the rendered text                                                                                                                                                                                                                              | copy      | confusing       | **shipped** — `fab204aa` (#986)                                                                             |
| D10 | dashboard · relationship detail → payment | initiator                  | `/dashboard/relationships/<own draft>` → `Open the payment step` → `/templates/relationship/relationship-basics/create/invite?instance=<id>`              | A payment started from the dashboard stays a dashboard surface, or says plainly that it re-enters the creation flow                                  | the link drops the reader back into the five-stage creation modal (`Stage 5 of 5`), whose `Cancel` leaves to the template library, not to the relationship                                                                                                                                                                                                                                                                      | behaviour | confusing       | **uncarded** — `payHref` in `components/dashboard/relationship-detail.tsx`                                  |
| D11 | pricing copy · shelf vs detail vs stage 5 | initiator                  | `/dashboard/templates` · `/dashboard/relationships/<own draft>` · `/templates/relationship/relationship-basics/create/invite?instance=<id>`               | One price story for one relationship                                                                                                                 | three are printed: shelf card "**$8.95/mo**", detail "The fee is **$8.95**, charged once for this relationship", stage 5 plans "**$9.95 /mo**" and "**$19.85 /mo**"                                                                                                                                                                                                                                                             | copy      | confusing       | **shipped** — `260e4684` (#985)                                                                             |
| D12 | dashboard · edit dialog                   | initiator                  | `/dashboard/relationships/<own draft>` → `Edit`                                                                                                           | The dialog headed "Edit this relationship … Everything here is written to the relationship itself" can reach the Aspects, as the page behind it does | the dialog carries Title · Summary · Mode · Setting · Their name · Their email · invitation window and **no Aspects at all**; the only post-creation aspect editor is the inline list on the page                                                                                                                                                                                                                               | state     | confusing       | **shipped** — `37066f70` (#991)                                                                             |
| D13 | modal · shell, signed-out visitor         | initiator (before sign-in) | `/templates/relationship/relationship-basics/create/commit`                                                                                               | A signed-out visitor is offered no sign-out control                                                                                                  | the shell's sidebar draws **`Logout`** on the signed-out create stages                                                                                                                                                                                                                                                                                                                                                          | behaviour | confusing       | **uncarded** — the rail's account row in `components/layout/sidebar.tsx`                                    |
| D14 | modal · URL identity across stages        | initiator                  | `/templates/relationship/assessment-relationship-basics/create` → `…/relationship-basics/create/mode`                                                     | One address shape for one flow: either the record id redirects to the slug (as the detail page does, 308) or it is refused                           | the id-based address serves stage 1 with a 200 and no redirect, and every later stage is under the **slug** — the flow changes its own identity one step in                                                                                                                                                                                                                                                                     | behaviour | cosmetic        | **uncarded** — the `[slug]` read in `app/(mainlayout)/templates/relationship/[slug]/create/page.tsx`        |
| D15 | 404 surface inside the shell              | both                       | `/dashboard/relationships/<id you are not a party to>`                                                                                                    | The page's heading is the visible sentence, and the shell is quiet about a live session it does not have                                             | the first `h1` in the DOM is a decorative `404` numeral at **192px** (measured; `text-9xl md:text-[12rem]`, `text-background`, `animate-pulse`) while the real page headings measure **30px** (dashboard, list, detail, assessments) or 24px (template shelf) — so the heading a screen reader announces is the watermark, not "This page isn't here"                                                                           | layout    | cosmetic        | **uncarded** — the `<h1>` at `app/not-found.tsx`                                                            |
| D16 | lifecycle · invitation accept             | counterparty               | `/invite/<token>` (the only invitation surface reachable is `/invite/00000000-0000-4000-8000-000000000000`)                                               | A counterparty can open the invitation they were sent and accept it, so the accept screen and the before/after-answer gate can be exercised          | **unreachable in this environment**: `session_invite` holds **0 rows** and no relationship is published, because sending requires a card on file — so there is no token to open. The unknown-token band ("No such invitation — This link does not name an invitation. Check that it was copied whole.") is all the demo can show; the counterparty's role was otherwise exercised through the dashboard and the shared instance | data      | blocks the flow | **shipped in part** — `260e4684` (#985); the accept _screen_ is still unreachable (see _D16_ below)         |

The stage-1 address in D8 is the id form the walk used
(`/templates/relationship/assessment-relationship-basics/create`); the slug form behaves the same.

## What each row's outcome rests on

Every `shipped` row below names the commit on `main` and the fact that commit changed. A row was not
marked shipped because a card said so.

| row | commit                                                                                                                                                            | what the commit made true                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `ada118bc` fix(relationships) · #958 a relationship with no initiator member has an initiator (#981)                                                              | `lib/relationship/initiator.ts` answers "who is the initiator" from the **column first, the `party` seat when the column is `NULL`** — the column alone made `relationship-assessment-instance-avery-rowan` tell Avery they were the Counterparty on a row whose Initiator seat they hold, which is what removed the publish band, `Invite Members` and the Aspects editor |
| D2  | `fab204aa` fix(relationship) · #975 D2/D9 the detail page says whose relationship it is (#986), band half in `ada118bc` (#981)                                    | the role is resolved once and stated once; the detail page's copy names whose relationship it is rather than drawing a chip and a contradicting read-only band                                                                                                                                                                                                             |
| D3  | `260e4684` fix(seed) · #975 the seeded relationship now says what its own session says, and carries the invitation that put the counterparty in their seat (#985) | the seed writes the status its own session implies (`complete`, `published_at`, `completed_at`, converging on re-seed) instead of leaving the `draft` default over a session deriving `complete`                                                                                                                                                                           |
| D5  | `fab204aa` (#986)                                                                                                                                                 | the Counterparty's name on the card is read as a **seat** (`party`) and falls back to the invitation's typed name — the pre-fix read was `session_invite.counterparty_name` alone, so with no invitation row the initiator's card could only print "Not claimed yet"                                                                                                       |
| D7  | `b34d09b8` fix(modal) · #975 stage 2 says why it will not advance (#984)                                                                                          | the refused press prints the fixture's own `Opinions Mode is required.` / `Alignment Setting is required.` at the field it is about, with `aria-describedby`/`aria-invalid` and focus moved; `noValidate` replaces the browser bubble without relaxing a `required`                                                                                                        |
| D9  | `fab204aa` (#986)                                                                                                                                                 | the `h1` is the relationship's own title, and the page names the two people                                                                                                                                                                                                                                                                                                |
| D11 | `260e4684` (#985)                                                                                                                                                 | stage 5's plan prices are read from `data/billing-plans.ts` instead of typed, so `$9.95`/`$19.85` became the shelf's own `$8.95`/`$16.95`                                                                                                                                                                                                                                  |
| D12 | `37066f70` fix(dashboard) · #975 D12 the Edit relationship dialog names the Aspects and hands back the page's editor (#991)                                       | the dialog states where the Aspects are edited and hands back the page's inline editor, rather than implying it writes them                                                                                                                                                                                                                                                |
| D16 | `260e4684` (#985)                                                                                                                                                 | the seed writes the claimed `session_invite` row that put each counterparty in their seat, and `V31` in `scripts/db-verify.mjs` fails by id if a seeded relationship stops agreeing with its own session                                                                                                                                                                   |

**`V31` is the regression guard** the D3/D11/D16 fix added: _a seeded relationship is coherent with
its own session_ — status not `draft`/`pending` over a `complete` session, `published_at` present,
`session_invite` present and claimed. The invariant is checked, not documented, which is the pattern
that #962 established.

### D4 — closed as not a defect, with the measurement

D4 was **not** fixed by a commit, and no read changed. Re-measuring the two surfaces over the same
rows found the counters and `/assessments` agreeing; the gap the inventory recorded compared an
Overview card with a _different tab_ of the list, plus the documented narrowing a card does not
carry. The honest outcome is `closed, not a defect` — not a shipped row — and this file says so
rather than pointing at a commit that never touched it.

### D16 — what the seed fixed, and what is still open

`260e4684` closed the _mechanism_: `session_invite` was empty because no card was on file, and a
`session_invite` row is the only path that binds a counterparty to a seat. The seeded invitation is
**claimed** (`claimed_at` stamped), because the seat it opened was taken — which is what makes the
seeded pair answerable at all.

What that leaves open is the **accept screen**: `/invite/<token>` for an _unclaimed_ invitation needs
a relationship nobody has answered, and the five-party demo catalogue has none. Making one is a
**fixture decision for the owner** (a fifth seeded relationship left unanswered), not a read fix, and
it was named as open in #985 rather than invented. Until it exists, the counterparty's
before-both-answered state has no reachable screen.

## What each role actually sees (the substance behind D1–D6)

Captured with the two demo accounts, one session each, at inventory time:

| Screen                              | Initiator                                                               | Counterparty                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/dashboard`                        | "Welcome back, Avery" · Needs your answers 1 · Reports open 0           | "Welcome back, Rowan" · 0 / 0 / 0                                                                          |
| `/dashboard/relationships`          | 1 row, chip `Initiator`, "with · Not claimed yet", Draft                | 1 row, chip `Counterparty`, "with · Avery", Draft                                                          |
| detail                              | chip `Initiator` **and** "You are the Counterparty … read-only for you" | chip `Counterparty`, same read-only band, the same 5 Aspects                                               |
| `/assessments`                      | Gap ready 1 · "You have both accepted"                                  | Gap ready 1 · "You have both accepted"                                                                     |
| `/assessment/instances/<id>`        | not captured (initiator view of the same session)                       | "You are answering as Rowan, the Counterparty … the report is open to both of you", 6 of 20 Gaps over Soft |
| `/assessment/instances/<id>/answer` | —                                                                       | sealed sheet, "There is nothing to submit on this page"                                                    |
| `/assessment/instances/<id>/report` | —                                                                       | 6 Gaps, widest Gap 3, read-only                                                                            |

The counterparty's read-only detail led with the **"Keep these Aspects for yourself / Save this
template to My Templates"** fork panel; the sentence explaining "this screen is read-only for you"
was the third block down, after "Where this stands". For a reader whose only job on the page is to
be told why they cannot act, the upsell was the first thing they met. That observation is not one of
the 16 rows and is not carded — it is recorded here because it is the kind of thing a row gets
written about next time.

## Expected and NOT found (a finding too)

- **The desktop column is right.** Every dashboard page measured `main.x = 250` with content blocks
  beginning at **x=274, width 1126** — exactly `docs/specs/ux-reference-patterns.md` §1 — and
  `overflowX = 0` on all of them. The `h1` sits inside that column and never centred: measured
  **x=306** on the relationships list and the template shelf, **x=330** on the relationship detail
  and the template detail, **x=394** on the dashboard (inside its card's padding) — a centred header
  on a 1126-wide column would sit near x≈683, and none does.
- **Responsive holds.** At 390 CSS px `/dashboard`, `/dashboard/relationships`, a relationship detail
  and stage 1 of the modal all reflow to `main = 0…390` with **no horizontal overflow**. The modal's
  1440-wide sheet is the only 1440-wide surface at 390, and it reflows inside.
- **The send gate is honest.** On stage 5 with no card on file, `send email to counterparty now`
  measures `disabled=true` **and** the column carries the sentence that says what unlocks it;
  `Continue as Draft` is present and lands on `/dashboard/relationships`.
- **Stage 3's last-Aspect rule** could not be provoked — with five rows every `Remove` is enabled,
  which is the specified behaviour; removing down to one row is not a state this walk reaches.
- **The answer sheet refuses to be a control that can only be refused**: a sealed,
  already-accepted sheet draws the stored marks and says "There is nothing to submit on this page".
- **An unknown invitation band is clear and quiet**: `/invite/<random>` answers "No such invitation —
  This link does not name an invitation. Check that it was copied whole." with no phantom rail, which
  is what `docs/specs/flow-stages.md` asks for.
- **`/dashboard/user` 404s on AlignSynch and that is not a defect** — the route is QuizHub's account
  home; the only links to it live behind `seesQuizProduct`, which is off on this brand.
- **The aspect display-vs-edit divergence the owner reported did not reproduce as stated.** Aspects
  render in the read-only list for both roles (`data-relationship-aspect` × 5 on the counterparty's
  view), in the editable list on the initiator's own draft (5 rows with ✎/✕), and in stage 3. What
  was found is the **inverse** gap, filed as D12: the Edit dialog shows no Aspects at all. If the
  report was about a specific Aspect dropping out of a specific view, it needs the screen it was seen
  on — nothing on these three surfaces loses a row.
- **No layout breakage on the modal.** Stage routing, the five-cell rail (`Stage n of 5`), the
  `[Back][Cancel]` left group and the flush-right advance all render as `docs/specs/flow-stages.md`
  describes; the stage column begins at x=280 on every stage.

## Limitations (stated, not glossed)

1. **No invitation could be sent at audit time, so the counterparty's accept path (`/invite/<token>`)
   had no screenshot.** Sending needs a card on file; `session_invite` was empty on the branch.
   `demo:flow`'s card step mounts Stripe in test mode and finds the fields (`input[name=cardNumber]`,
   `cardExpiry`, `cardCvc`, `billingName`, `billingCountry` inside `js.stripe.com`) but its selector
   set does not match them, so its "could not put a card on file" finding is **a harness gap, not a
   product verdict** — it was not carded as a defect. The card step has since moved (#1038).
2. **The before-both-answered state was not reachable without writing to the shared demo branch.**
   The only relationship the demo accounts are parties to already carried 5+5 opinions and both
   acceptances. The gate was read from `lib/flow/answer-gate.ts` and the _after_ state captured for
   both roles; the _before_ state is untested by the demo dataset — and per D3 the dataset could not
   even say consistently which state it was in. This is the same gap D16 still leaves open.
3. **The two drafts created during the walk were removed** (relationship, session, party cascade), so
   the branch went back to its 4 seeded relationships. No product code, fixture or doc was changed by
   the audit.

## The six rows still uncarded

Each is a defect with a URL and a reproduction in the table above; none has a commit. The last column
is what a fix would touch — not a design, just the file that decides the behaviour.

| row | one line                                                                                                                               | what a fix would touch                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D6  | a never-sent draft is listed on `/assessments` as `Invited` — "Yours to answer" — while its own detail says nothing was sent           | the derived status ladder (`lib/flow/state.ts`, `lib/flow/stage.ts`) or the `/assessments` read predicate: a draft with no session has no invitation, so it cannot be `awaiting_counterparty`            |
| D8  | stage 1's refused submit says nothing on the page; the refusal is the browser's `required` bubble                                      | stage 1's `<form>` in `components/assessment-flow/create-relationship.tsx` and `StageOneFields` — the same `noValidate` + field-sentence pattern stage 2 adopted in #984                                 |
| D10 | a payment opened from the dashboard drops the reader into stage 5 of the creation modal, whose `Cancel` leaves to the template library | `payHref` in `components/dashboard/relationship-detail.tsx` (`createInviteForPath`, the #794 handles) and where the modal's close lands                                                                  |
| D13 | the rail draws a sign-out row for a visitor who has no session, on the signed-out create stages                                        | the account row in `components/layout/sidebar.tsx`, derived from the session the layout already resolves (`lib/shell/account-menu.ts` is where the header's own version of this decision landed in #992) |
| D14 | the flow answers 200 on an id-based stage-1 address and then switches to the slug for every later stage                                | the `[slug]` read in `app/(mainlayout)/templates/relationship/[slug]/create/page.tsx` (`readLibraryTemplate`) or a `next.config.mjs` redirect if the id form must be refused                             |
| D15 | the first `h1` in the DOM of a 404 page is a decorative 192px numeral, so the heading a screen reader announces is the watermark       | the `<h1>` at `app/not-found.tsx` — the numeral should not be the heading, and the real sentence should be                                                                                               |

## What to fix first

The two rows that made the audit's central finding also made every other row harder to read, and both
now have commits: **D1** (the initiator's own surface was unreachable) and **D3** (the dataset said
the Gap was open over a relationship whose status said nothing was sent). With those two shipped, a
stranger reading the demo meets a coherent pair.

Of the six still uncarded, **D6 and D8 are the two a person hits**: D6 puts a draft in a list it does
not belong in and labels it `Invited`, and D8 is the same silent-refusal defect #984 fixed one stage
later — the fix is the pattern that already exists in the tree.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Specs & design briefs** › UX defect inventory (#975) · prev [UI/UX audit](ui-ux-audit.md) · next [Answer input](ux-input.md)

<!-- docs-nav:end -->
