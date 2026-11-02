/**
 * lib/v1/review.ts — the review list's fixed half: every `/v1` screen a reviewer approves,
 * the concrete URL that opens it, and the matcher that maps a live pathname back to its row.
 *
 * The mutable half — each row's `status` and `note` — lives in the store (`lib/v1/store.tsx`),
 * persisted under its own localStorage key so a review survives a reload. This file carries only
 * what cannot change while the reviewer works: the routes, the one-line descriptions, and the
 * demo URLs that exercise the dynamic routes with a seed record.
 *
 * `review` itself is not a row: it is the tool the reviewer holds, not a screen they judge, and a
 * row that links to itself would be a dead-end with a status.
 */

/** The three approval states, and nothing else. */
export type ReviewStatus = "unreviewed" | "changes requested" | "approved";

/** The three states in filter/render order. */
export const REVIEW_STATUSES: readonly ReviewStatus[] = [
  "unreviewed",
  "changes requested",
  "approved",
];

/** One row of the checklist: the route pattern, the URL that opens it, and what it is. */
export interface ReviewScreen {
  /** The route pattern as `content/routes.ts` spells it, e.g. `/v1/relationships/[id]`. */
  readonly route: string;
  /** The concrete URL "Open" navigates to; a seed record for a dynamic route. */
  readonly href: string;
  /** One line describing what the screen is. */
  readonly description: string;
}

/**
 * Every prototype screen, in the order `content/routes.ts` lists them (static, then dynamic).
 * The dynamic rows name a seed id (`rel-invited`, `rel-sharing-unmet`, `rel-aligned`, `partners`)
 * so "Open" always lands on a screen that renders — a route that resolves is the acceptance, not
 * a pattern that 404s.
 */
export const REVIEW_SCREENS: readonly ReviewScreen[] = [
  {
    route: "/v1",
    href: "/v1",
    description:
      "The persona picker — the stand-in for /login; pick a persona and land on its screen.",
  },
  {
    route: "/v1/admin",
    href: "/v1/admin",
    description: "Admin landing: every relationship and template, with the gap aggregates counted.",
  },
  {
    route: "/v1/coach",
    href: "/v1/coach",
    description: "Coach landing: read-only view of shared relationships, with an advice thread.",
  },
  {
    route: "/v1/counterparty",
    href: "/v1/counterparty",
    description:
      "Counterparty landing: claimable invitations and the relationships already joined.",
  },
  {
    route: "/v1/initiator",
    href: "/v1/initiator",
    description:
      "Initiator landing: their templates, their relationships, and the counts to each list.",
  },
  {
    route: "/v1/initiator/relationships",
    href: "/v1/initiator/relationships",
    description:
      "The Initiator's relationships as cards: stage tabs, search, sessions N of M, plan and period.",
  },
  {
    route: "/v1/initiator/templates",
    href: "/v1/initiator/templates",
    description: "The Initiator's template library, with an inline form that copies a template.",
  },
  {
    route: "/v1/initiator/templates/new",
    href: "/v1/initiator/templates/new",
    description: "The template author — writes a template to the in-browser store.",
  },
  {
    route: "/v1/pricing",
    href: "/v1/pricing",
    description: "The four plan tiers; every paid CTA is disabled so nothing is charged.",
  },
  {
    route: "/v1/privacy",
    href: "/v1/privacy",
    description: "The draft Privacy Policy, inside the prototype's chrome.",
  },
  {
    route: "/v1/service",
    href: "/v1/service",
    description:
      "Service queue: invitations, accounts and stuck relationships, resolve per ticket.",
  },
  {
    route: "/v1/support",
    href: "/v1/support",
    description: "The help centre without the alignment taxonomy; reads the brand mailbox.",
  },
  {
    route: "/v1/templates",
    href: "/v1/templates",
    description: "The catalogue of relationship types grouped by realm, one card each.",
  },
  {
    route: "/v1/terms",
    href: "/v1/terms",
    description: "The draft Terms of Service, inside the prototype's chrome.",
  },
  {
    route: "/v1/relationships/[id]",
    href: "/v1/relationships/rel-invited",
    description:
      "The screen every role opens a relationship from — a session timeline, not a record.",
  },
  {
    route: "/v1/relationships/[id]/accept",
    href: "/v1/relationships/rel-sharing-unmet/accept",
    description:
      "The acceptance step — each party reviews the value-free summary and records acceptance; the report unlocks only when both accept.",
  },
  {
    route: "/v1/relationships/[id]/answer",
    href: "/v1/relationships/rel-invited/answer",
    description:
      "The answer sheet — Basic asks Feel and Wish on every Aspect (rel-invited), Advanced asks all four (rel-connected-blind); each sheet names its Setting, which changes the report's tolerance, never the questions.",
  },
  {
    route: "/v1/relationships/[id]/report",
    href: "/v1/relationships/rel-aligned/report",
    description:
      "The report — Basic (rel-aligned) shows the two Basic groups and no Prediction group; Advanced (rel-advanced) adds the four prediction Gaps naming one party's Think or Guess against the other's actual. Flags by severity are derived from the Gaps, never authored; the verdict names the Setting: Soft tolerates a Gap of 1, Full tolerates none — rel-aligned (Soft) and rel-same-sheet-full (Full) carry identical counts on identical answers, so the verdict is the only thing that differs between them.",
  },
  {
    route: "/v1/templates/[type]",
    href: "/v1/templates/business-partners",
    description: "The page a person decides on before paying: Aspects, walkthrough, price, Start.",
  },
  {
    route: "/v1/templates/[type]/demo",
    href: "/v1/templates/co-founders/demo",
    description: "A completed-session report rendered from fixture answers for the type.",
  },
];

/** Does a live pathname fall under this route pattern? Static rows match exactly. */
function matchesPattern(pathname: string, pattern: string): boolean {
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) => part.startsWith("[") || part === pathParts[index]);
}

/** The row a live pathname belongs to, or `undefined` on `/v1/review` and anything unknown. */
export function matchReviewScreen(pathname: string): ReviewScreen | undefined {
  return REVIEW_SCREENS.find((screen) => matchesPattern(pathname, screen.route));
}
