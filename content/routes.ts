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
  "/admin/instances",
  "/affiliate",
  "/assessment",
  "/assessment/instances",
  "/assessment/templates/new",
  "/battle",
  "/categories",
  "/chat",
  "/create/editor",
  "/create/generator",
  "/creator-tips",
  "/daily-challenge",
  "/dashboard/user",
  "/demo",
  "/demo/admin",
  "/explore",
  "/explore/featured",
  "/leaderboard",
  "/login",
  "/my-quizzes",
  "/news",
  "/pricing",
  "/privacy",
  "/quiz-discussions",
  "/register",
  "/search",
  "/settings",
  "/support",
  "/terms",
  "/tournaments",
  "/welcome",
] as const;

/** Routes with `[param]` segments, as Next spells them. */
const DYNAMIC_ROUTES = [
  "/assessment/[slug]",
  "/assessment/instances/[instanceId]",
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
  { path: "/pricing", title: "Pricing Plan" },
  { path: "/support", title: "Support" },
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
