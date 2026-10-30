/**
 * Who is looking at the navigation, and which destinations they are allowed to see.
 *
 * Issue #156 is about visibility, not deletion. There is one codebase and one record
 * abstraction: a quiz is a record with items, an assessment is a record with items and
 * parties, and shipping the second template does not retire the first. So every route the
 * quiz product ever had still exists, still resolves, and is still reachable by URL. What
 * changed is **who is shown it**:
 *
 *   a platform user  sees the menu of the product they signed up for. On
 *                    `BRAND=alignsynch` that is Home, Templates, How it works, Support —
 *                    the alignment destinations, not `/leaderboard`.
 *   everyone else    sees their brand's menu and nothing more. The quiz destinations are
 *                    not hidden from the DOM by CSS; they are not rendered.
 *
 * The split is one navigation definition filtered by capability
 * (`components/layout/nav-menus.tsx`), never a second nav tree: the quiz menu is a single
 * component that a viewer either gets or does not.
 *
 * **Which filter is stubbed, and where it gets wired.** There is no role model yet.
 * `SessionUser` (`lib/auth/session.ts`) carries `userId`, `email` and `name` and says so in
 * its own comment — "no token, no session id, no roles". So `navViewer()` below returns
 * `PLATFORM_VIEWER` for every request, and no capability is ever granted: the quiz menu is
 * unreachable in the shell on the alignment brand until roles exist. That is the honest
 * state, not a half-feature dressed up as finished — an admin today reaches every surface by
 * URL, which is what the destination table in the PR measures.
 *
 * The wiring point is this function and only this function. When a role lands (a `role`
 * column on `user_profile`, read through `lib/auth/session.ts`), `navViewer` takes the
 * `SessionUser | null` the shell already resolves server-side and returns the capabilities
 * that role carries. The caller is `app/(mainlayout)/layout.tsx`, a server component — a
 * client component cannot call `currentUser()`, and putting a role on the client would be
 * trusting the browser. That layout already passes the brand id and the mark down to the
 * sidebar; a capability set is one more prop on the same path.
 *
 * Nothing here imports React, Next or zod: it is a pure predicate, so a node test can prove
 * both viewers without a browser (see `tests/nav-brand.test.ts`).
 */
import type { BrandId } from "@/data/brand";

/** One destination family a viewer may or may not be shown. */
export const NAV_CAPABILITIES = ["quiz-surfaces"] as const;

export type NavCapability = (typeof NAV_CAPABILITIES)[number];

/** A viewer, as the navigation sees one: a set of capabilities, no identity. */
export interface NavViewer {
  readonly capabilities: ReadonlySet<NavCapability>;
}

/**
 * The default viewer: a signed-up platform user of the brand the build ships.
 *
 * This is also today's behaviour on `BRAND=quizhub`, whose brand menu *is* the quiz menu, so
 * the default viewer sees everything that product has and the template build is unchanged
 * byte for byte. On `BRAND=alignsynch` the same viewer sees the alignment menu — the bug
 * this issue fixes — and no quiz destination.
 */
export const PLATFORM_VIEWER: NavViewer = { capabilities: new Set<NavCapability>() };

/** Does this viewer carry the capability? */
export function sees(viewer: NavViewer, capability: NavCapability): boolean {
  return viewer.capabilities.has(capability);
}

/** The viewer with everything — the admin the role model will hand back once it exists. */
export function viewerWith(...capabilities: NavCapability[]): NavViewer {
  return { capabilities: new Set(capabilities) };
}

/**
 * The routes an alignment visitor is shown: the front page, their account settings, and the
 * support centre. Everything else in the tree is the quiz product, which the same capability
 * that gates the nav keeps out of their menu and out of their search results
 * (`data/searchdata.ts`).
 *
 * A positive list rather than a list of exclusions, because the failure to avoid is a new quiz
 * route arriving in the index — and in a menu — without anyone deciding it belongs there.
 */
export const ALIGNMENT_ROUTES: readonly string[] = ["/", "/settings", "/support"];

/**
 * The viewer the shell renders for — **stubbed until roles exist** (see the module comment).
 *
 * Every request is the platform viewer, because the most a session knows today is an id, an
 * email and a name. Role → capabilities is mapped here and nowhere else; no component asks
 * what a viewer's role is, only which capabilities it carries, so the swap is one function.
 */
export function navViewer(): NavViewer {
  return PLATFORM_VIEWER;
}

/**
 * Does this viewer get the quiz product's chrome on this brand? (issue #156 follow-up)
 *
 * The rule is the one `components/layout/nav-menus.tsx` already follows, and the reason it is a
 * function rather than a `sees(...)` call in each component: **on the quiz brand the brand is the
 * product**, so the shipped chrome is what every viewer gets — `navViewer()` grants no capability
 * today, and gating on the capability alone would strip the quiz build of its own shell. On the
 * alignment brand the quiz product is an *addition*, and only a viewer carrying `quiz-surfaces`
 * gets it back.
 *
 * What it gates is the quiz product's chrome outside the sidebar: the header's wallet chip, the
 * account menu's profile/dashboard/my-quizzes rows, and — through `sees` in `data/searchdata.ts`
 * and `lib/shell-copy.ts`'s tab ids — the quiz rows and tabs in search.
 *
 * The `switch` over the brand literal has no fall-through: a third brand fails `tsc` until
 * someone decides whether it ships the quiz product's chrome.
 */
export function seesQuizProduct(brandId: BrandId, viewer: NavViewer): boolean {
  switch (brandId) {
    case "quizhub":
      return true;
    case "alignsynch":
      return sees(viewer, "quiz-surfaces");
    default: {
      const unhandled: never = brandId;
      throw new Error(`no chrome decision for brand ${String(unhandled)}`);
    }
  }
}
