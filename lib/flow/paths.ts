/**
 * The flow's URLs, in one place (#146).
 *
 * A form's `action` and a redirect's target are written here rather than in JSX, for two
 * reasons: a component that spells a path is a second copy of the route manifest, and the
 * page-copy ratchet (E23) counts a string attribute in a counted component — so a path in
 * JSX would also have to live in an editor's copy fixture, which is the wrong place for it.
 *
 * `/assessment`, `/assessment/instances/[instanceId]` and `/invite/[token]` are registered
 * in `content/routes.ts` (E7 checks both directions); the two POST-only endpoints are route
 * handlers and therefore not pages, so the manifest does not list them.
 */
export const ASSESSMENTS_PATH = "/assessment";

/**
 * `/dashboard` — the signed-in console's Overview.
 *
 * A top-level path, not a child of `/dashboard/user`: `/dashboard/user` is the **quiz** product's
 * account home (#164), gated by `requireQuizProduct()`, and a console that sat underneath it would
 * be unreachable on the alignment build the console exists for. The two are siblings with two
 * products' words, and only one of them is a 404 on either brand.
 */
export const OVERVIEW_PATH = "/dashboard";

/**
 * `/assessment/instances` — the instances **this signed-in account** is a party to (#213).
 *
 * A static path beside the dynamic `/assessment/instances/[instanceId]`, not a child of it: the
 * list is its own surface, and a browser that types it gets the list rather than a 404 for an
 * instance id nobody holds.
 */
export const MY_INSTANCES_PATH = "/assessment/instances";

/** The create endpoint — a POST-only route handler. */
export const CREATE_INSTANCE_PATH = "/assessment/new";

/**
 * `/assessment/templates/new` — the form that authors a template (#255).
 *
 * Registered in `content/routes.ts` (E7 checks it in both directions) because it is a page. It is
 * a child of `/assessment` rather than a sibling (`/assessment/new` is already taken by the
 * instance-creating POST), and it is not `/assessment/templates/[slug]/edit`: a template is never
 * edited once saved — instances copy their Aspects at creation, so a mutable source would rewrite
 * the questions under answers somebody already gave.
 */
export const NEW_TEMPLATE_PATH = "/assessment/templates/new";

/**
 * The template-saving endpoint — a POST-only route handler, so it is not a page and the manifest
 * does not list it (the same split as `/assessment/new`).
 *
 * The form posts here and the handler redirects: a save is a POST followed by a GET of either the
 * form (refused, with the reason) or `/assessment` (saved, where the new template is listed). That
 * is what keeps a reload from saving a second copy.
 */
export const CREATE_TEMPLATE_PATH = "/assessment/templates";

export function instancePath(instanceRecordId: string): string {
  return `/assessment/instances/${instanceRecordId}`;
}

/** The submit endpoint: a form post, so a frozen answer is a status code and not a banner. */
export function answersPath(instanceRecordId: string): string {
  return `${instancePath(instanceRecordId)}/answers`;
}

/**
 * The re-invite endpoint — a POST, so a GET never reissues a token (#275).
 *
 * A child of the instance's own address rather than a sibling: the invitation belongs to that
 * instance, and the form that posts here is drawn on that instance's screen. Like the other two
 * POST-only endpoints it is a route handler, not a page, so the manifest does not list it.
 */
export function reinvitePath(instanceRecordId: string): string {
  return `${instancePath(instanceRecordId)}/invite`;
}

export function invitePath(token: string): string {
  return `/invite/${token}`;
}

/** The claim endpoint — a POST, so a GET never spends the single-use token. */
export function claimPath(token: string): string {
  return `${invitePath(token)}/claim`;
}
