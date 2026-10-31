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
 * `/assessment/templates` — the template library: the built-ins this account can use plus the
 * templates it wrote (#console 5/5).
 *
 * A page now, not a POST endpoint: the route handler that saves a template used to live at this
 * exact path, and Next refuses a `page.tsx` and a `route.ts` in one segment (they are two
 * parallel pages for the same URL, and the app loader throws E28). The save moved to
 * `CREATE_TEMPLATE_PATH` below — one segment deeper, same handler, same redirect — so the
 * screen the console asked for could exist at the address it asked for.
 */
export const TEMPLATE_LIBRARY_PATH = "/assessment/templates";

/** One template, read-only: its Aspects, its instances and whether it is archived. */
export function templateDetailPath(recordId: string): string {
  return `${TEMPLATE_LIBRARY_PATH}/${recordId}`;
}

/** The archive/unarchive endpoint — a POST, so a GET never changes a template's state. */
export function templateStatusPath(recordId: string): string {
  return `${templateDetailPath(recordId)}/status`;
}

/** The duplicate endpoint — a POST, so a GET never writes a copy. */
export function templateDuplicatePath(recordId: string): string {
  return `${templateDetailPath(recordId)}/duplicate`;
}

/**
 * The template-saving endpoint — a POST-only route handler, so it is not a page and the manifest
 * does not list it (the same split as `/assessment/new`).
 *
 * `/assessment/templates/save` and not `/assessment/templates`: that address is the library page
 * now (`TEMPLATE_LIBRARY_PATH`), and a segment cannot hold both. The form posts here and the
 * handler redirects: a save is a POST followed by a GET of either the form (refused, with the
 * reason) or `/assessment` (saved, where the new template is listed). That is what keeps a reload
 * from saving a second copy.
 */
export const CREATE_TEMPLATE_PATH = `${TEMPLATE_LIBRARY_PATH}/save`;

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
