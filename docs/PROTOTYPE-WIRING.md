# Prototype wiring — the one screen that exists, what it moves into, and what must not be wired

Sprint `t_1ba42696` ended with "then — and only then — a wiring plan, one card per cohort". This is
that plan, and it is written against the tree rather than against the sprint's premise, because the
two disagree.

Measured at `origin/main` `cb862e5c` on 2026-11-01, with the only prototype branch read commit by
commit (`origin/proto/console-overview`, head `3bfc4bb2`, 19 files, PR #339).

**The short version.** One cohort was prototyped: cohort 1, the console namespace and the admin
overview. It is unmerged, green, and was never approved by the owner. Cohorts 2–5 produced no
branch, no route, no fixture and no screenshots — their cards were archived before they ran. So this
plan has **one wiring section and one wiring card**. A card per cohort would have had to invent four
prototype routes, and a wiring card whose spec names a file that does not exist is a card that
starts by inventing the file.

## The measured state

| cohort | prototype route(s)               | fixture                      | copy fixture                      | code                                     | state                       |
| ------ | -------------------------------- | ---------------------------- | --------------------------------- | ---------------------------------------- | --------------------------- |
| C1     | `/prototype`, `/prototype/admin` | `data/prototypes/console.ts` | `data/pages/prototype-console.ts` | `origin/proto/console-overview`, PR #339 | built, unmerged, unapproved |
| C2     | —                                | —                            | —                                 | none                                     | not prototyped              |
| C3     | —                                | —                            | —                                 | none                                     | not prototyped              |
| C4     | —                                | —                            | —                                 | none                                     | not prototyped              |
| C5     | —                                | —                            | —                                 | none                                     | not prototyped              |

The four empty rows are not an omission in this document; they are the finding. What backs them:

- `git ls-remote --heads origin` lists exactly one prototype ref, `refs/heads/proto/console-overview`.
- `git log --all -- '*prototype*'` adds prototype files in one commit (`0fff36e2`), on that branch.
- `docs/PROTOTYPE-CONSOLE.md` does not exist on `main`. On the branch it has cohort 1's section and
  nothing else.
- The fixture's own review index lists one screen:
  `prototypeScreens = [{ id: "admin", href: "/prototype/admin", eventualRoute: "/admin" }]`.

## Where the sprint's premise and the tree disagree

The card this plan answers opens with "This card is gated on cohort 5 being **approved**, so by the
time it dispatches the owner has seen all five cohorts' screenshots." Neither half survived contact
with the board:

1. **No cohort was approved.** All five cohort cards (`t_e0484f0d`, `t_52c31c66`, `t_23b4713e`,
   `t_95993a7b`, `t_424f7423`) are archived with one reason, verbatim:
   "BLOCKED: Superseded — this rebuild is re-issued on deepseek-v4-pro with the UI mapping as the
   spec. Do not dispatch on flash." No approval event, no review column entry, no owner sign-off
   exists for any of the five.
2. **There is no five-cohort mapping table.** `docs/PROTOTYPE-CONSOLE.md` is a branch artefact
   (PR #339), and it documents cohort 1 only. Its own text defers the rest: "Cohort 2's
   `/prototype/relationships` and cohort 4's `/prototype/admin/gaps` are listed on the overview as
   **text rows** with their routes, not as links, until the cohort that mounts them adds the link."
3. **The screenshots the gate was waiting on do not exist for four cohorts.** Cohort 1's captures
   are attached to `t_e0484f0d`, not committed; cohorts 2–5 never ran a dev server.
4. **The architecture moved while the cohorts were open.** At 09:12–09:20 the board created `/v1`
   (`t_6271a7a3`, "the whole product clickable at `/v1`", with a persona switcher and an in-browser
   store) and four variation cards (`t_a97eea09` template editor, `t_d0450aa5` catalogue + grid,
   `t_0cc40793` verdict + opinion sheet, `t_5c5df6bb` the ancestor check), and archived the
   `/preview` studio (`t_2f767cd9`). Those five cards are the live path to the surfaces cohorts 2–4
   were going to mock. Wiring a prototype that nobody will build is not a plan; it is a queue item
   against a dead branch.
5. **The prototype routes are outside the parity ratchet.** `content/routes.ts` gained `/prototype`
   and `/prototype/admin` on the branch, but `tests/parity/routes.ts` was not touched, so no parity
   summary covers either route. A wired screen must enter parity — the prototype never did.

What this leaves is one honest wiring job: cohort 1's admin overview, the screen that fills the gap
where `/admin` has no index today (`app/(mainlayout)/admin/` holds `instances/` and `gaps/` and
nothing else).

## Cohort 1 — the namespace and the admin overview

Two prototype routes, one gate, one fixture, one copy module. The gate is called once, in
`app/(mainlayout)/prototype/layout.tsx`, through `lib/prototype-gate.ts::requirePrototypeScreens()`,
which resolves `console.prototypes` (`data/flags.ts`: `default: false`, `adminBypass: true`, no
`templates`) through `lib/auth/flag-gate.ts::enabledForCaller` and renders `notFound()` for anyone
but an admin. The copy lives in `data/pages/prototype-console.ts` at a `budget: 0` entry in
`data/pages/budget.ts`, and the band every screen carries is mounted by the layout, not by a page.

### `/prototype` — the index (no product route)

The index is the review surface, not a destination. Its own page says so: "the index of prototype
screens that render today". When the last prototype screen is wired, `/prototype` goes away with the
namespace — it does not become `/admin` or anything else, and it must not be the landing page an
operator keeps.

- **Files that go away at the end:** `app/(mainlayout)/prototype/page.tsx`,
  `components/prototype/prototype-index.tsx`, the `prototypeIndexPageCopy` half of
  `data/pages/prototype-console.ts`, and the two `/prototype` entries in `data/pages/budget.ts`,
  `data/pages/index.ts`, `content/routes.ts` and `data/ui-registry.ts`.
- **Read:** `data/prototypes/console.ts::prototypeScreens` — one record, `{ id, href, eventualRoute }`.
- **Migration:** none. Nothing here touches a table.
- **Write path:** none.
- **Flag:** none of its own; it inherits `console.prototypes` from the layout. Deleting the subtree
  deletes the flag's last consumer.
- **Tests:** `tests/prototype-fixture.test.ts` asserts the record and the copy fixture agree; both
  move to the wired screen's test (below) and the index-specific assertions are deleted with it.

### `/prototype/admin` → `/admin`

This is the screen worth wiring: an operator's landing page that shows the population, what is stuck,
and what is not built yet. The fixture's own record already names the destination —
`eventualRoute: "/admin"` — and `docs/PROTOTYPE-CONSOLE.md` records the state as "not built".

**The move.**

| what                         | from                                                      | to                                                     |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| the view                     | `components/prototype/admin-overview.tsx`                 | `components/admin/admin-overview.tsx`                  |
| its two declared prop shapes | `CountFigures`, `AttentionRow` (beside the view)          | beside the view, unchanged in name                     |
| the route                    | `app/(mainlayout)/prototype/admin/page.tsx`               | `app/(mainlayout)/admin/page.tsx` (new file)           |
| the gate                     | `lib/prototype-gate.ts` + the prototype layout            | `lib/auth/require-role.ts::requireAdmin()` in the page |
| the words                    | `data/pages/prototype-console.ts::prototypeAdminPageCopy` | `data/pages/admin-overview.ts` (new fixture)           |
| the records                  | `data/prototypes/console.ts`                              | deleted; the page reads Postgres                       |

**Files that go away at the end:** everything under `app/(mainlayout)/prototype/`,
`components/prototype/` (all three views — the band exists only because prototype screens exist),
`lib/prototype-gate.ts`, `data/prototypes/console.ts`, `data/pages/prototype-console.ts`, the
`console.prototypes` entry in `data/flags.ts`, and the two budget/routes/index/ui-registry entries.
The branch's `docs/PROTOTYPE-CONSOLE.md` goes with them: a mapping table for screens that no longer
exist is a second description of the product.

**The read.** The four count bands and the attention table are reductions over rows an admin read
already returns. What exists and what does not:

| figure on the mock                        | where a wired `/admin` gets it                                                                   | exists?            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------ |
| relationships (6)                         | `lib/db/admin-instances.ts::listAdminInstances(now)` — row count                                 | yes                |
| invited / connected / sharing / aligned   | filter those rows on `AdminInstanceRow.stage`                                                    | yes                |
| templates (4), built-in (3), authored (1) | a new cross-account count over `record` (see below)                                              | **no**             |
| awaiting invitation (2)                   | `initiator` / `counterparty` `SeatRow.state` in `invited` or `expired` (`seatStateOf`)           | yes                |
| complete (2)                              | `AdminInstanceRow.status === "complete"` (`lib/flow/state.ts::INSTANCE_STATUSES`)                | yes                |
| attention rows                            | filter the same rows: stage before `sharing`, or a seat in `invited`/`expired`, or idle ≥ 7 days | yes                |
| "N days idle" per row                     | `AdminInstanceRow.lastActivity` (ISO instant)                                                    | yes, as an instant |

The one missing read is the template population, and it is worth naming precisely because the
obvious candidate is wrong. `lib/db/template-library.ts::listLibraryTemplates(userId)` is **viewer
scoped** (`WHERE r.author_user_id IS NULL OR r.author_user_id = $1`) and **excludes templates that
already have an instance** (`NOT EXISTS (SELECT 1 FROM assessment_instance ai WHERE ai.record_id = r.id)`).
Wiring the "4 templates" figure on it would report 3 for the mock's own population — the exact
undercount that looks like a correct number. The wired screen needs one new statement, in the module
that already owns admin reads:

```sql
SELECT count(*)::int AS total,
       count(*) FILTER (WHERE author_user_id IS NULL)::int AS platform,
       count(*) FILTER (WHERE author_user_id IS NOT NULL)::int AS authored
FROM record
WHERE record_type = 'assessment' AND status <> 'draft';
```

Named `listAdminOverview` / `countAdminTemplates` in `lib/db/admin-instances.ts` (one admin read
module, one retry path through `queryRows`), with the same `DatabaseUnavailableError` handling
`/admin/instances` uses — a read that does not answer is a panel, not a Next 500.

**The migration: none.** Every column the wired screen needs is already in the schema.
`assessment_instance.name` and `party.submitted_at` landed in `db/migrations/0011_console_columns.sql`,
`record.author_user_id` in the same file, the invite instants in `0002_two_party_flow.sql` and
`0010_invite_resend.sql`, `alignment_setting` in `0008_alignment_setting.sql`. A wiring card that
adds a migration for this screen is adding one for a field nobody asked for.

**The maintenance fields — approved: none of the four.** `docs/specs/maintenance-fields.md`
recommends adding **only the optional relationship name**, pre-filled with the template title
("submit untouched and the default is what today's build does anyway"), and it cuts the other three
outright: "Cut outright as form fields: Relationship Type, Relationship Realm, Relationship
Descriptor." No approval for any of the four exists on the board — the only card that mentioned them
(`t_52c31c66`, cohort 2) was archived as superseded, and the sprint's own note called them "the
relationship maintenance fields (spec use case 100: name/type/realm/descriptor, which have no schema
at all)".

- The **name** does not need a migration: it is `assessment_instance.name`, added in `0011`, read
  through `instanceNameOf()` in `content/assessment.ts` (falls back to the template title when NULL),
  and it is already on `AdminInstanceRow.name`.
- **Type, realm and descriptor** need one **if** the owner ever approves them, and it would be
  `db/migrations/0013_maintenance_fields.sql` — three nullable `TEXT` columns on
  `assessment_instance`, no default, no backfill, each with the `btrim`/length `CHECK` pattern
  `0011` established for `name`. That migration is a separate decision and is **not** part of this
  wiring. Note the spec and the schema already disagree in one place worth fixing in whichever card
  touches it: the spec says "the name is `record.title` (exists)", while the column that actually
  holds it is `assessment_instance.name` (`0011`). The read selects both
  (`instance_name`, plus the template's `title`), so nothing is broken today — but a card that
  follows the spec's sentence literally would write the name to the wrong table.

**The write path: none.** `/admin` is a read-and-filter surface, and `lib/db/admin-instances.ts` says
why in its own header: "No destructive verb. Nothing here writes: no delete, no force-complete, no
status flip." So the wiring card adds no route handler, no POST, no session rule beyond
`requireAdmin()`, and no refusal codes.

That matters for the sprint's other line — that the aspect editor's save is the first real write in
the console since #255. It is, and it is **not in this cohort**. Cohort 3 was where it would have
been prototyped, and cohort 3 produced nothing; the editor is now being built directly as a variation
(`t_a97eea09`, `components/assessment-flow/template-editor.tsx`). When its save lands it will be a
route handler under `app/(mainlayout)/assessment/templates/[templateId]/`, gated by the viewer's
role for that template (`record.author_user_id = $viewer`), refusing a non-author with the same 404
`requireAdmin` produces rather than a 403 — and none of that belongs in a card that wires an
operator's read-only index.

**The flag.** `console.prototypes` is **deleted**, not defaulted off. A wired screen that stays
behind the prototype flag is a screen nobody can use: the flag's only two consumers are the
`/prototype` index and `/prototype/admin`, and the wired `/admin` is gated by `requireAdmin()`, which
is the rule `/admin/instances` and `/admin/gaps` already use. Concretely, the wiring card removes:

- the `console.prototypes` definition and `note` from `data/flags.ts`;
- `tests/flags.test.ts`'s admin-bypass census drops from two flags back to one
  (`community.leaderboard`) — the test asserts the census, so this is a required edit, not a cleanup;
- `PROTOTYPE_FLAG` and the `prototypeScreensEnabled` half of `lib/prototype-gate.ts` (the file goes);
- the two prototype entries in `content/routes.ts`, `data/pages/budget.ts`, `data/pages/index.ts`
  and `data/ui-registry.ts`, plus a regenerated `docs/ui-registry.md`.

**The tests.**

| test                                    | what it proves                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/admin-overview.test.ts` (new)    | each figure equals a filter over the rows the read returns; the attention row set is exactly the stalled/stale ones; no field on `AttentionRow` can carry an answer or a score |
| `tests/admin-instance-registry.test.ts` | unchanged — the wired overview must not loosen the blind rule the registry pins                                                                                                |
| `tests/require-role.test.ts`            | the refusal shape: member → `NEXT_NOT_FOUND`, signed-out → `/login?next=/admin`, admin → the page                                                                              |
| `tests/flags.test.ts`                   | the flag census after `console.prototypes` is deleted                                                                                                                          |
| `pnpm parity`                           | `/admin` enters `tests/parity/routes.ts` and gets a summary via `pnpm parity:update --reason "…"` (the prototype routes never had one)                                         |
| `pnpm data:check`                       | E23 budget: `/admin` names `data/pages/admin-overview.ts` at the same `budget: 0` the prototype held, `mounts` dropped with the layout                                         |
| `pnpm ui:registry`                      | `/admin` replaces both `/prototype` entries with `status: "db"`, and `components/admin` replaces `components/prototype` as the domain                                          |

`tests/prototype-fixture.test.ts` and `tests/prototype-gate.test.ts` are **deleted** with the subtree,
not renamed: their subject is the fixture and the flag, and both cease to exist. The assertions worth
keeping (the counts are filters; the stage list equals `content/stages.ts`) move into
`tests/admin-overview.test.ts` against the row shape, not against the fixture.

**The order.** Dependency first, screen second, tests last:

1. **Merge PR #339.** The prototype must exist on `main` before it can be wired; it is green on
   `3bfc4bb2` (`typecheck / lint / build` for both brands) and open.
2. **Merge `origin/main` into the branch once more** before that, and re-gate — the branch was last
   updated at 12:30Z and `main` has moved since (`cb862e5c`).
3. **The read.** `listAdminInstances(now)` is reused as-is; add the template-population statement to
   `lib/db/admin-instances.ts`, with `DatabaseUnavailableError` handling. No migration.
4. **The screen.** `app/(mainlayout)/admin/page.tsx` (gate first, then read, then render;
   `force-dynamic`; `robots: noindex`), `components/admin/admin-overview.tsx` moved from the
   prototype view, `data/pages/admin-overview.ts` fixture, budget entry, `content/routes.ts` entry.
5. **The nav row.** One row in `components/layout/nav-menus.tsx` behind `sees(viewer, "admin-console")`
   with a new label in `data/pages/shell.ts`. Do **not** reuse `console-overview` — that id is
   `/dashboard`'s label ("Overview"), and two destinations under one word is the drift the fixture
   exists to prevent.
6. **Delete the namespace.** `/prototype/**`, `components/prototype/**`, `lib/prototype-gate.ts`,
   `data/prototypes/console.ts`, `data/pages/prototype-console.ts`, the flag, the routes/budget/index
   entries, `docs/PROTOTYPE-CONSOLE.md`.
7. **Tests and ratchets.** The table above, `pnpm parity:update`, `pnpm ui:registry`, `pnpm format`.

### What the mock says that the live read does not

Three places where the prototype's vocabulary and the shipped model's disagree. Each is a decision
for the wiring card, and any of them silently copied becomes a screen printing a state the database
cannot produce:

| the mock                                                 | the live model                                                                                                | what the wiring does                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| seat states `claimed`, `invited`, `unclaimed`, `expired` | `SEAT_STATES = claimed, seat, invited, expired, none` (`lib/admin/instance-registry.ts`)                      | render `seatStateOf()`'s five states; the mock's "Seat, no account" is `seat`; `none` has no mock equivalent        |
| "N days idle" per attention row                          | the registry prints `formatDate(row.lastActivity)` — a date, not an age                                       | choose one vocabulary for "when" across the console, or record why the overview says age and the registry says date |
| "4 templates, 3 built-in, 1 authored"                    | no cross-account template count exists; `listLibraryTemplates` is viewer-scoped and excludes in-use templates | the new statement above, and `authored` means `author_user_id IS NOT NULL`, not "authored by this admin"            |

Two further notes the branch recorded and the wiring must not lose:

- `components/console/stat-card-grid.tsx` has no non-linking variant **deliberately** ("a total with
  no list behind it is exactly the kind of number the console exists to stop printing", and
  `StatCard.href` is required). Once `/admin/instances` and `/admin/gaps` are reachable, the counts
  can become links — that is a decision on `StatCard`, not on this screen, and it can also stay as it
  is.
- The mock's index is also the only place that lists "screens still to come". Wired, that band has no
  subject: the two rows it names (cohort 2's relationships, cohort 4's gaps) are `/assessment/instances`
  and `/admin/gaps`, which already exist. Delete the band rather than re-point it.

## Cohorts 2–5 — no prototype, nothing to wire

Each of these was archived before it ran. None has a route, a fixture, a copy fixture, a flag entry,
or a screenshot. The surfaces each cohort named **already exist and are DB-backed**, which is what the
sprint's own decomposition said before it split — so the honest entry in this plan is the existing
file, not a prototype that was never drawn.

### Cohort 2 — relationships (list, detail, maintenance fields, seats, stage, invite states)

- **Prototype route:** none. **Fixture:** none. **Copy fixture:** none.
- **What exists instead:** `/assessment/instances` (`components/assessment-flow/my-instances.tsx`,
  read `lib/db/my-instances.ts`), `/assessment/instances/[instanceId]`
  (`components/assessment-flow/instance-view.tsx`), the stage sentence (`lib/flow/stage.ts`), seats
  and re-invite (`lib/flow/invite-state.ts`, `lib/flow/resend.ts`), and the operator's registry
  (`components/admin/instance-registry.tsx`, read `lib/db/admin-instances.ts`).
- **Reason verbatim:** "BLOCKED: Superseded — this rebuild is re-issued on deepseek-v4-pro with the
  UI mapping as the spec. Do not dispatch on flash."
- **Before a wiring card could exist:** a `/prototype/relationships` route, a fixture, a copy
  fixture, screenshots, and an approval. The only piece of it that is genuinely unwired is the
  relationship name field, and that is a create/edit path (`docs/specs/maintenance-fields.md`), not a
  prototype.

### Cohort 3 — assessments (template library variation, the aspect editor)

- **Prototype route:** none. **Fixture:** none. **Copy fixture:** none.
- **What exists instead:** `/assessment/templates` and `/assessment/templates/[templateId]`
  (`components/assessment-flow/template-{library,list,detail}.tsx`) — real reads, and a detail page
  documented as "the place the editor will land". The editor itself is being built now as a variation
  of `components/create/quiz-editor.tsx` (`t_a97eea09`), under guardrail #336, as a new file —
  not behind `console.prototypes`.
- **Reason verbatim:** same archive line as above.
- **Before a wiring card could exist:** the editor would have to be a prototype screen. It is not:
  it is being built as the shipped screen, so its wiring is that card's own delivery, not a second
  card here.

### Cohort 4 — opinions + gap (the per-instance report, the admin aggregate)

- **Prototype route:** none. **Fixture:** none. **Copy fixture:** none.
- **What exists instead:** the instance report (`components/assessment-flow/assessment-report.tsx`,
  derived in `lib/assessment-report.ts`) and the admin aggregate `/admin/gaps`
  (`components/console/gap-analysis.tsx`, read `lib/db/gap-rows.ts::readGapPopulation()`). The
  verdict hero is being built as a variation of the quiz result hero (`t_0cc40793`).
- **Reason verbatim:** same archive line as above.
- **Before a wiring card could exist:** a `/prototype/admin/gaps` route with its own fixture — a
  second population fixture, which is precisely the cost the sprint's decomposition avoided by not
  drawing what already reads Postgres.

### Cohort 5 — admin reach (every quiz route and every console route, measured)

- **Prototype route:** none. **Fixture:** none. **Copy fixture:** none.
- **What exists instead:** `requireAdmin()` (`lib/auth/require-role.ts`), the `admin-console`
  capability (`lib/nav.ts`), and the `product.quiz-surfaces` flag (`data/flags.ts`) which is the only
  per-template on in the tree.
- **Reason verbatim:** same archive line as above.
- **Before a wiring card could exist:** nothing on this card is a screen. Its subject is a
  caller-aware gate over 25 build-time-constant call sites, with a measured cost — which is a
  performance/architecture card, not a prototype-to-wired move. The sprint's decision 6 recorded the
  fallback ("if the caller-aware gate makes the 25 routes dynamic, it lands the admin preview path
  and reports the cost instead of accepting the regression"); that decision belongs to whoever takes
  admin reach next, and it is out of scope here.

## What must not be wired

- **Relationship Type, Relationship Realm, Relationship Descriptor.** Not approved, and the spec
  argues against them: "Cut outright as form fields: Relationship Type, Relationship Realm,
  Relationship Descriptor." The only approved-or-recommended field is the optional name, and it
  already has a column. If they are ever approved, the migration is
  `db/migrations/0013_maintenance_fields.sql` — named here so nobody adds them inline on a screen.
- **The four unbuilt cohorts' screens.** Their reason, verbatim, is the archive line above. A wiring
  card for `/prototype/relationships`, `/prototype/admin/gaps`, a template-editor prototype or an
  admin-reach prototype would each name a route that has never rendered.
- **`/prototype` (the index).** Its page says what it is: "the index of prototype screens that render
  today". It is the review artefact for the namespace, not a product route, and it disappears with
  the namespace rather than graduating into one.
- **`/v1/**`.** A different surface with a different job: a clickable product over an in-browser
  store (`lib/v1/store.tsx`, `data/v1/fixtures.ts`), used to review flows end to end without auth.
  Wiring it is not moving a route — it is replacing a store — and it is not this plan's subject.
- **Any screen still behind `console.prototypes` once its route is wired.** There is no such screen
  after cohort 1's wiring, because the flag is deleted with the subtree. Anything that reaches for
  the flag again is a new prototype and needs the whole namespace (gate, layout, fixture, budget
  entry) back, which is a decision, not a shortcut.

## The wiring cards

| card | cohort              | screens | created?                                    |
| ---- | ------------------- | ------- | ------------------------------------------- |
| W1   | C1 · admin overview | 1       | yes — one card, gated on #339 and the owner |
| W2   | C2 · relationships  | 0       | no — nothing was prototyped                 |
| W3   | C3 · assessments    | 0       | no — nothing was prototyped                 |
| W4   | C4 · opinions + gap | 0       | no — nothing was prototyped                 |
| W5   | C5 · admin reach    | 0       | no — nothing was prototyped                 |

W1 carries the precondition rather than assuming it: PR #339 merged **and** the owner's approval of
`/prototype/admin` at 1440 and 390 recorded on `t_e0484f0d`. With either missing, the card blocks
instead of wiring a screen nobody signed off. That is the same gate the sprint put on cohort 5, moved
to the one place where it still has a subject.
