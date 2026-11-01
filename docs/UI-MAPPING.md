# The quiz-surface map

Every quiz surface this tree inherits, the AlignSynch file that is a variation of it, the axis that
changes, and the mobile mechanics a variation has to copy rather than invent. Compiled on
`87663a5e` (`origin/main`, 2026-11-01) for the cohort cards under _SPRINT · backend UI prototypes in
template components_, so that each of those cards cites this page instead of re-deriving the map.

**Every path below was opened at that commit**, and the line numbers are that commit's. Where a
cohort card's name and the tree disagree, **the tree's name is on this page** and the card's name is
recorded next to it. This matters more than it sounds: **fifteen of the sixteen rows name a variation
path that does not exist under that spelling at `87663a5e`.** Seven of those fifteen are already
built under another name, and eight are genuinely missing. A card that starts from the guessed name
will rebuild something that is already there, which is the defect this page exists to prevent.

The rule this page enforces is [TEMPLATE-DOCTRINE.md](TEMPLATE-DOCTRINE.md)'s decision order: name
the surface you reused (the file), name the axis that changes, and only then write the generic new
surface. The per-file audit of bespoke composition is [UI-DIVERGENCE.md](UI-DIVERGENCE.md); this
page is the quiz→alignment axis of the same question.

## The rule: every quiz file is a read-only ancestor

**A quiz file in the left column is never edited.** Each AlignSynch artifact is a **new file that
copies the pattern**, because three things break the moment an ancestor is generalised:

1. **Parity hashes it.** Seven routes are hashed under both brands (`tests/parity/routes.ts`,
   `tests/parity/manifest.txt`). Editing `components/quiz/quiz-play.tsx` moves the QuizHub render and
   turns a docs card into a parity rewrite with a `--reason`.
2. **The brand boundary closes it anyway.** The twenty-two routes the quiz product owns
   (`tests/parity/boundary.ts`) include every `/quiz/**` route; on the AlignSynch build they answer
   `404` from `lib/brand-boundary.ts::requireQuizProduct()`. Generalising a component only the other
   brand may render is work AlignSynch can never exercise.
3. **The axis is not additive.** Score→aligned, counts→absence, questions→aspects are not props on
   the same component; they change what the component is allowed to _say_. A `variant` flag on
   `quiz-play.tsx` would be the blind rule implemented as a boolean somebody can flip.

So: copy the shell, hold the words in `data/pages/**` (E23), and leave the ancestor byte-identical.

---

## Part 1 — the map

Status vocabulary: **built** (a file does this job, possibly under another name), **partial**
(the pattern exists here and the variation is incomplete), **missing** (no file does this job),
**CONFLICT** (reuse is forbidden — copy the shell only), **done** (already stronger than the
ancestor).

| quiz ancestor (read-only, measured)                                                                                                                                                                  | the variation the cohort cards name                      | what the tree has at `87663a5e`                                                                                                                                                                                                                                                                                                                | status                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `components/create/quiz-editor.tsx` (701 L) — `Tabs` details/questions/settings (L296–301), per-question `Accordion` (L384), delete `AlertDialog`, preview `DialogContent` `sm:max-w-[600px]` (L601) | `components/assessment-flow/template-editor.tsx`         | **absent.** Nearest: `template-form.tsx` (153 L) — create only, eight fixed Aspect rows (`MAX_ASPECTS`), no tabs, no edit, no preview; `template-detail.tsx` (183 L) is read-only **on purpose**, whose header says editing is a later card that extends the route rather than replacing it                                                    | **missing — highest value**        |
| `components/create/quiz-generator.tsx` (178 L) — `composeDraft(mockQuizzes, …)` over `data/mock-quizzes.ts`                                                                                          | `template-generator.tsx` + new `data/aspect-starters.ts` | **absent**, both. `lib/flow/template-draft.ts` already exists (the draft model, blank-row skipping); there is no aspect-starting fixture and no generator surface                                                                                                                                                                              | unmapped                           |
| `components/my-quizzes/quiz-details.tsx` (548 L) — Edit                                                                                                                                              | the same `template-editor.tsx`, seeded by id             | **absent**, as row 1. Duplicate exists (`…/[templateId]/duplicate/route.ts`); edit does not                                                                                                                                                                                                                                                    | missing                            |
| `quiz-editor.tsx` delete `AlertDialog` + `my-quizzes.tsx` row delete                                                                                                                                 | `components/assessment-flow/instance-actions.tsx`        | **absent, and there is no delete anywhere**: `grep -rn "delete\|Delete" components/assessment-flow/` → 0 hits. The two writes that exist are duplicate and archive/unarchive (`assessment/templates/[templateId]/{duplicate,status}/route.ts`), both POST-and-303. Archive is the durable substitute for delete; that is a decision, not a gap | missing                            |
| `components/quiz/quiz-play.tsx` (486 L) — `Progress` + `Question {n} of {m}` (L377), feedback, timer, score                                                                                          | `opinion-sheet.tsx` — **shell only**                     | The sheet is built as **`answer-form.tsx`** (171 L): one native radio group per Aspect, five segments, no JavaScript, no progress, no feedback, no timer. `opinion-sheet.tsx` does not exist                                                                                                                                                   | **CONFLICT — copy the shell only** |
| `components/quiz/quiz-results.tsx` (364 L) — score hero + `canvas-confetti` at `score >= 70` (L59–84)                                                                                                | `components/assessment/report-verdict.tsx`               | **absent as a file; built inside `assessment-report.tsx`** L346–380: `data-verdict="aligned\|unmet"`, `report.verdict.unmet.length`, the widest Gap named, computed by `instanceAlignment()` in `lib/assessment-report.ts`                                                                                                                     | built — other name                 |
| `components/my-quizzes/quiz-statistics.tsx` (1100 L) — recharts dashboard + a Question Performance `<table>` (L744)                                                                                  | `components/assessment/instance-statistics.tsx`          | **absent as a file; the aggregate home is `components/console/gap-analysis.tsx`** behind `/admin/gaps` — histogram (`gap-histogram.tsx`) + a kinds `<table>` (L156), numbers from the pure `lib/admin/gap-aggregates.ts`, admin-gated via `requireAdmin()`                                                                                     | built — other name, admin-only     |
| `components/quiz/question-discussion.tsx` (298 L) — threads via `components/quiz/comment.tsx` + `Textarea`                                                                                           | `components/assessment-flow/report-discussion.tsx`       | **absent.** Nothing under `components/assessment*` or `app/(mainlayout)/assessment/**` mentions a discussion                                                                                                                                                                                                                                   | missing — real work                |
| `components/battle/battle-lobby.tsx` (268 L) — `allReady` + `isReady` badges                                                                                                                         | `components/assessment-flow/waiting-panel.tsx`           | **absent as a file; built inside `instance-view.tsx`** L280–286 — the waiting band, `data-waiting-on`, who is still to answer and nothing about what they have                                                                                                                                                                                 | built — other name                 |
| `components/explore/explore-quiz-list.tsx` (458 L) — card grid + filters                                                                                                                             | `components/assessment-flow/template-catalogue.tsx`      | **absent by that name; two files do the job.** `/assessment` → `template-list.tsx` (173 L, one create form per template, plain forms); `/assessment/templates` → `template-library.tsx` (396 L, Tabs + search + a fixed-layout 5-column `<table>` at L268)                                                                                     | built — two files, other names     |
| `components/my-quizzes/my-quizzes.tsx` (569 L) — Tabs + grid/list + per-row dropdown                                                                                                                 | `components/assessment-flow/my-instances-grid.tsx`       | **absent by that name; `/assessment/instances` → `my-instances.tsx`** (226 L, server component, three derived states, no counts)                                                                                                                                                                                                               | built — other name                 |
| `components/quiz/quiz-details.tsx` (700 L) — public landing, leaderboard, reviews                                                                                                                    | `components/assessment/template-public-page.tsx`         | **absent, and the route the card assumes is a different route.** `/assessment/[slug]` is the read of one **instance** from Postgres (`readAssessmentScreenBySlug`) and renders `assessment-report.tsx`; there is no public template page                                                                                                       | missing — different route          |
| `components/my-quizzes/quiz-details.tsx` — copy link                                                                                                                                                 | already bespoke: `invite-link.tsx` + `reinvite-form.tsx` | **present and stronger than the ancestor:** `invite-link.tsx` (155 L), `reinvite-form.tsx` (66 L)                                                                                                                                                                                                                                              | **done**                           |
| `components/profile/user-profile.tsx` (144 L) — rank/score line L105–107, `ProfileStats`                                                                                                             | `components/assessment/party-profile.tsx`                | **absent; `/profile/[username]` still renders `user-profile.tsx`**, with the rank/score block intact. This is the one shared page on the map that no AlignSynch variation has touched                                                                                                                                                          | unmapped                           |
| `components/home/hero-section.tsx` (52 L)                                                                                                                                                            | `components/home/alignment-hero.tsx`                     | **absent by that name; `components/home/alignment-home.tsx` is the AlignSynch front page.** `app/(marketing)/page.tsx` composes both, per brand                                                                                                                                                                                                | built — other name                 |
| `components/categories/categories-page.tsx` (108 L) — grid of `/categories/[slug]`                                                                                                                   | `components/assessment/family-index.tsx`                 | **absent.** The nearest surface is `/assessment` → `template-list.tsx`, which lists templates, not families — a different object, so this is a new generic surface, not a copy                                                                                                                                                                 | missing                            |

### The names the cards guessed, and the file that does the job

| the card says                            | the tree says                                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `assessment-flow/opinion-sheet.tsx`      | `assessment-flow/answer-form.tsx`                                                                                      |
| `assessment-flow/waiting-panel.tsx`      | the waiting band inside `assessment-flow/instance-view.tsx` (L280–286)                                                 |
| `assessment/report-verdict.tsx`          | the verdict band inside `assessment/assessment-report.tsx` (L346–380)                                                  |
| `assessment-flow/template-catalogue.tsx` | `assessment-flow/template-list.tsx` (`/assessment`) + `assessment-flow/template-library.tsx` (`/assessment/templates`) |
| `assessment-flow/my-instances-grid.tsx`  | `assessment-flow/my-instances.tsx`                                                                                     |
| `assessment/instance-statistics.tsx`     | `console/gap-analysis.tsx` (+ `lib/admin/gap-aggregates.ts`) behind `/admin/gaps`                                      |
| `home/alignment-hero.tsx`                | `home/alignment-home.tsx`                                                                                              |

Genuinely absent, with nothing standing in for them: `template-editor.tsx`,
`template-generator.tsx` + `data/aspect-starters.ts`, `instance-actions.tsx`,
`assessment-flow/report-discussion.tsx`, `assessment/template-public-page.tsx`,
`assessment/party-profile.tsx`, `assessment/family-index.tsx`.

### The routes those files are mounted at

Measured from `app/(mainlayout)/**/page.tsx`: `/assessment` (template list + create form),
`/assessment/templates` (library), `/assessment/templates/new` (form), `/assessment/templates/[templateId]`
(read-only detail), `/assessment/instances` (my instances), `/assessment/instances/[instanceId]`
(the one screen both parties share), `/assessment/[slug]` (one answered instance, from Postgres),
`/admin/instances` and `/admin/gaps` (operator console, `requireAdmin()`), `/invite/[token]` (claim).

### Retained quiz surfaces — catalogued, not work

The brand boundary closes these on the AlignSynch build. They stay in `docs/ui-registry.md` and keep
rendering on QuizHub; **none of them is a gap to fill**, and a card that "adds" one has misread the
product.

**Twenty-two routes answer `404` on AlignSynch through `requireQuizProduct()`**
(`tests/parity/boundary.ts`, `lib/brand-boundary.ts`): `/daily-challenge`, `/categories`,
`/categories/[slug]`, `/battle`, `/explore`, `/explore/featured`, `/tournaments`, `/tournaments/[id]`,
`/creator-tips`, `/creator-tips/[slug]`, `/quiz-discussions`, `/quiz/[id]`, `/quiz/[id]/play`,
`/quiz/[id]/discussion`, `/create/editor`, `/create/generator`, `/my-quizzes`, `/my-quizzes/[id]`,
`/my-quizzes/[id]/statistics`, `/affiliate`, `/chat`, `/dashboard/user`.

**One quiz surface is closed on both brands by a flag, not the boundary:** `/leaderboard` answers
`404` everywhere because `community.leaderboard` is off (same commit, `boundary.ts` L80–83). Its
`404` is a mock gate, so it cannot express the boundary and is deliberately absent from the
twenty-two.

**Correction to the cohort card's list.** The card groups search, news, the support KB, pricing tiers
and settings with the retained surfaces. Measured, they are **not** brand-gated: `/search`, `/news`,
`/news/[slug]`, `/settings`, `/pricing` and `/support/**` are shared core, live under **both** brands,
and `requireQuizProduct()` appears in none of them. They are shared surfaces whose AlignSynch
expression already exists — a different fact from "retained for the other product", and the one a
card should act on.

---

## Part 2 — the three surfaces with no quiz ancestor at all

These are the product. A card that reuses a quiz pattern here has misread the product, because the
ancestor is built on the assumption each one breaks.

### 1. The claim page — `components/assessment-flow/invite-view.tsx`, `/invite/[token]`

137 lines, and its two rules are structural, not stylistic:

- **`GET` renders; only `POST` consumes.** The token is single-use, so a page that claimed on `GET`
  would be claimed by whatever fetched the link first — a mail preview, a scanner, a prefetch. The
  button posts to `/invite/[token]/claim` (`app/(mainlayout)/invite/[token]/claim/route.ts`), the
  only writer of `claimed_at` (`lib/flow/store.ts`).
- **`already-a-party` is a refusal that is drawn, not toasted.** A browser that already holds a seat
  is named, told the invitation is not theirs to take, and never shown the claim control; the token
  stays unspent. The codes are `lib/flow/claim.ts` (`ClaimRefusal`), and every sentence is a band in
  `data/pages/invite.ts` (E23), never a status code in a tab.

There is no ancestor for this: every quiz entry point is a public `/quiz/[id]` anyone may play, so
the concept "this token belongs to one browser, once" has no quiz analogue.

### 2. The stage machine — `lib/flow/stage.ts` + `instance-view.tsx`

84 lines, pure, and it **cannot return `aligned`**:

```
awaiting_counterparty → invited     the Counterparty has no seat yet
answering             → connected   both seats exist, the sheet is not finished
complete              → sharing     both submitted; the report is open to both
```

`aligned` is a **verdict, not a step** — it is `instanceAlignment()` over the finished Gap, arithmetic
that flips when a Settings choice changes, so it belongs to the report's verdict band and nowhere
else. The type excludes it, which makes "draw Aligned as a step" a compile error rather than a rule
somebody has to remember. `instance-view.tsx` draws the one stage sentence (L157–185, `data-stage`),
with tones per invitation state (L90–94: `unclaimed` neutral, `claimed` emerald, `expired` red).
The argument, with sources, is `docs/specs/ux-stages.md`; the status model is `lib/flow/state.ts`.

**There is no stepper, and that is the design:** three of the four transitions are driven by the
other party or by nobody, and an expired invitation is a step backwards no stepper can draw.

### 3. The blind rule — rendering the _absence_ of score, count and gap

Every quiz surface renders progress immediately: `quiz-play.tsx` has a `Progress` bar and
`Question {n} of {m}` (L377), `quiz-results.tsx` has a score hero, `quiz-statistics.tsx` has per-question
accuracy. **Withholding has no ancestor**, so no component can be copied into it.

The rule is enforced by what the read _selects_, not by a conditional in the markup:

- `lib/flow/state.ts` derives three statuses, and `my-instances.tsx`'s third state says who is still to
  answer and nothing about what they have — there is no prop on that component that could draw a score.
- `instance-view.tsx`'s `answering` branch has `report: null`; the other party's answers are **absent,
  not hidden**, and the view model has no field to carry them.
- Only the report (`assessment-report.tsx`) draws a Gap, and only once both parties submitted.

**This is the spine of the product and must never be "fixed" into a progress bar.** A card that adds
one has deleted the product's only claim; a card that finds a count leaking is a bug fix, not a style
change.

---

## Part 3 — mobile mechanics, measured (copy these verbatim)

### Breakpoints are not Tailwind's defaults

`tailwind.config.ts` L102–110 overrides them:

```
sm: "576px", md: "768px", lg: "992px", xl: "1280px", xxl: "1400px",
"3xl": "1600px", "4xl": "1800px",
```

**A 390px phone is below `sm`.** There is no `xs`, so **unprefixed classes are the mobile layer** and
every breakpoint prefix is an upgrade. A design that reads `sm:` as "small phones" is wrong twice
over: 390px is 186px below this `sm`, and this `sm` is 64px narrower than Tailwind's default `640px`.
`useIsMobile()` (`components/ui/use-mobile.tsx`) also uses its own `768` constant, so JS and CSS
disagree about what "mobile" means — prefer CSS.

### Shared and free on every `(mainlayout)` route

| mechanic           | measured                                                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| page gutter        | `components/layout/main-layout.tsx` L96 — `<main className="flex-1 overflow-auto p-3 md:p-4 xxl:p-6">`                                                                                                |
| sidebar below `xl` | `components/layout/sidebar.tsx` L104–107 — `max-xl:visible max-xl:translate-x-0 max-xl:shadow-2xl` / `max-xl:invisible max-xl:-translate-x-full`; a `250px` rail that is off-canvas, not a bottom bar |
| its scrim          | `main-layout.tsx` L66 — `fixed inset-0 z-40 bg-black/60 xl:hidden`                                                                                                                                    |
| header             | `components/layout/header.tsx` L242 — `sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6`                                                                  |
| its hamburger      | `header.tsx` L251 — `xl:hidden`                                                                                                                                                                       |

A variation gets all five for free by living under `app/(mainlayout)/`. **The mobile layer is already
correct** in the shell; the defects in Part 4 are all inside page bodies.

### Right-edge panels — copy the ChatDrawer trio

`components/header/ChatDrawer.tsx` L32, verbatim:

```
fixed top-0 right-0 z-50 h-full w-full sm:w-96 bg-background shadow-xl transition-transform duration-300 ease-in-out
```

plus `translate-x-0` / `translate-x-full` for the open state, and a scrim rendered by the header
(`header.tsx` L660): `fixed inset-0 bg-black/20 z-50 transition-opacity` with `opacity-0
pointer-events-none` when closed. **`w-full sm:w-96` is the mechanic**: full-bleed below `sm`,
`24rem` above it. (The card writes the trio as `fixed inset-y-0 w-full sm:w-96`; the tree spells the
same shape as `top-0` + `h-full`. Copy the tree.)

### Card grids — `explore-quiz-list.tsx` L168, verbatim

```
grid gap-6 sm:grid-cols-2 md:grid-cols-1 min-[900px]:grid-cols-2 xxl:grid-cols-3
```

The `md:grid-cols-1` step is not a typo: at `md` the shell's sidebar takes `250px`, so the content
column narrows and one column is correct again until `900px`. **Copying `sm:grid-cols-2 md:grid-cols-3`
from a generic Tailwind habit reproduces the exact bug this string avoids.** Note the same file's
**loading skeleton** at L103 uses `xl:grid-cols-3` instead of the loaded grid's `min-[900px]:grid-cols-2
xxl:grid-cols-3`, so the skeleton and the content disagree at two widths — copy L168, not L103.

### Wide tables — the leaderboard pair is the only correct mobile pattern

`components/leaderboard/leaderboard-table.tsx`:

- L62 — wrapper: `space-y-4 w-full overflow-x-auto whitespace-nowrap`
- L66 — inner: `min-w-[600px]`
- L75 — column drop: `hidden md:col-span-2 md:block md:text-right`

**There is no table→card collapse anywhere in this tree.** Do not invent one and claim it inherited:
the pattern to copy is _scroll sideways, drop columns at `md`_, and a card that needs more than that
is adding a mechanic, not reusing one.

### Images — `components/media/media.tsx`, never a bare `next/image`

`Media` (`MediaProps`) takes `entry`/`fallback`/`seed` and resolves the tier order file → remote →
generated, with `fill` or `width`/`height`, `sizes`, and a drawn default painted at the same size
when a URL 404s (so nothing reflows). `MediaMark` is the bare drawn mark. A raw `next/image` without
dimensions is a **dev-time 500 and a green build** (`AGENTS.md`, Pitfalls). The three tiers are
`MediaEntry` in `content/media.ts`; sizing comes from the record, never from a constant typed in the
component.

### Panels and sheets — the primitives exist and nothing uses them

`components/ui/sheet.tsx` (121 L), `components/ui/drawer.tsx` (100 L) and
`components/ui/use-mobile.tsx` (19 L) are exported and imported **zero** times:
`grep -rln` for each across `components app lib hooks` → 0. All **seven** dialogs in the tree are
centered modals — `quiz-editor.tsx`, `wallet-dashboard.tsx`, `review-modal.tsx`,
`tournament-discussion.tsx`, `message-modal.tsx`, `profile-created-quizzes.tsx`, `chat-sidebar.tsx` —
each overriding only `max-w` on the primitive's `left-[50%] top-[50%] … translate-x-[-50%]` base.

So a bottom sheet is **available and unused**. A variation that wants one would be its first consumer:
that is a deliberate choice to state in the handoff, not an inherited behaviour to claim.

### No sticky action bar exists anywhere

`grep` for a `sticky bottom-0` action strip finds only primitives (`ui/toast.tsx`,
`ui/sheet.tsx`, `ui/drawer.tsx`) and decorative `absolute bottom-0` dots. **The answer sheet's submit
(`answer-form.tsx` L164) scrolls away on a long sheet** — eight Aspects, each asking up to four score
kinds, is a long scroll on a 390px phone. A sticky submit is **new work, not inherited**, and it is
the single highest-value mobile addition on this map.

---

## Part 4 — known mobile defects, for the variations to fix

| defect                                                                                          | measured evidence                                                                                                                                                                                                                                                                                                               | what a variation does                                                                            |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| the report's `<table>` has no mobile wrapper                                                    | `components/assessment/assessment-report.tsx` L304 — `<table className="mt-1 w-full border-collapse">`, no `overflow-x-auto`, no `min-w-*`. Survives 390px by luck; one added column breaks it                                                                                                                                  | wrap in the leaderboard pair (Part 3) when touching it                                           |
| **`components/console/gap-analysis.tsx` L156 has the same defect** and the card did not name it | `<table className="w-full border-t">`, no wrapper, no `min-w-*`; four numeric columns, right-aligned                                                                                                                                                                                                                            | same fix; it is the aggregate home, so it is the one that gains a column next                    |
| `assessment-flow/` is nearly breakpoint-free                                                    | **3** breakpoint usages in the whole directory — `template-detail.tsx` L78, `template-form.tsx` L105, `my-instances.tsx` L171 — all `sm:grid-cols-2`, and **no sticky submit** (the card measured 2; re-measured at `87663a5e` it is 3)                                                                                         | add breakpoints deliberately and copy the Part 3 strings                                         |
| `template-library.tsx` L268 squeezes instead of scrolling                                       | `<table className="w-full table-fixed border-collapse …">` with five columns, no wrapper, no `min-w-*` — `table-fixed` means 390px splits into five slivers rather than overflowing                                                                                                                                             | if columns stay fixed, prefer the leaderboard pair; do not copy `table-fixed` for a tabular list |
| **do not copy `my-quizzes.tsx` L427**                                                           | `<div className="grid grid-cols-4 gap-4 mb-4">` — unprefixed, so four label/value pairs side by side at 390px                                                                                                                                                                                                                   | an alignment row states one derived fact, never a four-up stats strip                            |
| **the "only real `<table>`" claim in the card is wrong**                                        | five real `<table>` elements under `components/`: `assessment-report.tsx` L304, `console/gap-analysis.tsx` L156, `assessment-flow/template-library.tsx` L268, `my-quizzes/quiz-statistics.tsx` L744 (ancestor), `affiliate/why-partner.tsx` L168 — only the last has an `overflow-x-auto` wrapper, and even that has no `min-w` | the census is the point: "the report is the only table" would license ignoring the other four    |

---

## How this page was measured

Every claim above is one of these commands, re-runnable at any commit:

```bash
# 1. every ancestor and variation path, with line counts (MISS = the file is not there)
for f in components/create/quiz-editor.tsx components/assessment-flow/answer-form.tsx …; do
  [ -f "$f" ] && wc -l "$f" || echo "MISS $f"; done

# 2. the breakpoints (not Tailwind's defaults)
sed -n '102,110p' tailwind.config.ts

# 3. the shell mechanics
grep -n "p-3 md:p-4 xxl:p-6" components/layout/main-layout.tsx
grep -n "max-xl:" components/layout/sidebar.tsx
grep -n "sticky\|xl:hidden" components/layout/header.tsx

# 4. the unused primitives (0 = exported, never imported)
for m in ui/sheet ui/drawer ui/use-mobile; do grep -rln "@/components/$m" components app lib hooks | wc -l; done

# 5. the table census and the grid strings
grep -rn "<table" components app --include=*.tsx | grep -v "components/ui/"
grep -n "sm:grid-cols-2" components/explore/explore-quiz-list.tsx

# 6. the boundary, per route
grep -rln "requireQuizProduct" app | sort
```

## What this page is not

- **Not a licence to edit a quiz file.** The left column is read-only; see the rule at the top.
- **Not a build order.** The status column says what exists; which of the missing rows to build is a
  product decision, and the cohort cards carry their own approval gate.
- **Not a substitute for `docs/ui-registry.md`.** The registry is generated and gates every route and
  component domain; this page is the hand-written map of one axis of it.
- **Not evidence that a surface works.** A built file is a file: `assessment-flow/` is DB-backed and
  request-time (`force-dynamic`, `DATABASE_URL` unset in the gate), so proving a variation works is a
  dogfood run, not a `next build`.
