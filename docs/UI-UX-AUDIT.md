# UI/UX audit — AlignSynch against the purchased template

What AlignSynch follows, varies, or quietly diverges from, measured against the UI/UX patterns the
purchased quiz template already established. The question is not "is this good design" — it is
"does this follow the template we own, and where does it quietly diverge?"

Read-only audit. No component, fixture or route was changed. Compiled at `origin/main`
(`62a7d286`). The `/v1` prototype is not on `main`: it lives on `alignsynch/v1-advanced-only`
(`0d19334d`) and every `/v1` file below was read from that branch with `git show`.

Verdicts are exactly three, plus one for the retained quiz product:

- **follows** — composes the template's own pattern, or is the template surface itself.
- **varies** — the same pattern on a deliberately named axis, and the difference is recorded.
- **diverges** — quietly broke from the pattern in a way a screenshot hides.
- **retained** — a quiz-product route that answers 404 on AlignSynch (`requireQuizProduct()`),
  kept as the template ancestor and not an AlignSynch screen.

---

## 1. The pattern set (ancestors), with paths

The template the audit scores against. Every path below was opened in this tree.

| pattern                           | ancestor file(s) opened                                                                                        | what it establishes                                                                                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| page header + actions             | `components/ui/page-header.tsx`, `components/my-quizzes/my-quizzes.tsx`                                        | `h1 text-3xl font-bold tracking-tight` + muted description; the primary action is a `Button asChild`→`Link` top-right; back links open every detail page                 |
| list + filters + empty state      | `components/my-quizzes/my-quizzes.tsx`                                                                         | search input, status `Select`, `Tabs`, grid/list toggle; empty state = icon + heading + body + a create CTA                                                              |
| detail with hero + tabs           | `components/quiz/quiz-details.tsx`                                                                             | back link → cover hero → `Tabs` (overview/leaderboard/reviews) → side card with the primary action; a tab exists only where its content does                             |
| play surface                      | `components/quiz/quiz-play.tsx`                                                                                | `Progress` + "Question n of m", feedback overlay, timer, results screen                                                                                                  |
| forms + validation                | `components/create/quiz-editor.tsx`, `components/auth/login-view.tsx`, `components/auth/register-view.tsx`     | `Tabs` details/questions/settings, `Accordion` per item, `AlertDialog` for destructive, toast for save; error as a visible `Alert`, pending state, disabled-when-invalid |
| table on mobile                   | `components/leaderboard/leaderboard-table.tsx`                                                                 | `overflow-x-auto whitespace-nowrap` wrapper + `min-w-[600px]` inner + `hidden md:block` column drop                                                                      |
| dialogs / sheets / toasts         | `components/ui/dialog.tsx` (all seven callers), `components/ui/sheet.tsx` (unused), `components/ui/sonner.tsx` | centered modal is the only dialog form; `sheet`/`drawer` exist and are imported zero times (`docs/UI-MAPPING.md`); toast via sonner in `app/layout.tsx`                  |
| spacing / card / heading / button | `components/ui/card.tsx`, `components/ui/button.tsx`, `components/ui/badge.tsx`                                | `Card` = `rounded-lg border bg-card shadow-sm`; button variants `default`/`action`/`outline`/`destructive`/`ghost`; heading `text-3xl`/`text-2xl`/`text-xl` ladder       |

The quiz→alignment axis of this same question is already mapped in `docs/UI-MAPPING.md`; the
per-file composition audit is `docs/UI-DIVERGENCE.md`. This page is the interaction and behaviour
half those two do not cover: verdicts that only a click-through (or a read of the handler) reveals.

---

## 2. Scored table — every route in `content/routes.ts` (50), each once

The ancestor named is the file that establishes the pattern; where that ancestor was read through
`docs/UI-MAPPING.md` rather than opened here, the row says so.

### Shared core and marketing (render on both brands)

| surface                    | ancestor                                                                                     | verdict | the specific fix                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` (marketing home)       | `components/home/alignment-home.tsx` vs the QuizHub home bands in `app/(marketing)/page.tsx` | varies  | brand-composed `switch` over `BrandId`, no edit — correct; the AlignSynch home is three bands, not the twelve quiz bands, and that is the doctrine's own pattern |
| `/welcome`                 | `components/marketing/marketing-landing.tsx` (per `docs/UI-DIVERGENCE.md`)                   | follows | the template's landing; `UI-DIVERGENCE.md` already flags its hand-rolled cards/CTAs for a later reshape                                                          |
| `/pricing`                 | `app/(marketing)/pricing/page.tsx` → `components/pricing/*`                                  | follows | thin route + fixture sections, no markup of its own                                                                                                              |
| `/support`                 | `components/support/support-page.tsx`                                                        | follows | same                                                                                                                                                             |
| `/support/articles/[slug]` | `components/support/article-detail.tsx`                                                      | follows | same article template as `/news/[slug]`                                                                                                                          |
| `/terms`, `/privacy`       | `components/legal/legal-page.tsx`                                                            | follows | one view, two fixtures — deliberate                                                                                                                              |
| `/news`                    | `components/news/news-page.tsx`                                                              | follows | shared core, not brand-gated                                                                                                                                     |
| `/news/[slug]`             | `components/news/news-article.tsx`                                                           | follows | same                                                                                                                                                             |
| `/search`                  | `app/(mainlayout)/search/page.tsx` → `components/search/search-results.tsx`                  | follows | brand index resolved on the server, no client catalog                                                                                                            |
| `/settings`                | `app/(mainlayout)/settings/page.tsx` → `components/identity/settings-view.tsx`               | follows | real profile behind `currentUser()`                                                                                                                              |
| `/profile/[username]`      | `components/profile/user-profile.tsx` / `components/identity/member-profile.tsx`             | varies  | demo person vs real member are two views behind one URL; the demo branch labels itself a demo account — a deliberate, recorded variation                         |
| `/login`                   | `components/auth/login-view.tsx`                                                             | follows | it **is** the template's login, made real (#164/#281); error states, pending, Google-first                                                                       |
| `/register`                | `components/auth/register-view.tsx`                                                          | varies  | the template's two-step wizard, but two steps now and `destination` is brand-resolved (#351)                                                                     |
| `/demo`                    | `app/(auth)/demo/page.tsx` → `components/auth/demo-gate.tsx`                                 | follows | demo door, not an AlignSynch surface                                                                                                                             |
| `/demo/admin`              | `app/(auth)/demo/admin/page.tsx`                                                             | follows | demo admin, `requireAdmin()`                                                                                                                                     |

### AlignSynch product (the assessment flow)

| surface                              | ancestor                                                                                                                                           | verdict      | the specific fix                                                                                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                         | `components/console/overview.tsx` ← `components/identity/account-home.tsx` + `components/console/stat-card-grid.tsx`                               | follows      | composes `PageHeader` + `StatCardGrid`; the failure panel should be `Alert` (`docs/UI-DIVERGENCE.md` names it)                                                                                                |
| `/assessment`                        | `components/assessment-flow/template-list.tsx` ← `components/my-quizzes/my-quizzes.tsx`                                                            | varies       | the list shape, but plain-HTML per-template create forms (no-JS, `curl`-drivable) instead of a client grid — recorded                                                                                         |
| `/assessment/templates`              | `components/assessment-flow/template-library.tsx` ← `components/my-quizzes/my-quizzes.tsx`                                                         | varies       | tabs/search/status filter kept, grid/list dropped for a table; **but** see the mobile row — `table-fixed` with no `overflow-x-auto` wrapper                                                                   |
| `/assessment/templates/new`          | `components/assessment-flow/template-form.tsx` ← `components/create/quiz-editor.tsx`                                                               | varies       | eight fixed Aspect rows instead of an accordion-plus-add-button; no-JS on purpose, refusal drawn above the form                                                                                               |
| `/assessment/templates/[templateId]` | `components/assessment-flow/template-detail.tsx` ← `components/my-quizzes/quiz-details.tsx` (per `docs/UI-MAPPING.md`)                             | follows      | back link → facts `dl` → aspects list → actions; read-only on purpose, edit is a later card                                                                                                                   |
| `/assessment/instances`              | `components/assessment-flow/my-instances.tsx`                                                                                                      | follows      | list of rows with three derived states; empty state has a create CTA; the "unseen" marker is a row line, not a toast                                                                                          |
| `/assessment/instances/[instanceId]` | `components/assessment-flow/instance-view.tsx` ← `components/quiz/quiz-play.tsx` (shell only)                                                      | varies       | stage **sentence** instead of a progress bar; invite panel tones by state; answer sheet below — the blind rule is structural, not a hidden conditional                                                        |
| `/assessment/[slug]`                 | `components/assessment/assessment-report.tsx` ← `components/quiz/quiz-results.tsx` (per `docs/UI-MAPPING.md`)                                      | **diverges** | the report renders no back link — not to the instance, not to `/assessment/instances`. The template's detail pages all open with a back link; this one is a dead end the shell sidebar is the only way out of |
| `/invite/[token]`                    | none — the claim page has no quiz ancestor (`docs/UI-MAPPING.md` part 2)                                                                           | varies       | GET renders, POST consumes; `already-a-party` drawn not toasted; checkbox confirm — correct, keep                                                                                                             |
| `/admin/instances`                   | `components/admin/instance-registry.tsx` ← `components/my-quizzes/my-quizzes.tsx` (table shape) + `components/leaderboard/leaderboard-filters.tsx` | follows      | the positive control: `Table` + `Tabs` + `Select`, filters client-side over one read                                                                                                                          |
| `/admin/gaps`                        | `components/console/gap-analysis.tsx` ← `components/ui/page-header.tsx` + `components/ui/card.tsx` + `components/ui/table.tsx`                     | varies       | response-analytics shell; `docs/UI-DIVERGENCE.md` flags the hand-rolled `StatCard` and the un-wrapped kinds table                                                                                             |

### Retained quiz product (404 on AlignSynch — the ancestor itself, not an AlignSynch screen)

These are the template's own surfaces. They stay on QuizHub, answer 404 on AlignSynch through
`requireQuizProduct()` (`lib/brand-boundary.ts`, `tests/parity/boundary.ts`), and are catalogued in
`docs/ui-registry.md` — nothing to score, nothing to fix. Listed once each so the manifest is
covered: `/daily-challenge`, `/categories`, `/categories/[slug]`, `/battle`, `/explore`,
`/explore/featured`, `/tournaments`, `/tournaments/[id]`, `/creator-tips`, `/creator-tips/[slug]`,
`/quiz-discussions`, `/quiz/[id]`, `/quiz/[id]/play`, `/quiz/[id]/discussion`, `/create/editor`,
`/create/generator`, `/my-quizzes`, `/my-quizzes/[id]`, `/my-quizzes/[id]/statistics`, `/affiliate`,
`/chat`, `/dashboard/user`, and `/leaderboard` (closed on both brands by `community.leaderboard`, not
by the boundary).

---

## 3. Scored table — the `/v1` prototype (16 routes on `alignsynch/v1-advanced-only`)

Every `/v1` file was read from that branch. The prototype is additive and open: it touches no
production file, and its routes are not in `main`'s `content/routes.ts`.

| surface                         | ancestor (named in the file's own header)               | verdict      | the specific fix                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/v1` (persona picker)          | `components/auth/login-view.tsx`                        | varies       | the login split-screen, right half a six-persona card grid instead of a form — the prototype's auth stand-in, deliberate                                                                           |
| `/v1/initiator`                 | `components/console/overview.tsx`                       | follows      | stat tiles + a relationship list; `EmptyState`/`LoadingState` primitives used                                                                                                                      |
| `/v1/initiator/templates`       | `components/assessment-flow/template-library.tsx`       | varies       | inline "copy into a relationship" form; **Basic mode is a `disabled` option with a sentence explaining why** — the one place a disabled control is explained, and the pattern to copy              |
| `/v1/initiator/templates/new`   | `components/create/quiz-editor.tsx`                     | varies       | the editor, on the Aspect axis; Save/Publish/Archive/Delete are **real writes** to `lib/v1/store.tsx` (the ancestor's are fake `console.log`+toast)                                                |
| `/v1/initiator/relationships`   | `components/assessment-flow/my-instances.tsx`           | follows      | list + inline invite                                                                                                                                                                               |
| `/v1/relationships/[id]`        | `components/assessment-flow/instance-view.tsx`          | varies       | detail + tabs + a real `<table>` with `overflow-x-auto` (does the mobile-table thing right)                                                                                                        |
| `/v1/relationships/[id]/answer` | `components/assessment-flow/answer-form.tsx`            | **diverges** | see below — the 1–5 band is rebuilt as `aria-pressed` buttons, losing the ancestor's native radio group, and submit is a full-page `window.location.assign`                                        |
| `/v1/relationships/[id]/report` | `components/assessment/assessment-report.tsx`           | **diverges** | the unlocked report renders **no `<Link>` and no outbound `href` at all** — the locked state has "Back to the relationship", the unlocked one is a measured dead end                               |
| `/v1/admin`                     | `components/admin/instance-registry.tsx`                | follows      | two tables, both `overflow-x-auto`                                                                                                                                                                 |
| `/v1/coach`                     | none — prototype-only (`party.role` has no third value) | varies       | labelled "Prototype — not represented in the schema" in the UI, which is the honest way to ship a prototype-only surface                                                                           |
| `/v1/counterparty`              | none — prototype-only                                   | varies       | claimable + mine, two lists                                                                                                                                                                        |
| `/v1/service`                   | `components/support/support-page.tsx`                   | varies       | the support queue; "Resolve"/"Resend invite" mutate the local store with no confirmation                                                                                                           |
| `/v1/pricing`                   | `components/marketing/marketing-landing.tsx`            | **diverges** | the four CTAs are a `<p>` styled `cursor-not-allowed`, not a `disabled` `<button>` — not focusable, not announced as a control; the "nothing is charged" note explains it, but the control is fake |
| `/v1/support`                   | `components/support/support-page.tsx`                   | follows      | three fact cards + `mailto:`                                                                                                                                                                       |
| `/v1/terms`, `/v1/privacy`      | `components/legal/legal-page.tsx`                       | follows      | the same draft legal page                                                                                                                                                                          |

The `/v1` shell (`components/v1/v1-shell.tsx`) mounts a sticky `PersonaBar` (the auth stand-in) on
every screen. That bar is the only global navigation the prototype has — the screens themselves
mostly do not link to each other, which is why the report's dead end matters.

---

## 4. Interaction checks a screenshot hides

Checked on every surface read above. Only the failures are listed; where a check passes everywhere
it is noted once.

1. **Can a person always get back?** No, in three places.
   - `/v1/relationships/[id]/report` — unlocked report: zero links, zero outbound `href`
     (`components/v1/report-view.tsx`). The locked state has "Back to the relationship"; the
     unlocked state — the one a completed pair actually reaches — has nothing.
   - `/assessment/[slug]` — the real report: no back link to the instance or the list
     (`components/assessment/assessment-report.tsx`).
   - `/assessment/instances/[instanceId]` — no back link to `/assessment/instances` either; the
     shell sidebar is the only way out (`components/assessment-flow/instance-view.tsx`).
2. **Destructive actions confirmed?** Not always.
   - Confirmed: template Delete and Archive (`AlertDialog`, `components/v1/template-editor.tsx`).
   - Not confirmed: **"Reset demo"** wipes the whole store on one click
     (`components/v1/persona-bar.tsx` L64); "Re-invite" rotates the token and kills the old link
     with only a text note (`components/v1/relationship-detail.tsx`); "Resolve"/"Resend invite"
     (`components/v1/service-home.tsx`); the per-Aspect trash icon removes an Aspect immediately
     (`components/v1/template-editor.tsx`, inherited from `components/create/quiz-editor.tsx`).
3. **Empty states explained?** Mostly yes — `EmptyState` (`components/v1/v1-ui.tsx`) carries
   title + body + action, and `template-editor.tsx` explains "No Aspects yet." The gap is the
   template's own: see §6.
4. **Errors visible, not only in the log?** Yes on the real flow (`role="alert"` in
   `instance-view.tsx`, `template-form.tsx`, `invite-view.tsx`). **No** in
   `/v1/relationships/[id]/answer`: the validation message is a plain `<p>` with no
   `role="alert"` and appears only after a failed submit, so a screen reader is not told
   (`components/v1/answer-sheet.tsx`).
5. **Disabled controls explained?** Once, and only in the prototype: the Basic-mode `<option
   disabled>` with "Basic is a subset of Advanced. Not in this prototype."
   (`components/v1/template-library.tsx`). Everywhere else a disabled control is silent: the
   editor's "Add aspect" at `MAX_ASPECTS` (`components/v1/template-editor.tsx`), the register
   wizard's `disabled` Next (`components/auth/register-view.tsx`), and the pricing `<p>` that is
   not even a real control.
6. **Touch targets ≥ 44px?** The one real answer sheet meets it (`min-h-[44px] min-w-[44px]`,
   `components/assessment-flow/answer-form.tsx`), and the prototype's score buttons are `h-11`.
   Failures: the invite copy button is `px-2 py-0.5` — roughly 22px tall
   (`components/assessment-flow/invite-link.tsx` L139); the accordion reorder/delete controls are
   `h-4 w-4` icon `<span>`s (`components/v1/template-editor.tsx`, `components/create/quiz-editor.tsx`);
   `my-quizzes.tsx` grid/list toggles are `h-8 w-8`.
7. **Nothing hover-only?** False. The accordion reorder/delete controls in both editors are
   `<span onClick>` with `stopPropagation` — no button, no keyboard, no focus ring, invisible to a
   screen reader, and only their `hover:bg-muted/50` hints at interactivity
   (`components/create/quiz-editor.tsx` L391–413, copied into `components/v1/template-editor.tsx`
   L334–357).

---

## 5. Top ten fixes, ranked by user impact

1. Give the unlocked report a back link and an outbound path to the relationship —
   `components/v1/report-view.tsx`.
2. Give the real report a back link to the instance/list — `components/assessment/assessment-report.tsx`.
3. Confirm "Reset demo" before wiping the store — `components/v1/persona-bar.tsx`.
4. Make the reorder/delete controls real buttons with focus and 44px targets (and stop inheriting
   the ancestor's `<span onClick>`) — `components/v1/template-editor.tsx`.
5. Rebuild the 1–5 band as the ancestor's native radio group, and drop the full-page
   `window.location.assign` for a router transition — `components/v1/answer-sheet.tsx`.
6. Announce the answer-sheet validation error with `role="alert"` — `components/v1/answer-sheet.tsx`.
7. Wrap the template-library table in the leaderboard `overflow-x-auto` + `min-w-[600px]` pair —
   `components/assessment-flow/template-library.tsx`.
8. Wrap the gap-analysis kinds table the same way — `components/console/gap-analysis.tsx`.
9. Enlarge the invite copy button to a 44px target — `components/assessment-flow/invite-link.tsx`.
10. Render the pricing CTAs as a real `disabled` `<button>`, not a `<p>` — `components/v1/marketing-views.tsx`.

## 6. Mobile findings — width and what breaks

Breakpoints are not Tailwind's defaults (`tailwind.config.ts` L103–107: `sm` 576, `md` 768,
`lg` 992, `xl` 1280, `xxl` 1400); an unprefixed class is the mobile layer and a 390px phone is
186px below `sm`.

- **390px, `/assessment/templates`** — `<table className="w-full table-fixed …">` with seven
  columns and no `overflow-x-auto` wrapper: `table-fixed` splits 390px into slivers instead of
  scrolling (`components/assessment-flow/template-library.tsx` L268).
- **390px, `/admin/instances`** — the nine-column `Table` has no `overflow-x-auto` wrapper; every
  column compresses (`components/admin/instance-registry.tsx` L263).
- **390px, `/admin/gaps`** — the five-column kinds `Table` has no wrapper (`components/console/gap-analysis.tsx` L194).
- **390px, `/assessment/[slug]` report** — the three-column gap `table` survives by luck with no
  wrapper (`components/assessment/assessment-report.tsx` L304); one added column breaks it
  (`docs/UI-MAPPING.md` records the same).
- **390px, `/assessment/instances/[instanceId]`** — the submit button sits at the bottom of a sheet
  that is eight Aspects × up to four score kinds long; it scrolls away, and no sticky action bar
  exists anywhere in the tree (`components/assessment-flow/answer-form.tsx` L164,
  `docs/UI-MAPPING.md` part 3).
- **390px, `/v1/relationships/[id]`** — the answers table does it right (`overflow-x-auto`,
  `components/v1/relationship-detail.tsx`); the prototype is ahead of the production tables here.
- **390px, `/v1` persona picker** — the two-column persona grid (`sm:grid-cols-2`) is single-column
  below `sm`, which is correct; the left brand panel is `lg:w-2/5`, hidden below `lg` — fine.

## 7. What the template itself does badly — do not inherit these

1. **The primary CTA lies.** `components/create/quiz-editor.tsx` `saveQuiz`/`publishQuiz` are
   `console.log` plus a success toast — no write, no persistence, a green checkmark over nothing.
   The `/v1` editor correctly made these real; the production quiz editor still doesn't.
2. **Redundant and dead filter controls.** `components/my-quizzes/my-quizzes.tsx` draws a status
   `Select` **and** a status `Tabs` bound to the same state, plus a "Sort By" `Select` that sorts
   nothing (`filteredQuizzes` never re-sorts). Two controls for one filter, one control for no
   behaviour.
3. **Reorder/delete are `<span onClick>` with 16px icons** — not buttons, not keyboard-reachable,
   no focus ring, sub-44px targets (`components/create/quiz-editor.tsx` L391–413). The
   `/v1` editor copied this verbatim rather than fixing it at the source.
4. **The mobile table is a sideways scroll, nothing more.** `components/leaderboard/leaderboard-table.tsx`
   forces `min-w-[600px]` + `overflow-x-auto`; there is no table→card collapse in the whole tree
   (`docs/UI-MAPPING.md`). It is the _correct_ pattern to copy, but it is still a horizontal-scroll
   band-aid, and its `success` variant paints a raw `bg-green-400` palette step inside the primitive
   that `components/ui/button.tsx` itself says the palette has one home.
5. **A form that asks for data it discards.** `components/auth/register-view.tsx` collects phone,
   date-of-birth and country, and its own comment admits none of them are sent anywhere — a field
   that silently goes nowhere is worse than one the product doesn't ask for.

## 8. Verification

The document is a `docs/`-only change; the gate runs the docs lane (`glossary` +
`release:check`). Result: `bash scripts/verify.sh` exited 0 (see the run log). No component,
fixture or route file was modified — `git status` is clean apart from this file.
