/**
 * The surface-column registry — one row per route under `app/(mainlayout)/`, and the mode each
 * one is allowed to draw in (#858).
 *
 * **The rule, from the owner:** every dashboard page is left-justified in one column with the
 * sidebar; full-width is a registered exception with a reason and a way back. Admin already
 * complied (#717 — eighteen pages rendering `StageColumn`). The member half did not: `/dashboard`,
 * `/dashboard/relationships`, `/dashboard/help`, `/assessment/instances`,
 * `/assessment/instances/[instanceId]`, `/my-quizzes` and `/settings` had **no page-level wrapper
 * at all**, and the centring was drawn inside the views — `dashboard-page.tsx`,
 * `relationship-cards.tsx`, `quiz-statistics.tsx`, `instance-view.tsx`, `report-view.tsx`,
 * `stage-shell.tsx`, `invite-view.tsx`, `template-shelf.tsx` — so three pages had three different
 * left edges and a fourth changed its edge at `md`.
 *
 * **This file is the spec, not a transcript.** It was written from the rule and the artifact, then
 * the pages were made to match it. A row that says `column` where a page still centres itself is a
 * gate failure in `scripts/column-refs.ts`, not a disagreement to settle here — and the fix is the
 * page, never the row. (`MUST NOT: write the registry to match whatever the pages already do.`)
 *
 * ## The three modes
 *
 * | mode     | what it means                                                          | what it owes            |
 * | -------- | ---------------------------------------------------------------------- | ----------------------- |
 * | `column` | the page renders inside `StageColumn` — 1126px, one left edge          | the page wraps itself   |
 * | `wide`   | a wider board on purpose, inside the shell                             | `reason`                |
 * | `bleed`  | edge-to-edge, the shell's chrome inside the surface (a player, a chat) | `reason` **and** `back` |
 *
 * `column` is the default and the only mode that needs nothing: it is what every page gets by
 * being a dashboard page. `wide` is the escape hatch a full-width board uses — the statistics
 * report's 4-up metric row, the quiz catalogue's grid — and `bleed` is the narrower one, for a
 * surface that is its own window (the quiz player, the conversation list beside its thread).
 *
 * **`back` is a route, not a sentence.** A bleed surface takes the shell's chrome with it, so it
 * owes the reader the way out in its own header; `back` names the destination that control points
 * at, and `scripts/column-refs.ts` fails a `back` that is not itself a registered route, so the
 * affordance cannot point at a 404 nobody notices.
 *
 * **Why the quiz and marketing-adjacent surfaces are `wide` rather than `column`.** The rule is
 * about the dashboard family; the quiz product is allowed its own ground (`AGENTS.md`, and the
 * card's own MUST NOT: never delete the `mx-auto` from a marketing or quiz surface). They are
 * registered anyway — not exempted by a prefix rule — because a registry with holes is a registry
 * that cannot tell "deliberately wide" from "nobody has looked at this yet". A new page under
 * `(mainlayout)` is a gate failure until somebody decides which of the three it is.
 *
 * **No zod.** Every other fixture in `data/` is parsed by a schema, and this one is not on
 * purpose: its validator is the filesystem. `scripts/column-refs.ts` holds every row against
 * `app/(mainlayout)/**\/page.tsx` in both directions and fails a missing row, a stale row, a
 * `wide` with no reason and a `bleed` whose `back` does not resolve — which is a stronger test
 * than a schema, and it has to load under plain `node` with no import graph of its own.
 */

/** Which width a page is allowed to draw in. See the table in the file header. */
export type SurfaceColumnMode = "column" | "wide" | "bleed";

/** One route's column decision. */
export interface SurfaceColumn {
  /** The route pattern, spelled exactly as the page's directory spells it: `/dashboard`, `[id]`. */
  path: string;
  mode: SurfaceColumnMode;
  /** Required for `wide` and `bleed`: the fact that makes this surface different. */
  reason?: string;
  /** Required for `bleed`: the route the surface's own back-to-dashboard control points at. */
  back?: string;
}

/**
 * The quiz product's own ground. One sentence, used by the catalogue and reader rows below, so a
 * change to the reasoning is one edit and not twenty-three.
 */
const QUIZ_GROUND =
  "The quiz product's own ground: a card grid sized by the shell rather than the relationship column (#858 keeps the rule to the dashboard family).";

/** A quiz surface that is a board rather than a column: the board is the product. */
const QUIZ_BOARD =
  "A quiz board read as a wide surface — leaderboard, tournaments, discussions — with no page body to put in a 1126px column.";

/** A quiz article/reader surface, wide for the reason a public page is wide. */
const QUIZ_READER =
  "A quiz reader: a title, a body measure and an aside. Its measure lives on the prose, not on a page column, so the page stays full width.";

/**
 * The full-width report the card names. `max-w-7xl` today (1280px, wider than the column), and the
 * reason is arithmetic rather than taste: the KPI row is four-up and two chart panels sit side by
 * side, so a 1126px column wraps the row and splits the charts.
 */
const QUIZ_STATISTICS =
  "The full-width statistics report: a four-up KPI row and two side-by-side chart panels; inside the 1126px column the row wraps and the charts split.";

const rows: readonly SurfaceColumn[] = [
  // ── Admin: the console family. #717 already put all eighteen on `StageColumn`. ──────────────
  { path: "/admin/audit", mode: "column" },
  { path: "/admin/billing", mode: "column" },
  { path: "/admin/brand", mode: "column" },
  { path: "/admin/broadcast", mode: "column" },
  { path: "/admin/console", mode: "column" },
  { path: "/admin/console/relationships", mode: "column" },
  { path: "/admin/console/relationships/[id]", mode: "column" },
  { path: "/admin/console/templates", mode: "column" },
  { path: "/admin/console/templates/[id]", mode: "column" },
  { path: "/admin/console/users", mode: "column" },
  // #892 — the documentation home and one document. Both are `StageColumn` pages like the rest of
  // the console family; the catch-all renders a long markdown body in the column, not wider.
  { path: "/admin/docs", mode: "column" },
  { path: "/admin/docs/[...slug]", mode: "column" },
  { path: "/admin/gaps", mode: "column" },
  // #920 — the growth model. The charts are `aspect`-free (a fixed height inside the column), so the
  // band that could have been wide stays at the console's width like every other admin page.
  { path: "/admin/growth", mode: "column" },
  { path: "/admin/health", mode: "column" },
  { path: "/admin/inbox", mode: "column" },
  { path: "/admin/instances", mode: "column" },
  { path: "/admin/instances/[id]", mode: "column" },
  { path: "/admin/instances/[id]/report", mode: "column" },
  { path: "/admin/review", mode: "column" },
  { path: "/admin/templates", mode: "column" },
  { path: "/admin/templates/[id]", mode: "column" },

  // ── The member dashboard family: what #858 moved onto the column. ───────────────────────────
  { path: "/dashboard", mode: "column" },
  { path: "/dashboard/help", mode: "column" },
  { path: "/dashboard/relationships", mode: "column" },
  { path: "/dashboard/relationships/[id]", mode: "column" },
  { path: "/dashboard/support", mode: "column" },
  { path: "/dashboard/support/articles/[slug]", mode: "column" },
  { path: "/dashboard/templates", mode: "column" },
  { path: "/dashboard/templates/[id]", mode: "column" },
  { path: "/dashboard/user", mode: "column" },
  { path: "/settings", mode: "column" },
  /**
   * Affiliate is a marketing page that happens to live in the shell, and it shows: eight sections
   * of its own, each drawing a centred band (`components/affiliate/**`, 25 hits) the way every
   * public page does. A column around it would double-box the bands rather than give the page an
   * edge, so it is registered wide — the exception is the page's own structure, not a stray
   * `mx-auto` somebody forgot.
   */
  {
    path: "/affiliate",
    mode: "wide",
    reason:
      "A marketing page inside the shell: its sections draw their own centred bands, so a column would box the page twice over.",
  },

  // ── The relationship flow: the six stages, the acceptance, the answer sheet, the sent state. ─
  { path: "/assessment", mode: "column" },
  // #877 — the member's assessment-session listing, moved out of the record-kind tree. It renders
  // `StageColumn` like the dashboard record lists it sits beside, which is what `column` records.
  { path: "/assessments", mode: "column" },
  { path: "/assessment/instances/[instanceId]", mode: "column" },
  { path: "/assessment/instances/[instanceId]/accept", mode: "column" },
  /**
   * The live answer sheet. The card named it among the exceptions; measured, it already renders
   * `StageColumn` (the `answer` page wraps it, #717's C1 sibling), so registering it `wide` would
   * be a row describing a screen that does not exist. `column` is the truthful row — see the card
   * comment that records the four named surfaces and where each one landed.
   */
  { path: "/assessment/instances/[instanceId]/answer", mode: "column" },
  { path: "/assessment/instances/[instanceId]/report", mode: "column" },
  { path: "/assessment/instances/[instanceId]/sent", mode: "column" },
  { path: "/invite/[token]", mode: "column" },
  { path: "/templates/relationship", mode: "column" },
  { path: "/templates/relationship/new", mode: "column" },
  { path: "/templates/relationship/[slug]", mode: "column" },
  { path: "/templates/relationship/[slug]/create", mode: "column" },
  { path: "/templates/relationship/[slug]/create/aspects", mode: "column" },
  { path: "/templates/relationship/[slug]/create/commit", mode: "column" },
  { path: "/templates/relationship/[slug]/create/invite", mode: "column" },
  { path: "/templates/relationship/[slug]/create/mode", mode: "column" },

  // ── Authoring. ──────────────────────────────────────────────────────────────────────────────
  { path: "/my-quizzes", mode: "column" },
  { path: "/my-quizzes/[id]", mode: "wide", reason: QUIZ_BOARD },
  { path: "/my-quizzes/[id]/statistics", mode: "wide", reason: QUIZ_STATISTICS },
  { path: "/create/editor", mode: "wide", reason: QUIZ_GROUND },
  { path: "/create/generator", mode: "wide", reason: QUIZ_GROUND },

  // ── The quiz product's boards, catalogues and readers. Each wide, each with its reason. ──────
  { path: "/explore", mode: "wide", reason: QUIZ_GROUND },
  { path: "/explore/featured", mode: "wide", reason: QUIZ_GROUND },
  { path: "/categories", mode: "wide", reason: QUIZ_GROUND },
  { path: "/categories/[slug]", mode: "wide", reason: QUIZ_GROUND },
  { path: "/assessment/[slug]", mode: "wide", reason: QUIZ_BOARD },
  { path: "/battle", mode: "wide", reason: QUIZ_BOARD },
  { path: "/daily-challenge", mode: "wide", reason: QUIZ_BOARD },
  { path: "/leaderboard", mode: "wide", reason: QUIZ_BOARD },
  { path: "/quiz-discussions", mode: "wide", reason: QUIZ_BOARD },
  { path: "/quiz/[id]", mode: "wide", reason: QUIZ_BOARD },
  { path: "/quiz/[id]/discussion", mode: "wide", reason: QUIZ_BOARD },
  { path: "/tournaments", mode: "wide", reason: QUIZ_BOARD },
  { path: "/tournaments/[id]", mode: "wide", reason: QUIZ_BOARD },
  { path: "/creator-tips", mode: "wide", reason: QUIZ_READER },
  { path: "/creator-tips/[slug]", mode: "wide", reason: QUIZ_READER },
  { path: "/news", mode: "wide", reason: QUIZ_READER },
  { path: "/news/[slug]", mode: "wide", reason: QUIZ_READER },
  { path: "/support", mode: "wide", reason: QUIZ_READER },
  { path: "/how-it-works", mode: "wide", reason: QUIZ_READER },
  { path: "/search", mode: "wide", reason: QUIZ_READER },
  { path: "/profile/[username]", mode: "wide", reason: QUIZ_READER },

  // ── Bleed: a surface that is its own window. Each owes a reason and a way back. ──────────────
  /**
   * The quiz player. Full-height, one question at a time, its own progress bar and timer, and on a
   * results screen a full sheet — a 1126px column would box a game. The way back is already in its
   * chrome: `QuizHeader` renders a `Back to Explore` control on every state of the surface
   * (`components/quiz/quiz-header.tsx`), and `/explore` is the board it leaves from.
   */
  {
    path: "/quiz/[id]/play",
    mode: "bleed",
    reason:
      "The quiz player: full-height, one question at a time, its own progress and timer, and a full results sheet — a column boxes the game.",
    back: "/explore",
  },
  /**
   * Chat. Two panes that scroll independently and fill the viewport; a column would put a fixed
   * left edge through a conversation list. The back control is `ChatPage`'s own header link
   * ("Back to your dashboard" → `/dashboard/user`, the quiz build's account home).
   */
  {
    path: "/chat",
    mode: "bleed",
    reason:
      "Chat: two independently scrolling panes filling the viewport — a conversation list beside its thread. A column's left edge would cut the list.",
    back: "/dashboard/user",
  },
];

/**
 * The registry, as the check reads it.
 *
 * Frozen so a test cannot mutate the module's own rows and then assert against them, which is how
 * a registry quietly starts agreeing with whatever the last test did.
 */
export const surfaceColumns: readonly SurfaceColumn[] = Object.freeze(rows);
