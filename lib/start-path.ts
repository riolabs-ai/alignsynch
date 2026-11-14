/**
 * Where a "start" action goes — for the person looking at it (#979, #1042).
 *
 * Every public surface that sells a relationship ends in the same action: choose a template and
 * begin. Two issues have shaped that action, and the second reversed the first:
 *
 *   - **#979** found that every start action was a **constant** — `/register`, or `/register` with
 *     the chosen stage as `?next=` (#867) — and that a member with a live session was asked to
 *     create the account they already had. The fix made the destination a function of the session.
 *   - **#1042** found the other half: a **visitor** was still sent to the sign-up form, so the
 *     wizard was not where anybody landed, a draft could not survive the account round-trip, and
 *     one intent had three doors (visitor → `/register`, returning signed-out user → `/login`,
 *     member → the flow). Since #690 stage 1 renders for a signed-out visitor like any other page
 *     — the create endpoint has always accepted a signed-out post — so the account never needed to
 *     come first. `docs/specs/flow-stages.md` puts it at stage 4, *inside* the wizard, where the
 *     app's own sign-in form is mounted and the draft cookie is already on the browser.
 *
 * So there is one door, and it is the flow's stage 1:
 *
 *   - **`startPathFor()`** — the catalogue's own action, which always knows the template — is that
 *     stage, for a visitor and a member alike. Identity is no longer a parameter of this address:
 *     a door that changes with the session is three doors to test and three ways to be wrong.
 *   - **`startHrefFor()`** — for hrefs that arrive as **data** (the fixture CTAs in
 *     `data/pages/*.ts`, `data/billing-plans.ts`) — still resolves the *account-only* case, because
 *     that intent is real and `/login` and `/register` remain for it: a bare `/register` is a
 *     member's account home and a visitor's sign-up page, while `/register?next=<a screen>` names a
 *     screen and now lands on it for both viewers.
 *
 * **Free of React, Next and the session module.** The `StartViewer` is plain data the server
 * resolves once per request (`currentUserIfConfigured()` / `shellSession()`), so a client band can
 * resolve its own href without an auth import (`data:check` E34 keeps `lib/db/**` and `pg` out of
 * the browser graph; this module reaches neither) and a node test can drive every branch without a
 * cookie store.
 */
import type { BrandId } from "@/data/brand";
import { AFTER_SIGN_IN_BY_BRAND, safeNextPath } from "@/lib/auth/paths";
import { createRelationshipPath } from "@/lib/flow/paths";

/** The sign-up route, spelled once. `/register` is a page in `content/routes.ts`, not a copy. */
export const REGISTER_PATH = "/register";

/**
 * The two facts an **account** action is a function of: whether this request has a session, and
 * which brand's destinations a member is sent to.
 *
 * `brandId` is on the viewer rather than passed beside it because the bare-`/register` branch
 * needs exactly that pair and nothing else — the brand decides where "already have an account"
 * lands (`/dashboard` on AlignSynch, `/dashboard/user` on QuizHub), and a surface that forgot to
 * pass it would resolve to another brand's account home. Required, never defaulted: a default
 * here is how one surface silently rejoins the class of defect this module exists to close.
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
 * `signedIn` is the whole answer an account action needs — a page resolves the session once
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
 * The catalogue's start action: the create flow's **stage 1**, with the template carried (#1042).
 *
 * It takes only the template's id now. Until #1042 it also took a {@link StartViewer} and sent a
 * visitor to `/register?next=<this stage>` — the account first, the wizard after — which is the
 * detour the owner reproduced on Staff–Manager (`/register?next=%2Ftemplates%2Frelationship%2Fstaff-manager%2Fcreate`)
 * and on the blank entry (`/login?next=%2Ftemplates%2Frelationship%2Fcreate`). Stage 1 renders for
 * a signed-out visitor (#690), so there was never a screen the account was needed to reach; the
 * account is stage 4, and it happens here, on the draft.
 *
 * A caller that still holds a viewer hands it to {@link startHrefFor} when its href arrives as
 * data. This function is the one destination no session can change.
 */
export function startPathFor(typeId: string): string {
  return createRelationshipPath(typeId);
}

/**
 * Any authored start href, resolved for this viewer — the *account* half of the same intent.
 *
 * Surfaces read their action's words **and** destination from a fixture (`data/pages/templates.ts`,
 * `data/pages/home-alignsynch.ts`, `data/billing-plans.ts`), so the destination cannot be a value a
 * component derives — but it is still a value that must not offer an account to somebody who has
 * one. This is the one place that translates the authored href:
 *
 *   `/register`                 → the brand's account home for a member, `/register` for a visitor
 *   `/register?next=<path>`     → `<path>`, for **both** viewers (#1042)
 *   anything else               → unchanged, for both viewers
 *
 * **A bare `/register` still means account-only intent**, and it is the authored form for it: the
 * shell's Sign Up row and `/pricing`'s "Start your 7 days" are not create actions, and rewriting
 * them into a wizard would invent an intent the fixture did not author. A create-intent CTA
 * authors its destination instead — the flow's own stage 1, blank or template-backed
 * (`data/pages/templates.ts::final-cta`) — and this function passes it through untouched because
 * it is not a sign-up address.
 *
 * An authored href that is not the sign-up route passes through untouched — `checkout` is the one
 * other value in the plan fixture, and a resolver that rewrote it would be making a billing
 * decision it has no business making.
 */
export function startHrefFor(href: string, viewer: StartViewer): string {
  if (!href.startsWith(REGISTER_PATH)) return href;
  if (href === REGISTER_PATH) {
    return viewer.signedIn ? memberLandingPath(viewer) : REGISTER_PATH;
  }
  if (!href.startsWith(`${REGISTER_PATH}?`)) return href;

  const next = new URLSearchParams(href.slice(REGISTER_PATH.length + 1)).get("next");
  return safeNextPath(next, memberLandingPath(viewer));
}
