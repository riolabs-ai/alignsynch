/**
 * The admin console's own routes, in one place (#503).
 *
 * `ADMIN_INSTANCES_PATH` already lives next to the registry it names
 * (`lib/admin/instance-registry.ts`), because that module's derivation is what the route renders.
 * The two things added here are the routes a *repair* screen needs to link to: the log its write
 * lands in, and one relationship's detail screen. They are functions rather than spelled-out
 * strings so the page, the nav row and the registry's row link cannot disagree about an address —
 * and E10 only reads literal `href` attributes, so a path built from a constant is invisible to it
 * in exactly the way a route manifest entry makes safe.
 */
import { ADMIN_INSTANCES_PATH } from "@/lib/admin/instance-registry";

/** `/admin/audit` — the log every `act()` write lands in. */
export const ADMIN_AUDIT_PATH = "/admin/audit";

/** `/admin/instances/<id>` — one relationship, and its five repairs. */
export function adminRelationshipPath(instanceRecordId: string): string {
  return `${ADMIN_INSTANCES_PATH}/${instanceRecordId}`;
}
