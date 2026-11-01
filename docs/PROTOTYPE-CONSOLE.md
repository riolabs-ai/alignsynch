# Prototype console — the mock screens, and what each one varies

The console is being drawn in five cohorts (sprint `t_1ba42696`). A cohort that needs a screen which
cannot be reviewed against real data puts it behind `console.prototypes` under `/prototype`, renders
it from a fixture, and records it in this page. The page is the review artefact: **every screen names
the existing file it is a variation of**. A screen with no named ancestor is a defect — it is stopped
and escalated, not designed here (guardrail #336).

Each cohort appends **its own section** and edits nothing above it. The mapping table is the
acceptance test: if a row cannot fill the ancestor column with a path a reviewer can open, the screen
does not ship.

## How the namespace works (cohort 1, copied by 2–5)

| piece               | file                                      | what it decides                                                                                    |
| ------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| the flag            | `data/flags.ts`                           | `console.prototypes`: `default: false`, `adminBypass: true`, no `templates`                        |
| the gate            | `lib/prototype-gate.ts`                   | `requirePrototypeScreens()` → `notFound()` for anyone but an admin, or `FLAG_CONSOLE_PROTOTYPES=1` |
| where the gate runs | `app/(mainlayout)/prototype/layout.tsx`   | once, for every child segment; also mounts the prototype band                                      |
| the band            | `components/prototype/prototype-band.tsx` | the one sentence every prototype screen carries (`components/ui/alert.tsx`)                        |
| the records         | `data/prototypes/console.ts`              | the fixture rows; types declared there, no `lib/db/` import                                        |
| the words           | `data/pages/prototype-console.ts`         | both screens' `PageCopy` + the band's; budget 0                                                    |

`adminBypass` and **no `templates`**, and the omission is the mechanism: `resolveFlag` reads the
bypass first, then the env, then `templates`, then `default`, so a `templates: ["alignsynch"]` entry
would resolve the flag **on for every visitor** of that build. With only the bypass, an admin
resolves it on and a member or a signed-out visitor resolves it off.
`tests/prototype-gate.test.ts` asserts both halves.

## Cohort 1 — the namespace, the index, the admin overview

Two screens, both drawn over the same fixture: six relationships across the four stages, four
templates, three relationships quiet enough to need attention. Nothing on either screen is read from
Postgres and nothing is written; `/prototype` is the index the owner reviews from, `/prototype/admin`
is the overview that fills the gap where there is no `/admin` index today.

### The mapping table

| screen                             | URL                 | ancestor component (file)                                                                                                                                                                                                                                          | variation axes                                                                                                                                                             | new component needed                                                                                                                                  |
| ---------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prototype index                    | `/prototype`        | `components/dashboard/dashboard-overview.tsx` → `components/console/stat-card-grid.tsx` (the card: `Link` around `Card`, title, description, muted line) + `components/identity/account-home.tsx` → `components/console/overview.tsx` (the `h1` + subtitle header) | the cards are **destinations, not counts** (no figure at all); **one column, not four**; the detail line is the wired route instead of a count's caption                   | none — `<Link>` around `Card` written inline in `components/prototype/prototype-index.tsx`; `StatCard.value` is a `number` and a destination has none |
| Admin overview — header + counts   | `/prototype/admin`  | `components/identity/account-home.tsx` → `components/console/overview.tsx` (header + four count cards) → `components/console/stat-card-grid.tsx` / `components/dashboard/dashboard-overview.tsx` (Card, icon opposite the title, one figure, one caption)          | **the cards are not links** (`StatCard.href` is required; the lists these counts open are cohorts 2 and 4) and **the avatar is dropped** (no viewer record in the fixture) | none — the same `Card` in the grid's own 4-up rhythm, inline in `components/prototype/admin-overview.tsx`                                             |
| Admin overview — "needs attention" | `/prototype/admin`  | `components/my-quizzes/my-quizzes.tsx` → `components/admin/instance-registry.tsx` (the `Table` + stage `Badge` + seat cell) → `components/ui/table.tsx`, `components/ui/badge.tsx`                                                                                 | **columns: five, not nine**; no filters, no tabs, no row actions; the seat cell is unchanged (state badge + the seat's own name, or "unnamed")                             | none                                                                                                                                                  |
| Admin overview — "later cohort"    | `/prototype/admin`  | `components/admin/instance-registry.tsx` again (`Table` + `Badge`)                                                                                                                                                                                                 | **rows are text, not links** — the two routes they name are not mounted yet, and a link to a route that does not exist is a 404 dressed as navigation                      | none                                                                                                                                                  |
| The prototype band (every screen)  | all `/prototype/**` | `components/ui/alert.tsx`                                                                                                                                                                                                                                          | **mounted once in the layout, not per page**; amber, the console's existing "this is not what it looks like" colour                                                        | one shared view, `components/prototype/prototype-band.tsx` — `<Alert>` plus the fixture's sentence, so cohorts 2–5 cannot word it five ways           |

### The prototype → wired route map

| prototype route    | wired route | state                                                                               |
| ------------------ | ----------- | ----------------------------------------------------------------------------------- |
| `/prototype`       | —           | the review index; it does not become a product route                                |
| `/prototype/admin` | `/admin`    | not built. The sidebar still links straight to `/admin/instances` and `/admin/gaps` |

Cohort 2's `/prototype/relationships` and cohort 4's `/prototype/admin/gaps` are listed on the
overview as **text rows** with their routes, not as links, until the cohort that mounts them adds the
link. This table gains a row when that cohort lands; the wired route for each is that cohort's
decision, recorded there, not invented here.

### What this cohort could not build without a new component

Nothing. Every band above is an existing component, and the one new file — the band view — is
`<Alert>` plus a fixture sentence.

One friction point, recorded for the owner rather than worked around: **`components/console/stat-card-grid.tsx`
has no non-linking variant, deliberately** ("a total with no list behind it is exactly the kind of
number the console exists to stop printing"). The four counts on the overview therefore render from
`Card` in the grid's own column rhythm instead of through `StatCardGrid`, because every destination
they would open is a cohort that has not landed. If the owner prefers those counts to be links, the
change is to relax `StatCard.href` to optional in `components/console/**` — a decision on that
component, not on this screen.

### Mobile mechanics (measured, not assumed)

`docs/UI-MAPPING.md` is the tree's map of ancestors and its measured mobile mechanics; this cohort
copies them rather than re-deriving them. What was checked on these two screens at a 390px phone:

| mechanic                     | measured on `0fff36e2` + `origin/main`                                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| page gutter                  | free from `components/layout/main-layout.tsx` — the layout adds no second padding (that is the `px-4 py-10` divergence the map records)                                                                                                           |
| document overflow at 390px   | none — `documentElement.scrollWidth` 390 = `clientWidth` 390                                                                                                                                                                                      |
| the two wide tables at 390px | each scrolls inside `components/ui/table.tsx`'s own `relative w-full overflow-auto` wrapper (512px of content in a 364px wrapper) — the scroll-sideways half of the leaderboard mechanic, unchanged from `components/admin/instance-registry.tsx` |
| count cards                  | `grid gap-4 md:grid-cols-2 lg:grid-cols-4` — `components/console/stat-card-grid.tsx`'s string, so one column below `md` (768px here, not Tailwind's)                                                                                              |
| icons, badges, avatars       | lucide at the caller's `h-4 w-4`, `components/ui/badge.tsx` variants, no images on either screen                                                                                                                                                  |

No column is dropped at `md` on the attention table, because its ancestor
(`components/admin/instance-registry.tsx`) keeps all nine and dropping columns here would be a new
mechanic rather than a reuse of one.

### Evidence

- `bash scripts/verify.sh` → `EXIT=0`, `lane=code`, green including `data:check` (both routes measure
  `0/0` page-copy literals), `test`, `parity` and `next build` (both routes build **ƒ**,
  request-time — the gate is not prerendered).
- The gate, measured on a dev server at a unique port (`BRAND=alignsynch pnpm dev -p 3141`, signed
  out):
  - override **off** (the default): `/prototype/admin` → **404**, `/prototype` → **404**
  - `FLAG_CONSOLE_PROTOTYPES=1`: `/prototype/admin` → **200**, `/prototype` → **200**
- Screenshots at 1440×900 and 390×844 for both screens, each captured only after asserting the
  screen's own `h1` from the fixture (`Admin overview`, `Prototype screens`) and the presence of the
  prototype band — so a 404 could not pass as a capture. They are attached to the card, not committed.
- The figures on the overview are asserted against hand-written filters over the fixture rows in
  `tests/prototype-fixture.test.ts` (six relationships, four templates, two seats awaiting an
  invitation, two complete, three rows needing attention) — a count of rows, never a percentage.
