/**
 * Route manifest — the referential anchor for every link the content model emits.
 *
 * Two things depend on it:
 *  - `buildSearchIndex()` refuses to index a path that does not resolve;
 *  - `checkNotificationRefs()` refuses a notification whose `link` has no route.
 *
 * That is what stops the two dead notification links and the sixteen
 * `/categories/<A-only-slug>` dead ends from coming back (D13).
 *
 * `data:check` walks `app/` and fails if this table and the filesystem disagree,
 * in both directions — a route added to the app but not here is as red as a
 * route kept here after its page was deleted.
 */
import { z } from "zod";
import { zRouteManifest, type RouteManifest } from "./route-manifest";

/** Routes without a dynamic segment. Order is irrelevant; `matchRoute` is exact. */
const STATIC_ROUTES = [
  "/",
  "/admin/console",
  "/admin/console/relationships",
  "/admin/console/templates",
  "/admin/console/users",
  "/admin/audit",
  // #507 — the broadcast: compose, dry run, send, and the sends already made.
  "/admin/broadcast",
  // #505 — billing control: subscription state per relationship, and the owner's comp.
  "/admin/billing",
  // #906 — the brand and audience profile: the canon, rendered for the operator who writes from it.
  // Reached from the admin notice bar (the only door), gated by the console capability *and* the
  // alignment product — a quiz-only build answers 404.
  "/admin/brand",
  // #892 — the documentation home: the 117 pages under docs/, rendered from the manifest the gate
  // already walks. Its document route is a catch-all and lives in `DYNAMIC_ROUTES` below.
  "/admin/docs",
  // #893 — the two derived views over the same tree, both under the hub's address: the features
  // index groups `feat(<area>)` scopes out of CHANGELOG.md, and the releases shelf joins
  // `docs/changelog/releases.json` to the pages it generated. Static segments under a catch-all,
  // so Next resolves them before `[...slug]`.
  "/admin/docs/features",
  "/admin/docs/releases",
  // #1126 — the CRUD & Permissions matrix: the v2 spec reference for every card that adds a
  // create, edit, archive or leave action. Admin-only and read-only, and directly after Docs in
  // the rail; the source (`docs/specs/v2-prototype/crud-matrix.md`) is parsed per request.
  "/admin/permissions",
  // #1138 — the transactional-mail override editor: the register's member-facing templates, their
  // publish state and one template's editor. Directly after the two reference rows, because a mail's
  // words are the third thing an operator looks up.
  "/admin/email-templates",
  "/admin/gaps",
  // #920 — the growth model: 36 cohorts on the way to a $3M run-rate, charted from one committed
  // artifact (`data/demo/growth-model.json`), with the sampled operational set beside it.
  "/admin/growth",
  "/admin/health",
  "/admin/instances",
  // #665 — the console's review shelf: published artifacts, their to-dos and their feedback.
  "/admin/review",
  // #502a — template authoring: the console's authored catalogue and one template's editor.
  "/admin/templates",
  // #506 — the support inbox: the contact form's queue, one thread, the reply.
  "/admin/inbox",
  "/affiliate",
  "/assessment",
  // #877 — the member's assessment-session listing, a sibling of `/dashboard/relationships`. It
  // replaced `/assessment/instances`, which is now a 308 here (`next.config.mjs`); the session's
  // own page stays in `DYNAMIC_ROUTES` below.
  "/assessments",
  "/battle",
  "/categories",
  "/chat",
  "/create/editor",
  "/create/generator",
  "/creator-tips",
  "/daily-challenge",
  "/dashboard",
  /**
   * #1131 — Chat v2: one thread per relationship. A **member** surface under the dashboard, not the
   * quiz product's `/chat` above: that address is gated to the quiz brand (`requireQuizProduct`,
   * #300) and its conversations are a different product's; this one lists the relationships the
   * reader is a party to, so it sits beside the two lists below.
   */
  "/dashboard/chat",
  // #542 phase 1 — the destinations the rail used to reach on the marketing site.
  "/dashboard/help",
  "/dashboard/support",
  // #533 phase 2 — the initiator's own CRUD: their private templates and the relationships they
  // started. Both *lists* are static routes; their detail pages are in `DYNAMIC_ROUTES` below,
  // because a `[id]` segment filed as a static route matches only its own literal spelling and
  // every real `/dashboard/relationships/<id>` link would read as a 404 to `data:check` E10.
  "/dashboard/relationships",
  // #1132 — the member's billing surface: one trial panel per relationship, and a Counterparty
  // view that carries no price. Reached by its address until the bundles that link it (Start,
  // Account Settings) land; the bundle draws no rail row, so the shell does not gain one here.
  "/dashboard/payment",
  "/dashboard/templates",
  "/dashboard/user",
  "/demo",
  "/demo/admin",
  "/explore",
  "/explore/featured",
  "/forgot-password",
  "/help",
  "/how-it-works",
  "/leaderboard",
  "/login",
  "/my-quizzes",
  "/news",
  "/pricing",
  "/privacy",
  "/quiz-discussions",
  "/register",
  // The public catalogue — the header's `Templates` row, the footer's catalogue link and every
  // "start with a template" action. Since #1127 this is the **only** public catalogue address:
  // `/relationship-types` (which used to serve the retained #889 variation beside it, and used to
  // own `/templates` before that, #794) answers a 308 here from `next.config.mjs` and is
  // deliberately **not** a route, so nothing can mount a second catalogue under it again.
  "/relationship-templates",
  "/reset/complete",
  "/search",
  "/settings",
  "/support",
  // #1109 — `/templates/relationship` and `/templates/relationship/new` are **not** routes any
  // more: the member's library is `/dashboard/templates` (`?tab=mine` for the rows and the two ways
  // to start one), and the two addresses 308 there from `next.config.mjs`. The create flow's own
  // paths under `/templates/relationship/[slug]/create…` are still mounted and still listed below.
  "/terms",
  "/tournaments",
  "/welcome",
] as const;

/** Routes with `[param]` segments, as Next spells them. */
const DYNAMIC_ROUTES = [
  // #892 — one document, a catch-all because the tree nests (`docs/wiki/modules/app.md` is three
  // segments). Filed beside the other `[id]` entries and matched by `walkRoutes` exactly as spelled.
  "/admin/docs/[...slug]",
  "/admin/console/relationships/[id]",
  "/admin/console/templates/[id]",
  // #503 — one relationship's repair screen, a child of the registry route above it.
  "/admin/instances/[id]",
  // #502a — one template being drafted, a child of `/admin/templates`.
  "/admin/templates/[id]",
  // #1138 — one transactional mail's override, its versions and its editor; the id is the register's.
  "/admin/email-templates/[id]",
  // #504 — that relationship's Gap report: the operations screen, and the audited export beneath it.
  "/admin/instances/[id]/report",
  "/assessment/[slug]",
  "/assessment/instances/[instanceId]",
  "/assessment/instances/[instanceId]/report",
  // R1-E (#409): the two write screens sit one segment below the instance, beside the
  // `answers`/`invite` route handlers — `answer` (singular), because Next forbids a
  // `page.tsx` in the same segment as a `route.ts`.
  "/assessment/instances/[instanceId]/answer",
  "/assessment/instances/[instanceId]/accept",
  // #691 — stage 5, Sent: the screen the create lands on. A child of the instance rather than of
  // the `create` tree, because the invitation's row is what it draws and the template is a fact on
  // the session by the time it renders.
  "/assessment/instances/[instanceId]/sent",
  // #794 — the create flow, under the template's own noun. The segment is `record.slug`;
  // `record.id` stays the storage handle and leaves the URL. The library's own `[slug]` page and
  // its `new` form were retired in #1109 (they 308 to the dashboard) — what stays here is the flow.
  "/templates/relationship/[slug]/create",
  // #688 — stage 2 of the create flow. A page, not a query switch: each stage has its own
  // address, so a person can reload on Mode and the draft still puts them there.
  "/templates/relationship/[slug]/create/mode",
  // #689 — stage 3, the sibling the docstring above predicted. Same reason: an address that can be
  // reloaded, and the draft is what puts the person back on it.
  "/templates/relationship/[slug]/create/aspects",
  // #825 — stage 4, Account: the app's own sign-in form and the conversion that writes the
  // relationship as a draft. It is the last screen before anything exists.
  "/templates/relationship/[slug]/create/commit",
  // #825 — stage 5, Invite: send the invitation or keep the draft. It replaces the account gate
  // that used to sit *after* the create (`…/create/account`, retired with #659's decision).
  "/templates/relationship/[slug]/create/invite",
  // #542 phase 2 — the member's own CRUD detail pages, moved here from `STATIC_ROUTES` where
  // #533 phase 2 had filed them: a `[id]` pattern in the static list matches one literal string
  // and nothing else, so the list's own links were invisible to the route matcher.
  "/dashboard/relationships/[id]",
  "/dashboard/support/articles/[slug]",
  "/dashboard/templates/[id]",
  // #1130 — Propose a Template: the form a member's own template offers to the Library. A reviewed
  // request, never a publish, which is why it is a page under the template and not a control on it.
  "/dashboard/templates/[id]/propose",
  "/categories/[slug]",
  "/creator-tips/[slug]",
  "/invite/[token]",
  "/my-quizzes/[id]",
  "/my-quizzes/[id]/statistics",
  "/news/[slug]",
  "/profile/[username]",
  "/quiz/[id]",
  "/quiz/[id]/discussion",
  "/quiz/[id]/play",
  // One relationship *type*'s public page — the card title on `/relationship-templates` links
  // here, and every purchasable type is a static param of it. It sits under the catalogue's own
  // path since #1127, so the list and one row of it are one noun.
  "/relationship-templates/[slug]",
  // #794 · the worked example, one level below the type it belongs to. It used to be
  // `/assessment/demo/[type]`, under the record *kind* a type is not; the segment is the
  // taxonomy id, like its parent, because a type is a fixture row and not a record handle.
  "/relationship-templates/[slug]/demo",
  "/reset/[token]",
  "/support/articles/[slug]",
  "/tournaments/[id]",
] as const;

/**
 * Pages a search result may point at: static, no auth wall, and useful to land on.
 * The titles are the only authored strings in the search index — everything else
 * about a row is copied or counted from a collection.
 */
const INDEXABLE_PAGES: ReadonlyArray<{ path: string; title: string }> = [
  { path: "/", title: "Home" },
  { path: "/daily-challenge", title: "Today's Challenge" },
  { path: "/categories", title: "Categories" },
  { path: "/battle", title: "Quiz Battle" },
  { path: "/news", title: "News & Updates" },
  { path: "/explore", title: "Explore Quizzes" },
  { path: "/tournaments", title: "Quiz Tournament" },
  { path: "/leaderboard", title: "Leaderboard" },
  { path: "/creator-tips", title: "Quiz Creator Tips" },
  { path: "/quiz-discussions", title: "Quiz Discussions" },
  { path: "/create/editor", title: "Create Quiz" },
  { path: "/create/generator", title: "Quiz Generator" },
  { path: "/affiliate", title: "Affiliate Page" },
  { path: "/help", title: "Help" },
  { path: "/pricing", title: "Pricing Plan" },
  // The public catalogue. Indexable because it is the page a reader looking for a relationship
  // type is actually looking for; the route is in `(marketing)` and needs no session. The retained
  // `/relationship-types` variation is deliberately **not** listed: two index entries with one
  // title is a search result nobody can choose between.
  { path: "/relationship-templates", title: "Relationship Templates" },
];

export const routeManifest: RouteManifest = zRouteManifest.parse({
  routes: [
    ...STATIC_ROUTES.map((pattern) => ({ pattern, kind: "static" as const, indexable: true })),
    ...DYNAMIC_ROUTES.map((pattern) => ({ pattern, kind: "dynamic" as const, indexable: false })),
  ],
  pages: INDEXABLE_PAGES.map((page) => ({ ...page, indexable: true })),
});

/** Exposed for `data:check`, which compares them with the real `app/` tree. */
export const ROUTE_PATTERNS: readonly string[] = [...STATIC_ROUTES, ...DYNAMIC_ROUTES].sort();
