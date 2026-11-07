/**
 * The per-surface copy budget (E23) — the ratchet the later copy units turn.
 *
 * For each surface with a `PageCopy` fixture this records the files the copy owns and
 * the number of leaf literals still allowed inside them:
 *
 *   page      the module Next mounts the surface from — a page, a layout, or a special
 *             file (`app/not-found.tsx`)
 *   mounts    further modules that mount the same copy. Only the shell has them: its
 *             header and sidebar hang off `app/(mainlayout)/layout.tsx`, but its footer
 *             is rendered by the pages, so `components/layout/footer.tsx` is a second
 *             mount of the one `data/pages/shell.ts`. Without it the footer's strings
 *             would be attributed to nobody.
 *   dirs      the directories whose *reachable* files are attributed to the surface.
 *             Reachability matters: a component nobody imports is not this surface's
 *             copy, and counting it would make two cards fight over one number. WU-12
 *             deleted the fourteen unimported components, which is exactly why
 *             attribution asks the import graph instead of listing a directory. Every
 *             surface here declares one: even the 404 renders `components/not-found/*`,
 *             and an empty `dirs` whose module imports a component is a red build.
 *   fixture   must be reachable from `page` or a mount; that is the proof the copy is
 *             wired in
 *   budget    leaf literals still tolerated. **Measured, then recorded.** A unit lowers
 *             it; raising it is a reviewable diff (the check compares the tree against
 *             this number, it never re-baselines itself).
 *
 * `"/"` measured 87 literals before WU-6 and 0 after — every string the page's own
 * components rendered now lives in `data/pages/home.ts`. The budget stays 0: the next
 * literal added to `components/home/**` that a page renders is a red build.
 *
 * `/` also attributes `components/categories`, because the home page renders the
 * how-it-works band that lives there (WU-8). Attribution is reachability, so only
 * `categories-how-it-works.tsx` joins the count; the rest of the directory belongs to
 * `/categories` and `/categories/[slug]`, which name the same directory and pick up
 * only what their own page modules import.
 *
 * WU-7 took the shell, `/login`, `/register` and the 404 to 0 the same way, so every
 * surface in this table is at 0 and the next literal added to any of them is a red
 * build. `shell` and `not-found` are the two declared non-route surfaces
 * (`NON_ROUTE_COPY_SURFACES` in `content/pages.ts`).
 *
 * WU-9 recorded the same 0 for the five marketing surfaces it moved: 184 literal strings
 * across 30 components became 8 fixtures, and the two news routes and the two support
 * routes that share one component directory each measured 0 on their own import closure.
 * A row here is per *surface*, so a shared band is counted once per surface that reaches
 * it — that is the number that has to stay at 0 when the next band is added to either page.
 */
import { zPageCopyBudget, type PageCopyBudget } from "../../content/pages";

export const pageCopyBudget: PageCopyBudget = zPageCopyBudget.parse({
  "/": {
    page: "app/(marketing)/page.tsx",
    dirs: ["components/home", "components/categories"],
    fixture: "data/pages/home",
    budget: 0,
  },
  // #503 — the audit log. Budget 0: the seven column labels, the dash for the absent side of a
  // change, the "no profile row" attribution and the two empty/failure panels are
  // `data/pages/admin-audit.ts`, so the next literal written in `audit-log.tsx` is a red build.
  "/admin/audit": {
    page: "app/(mainlayout)/admin/audit/page.tsx",
    dirs: ["components/admin"],
    fixture: "data/pages/admin-audit",
    budget: 0,
  },
  // #507 — the broadcast. Budget 0 from the first commit, like the console's other screens: the four
  // mail-key banners, the compose band's fourteen fields, the four dry-run counts, the six list
  // captions, the send table's six columns and the fourteen refusal sentences are all
  // `data/pages/admin-broadcast.ts`, so the next literal written in `broadcast-composer.tsx` is a
  // red build. Attribution is reachability, so this row counts one component.
  "/admin/broadcast": {
    page: "app/(mainlayout)/admin/broadcast/page.tsx",
    dirs: ["components/admin"],
    fixture: "data/pages/admin-broadcast",
    budget: 0,
  },
  // #505 — billing control. Budget 0 from the first commit, like the console's other screens: the
  // test-mode banner's three states, the six stat captions, the nine column labels, the five
  // subscription states, the four plan sources, the plan-limit sentences, the comp band's eleven
  // fields, the seven refusal sentences and the empty/failure panels are all
  // `data/pages/admin-billing.ts`, so the next literal written in `billing-control.tsx` is a red
  // build. Attribution is reachability, so this row counts one file.
  "/admin/billing": {
    page: "app/(mainlayout)/admin/billing/page.tsx",
    dirs: ["components/admin"],
    fixture: "data/pages/admin-billing",
    budget: 0,
  },
  "/admin/gaps": {
    page: "app/(mainlayout)/admin/gaps/page.tsx",
    dirs: ["components/console"],
    fixture: "data/pages/admin-gaps",
    budget: 0,
  },
  // The operator's platform health (#508): four measurements, each with its own source line. Budget
  // 0 from the first commit — the four headings, every stat caption, the two alarm sentences and the
  // two provenance templates are `data/pages/admin-health.ts`, so the next literal written in the
  // cards is a red build.
  "/admin/health": {
    page: "app/(mainlayout)/admin/health/page.tsx",
    dirs: ["components/admin"],
    fixture: "data/pages/admin-health",
    budget: 0,
  },
  // Card 3/5 of the console: the operator's relationship registry. Budget 0 from the first
  // commit, like the flow surfaces — the heading, the nine column labels, the five seat states,
  // the five stage tabs, the two selects' options, the count sentence and the three
  // empty/failure states are all `data/pages/admin-instances.ts`, so the next literal written in
  // the table is a red build.
  "/admin/instances": {
    page: "app/(mainlayout)/admin/instances/page.tsx",
    dirs: ["components/admin"],
    fixture: "data/pages/admin-instances",
    budget: 0,
  },
  // #503 — one relationship's repair screen, the registry's child. Budget 0 from the first
  // commit: the five bands, their buttons, the two seat pickers, the eleven refusal sentences and
  // the one-time-link notice are all `data/pages/admin-relationship.ts`. Attribution is
  // reachability, so only `components/admin/relationship-operations.tsx` joins this row's count —
  // the registry belongs to `/admin/instances` above it and the log to `/admin/audit` below.
  "/admin/instances/[id]": {
    page: "app/(mainlayout)/admin/instances/[id]/page.tsx",
    dirs: ["components/admin", "components/relationship"],
    fixture: "data/pages/admin-relationship",
    budget: 0,
  },
  // #665 — the review shelf. Budget 0 from the first commit, like the console's other screens: the
  // group heading's two states, the row's one-line summary, the preview's served-from note, the
  // metadata labels, the to-do states and the whole feedback/issue vocabulary are
  // `data/pages/admin-review.ts`, so the next literal written in `review-artifacts.tsx` is a red
  // build. Attribution is reachability, so this row counts one component.
  "/admin/review": {
    page: "app/(mainlayout)/admin/review/page.tsx",
    dirs: ["components/admin"],
    fixture: "data/pages/admin-review",
    budget: 0,
  },
  // #502a — template authoring. Budget 0 from the first commit: the table's headings and states,
  // the create band's five fields and its nine refusal sentences are `data/pages/admin-templates.ts`,
  // so the next literal written in `template-registry.tsx` is a red build. Attribution is
  // reachability, so only the registry joins this row — the editor belongs to the child below.
  "/admin/templates": {
    page: "app/(mainlayout)/admin/templates/page.tsx",
    dirs: ["components/admin"],
    fixture: "data/pages/admin-templates",
    budget: 0,
  },
  // The editor: the three tabs, the record's fields, the Aspect row controls, the save band and the
  // locked panel are `data/pages/admin-template-editor.ts`. The preview reuses the flow's answer
  // sheet, whose own words belong to `/assessment/instances/[instanceId]/answer` and are passed in
  // rather than re-authored here.
  "/admin/templates/[id]": {
    page: "app/(mainlayout)/admin/templates/[id]/page.tsx",
    dirs: ["components/admin"],
    fixture: "data/pages/admin-template-editor",
    budget: 0,
  },
  // #504 — the relationship's Gap report. Budget 0 from the first commit: the verdict band, the
  // per-Aspect rows, the eight kind labels' captions, the export footer, the reissue form, the
  // PII banner and the nine refusal sentences are all `data/pages/admin-report.ts`. Attribution
  // is reachability, so this row counts `components/admin/report-operations.tsx` and the repair
  // screen above it keeps its own file.
  "/admin/instances/[id]/report": {
    page: "app/(mainlayout)/admin/instances/[id]/report/page.tsx",
    dirs: ["components/admin"],
    fixture: "data/pages/admin-report",
    budget: 0,
  },
  // #506 — the support inbox. Budget 0 from the first commit: the queue's five column labels, the
  // four status words, the delivery band's four states, the throttle's two sentences, the thread's
  // receipts, three forms and the ten refusal sentences are all `data/pages/admin-inbox.ts`, so the
  // next literal written in either component is a red build. Attribution is reachability, so this
  // row counts `components/admin/support-inbox.tsx` and `support-thread.tsx` — and nothing else in
  // the directory, because no other page imports them.
  "/admin/inbox": {
    page: "app/(mainlayout)/admin/inbox/page.tsx",
    dirs: ["components/admin"],
    fixture: "data/pages/admin-inbox",
    budget: 0,
  },
  "/battle": {
    page: "app/(mainlayout)/battle/page.tsx",
    dirs: ["components/battle"],
    fixture: "data/pages/battle",
    budget: 0,
  },
  "/categories": {
    page: "app/(mainlayout)/categories/page.tsx",
    dirs: ["components/categories"],
    fixture: "data/pages/categories",
    budget: 0,
  },
  "/categories/[slug]": {
    page: "app/(mainlayout)/categories/[slug]/page.tsx",
    dirs: ["components/categories"],
    fixture: "data/pages/category-detail",
    budget: 0,
  },
  "/daily-challenge": {
    page: "app/(mainlayout)/daily-challenge/page.tsx",
    dirs: ["components/daily-challenge"],
    fixture: "data/pages/daily-challenge",
    budget: 0,
  },
  "/dashboard/user": {
    page: "app/(mainlayout)/dashboard/user/page.tsx",
    dirs: ["components/identity"],
    fixture: "data/pages/dashboard",
    budget: 0,
  },
  /**
   * `/dashboard` — the console's Overview (Console 2/5), and the first surface whose four figures
   * are counts rather than authored metrics. Budget 0 from the first commit: the card labels, the
   * three one-line explanations, the empty band and the failure panel are all
   * `data/pages/overview.ts`, so the next sentence written in `components/console/**` is a red
   * build. `dirs` is only the new domain — `/dashboard/user`'s `components/identity` stays
   * attributed to that surface, and the two consoles cannot lend each other words.
   */
  "/dashboard": {
    page: "app/(mainlayout)/dashboard/page.tsx",
    dirs: ["components/console"],
    fixture: "data/pages/overview",
    budget: 0,
  },
  // #542 phase 1 — support inside the shell: the knowledge base, the request form and the outcome
  // band. Budget 0: the list's chrome, the fields, the five states and the band's three facts are
  // `data/pages/dashboard-support.ts`.
  "/dashboard/support": {
    page: "app/(mainlayout)/dashboard/support/page.tsx",
    dirs: ["components/support"],
    fixture: "data/pages/dashboard-support",
    budget: 0,
  },
  // #533 phase 2 — the initiator's own CRUD, budget 0 from the first commit. The two lists, the
  // private template editor (which renders `components/admin/template-editor.tsx` in its
  // `band: "private"` variation — a component with no literals of its own) and one relationship's
  // detail: every label, every refusal sentence and every notice is a fixture string, because a
  // member's screen is where "the trial is running and no invitation is live" has to be said in
  // words rather than inferred from two badges.
  "/dashboard/templates": {
    page: "app/(mainlayout)/dashboard/templates/page.tsx",
    dirs: ["components/dashboard"],
    fixture: "data/pages/dashboard-templates",
    budget: 0,
  },
  "/dashboard/templates/[id]": {
    page: "app/(mainlayout)/dashboard/templates/[id]/page.tsx",
    dirs: ["components/dashboard", "components/admin"],
    fixture: "data/pages/dashboard-template-editor",
    budget: 0,
  },
  "/dashboard/relationships": {
    page: "app/(mainlayout)/dashboard/relationships/page.tsx",
    dirs: ["components/dashboard"],
    fixture: "data/pages/dashboard-relationships",
    budget: 0,
  },
  "/dashboard/relationships/[id]": {
    page: "app/(mainlayout)/dashboard/relationships/[id]/page.tsx",
    dirs: ["components/dashboard", "components/relationship"],
    fixture: "data/pages/dashboard-relationship-detail",
    budget: 0,
  },
  "/explore": {
    page: "app/(mainlayout)/explore/page.tsx",
    dirs: ["components/explore"],
    fixture: "data/pages/explore",
    budget: 0,
  },
  /**
   * `/how-it-works` — the console's onboarding page. Budget 0 from the first commit, like the
   * flow surfaces: the six moves, the two half-labels and the three honest limits are all
   * `data/pages/how-it-works.ts`, so the next sentence typed into the view is a red build.
   */
  "/how-it-works": {
    page: "app/(mainlayout)/how-it-works/page.tsx",
    dirs: ["components/onboarding"],
    fixture: "data/pages/how-it-works",
    budget: 0,
  },
  "/explore/featured": {
    page: "app/(mainlayout)/explore/featured/page.tsx",
    dirs: ["components/explore"],
    fixture: "data/pages/explore-featured",
    budget: 0,
  },
  "/login": {
    page: "app/(auth)/login/page.tsx",
    dirs: ["components/auth"],
    fixture: "data/pages/login",
    budget: 0,
  },
  "/register": {
    page: "app/(auth)/register/page.tsx",
    dirs: ["components/auth"],
    fixture: "data/pages/register",
    budget: 0,
  },
  "/affiliate": {
    page: "app/(mainlayout)/affiliate/page.tsx",
    dirs: ["components/affiliate"],
    fixture: "data/pages/affiliate",
    budget: 0,
  },
  /**
   * The three password surfaces (#password-reset), budget 0 from the first commit like the other
   * flow surfaces: every sentence — the five request outcomes, the four link states, the six
   * password refusals, the message body — is `data/pages/password-reset.ts`, and the views only
   * join ids to sentences. One fixture for three routes, like the two legal pages: the same person
   * reads them in sequence, and two copies of "Ask for a new link" is two places a typo hides.
   */
  "/forgot-password": {
    page: "app/(auth)/forgot-password/page.tsx",
    dirs: ["components/auth"],
    fixture: "data/pages/password-reset",
    budget: 0,
  },
  "/reset/[token]": {
    page: "app/(auth)/reset/[token]/page.tsx",
    dirs: ["components/auth"],
    fixture: "data/pages/password-reset",
    budget: 0,
  },
  "/reset/complete": {
    page: "app/(auth)/reset/complete/page.tsx",
    dirs: ["components/auth"],
    fixture: "data/pages/password-reset",
    budget: 0,
  },
  "/pricing": {
    page: "app/(marketing)/pricing/page.tsx",
    dirs: ["components/pricing"],
    fixture: "data/pages/pricing",
    budget: 0,
  },
  "/profile/[username]": {
    page: "app/(mainlayout)/profile/[username]/page.tsx",
    // Only the identity components this card added. The demo branch still renders the fixture
    // profile view (`components/profile/**`), which holds 132 unreviewed literals and several
    // sentences — attributing that directory here would fail the length rule in this card
    // instead of leaving it where it is: pre-existing copy debt with its own unit. The ratchet
    // still applies to everything new, which is what "budget 0" means for this surface.
    dirs: ["components/identity"],
    fixture: "data/pages/profile",
    budget: 0,
  },
  "/settings": {
    page: "app/(mainlayout)/settings/page.tsx",
    dirs: ["components/identity"],
    fixture: "data/pages/settings",
    budget: 0,
  },
  "/news": {
    page: "app/(mainlayout)/news/page.tsx",
    dirs: ["components/news"],
    fixture: "data/pages/news",
    budget: 0,
  },
  "/news/[slug]": {
    page: "app/(mainlayout)/news/[slug]/page.tsx",
    dirs: ["components/news"],
    fixture: "data/pages/news-article",
    budget: 0,
  },
  /**
   * `/support` — the account support page, in the app shell since the Help/Support split.
   *
   * The route moved from `app/(marketing)/` to `app/(mainlayout)/` and the panel components stayed
   * in `components/support/`, which `/help` also renders: a shared band is counted once per
   * surface it reaches, and both surfaces must keep measuring 0.
   */
  "/support": {
    page: "app/(mainlayout)/support/page.tsx",
    dirs: ["components/support"],
    fixture: "data/pages/support",
    budget: 0,
  },
  /**
   * `/help` — the public help centre (FAQ + knowledge base). Budget 0 from the first commit, like
   * every surface this tree adds: the two tab labels, the taxonomy, the two bands' chrome and the
   * "need a person" paragraph are all `data/pages/help.ts`.
   */
  "/help": {
    page: "app/(marketing)/help/page.tsx",
    dirs: ["components/support", "components/contact"],
    fixture: "data/pages/help",
    budget: 0,
  },
  "/support/articles/[slug]": {
    page: "app/(marketing)/support/articles/[slug]/page.tsx",
    dirs: ["components/support"],
    fixture: "data/pages/support-article",
    budget: 0,
  },
  "/creator-tips": {
    page: "app/(mainlayout)/creator-tips/page.tsx",
    dirs: ["components/creator-tips"],
    fixture: "data/pages/creator-tips",
    budget: 0,
  },
  "/creator-tips/[slug]": {
    page: "app/(mainlayout)/creator-tips/[slug]/page.tsx",
    dirs: ["components/creator-tips"],
    fixture: "data/pages/creator-tips-detail",
    budget: 0,
  },
  /**
   * The two legal pages (issue #270). One component directory serves both routes, because they
   * are one document in two shapes: the draft banner, the heading, the section stack and the
   * paragraph/list vocabulary are shared, and only the fixture differs. `fixture` is the module
   * the page imports, which is also where the brand record is read — so `BRAND=quizhub` and
   * `BRAND=alignsynch` validate different words against the same budget.
   */
  "/privacy": {
    page: "app/(marketing)/privacy/page.tsx",
    dirs: ["components/legal"],
    fixture: "data/pages/legal",
    budget: 0,
  },
  "/terms": {
    page: "app/(marketing)/terms/page.tsx",
    dirs: ["components/legal"],
    fixture: "data/pages/legal",
    budget: 0,
  },
  /**
   * `/templates` — the public Relationship Templates catalogue.
   *
   * Budget 0 from the first commit, like every surface this tree adds: the hero, the three bands'
   * chrome, the five strings a card repeats and the counted catalogue sentence are all
   * `data/pages/templates.ts`, so the next literal written in `components/templates/**` or in the
   * page module is a red build. The cards themselves are `lib/template-catalogue.ts` over
   * `data/relationship-types.ts` — records, not words.
   */
  "/templates": {
    page: "app/(marketing)/templates/page.tsx",
    dirs: ["components/templates"],
    fixture: "data/pages/templates",
    budget: 0,
  },
  shell: {
    page: "app/(mainlayout)/layout.tsx",
    mounts: ["components/layout/footer.tsx"],
    dirs: ["components/layout", "components/header"],
    fixture: "data/pages/shell",
    budget: 0,
  },
  /**
   * `tour` — the first-run tour's callout (#455), the second non-route surface.
   *
   * `page` is `/dashboard`'s module because that is what *mounts* the surface: the route resolves
   * the fixture and hands it to `components/tour/first-run-tour.tsx` as a prop, exactly as
   * `components/legal` receives its words, and the check's "fixture reachable from the page"
   * half proves the wiring. `dirs` is the one component directory the tour owns, and budget 0
   * from the first commit: the six step sentences, the three button labels, the progress line and
   * the announcement sentence are all `data/pages/tour.ts`, so the next string typed into
   * `components/tour/**` is a red build rather than a second home for copy.
   */
  tour: {
    page: "app/(mainlayout)/dashboard/page.tsx",
    dirs: ["components/tour"],
    fixture: "data/pages/tour",
    budget: 0,
  },
  /**
   * `/search` — the one route whose copy lives in the shell's fixture (issue #156 follow-up).
   *
   * The search field, the four result-group headings and the page's own empty states are one
   * vocabulary: the palette and the route word the same groups, and two fixtures would let
   * "Pages" and "Assessments & pages" describe the same rows. So the surface names
   * `data/pages/shell` as its fixture, exactly as the two `search` / `search-alignsynch` sections
   * are shared today, and E23 attributes this route's own component directory
   * (`components/search/**`) to it. `data/pages/index.ts` maps `"/search"` to the same instance
   * for the same reason — a budget with no copy entry is a stale slot, and the copy it points at
   * is the instance the page renders.
   *
   * Budget 0, measured: the body's title, result count, empty states, no-query state and the
   * difficulty filter's options were all literals in `components/search/search-results.tsx`
   * before this card, and the tabs had already moved out one card earlier. The two quiz-only
   * count labels (`{n} quiz` / `{n} quizzes`) inside the category and creator cards are
   * string literals in an *expression*, which E23's leaf rule does not read; they are on the
   * list for the card that gives an alignment build a category or a creator.
   */
  "/search": {
    page: "app/(mainlayout)/search/page.tsx",
    dirs: ["components/search"],
    fixture: "data/pages/shell",
    budget: 0,
  },
  "not-found": {
    page: "app/not-found.tsx",
    dirs: ["components/not-found"],
    fixture: "data/pages/not-found",
    budget: 0,
  },
  "/tournaments": {
    page: "app/(mainlayout)/tournaments/page.tsx",
    dirs: ["components/tournaments"],
    fixture: "data/pages/tournaments",
    budget: 0,
  },
  "/tournaments/[id]": {
    page: "app/(mainlayout)/tournaments/[id]/page.tsx",
    dirs: ["components/tournaments"],
    fixture: "data/pages/tournament-detail",
    budget: 0,
  },
  // #146 moved the two-party flow's words out as they were written: the three new
  // surfaces measure 0, and the ratchet starts there rather than at a number a later unit
  // would have to lower.
  "/assessment": {
    page: "app/(mainlayout)/assessment/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment",
    budget: 0,
  },
  "/assessment/instances": {
    page: "app/(mainlayout)/assessment/instances/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment-instances",
    budget: 0,
  },
  "/assessment/instances/[instanceId]": {
    page: "app/(mainlayout)/assessment/instances/[instanceId]/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment-instance",
    budget: 0,
  },
  // #409 — the relationship report, the one read surface the app did not have. Budget 0 from the
  // first commit, for the same reason: the locked state, the verdict band, the opinion matrix and
  // the Gap table's four headings are all in `data/pages/assessment-relationship-report.ts`, so
  // the next literal written in `report-view.tsx` is a red build.
  "/assessment/instances/[instanceId]/report": {
    page: "app/(mainlayout)/assessment/instances/[instanceId]/report/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment-relationship-report",
    budget: 0,
  },
  // R1-E (#409) — the three write surfaces, shipped as in-progress UI. Budget 0 from the
  // first commit: the headings, the blind rule, the seat rows, the Mode/Setting explanations
  // and both not-wired notices are `data/pages/assessment-*.ts`, so a sentence typed back into
  // a component is a red build.
  "/assessment/instances/[instanceId]/answer": {
    page: "app/(mainlayout)/assessment/instances/[instanceId]/answer/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment-answer",
    budget: 0,
  },
  "/assessment/instances/[instanceId]/accept": {
    page: "app/(mainlayout)/assessment/instances/[instanceId]/accept/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment-accept",
    budget: 0,
  },
  "/assessment/templates/[templateId]/create": {
    page: "app/(mainlayout)/assessment/templates/[templateId]/create/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment-create",
    budget: 0,
  },
  // #255 — the template authoring form. Budget 0 from the first commit, for the reason the
  // three flow surfaces above are: every word is in `data/pages/assessment-template-new.ts`,
  // including the six refusals, so the next literal written in the form is a red build.
  // #console 5/5 — the template library and one template. Two surfaces, one read each, budget 0
  // from the first commit: every word is in `data/pages/assessment-templates.ts` and
  // `data/pages/assessment-template-detail.ts`, so the next literal written in either component
  // is a red build.
  "/assessment/templates": {
    page: "app/(mainlayout)/assessment/templates/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment-templates",
    budget: 0,
  },
  "/assessment/templates/[templateId]": {
    page: "app/(mainlayout)/assessment/templates/[templateId]/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment-template-detail",
    budget: 0,
  },
  "/assessment/templates/new": {
    page: "app/(mainlayout)/assessment/templates/new/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment-template-new",
    budget: 0,
  },
  "/invite/[token]": {
    page: "app/(mainlayout)/invite/[token]/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/invite",
    budget: 0,
  },
  /**
   * The marketing landing page (#159) — the first surface in this table that is not a product
   * route, and the reason `mounts` exists for a second caller.
   *
   * Its chrome hangs off `app/(marketing)/layout.tsx`, which is not the page Next renders, so the
   * layout is a mount: without it the header's CTA label and the footer's two strings would be
   * attributed to nobody. The one directory it owns is `components/marketing/**`, which the layout
   * and the page both import.
   *
   * Budget 0, measured not assumed: the seven bands' words are `data/pages/marketing.ts`, the brand
   * name is `brand.name`, the two limits are fixture items, and the only other strings the built
   * HTML carries are the address (`brand.supportEmail`) and Tailwind class names.
   */
  "/welcome": {
    page: "app/(marketing)/welcome/page.tsx",
    mounts: ["app/(marketing)/layout.tsx"],
    dirs: ["components/marketing"],
    fixture: "data/pages/marketing",
    budget: 0,
  },
});
