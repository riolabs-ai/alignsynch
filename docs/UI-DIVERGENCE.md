# The divergence table

Every surface in the console, admin, dashboard, assessment-template and marketing paths, one row per
file, with a verdict: what it is, who renders it, and whether it should compose something that
already exists. Compiled on `2fedcd58` (2026-11-01) for the parent card _Repair · restore the top
menu + footer, header identity, and audit every bespoke surface_.

The rule it enforces is the owner's, from [TEMPLATE-DOCTRINE.md](TEMPLATE-DOCTRINE.md): AlignSynch
and QuizHub are two configurations of one core, so a screen only one expression can ever use is a
screen the next expression has to rebuild. "Bespoke" here is **composition, not file location** — a
page that hand-rolls its title band, its own table, its own empty state or its own spacing is
bespoke even when it lives in `components/`.

## How a row was decided

For each file: name the surface it is a version of, then count the axes that change against
[TEMPLATE-DOCTRINE.md](TEMPLATE-DOCTRINE.md)'s table — columns, filters, row actions, empty state,
detail panel, data source. **One axis** is a configuration of an existing surface. **Several at
once, or a different object**, is a new surface, and then the question is whether the template for
it exists as a file. The reference files this table names, and what each one is the template of:

| the template                                                                    | what it is a template of                                                                                      |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `components/my-quizzes/my-quizzes.tsx` + `app/(mainlayout)/my-quizzes/page.tsx` | a record list: tabs, search, per-row actions, its own empty state                                             |
| `components/admin/instance-registry.tsx`                                        | the same list as a table: `components/ui/table.tsx` + Tabs + Select + Card, filters client-side over one read |
| `components/identity/account-home.tsx`                                          | a detail view of the signed-in person: identity header, then cards                                            |
| `components/support/article-detail.tsx` and `components/news/news-article.tsx`  | an article page: blocks in, related articles out                                                              |
| `components/console/stat-card-grid.tsx`                                         | "four numbers, each one a question", each a link to its list                                                  |
| `components/ui/*`                                                               | the primitives: `table`, `card`, `alert`, `button`, `badge`, `page-header`, `tabs`                            |

Verdict vocabulary — exactly three, so the next card can filter this table mechanically:

- **`wrap <component>`** — hand-built markup that should compose an existing component.
- **`rewrite onto <path>`** — a bespoke structure with a named template ancestor.
- **`keep — <reason>`** — no ancestor exists, or the divergence is deliberate and recorded.

## The table

27 files. Verdicts: **4 wrap**, **3 rewrite onto**, **20 keep**.

| file                                                                    | what it is                                                                                                                                                                                                                                               | used by                                            | verdict                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/(marketing)/layout.tsx`                                            | the public group's chrome: a header, a `flex-1` slot and a footer, and nothing else (no sidebar, no palette, no drawers)                                                                                                                                 | all seven routes in the group                      | rewrite onto components/layout/footer.tsx — the footer it mounts is a three-fact bespoke duplicate; card A (t_561727e5) mounts the shell's `Footer` and the menu-bearing header here                                                                                                                        |
| `app/(marketing)/page.tsx`                                              | a closed `switch` on `BrandId`: twelve quiz bands or one alignment view; no layout of its own but a `space-y-4 xl:space-y-8 pb-8` wrapper                                                                                                                | `/` on both brands                                 | keep — this is the doctrine's own pattern: a brand switch over band components, where a third brand is a compile error rather than an inherited page                                                                                                                                                        |
| `app/(marketing)/pricing/page.tsx`                                      | request-time: `readPricingPlanRows()` plus the viewer's entitlement, handed to `components/pricing/*` as sections                                                                                                                                        | `/pricing`                                         | keep — three fixture-driven bands and a plan grid built from `Card`/`Button`/`Badge`/`Switch`; the only markup is a `min-h-screen bg-background` wrapper                                                                                                                                                    |
| `app/(marketing)/support/page.tsx`                                      | mounts `SupportPage` with five fixture sections and the brand's support address                                                                                                                                                                          | `/support`                                         | keep — one view, no markup; its title band lives in `components/support/support-header.tsx` (outside this table, same hand-rolled `h1` as thirty other files)                                                                                                                                               |
| `app/(marketing)/support/articles/[slug]/page.tsx`                      | slug → `publishedArticle("kb", slug)` → `ArticleDetail` + `relatedArticles()`, `notFound()` on a miss                                                                                                                                                    | `/support/articles/[slug]`                         | keep — the article page template is `components/support/article-detail.tsx` (blocks + Badge/Button/Card/Separator), the same shape as `components/news/news-article.tsx`; this route only resolves and 404s                                                                                                 |
| `app/(marketing)/terms/page.tsx`                                        | mounts `LegalPage` from `legalPages.terms`                                                                                                                                                                                                               | `/terms`                                           | keep — one view, one fixture, a band that cannot be dismissed; the wrapper is `min-h-screen bg-background` and nothing else                                                                                                                                                                                 |
| `app/(marketing)/privacy/page.tsx`                                      | the same view and the same fixture, `legalPages.privacy`                                                                                                                                                                                                 | `/privacy`                                         | keep — the pair sharing one view is the point: a sentence cannot be corrected on one page and left on the other                                                                                                                                                                                             |
| `app/(marketing)/welcome/page.tsx`                                      | mounts `MarketingLanding` with `marketingPageCopy`                                                                                                                                                                                                       | `/welcome`                                         | keep — a thin composition; the divergence in this area is inside the view, which has its own row below                                                                                                                                                                                                      |
| `app/(mainlayout)/admin/gaps/page.tsx`                                  | `requireAdmin()` → `readGapPopulation()` → `aggregateGapPopulation()` → `AdminGapsView` or `AdminGapsUnreadable`; `force-dynamic`                                                                                                                        | `/admin/gaps`                                      | keep — gate, read and two failure states, no markup; the two views it mounts are the rows below                                                                                                                                                                                                             |
| `app/(mainlayout)/admin/instances/page.tsx`                             | the same shape over `listAdminInstances(new Date())` → `InstanceRegistry`                                                                                                                                                                                | `/admin/instances`                                 | keep — and the model for the whole area: its view already composes `components/ui/table.tsx` with Tabs, Select and Card                                                                                                                                                                                     |
| `app/(mainlayout)/dashboard/page.tsx`                                   | session → `listMyInstances` + `listPublishedTemplates` → `ConsoleOverview`; one guarded block, so a failed read draws no figures at all                                                                                                                  | `/dashboard`                                       | keep — every figure is one derivation over the rows it read; no markup in the route                                                                                                                                                                                                                         |
| `app/(mainlayout)/dashboard/user/page.tsx`                              | `requireQuizProduct()` → session → `readUserProfileByUserId` → `AccountHome`                                                                                                                                                                             | `/dashboard/user` (quiz build)                     | keep — one view, and the 404-before-session order is the brand boundary's, not a second gate                                                                                                                                                                                                                |
| `app/(mainlayout)/assessment/templates/page.tsx`                        | session → one read → `filterLibrary()` → `TemplateLibrary`; write notices resolved from ids, never from a URL's text                                                                                                                                     | `/assessment/templates`                            | keep — the page does the read and the filtering, the view draws; every state of the screen is a URL a `curl` can ask for                                                                                                                                                                                    |
| `app/(mainlayout)/assessment/templates/[templateId]/page.tsx`           | session → `readLibraryTemplate(id, userId)` → `notFound()` → `TemplateDetail`                                                                                                                                                                            | the "open" row action                              | keep — read-only, one view, no write; "not yours" and "does not exist" are the same 404 on purpose                                                                                                                                                                                                          |
| `app/(mainlayout)/assessment/templates/new/page.tsx`                    | session → `problemMessage(?problem=&aspect=)` → `TemplateForm`                                                                                                                                                                                           | `/assessment/templates/new`                        | keep — the refusal is resolved in the page from enum codes; the text a person typed never travels in a URL                                                                                                                                                                                                  |
| `app/(mainlayout)/assessment/templates/save/route.ts`                   | `POST`: session gate, indexed `aspect-N-{prompt,leftValue,rightValue}` fields → `readTemplateDraft` → 303; `GET` redirects to the form                                                                                                                   | the template form                                  | keep — a route handler has no markup, so it is not a UI surface; the registry says the same of all twelve                                                                                                                                                                                                   |
| `app/(mainlayout)/assessment/templates/[templateId]/duplicate/route.ts` | `POST`: session gate → `duplicateTemplate` → 303 with `?duplicated=`                                                                                                                                                                                     | a row action in the library                        | keep — same; its `libraryUrl()` helper is byte-identical to the copy in `status/route.ts` (see the cross-cutting notes)                                                                                                                                                                                     |
| `app/(mainlayout)/assessment/templates/[templateId]/status/route.ts`    | `POST`: the body carries `status=archived\|published`; the store's `WHERE` is the permission                                                                                                                                                             | a row action in the library                        | keep — same, and the filter travels in hidden fields rather than a `return` URL, so there is no open redirect                                                                                                                                                                                               |
| `components/console/gap-analysis.tsx`                                   | the response-analytics body (`/admin/gaps` for one measure): a local `StatCard` for four population counts, a hand-rolled `<table>` of eight kinds × five columns across two Setting sections, and a third copy of the amber failure panel               | `/admin/gaps`                                      | wrap components/console/stat-card-grid.tsx — four counts, each with a list behind it, is exactly what the grid exists for; then the kinds table wraps `components/ui/table.tsx` as `instance-registry.tsx` already does, and the panel is `components/ui/alert.tsx`                                         |
| `components/console/gap-histogram.tsx`                                  | a stacked bar chart over `components/ui/chart.tsx` + recharts: five Gap sizes as one token at five opacities, with the counts printed in the table beside it                                                                                             | `/admin/gaps`                                      | keep — a chart is not a list or a card and no second distribution exists to unify it with; its one inline `style={{ height }}` is a runtime number recharts needs. Not a composition defect, but broken: its five fills name `--chart-1`, which the imported stylesheet never defines (see the CSS section) |
| `components/console/overview.tsx`                                       | the console Overview: an identity header (avatar + `h1` + subtitle) copied from `components/identity/account-home.tsx`, a `StatCardGrid`, a `Card` empty state, and a hand-rolled amber failure panel                                                    | `/dashboard`                                       | wrap components/ui/alert.tsx — the failure panel is the same amber block written ten times in this tree and `Alert` already exists (four callers under `components/auth/`); the copied header is the same row's second fix                                                                                  |
| `components/console/stat-card-grid.tsx`                                 | the stat-card grid: `Card` + caller-sized icon + a `number` the caller computed + a **required** `href`                                                                                                                                                  | `/dashboard`                                       | keep — this is the standard the console rows are measured against: it composes `components/ui/card.tsx`, carries no literal, and deliberately has no non-linking variant                                                                                                                                    |
| `components/marketing/marketing-header.tsx`                             | the public header: a wordmark (or the brand's lockup) and one CTA; no navigation of any kind                                                                                                                                                             | all seven routes in the group                      | wrap components/layout/nav-menus.tsx — the repo has one navigation definition, and card A adds `PublicNav` there plus the `shellAccount()` identity slot; a CTA-only header is why `<nav>` anchors measured 0 on all six measured routes                                                                    |
| `components/marketing/marketing-footer.tsx`                             | a footer of three facts — brand name, beta note, `mailto:` — plus `AppVersion`                                                                                                                                                                           | all seven routes in the group                      | rewrite onto components/layout/footer.tsx — the shell's footer already draws brand-keyed columns, contact, the legal row and the version badge; this file is the duplicate card A deletes                                                                                                                   |
| `components/marketing/marketing-landing.tsx`                            | `/welcome`'s seven bands: a hero, three grids of eleven item boxes (nine solid, two dashed), a tinted band and a brand-coloured close; the boxes are hand-rolled `rounded-xl border border-slate-200 bg-white p-6` and both CTAs are hand-rolled buttons | `/welcome`                                         | wrap components/ui/card.tsx — the boxes are cards, and `border-slate-200` is not the `--border` token, so the warm-edge decision in `app/globals.css` never reaches this page; the two CTAs are `components/ui/button.tsx`                                                                                  |
| `app/globals.css`                                                       | the token layer (`:root` and `.dark`), the base layer (`@apply border-border`, 14px body, 16px unclassed headings) and `.scrollbar-hide`                                                                                                                 | every route, both brands                           | keep — there is no bespoke class beyond the token layer and one scrollbar utility: no layout numbers and no `<style>` block, and the whole scope holds one arbitrary value and one inline style, both named in the rows above                                                                               |
| `styles/globals.css`                                                    | a second token layer nothing imports: its own `--radius`, `--muted-foreground`, `font-family: Arial`, `h1`–`h6` and `p` rules, and the only definitions in the tree of `--chart-1`–`--chart-5` and the eight `--sidebar-*` properties                    | nothing — `app/layout.tsx` imports `./globals.css` | rewrite onto app/globals.css — fold in the properties `tailwind.config.ts` resolves and the imported sheet lacks, then delete the file; a second token set with a different `--radius` is the exact drift the imported sheet's own header documents against                                                 |

## Area by area

Each section says what the area is, how many files were read, and which rows the reshape should take
first. The files that are already right are named too — a table of only problems cannot tell a reader
what the standard is.

### `app/(marketing)/**` — 8 files read (7 routes + the layout)

The public surfaces, behind the marketing group's chrome and never the app shell. Seven of the eight
files hold no layout markup of their own — a read (or a fixture import), one view, one `metadata`
export — and that is the standard for this area, not the problem. The problem is the chrome they
inherit and the one view they draw from: `marketing-header.tsx`, `marketing-footer.tsx` and
`marketing-landing.tsx`, all three in the next section.

**Worst offenders:** `app/(marketing)/layout.tsx` and the two chrome components it mounts (card A is
already reshaping both), then `components/marketing/marketing-landing.tsx`.

**Housekeeping in the same pass:** three pages carry their own `min-h-screen bg-background` wrapper
inside a layout that is already `min-h-screen flex-col` (`pricing`, `terms`, `privacy`). It paints
nothing the layout does not; it is the one wrapper in this area that could go.

### `app/(mainlayout)/admin/**` — 2 files read

Two operator routes, both `force-dynamic`, both gated by `requireAdmin()` **before** anything is
read, both rendering a view that takes its numbers as props. This is the cleanest area in the audit:
there is no markup in either file, and `/admin/instances` draws through `components/ui/table.tsx`
already. Nothing here needs a verdict stronger than `keep`.

**Worst offenders:** none in the routes. The offenders are the views — `gap-analysis.tsx` in the
console section, and (outside this table) `components/admin/instance-registry.tsx`, which is the
positive control for the whole page.

### `app/(mainlayout)/dashboard/**` — 2 files read

Two account homes, and they are two different surfaces: `/dashboard` is the alignment console's
overview (counts of the viewer's own relationships, via `components/console/overview.tsx`) and
`/dashboard/user` is the quiz build's identity card (`components/identity/account-home.tsx`, behind
`requireQuizProduct()`). Both routes are thin and both are `keep`.

**Worst offenders:** neither route. The structural question this area raises is worth recording
rather than shaping: "who am I and what is mine" now has two shells, one per brand, and the doctrine
would rather it had one surface with a brand configuration. That is a product decision rather than a
divergence in a file, so it belongs in a card of its own — and the pattern to copy is not a second
view (`components/marketing`) but a brand switch over one view.

### `app/(mainlayout)/assessment/templates/**` — 6 files read (3 pages, 3 route handlers)

The template library: list, detail, new, and the three POST endpoints those screens act through.
This area is the audit's counter-example in miniature — the pages hold the session, the read and the
URL state, the writes are plain HTML `POST`s a `curl` can drive, and the words are all fixtures. All
six rows are `keep`.

**Worst offenders:** none. The views the list and detail pages mount,
`components/assessment-flow/template-library.tsx` and `template-detail.tsx`, sit outside this table's
paths but carry two of its findings — a hand-rolled `<table>` and another copy of the amber panel —
and should be taken with `gap-analysis.tsx`, not after it.

**Housekeeping in the same pass:** `libraryUrl()` is byte-identical in `status/route.ts` and
`duplicate/route.ts`, and `first()` in the list page is `firstValue()` in the new page. Two pairs of
three-to-fifteen lines; one `lib/flow/library-url.ts` and one `lib/flow/search-params.ts` would
collapse them.

### `components/console/**` — 4 files read

The console's generic shapes: a card grid, an overview built from it, and the one response-analytics
surface (stat cards, a distribution per measure, a comparison axis). The domain is deliberately
`mock` in the registry because every number arrives as a prop from the route that read Postgres —
which is the property that makes it reusable, and the reason two of the four rows are `keep` with
nothing to change.

**Worst offenders:** `gap-analysis.tsx` first (three divergences in one file, two of them with the
component already sitting beside them), then `overview.tsx`. `stat-card-grid.tsx` is the standard;
`gap-histogram.tsx` is the one divergence here that is deliberate and should stay.

### `components/marketing/**` — 3 files read

The public chrome and the landing page. This is the only area where the divergence is the whole
directory: two of the three files are a second, thinner copy of chrome the shell already owns, and
the third rebuilds `Card` and `Button` in place.

**Worst offenders:** all three, in this order — `marketing-footer.tsx` (deleted), then
`app/(marketing)/layout.tsx` and `marketing-header.tsx` (the same pass, card A), then
`marketing-landing.tsx` (card C's own work; card A does not open that file beyond reading it).

### CSS beyond the token layer — 2 files read, plus a census

There is no bespoke class in the stylesheet the app imports. `app/globals.css` is 144 lines: a
`:root` set, a `.dark` set, one base layer that applies `border-border` and sets the type scale, and
`.scrollbar-hide` — a utility with no numbers of its own. The tree's only `<style>` block outside a
stylesheet is `components/ui/chart.tsx`'s, which is the shadcn primitive doing its job.

What the census found, and what each finding is worth:

- **There are two stylesheets and only one is imported.** `styles/globals.css` is a hundred-line
  second token layer — a different `--radius` (`0.5rem` against the documented `0.375rem`), a
  different `--muted-foreground`, `font-family: Arial`, and base rules that set `h1` to
  `text-4xl lg:text-5xl` where the shipped sheet sets 16px. `app/layout.tsx` imports `./globals.css`;
  nothing imports the other (`grep -rn "styles/globals.css" app components` returns nothing).
- **Which is why the charts have no colour token.** `tailwind.config.ts` resolves `chart-1`–`chart-5`
  and the eight `sidebar` colours, and the only definitions of those properties in the tree are in
  the sheet nobody imports. `gap-histogram.tsx`, `components/my-quizzes/quiz-statistics.tsx` and
  `components/dashboard/earnings-chart.tsx` all name `var(--chart-1)`, so the histogram's five-step
  opacity ramp cannot resolve as authored. One block in `app/globals.css` fixes all three callers.
- **One arbitrary value in the whole scope:** `text-[0.65rem]` on the opinions chip in
  `marketing-landing.tsx` — the same chip the domains band draws two sections earlier at `text-xs`.
  Not a token and not a scale step: a size invented to fit a four-column grid. Named in that file's
  row.
- **One inline `style={{…}}` in the whole scope:** `style={{ height }}` on the histogram's
  `ChartContainer`, a runtime number with a default. Named in that file's row, and a `keep`. The
  repository has twenty-seven, but the other twenty-six are outside these paths; the one that matters
  is `app/layout.tsx`'s `<html style={brandVars}>`, which is the brand token layer painting
  `--primary` and friends, not a layout number.
- **Five invented page paddings for one shell.** The shell's `<main>` is
  `flex-1 overflow-auto p-3 md:p-4 xxl:p-6` (`components/layout/main-layout.tsx`), so it already owns
  the page's padding. The console pages then declare their own, differently, with no arbitrary value
  in any of them: `max-w-4xl space-y-6` and no padding at all (`overview.tsx`), `max-w-5xl px-4 py-8`
  (`gap-analysis.tsx`), `max-w-4xl px-4 py-10` (the library view), `max-w-3xl px-4 py-10` (the detail
  view), and nothing — the right answer — in `instance-registry.tsx`. This is the divergence `pnpm
  lint` cannot see, because all five use a scale step rather than a bracket.

## What the table found that is not a row

Three things recur across files, so no single row can fix them:

1. **The title band, hand-written thirty times.** `<h1 className="text-3xl font-bold …">` plus a
   muted description appears in thirty files under `app/` and `components/`, and
   `components/ui/page-header.tsx` is that exact shape with **one** consumer
   (`components/settings/account-settings.tsx`). In this table's scope it is `overview.tsx`; in the
   views next door it is `template-library.tsx`, `template-detail.tsx`, `instance-registry.tsx` and
   `support-header.tsx`. A primitive nobody calls is not a template; routing five calls through it is
   a smaller change than any of the six rows and it is what makes it one.
2. **The failure panel, hand-written ten times.** `rounded-lg border border-amber-300 bg-amber-50 p-6
   dark:border-amber-700 dark:bg-amber-950` is copied verbatim into ten files, two of them in scope
   (`overview.tsx`, `gap-analysis.tsx`) and one next door (the library view). `components/ui/alert.tsx`
   already exists with `role="alert"` and the icon slot wired; it needs one `warning` variant in
   `alertVariants`, after which all ten collapse onto `Alert` + `AlertTitle` + `AlertDescription`.
3. **The three "database did not answer" panels are three components.** `overview.tsx` draws an alert
   with a reload link, the library view draws the same alert with a raw `<a>`, `gap-analysis.tsx`
   draws one with no reload at all — and `components/assessment/assessment-unreadable.tsx`, the file
   two of them cite by name in their comments, is a fourth implementation that takes a `slug`. One
   `components/ui/alert.tsx` composition with an optional retry is the whole fix, and it is the same
   fix as 2.

## What is already right

The standard this table measures against, in one list, because it is the half a problem list always
loses:

- **The thin route.** Sixteen of the 27 rows hold no markup of their own: a session, a read, a gate,
  one view — or a route handler with no JSX — and two more are stylesheets. None of the sixteen draws
  anything, and that is the shape a new screen should copy before anything else.
- **`components/admin/instance-registry.tsx`** — the record list as a table: `components/ui/table.tsx`
  composed with Tabs, Select, Card and Badge, every filter client-side over one read, and a type
  (`AdminInstanceRow`) that carries nothing the screen may not draw. This is what `gap-analysis.tsx`
  should look like, and it is why "a registry is a table or it is nothing" is a sentence with a file
  behind it.
- **`components/ui/page-header.tsx`, `card.tsx`, `alert.tsx`, `button.tsx`, `table.tsx`** — the
  primitives exist. Four of the seven reshape rows are a missing _call_, not a missing component.
- **The fixture discipline.** Every file in this table that draws words takes them from `data/pages/*`
  through `sectionOf` / `itemLabel` / `sectionBody`; `components/marketing/**` sits at zero leaf
  literals and E23 fails the build if that rises. No row is `rewrite` for a copy problem.
- **`components/console/stat-card-grid.tsx` and `components/console/gap-histogram.tsx`** — the two
  deliberate divergences: a `number` the caller computed, and a chart. Both say why in the file, which
  is what a recorded divergence is supposed to look like.
