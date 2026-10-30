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

/** The create endpoint — a POST-only route handler. */
export const CREATE_INSTANCE_PATH = "/assessment/new";

export function instancePath(instanceRecordId: string): string {
  return `/assessment/instances/${instanceRecordId}`;
}

/** The submit endpoint: a form post, so a frozen answer is a status code and not a banner. */
export function answersPath(instanceRecordId: string): string {
  return `${instancePath(instanceRecordId)}/answers`;
}

export function invitePath(token: string): string {
  return `/invite/${token}`;
}

/** The claim endpoint — a POST, so a GET never spends the single-use token. */
export function claimPath(token: string): string {
  return `${invitePath(token)}/claim`;
}
