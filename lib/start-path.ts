/**
 * Where a "start" action goes — for the person looking at it (#979).
 *
 * Every public surface that sells a relationship ends in the same action: choose a template and
 * begin. Until this module the action was a **constant** — `/register` with the chosen template as
 * `?next=` (#867) — and the constant was right for exactly half the audience. A member with a live
 * session clicked a catalogue card and was asked to create the account they already had, on the
 * front door of the product's only paid flow. The destination is a function of the session, so it
 * is derived here rather than typed on each surface.
 *
 * Two rules, and they are the whole contract:
 *
 *   - **a visitor** keeps the address the surface authored: `/register` (the account) or
 *     `/register?next=<the flow's stage 1>` (the account, remembering the template);
 *   - **a member** is sent to the same intent with the account step removed: the flow's stage 1
 *     when the action named one, and the brand's own signed-in landing when the action was a bare
 *     account link (`AFTER_SIGN_IN_BY_BRAND`, never a second copy of that table).
 *
 * `startHrefFor()` is the resolver for hrefs that arrive as **data** — the fixture CTAs in
 * `data/pages/*.ts` and `data/billing-plans.ts`, which are authored once and rendered on several
 * surfaces — and `startPathFor()` is the catalogue's own action, which always knows the template.
 * Both take the same {@link StartViewer}, so a surface cannot be session-aware on one control and
 * stuck on another.
 *
 * **Free of React, Next and the session module.** The `StartViewer` is plain data the server
 * resolves once per request (`currentUserIfConfigured()` / `shellSession()`) and passes down, so a
 * client band can resolve its own href without an auth import (`data:check` E34 keeps `lib/db/**`
 * and `pg` out of the browser graph; this module reaches neither) and a node test can drive every
 * branch without a cookie store.
 */
import type { BrandId } from "@/data/brand";
import { AFTER_SIGN_IN_BY_BRAND, registerPathFor, safeNextPath } from "@/lib/auth/paths";
import { createRelationshipPath } from "@/lib/flow/paths";

/** The sign-up route, spelled once. `/register` is a page in `content/routes.ts`, not a copy. */
export const REGISTER_PATH = "/register";

/**
 * The two facts a start action is a function of: whether this request has a session, and which
 * brand's destinations a member is sent to.
 *
 * `brandId` is on the viewer rather than passed beside it because the bare-`/register` branch needs
 * exactly that pair and nothing else — the brand decides where "already have an account" lands
 * (`/dashboard` on AlignSynch, `/dashboard/user` on QuizHub), and a surface that forgot to pass it
 * would resolve to another brand's account home. Required, never defaulted: a default here is how
 * one surface silently rejoins the class of defect this module exists to close.
 */
export interface StartViewer {
  readonly signedIn: boolean;
  readonly brandId: BrandId;
}

/** The viewer of a request that resolved no session — a visitor, or a build with no auth env. */
export function visitorOf(brandId: BrandId): StartViewer {
  return startViewer(brandId, false);
}

/**
 * The viewer of a request, from the session it resolved.
 *
 * `signedIn` is the whole answer a start action needs — a page resolves the session once
 * (`currentUserIfConfigured()` answered `null` is the signed-out state, not a failure) and hands
 * the boolean down. Taking a boolean rather than an account keeps `lib/auth/**`'s session modules
 * out of this graph, which is what lets a client band import the resolver (`data:check` E34).
 */
export function startViewer(brandId: BrandId, signedIn: boolean): StartViewer {
  return { signedIn, brandId };
}

/** Where a member lands instead of a sign-up form: the brand's own account home. */
export function memberLandingPath(viewer: StartViewer): string {
  return AFTER_SIGN_IN_BY_BRAND[viewer.brandId];
}

/**
 * The catalogue's start action: a member begins the flow, a visitor creates the account first.
 *
 * The two halves are the same intent at two depths, which is why the member's half is the flow's
 * stage 1 with no wrapper: `/templates/relationship/<id>/create` renders for a signed-out visitor
 * too (#690), so a visitor's `?next=` names a screen rather than a promise.
 */
export function startPathFor(typeId: string, viewer: StartViewer): string {
  const flow = createRelationshipPath(typeId);
  return viewer.signedIn ? flow : registerPathFor(flow);
}

/**
 * Any authored start href, resolved for this viewer.
 *
 * Surfaces read their action's words **and** destination from a fixture (`data/pages/templates.ts`,
 * `data/pages/home-alignsynch.ts`, `data/billing-plans.ts`), so the destination cannot be a value a
 * component derives — but it is still a value that must not offer an account to somebody who has
 * one. This is the one place that translates the authored href:
 *
 *   `/register`                 → the brand's account home for a member
 *   `/register?next=<path>`     → `<path>` for a member, so the template they chose survives
 *   anything else               → unchanged, for both viewers
 *
 * An authored href that is not the sign-up route passes through untouched — `checkout` is the one
 * other value in the plan fixture, and a resolver that rewrote it would be making a billing
 * decision it has no business making.
 */
export function startHrefFor(href: string, viewer: StartViewer): string {
  if (!viewer.signedIn) return href;
  if (href === REGISTER_PATH) return memberLandingPath(viewer);
  if (!href.startsWith(`${REGISTER_PATH}?`)) return href;

  const next = new URLSearchParams(href.slice(REGISTER_PATH.length + 1)).get("next");
  return safeNextPath(next, memberLandingPath(viewer));
}
