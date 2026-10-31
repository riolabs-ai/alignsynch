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
 *                    `BRAND=alignsynch` that is Home, Templates, How it works, Support, then the
 *                    console's Overview and Your templates — the alignment destinations, not
 *                    `/leaderboard`. The operator's rows (`/admin/*`) are above this function's
 *                    grant: they need `admin-console`, which only an administrator carries.
 *   everyone else    sees their brand's menu and nothing more. The quiz destinations are
 *                    not hidden from the DOM by CSS; they are not rendered.
 *
 * The split is one navigation definition filtered by capability
 * (`components/layout/nav-menus.tsx`), never a second nav tree: the quiz menu is a single
 * component that a viewer either gets or does not.
 *
 * **Which filter was stubbed, and where it got wired.** `SessionUser` (`lib/auth/session.ts`) still
 * carries only `userId`, `email` and `name` — "no token, no session id, no roles" — so the role is
 * not on the session: it is read from `user_profile.role` for this request by
 * `app/(mainlayout)/layout.tsx`, the server component that already resolves the account for the
 * header, and handed to `navViewer(role)` below. The console's operator rows are the first
 * capability that comes from it (`admin-console`); a member, a signed-out visitor and a deployment
 * with no session all get the empty set this function returned for every request before the
 * console existed, which is why the alignment menu and the whole quiz build render what they
 * always did.
 *
 * The wiring point is this function and only this function, and the role crosses the
 * server/client boundary exactly once: `app/(mainlayout)/layout.tsx` reads it server-side (a client
 * component cannot call `currentUser()`, and putting a role on the client would be trusting the
 * browser) and passes the **capability set**, never the role, down to the sidebar.
 *
 * Nothing here imports React, Next or zod at runtime: it is a pure predicate, so a node test can
 * prove both viewers without a browser (see `tests/nav-brand.test.ts`). The `UserRole` import is
 * type-only and erased at build time.
 */
import type { BrandId } from "@/data/brand";
import type { UserRole } from "@/content/identity";

/** One destination family a viewer may or may not be shown. */
export const NAV_CAPABILITIES = ["quiz-surfaces", "admin-console"] as const;

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
 * The viewer the shell renders for, from the role the **server** resolved for this request.
 *
 * `admin` carries `admin-console`: the operator's destinations (`/admin/instances` today, and the
 * gap analysis beside it) are rows a member must not see, because a row that leads to a 404 is a
 * row that advertises a surface. Everybody else — a member, a signed-out visitor, a deployment
 * with no session — carries the empty set, exactly as this function answered before the console
 * existed.
 *
 * The role is an argument rather than a session read for the reason this module has always given:
 * a capability set is a pure value a node test can render either way, and the request's own
 * session is read in `app/(mainlayout)/layout.tsx` (a server component) through
 * `lib/auth/shell-account.ts::shellSession()`, which is the one place the session and the profile
 * row are resolved for the chrome. `quiz-surfaces` is still granted to nobody: the branding work
 * (#156) will decide whether an admin gets the quiz menu, and this function is where that
 * decision lands when it is made.
 */
export function navViewer(role: UserRole | null = null): NavViewer {
  return role === "admin" ? viewerWith("admin-console") : PLATFORM_VIEWER;
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
