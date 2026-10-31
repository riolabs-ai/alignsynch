/**
 * The brand boundary, as parity sees it (#300) — every route the quiz product owns, and the page
 * module each one resolves to.
 *
 * The seven routes in `routes.ts` are a *snapshot*: seven pages hashed per brand, deliberately
 * short because each one is a file somebody reads when it moves. This list is a different
 * question, and it has to be long: **which routes does one product ship and the other not?** Until
 * #300 nothing tested that boundary, which is exactly how fifty-two statements about quizzes ended
 * up served under the AlignSynch name.
 *
 * So the assertion is a status, not a hash:
 *
 *   quizhub     this brand ships the product → the page is not a 404
 *   alignsynch  this brand does not          → the page answers 404, via `product.quiz-surfaces`
 *
 * `parity.check.ts` walks this list per brand and asserts that. `/quiz/[id]` appears in both this
 * list and the seven-route snapshot: on the quiz brand it is hashed like any page, and on the
 * alignment brand its committed artifact is the declared 404 — which is how the boundary is
 * visible in a diff instead of the route quietly vanishing from the manifest.
 *
 * `params` are fixture ids, for the same reason `routes.ts` gives: a slug that resolves is a
 * render of a real record. On the alignment brand they are never reached — the gate is the first
 * statement of every page below — and that is the point of the list: it proves the gate runs
 * *before* the route does any work.
 *
 * The page modules are imported statically so `tsc` sees them: renaming or deleting a gated page
 * breaks the typecheck before any status is compared.
 */
import AffiliatePage from "@/app/(mainlayout)/affiliate/page";
import BattlePage from "@/app/(mainlayout)/battle/page";
import CategoriesPage from "@/app/(mainlayout)/categories/page";
import CategoryPage from "@/app/(mainlayout)/categories/[slug]/page";
import ChatPage from "@/app/(mainlayout)/chat/page";
import EditorPage from "@/app/(mainlayout)/create/editor/page";
import GeneratorPage from "@/app/(mainlayout)/create/generator/page";
import CreatorTipsPage from "@/app/(mainlayout)/creator-tips/page";
import CreatorTipPage from "@/app/(mainlayout)/creator-tips/[slug]/page";
import DailyChallengePage from "@/app/(mainlayout)/daily-challenge/page";
import DashboardPage from "@/app/(mainlayout)/dashboard/user/page";
import ExplorePage from "@/app/(mainlayout)/explore/page";
import FeaturedPage from "@/app/(mainlayout)/explore/featured/page";
import MyQuizzesPage from "@/app/(mainlayout)/my-quizzes/page";
import MyQuizPage from "@/app/(mainlayout)/my-quizzes/[id]/page";
import MyQuizStatisticsPage from "@/app/(mainlayout)/my-quizzes/[id]/statistics/page";
import QuizPage from "@/app/(mainlayout)/quiz/[id]/page";
import QuizDiscussionPage from "@/app/(mainlayout)/quiz/[id]/discussion/page";
import QuizPlayPage from "@/app/(mainlayout)/quiz/[id]/play/page";
import QuizDiscussionsPage from "@/app/(mainlayout)/quiz-discussions/page";
import TournamentPage from "@/app/(mainlayout)/tournaments/page";
import TournamentDetailPage from "@/app/(mainlayout)/tournaments/[id]/page";

import type { ParityPage } from "./routes";

export type QuizOnlyRoute = {
  /** The route pattern, as `content/routes.ts` spells it. The key the snapshot list matches on. */
  route: string;
  /** The page module the router would resolve. */
  page: ParityPage;
  /** The concrete URL this route is exercised with; empty for a static route. */
  params: Record<string, string>;
};

/**
 * The one quiz record the three `/quiz/[id]/*` routes are exercised with — the playable record
 * `routes.ts` already names, so the two lists cannot disagree about which quiz exists.
 */
const QUIZ_ID = "quiz-ultimate-world-history-trivia";

/**
 * The twenty-two routes, in the order the card's route list names them.
 *
 * `/leaderboard` is **not** here. It is a quiz surface, but it answers 404 on both brands because
 * `community.leaderboard` is off, so it cannot express the boundary: its 404 is a mock gate, not a
 * brand one. It stays in `routes.ts` with `disabledByFlag`, which is the honest statement of what
 * closes it.
 */
export const quizOnlyRoutes: readonly QuizOnlyRoute[] = [
  { route: "/daily-challenge", page: DailyChallengePage as unknown as ParityPage, params: {} },
  { route: "/categories", page: CategoriesPage as unknown as ParityPage, params: {} },
  {
    route: "/categories/[slug]",
    page: CategoryPage as unknown as ParityPage,
    params: { slug: "science" },
  },
  { route: "/battle", page: BattlePage as unknown as ParityPage, params: {} },
  { route: "/explore", page: ExplorePage as unknown as ParityPage, params: {} },
  { route: "/explore/featured", page: FeaturedPage as unknown as ParityPage, params: {} },
  { route: "/tournaments", page: TournamentPage as unknown as ParityPage, params: {} },
  {
    route: "/tournaments/[id]",
    page: TournamentDetailPage as unknown as ParityPage,
    params: { id: "global-championship" },
  },
  { route: "/creator-tips", page: CreatorTipsPage as unknown as ParityPage, params: {} },
  {
    route: "/creator-tips/[slug]",
    page: CreatorTipPage as unknown as ParityPage,
    params: { slug: "writing-effective-quiz-questions" },
  },
  { route: "/quiz-discussions", page: QuizDiscussionsPage as unknown as ParityPage, params: {} },
  { route: "/quiz/[id]", page: QuizPage as unknown as ParityPage, params: { id: QUIZ_ID } },
  {
    route: "/quiz/[id]/play",
    page: QuizPlayPage as unknown as ParityPage,
    params: { id: QUIZ_ID },
  },
  {
    route: "/quiz/[id]/discussion",
    page: QuizDiscussionPage as unknown as ParityPage,
    params: { id: QUIZ_ID },
  },
  { route: "/create/editor", page: EditorPage as unknown as ParityPage, params: {} },
  { route: "/create/generator", page: GeneratorPage as unknown as ParityPage, params: {} },
  { route: "/my-quizzes", page: MyQuizzesPage as unknown as ParityPage, params: {} },
  {
    route: "/my-quizzes/[id]",
    page: MyQuizPage as unknown as ParityPage,
    params: { id: QUIZ_ID },
  },
  {
    route: "/my-quizzes/[id]/statistics",
    page: MyQuizStatisticsPage as unknown as ParityPage,
    params: { id: QUIZ_ID },
  },
  { route: "/affiliate", page: AffiliatePage as unknown as ParityPage, params: {} },
  { route: "/chat", page: ChatPage as unknown as ParityPage, params: {} },
  { route: "/dashboard/user", page: DashboardPage as unknown as ParityPage, params: {} },
] as const;

/** The patterns alone — what the snapshot list (and a reviewer) matches a route against. */
export const QUIZ_ONLY_PATTERNS: readonly string[] = quizOnlyRoutes.map((route) => route.route);

/** Is this route pattern quiz-only? `routes.ts` uses it to decide how to pin `/quiz/[id]`. */
export function isQuizOnly(route: string): boolean {
  return QUIZ_ONLY_PATTERNS.includes(route);
}
