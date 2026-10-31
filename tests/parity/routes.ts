/**
 * The routes the brand-parity snapshot covers — and the only list that exists.
 *
 * Seven routes, one per surface a reskin can reach (#171): the front page (the one route whose
 * *composition* differs by brand), the two boards, the editorial list and its detail page, a
 * quiz, the assessment report and a profile. It is deliberately short: a snapshot per route per
 * brand is a file somebody has to read when it changes, and a list of thirty routes is a list of
 * thirty files nobody updates on purpose.
 *
 * `params` is the concrete URL each dynamic route is rendered with. They are fixture ids, not
 * placeholders: a slug that resolves is a render of the real record, and a 404 would fail the
 * run rather than snapshot an empty page.
 *
 * The page modules are imported statically, not by path string, so `tsc` sees them: a page that
 * is renamed or deleted breaks the typecheck before any snapshot is compared.
 */
import AssessmentPage from "@/app/(mainlayout)/assessment/[slug]/page";
import LeaderboardPage from "@/app/(mainlayout)/leaderboard/page";
import NewsArticlePage from "@/app/(mainlayout)/news/[slug]/page";
import NewsPage from "@/app/(mainlayout)/news/page";
import HomePage from "@/app/(marketing)/page";
import ProfilePage from "@/app/(mainlayout)/profile/[username]/page";
import QuizPage from "@/app/(mainlayout)/quiz/[id]/page";
import type { FlagName } from "@/data/flags";

/**
 * A page as this harness calls it. Every page in the app takes the Next 16 props shape —
 * `params` is a Promise — and returns either an element or a promise of one, so the two shapes
 * collapse to this one type at the call site.
 */
export type ParityPage = (props: {
  params: Promise<Record<string, string>>;
}) => unknown | Promise<unknown>;

/**
 * The chrome a route is mounted inside — the route group its page module lives in.
 *
 * Parity renders the page **inside the layout the router would pick**, and since #317 there are
 * two: `(mainlayout)` is the product shell (sidebar, header, drawers) and `(marketing)` is the
 * public header and footer. A route's group is what decides which one a reader gets, so the
 * snapshot has to mount the same one or it hashes a page nobody sees — the `/` home page moved to
 * `(marketing)` and would otherwise be pinned with a sidebar the real route does not render.
 */
export type RouteLayout = "mainlayout" | "marketing";

export type ParityRoute = {
  /** The route pattern, as the spec names it. Printed in the failure and the update log. */
  route: string;
  /** File name under `summaries/<brand>/`. */
  slug: string;
  /** The page module the router would resolve. */
  page: ParityPage;
  /** The dynamic segments this concrete URL fills; empty for a static route. */
  params: Record<string, string>;
  /**
   * The group the page module lives in. Absent means `(mainlayout)`, which is where every route in
   * this list lived before #317 and where five of the seven still are.
   */
  layout?: RouteLayout;
  /**
   * The feature flag that keeps this surface **off**, so the page answers 404 by design (#175).
   *
   * Declared, never inferred: the harness only accepts a 404 for a route that names its flag
   * here, and it asserts both halves of the claim — the resolver says off, and the page really
   * throws `notFound()`. An undeclared 404 still fails the run, which is what keeps "the fixture
   * stopped resolving" a red build rather than a pinned empty page.
   *
   * The committed artifact for such a route is the 404 itself (`outcome  404 — <flag> is off`),
   * so the day the flag is turned on the hash moves, the summary says `404 → headings…`, and the
   * reviewer gets the decision instead of a surprise.
   */
  disabledByFlag?: FlagName;
};

/**
 * The seven routes, in the order the spec lists them.
 *
 * The three fixtures are chosen so the route resolves: the first published news record
 * (`data/news-data.ts`), the playable quiz (`data/currentQuiz.ts`) and a real profile handle
 * (`data/players.ts`). `/assessment/avery-rowan` is the instance slug the spec names, and it is
 * the only route that reads a database in production — see `harness.ts` for what it reads here.
 *
 * `/leaderboard` is the one route whose *current* state is a 404: `community.leaderboard` is off
 * in `data/flags.ts` (the boards are still `data/players.ts`), so the page calls `notFound()`
 * before reading anything. Pin that rather than dropping the route — a surface that disappears
 * from the list is drift nobody sees.
 */
export const parityRoutes: readonly ParityRoute[] = [
  {
    route: "/",
    slug: "home",
    page: HomePage as unknown as ParityPage,
    params: {},
    /**
     * The front door is a public surface since #317: `app/(marketing)/page.tsx` renders inside the
     * marketing header and footer, with no sidebar. Mounting it in the shell here would pin a page
     * the router never serves.
     */
    layout: "marketing",
  },
  {
    route: "/leaderboard",
    slug: "leaderboard",
    page: LeaderboardPage as unknown as ParityPage,
    params: {},
    disabledByFlag: "community.leaderboard",
  },
  {
    route: "/news",
    slug: "news",
    page: NewsPage as unknown as ParityPage,
    params: {},
  },
  {
    route: "/news/[slug]",
    slug: "news-slug",
    page: NewsArticlePage as unknown as ParityPage,
    params: { slug: "10-strategies-for-creating-engaging-quizzes" },
  },
  {
    route: "/quiz/[id]",
    slug: "quiz-id",
    page: QuizPage as unknown as ParityPage,
    params: { id: "quiz-ultimate-world-history-trivia" },
  },
  {
    route: "/assessment/avery-rowan",
    slug: "assessment-avery-rowan",
    page: AssessmentPage as unknown as ParityPage,
    params: { slug: "avery-rowan" },
  },
  {
    route: "/profile/[username]",
    slug: "profile-username",
    page: ProfilePage as unknown as ParityPage,
    params: { username: "alexjohnson" },
  },
] as const;
