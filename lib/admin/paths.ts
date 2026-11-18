/**
 * The admin console's own routes, in one place (#503).
 *
 * `ADMIN_SESSIONS_PATH` already lives next to the registry it names
 * (`lib/admin/session-registry.ts`), because that module's derivation is what the route renders.
 * The two things added here are the routes a *repair* screen needs to link to: the log its write
 * lands in, and one relationship's detail screen. They are functions rather than spelled-out
 * strings so the page, the nav row and the registry's row link cannot disagree about an address —
 * and E10 only reads literal `href` attributes, so a path built from a constant is invisible to it
 * in exactly the way a route manifest entry makes safe.
 */
import { ADMIN_SESSIONS_PATH } from "@/lib/admin/session-registry";

/** `/admin/audit` — the log every `act()` write lands in. */
export const ADMIN_AUDIT_PATH = "/admin/audit";

/** `/admin/templates` — the console's authored-template catalogue (#502a). */
export const ADMIN_TEMPLATES_PATH = "/admin/templates";

/**
 * `/admin/billing` — subscription state per relationship, and the owner's comp (#505).
 *
 * Here rather than beside `lib/db/admin-billing.ts` for the reason `adminRelationshipPath` is here:
 * the screen's component links back to the audit log, and a path constant in a module that opens a
 * pool would be the E34 crossing the client graph forbids.
 */
export const ADMIN_BILLING_PATH = "/admin/billing";

/**
 * `/admin/broadcast` — a one-off notice to the news list (#507), the epic's last child.
 *
 * Here rather than beside `lib/admin/broadcast.ts` for the reason `ADMIN_BILLING_PATH` is here: the
 * screen's component links back to the audit log, and a path constant in a module that opens a pool
 * would be the E34 crossing the client graph forbids.
 */
export const ADMIN_BROADCAST_PATH = "/admin/broadcast";

/**
 * `/admin/inbox` — the support inbox (#506): the contact form's queue, one thread, and the reply.
 *
 * The selection is a query parameter rather than a child route (`?message=<uuid>`), so the queue
 * and the thread are one request-time render of one surface: the list a seat is working and the
 * message they opened cannot disagree, because they were read together. It also keeps the inbox
 * out of the route manifest's dynamic segments — a message id is a row, not a URL a reader types.
 */
export const ADMIN_INBOX_PATH = "/admin/inbox";

/** `/admin/inbox?message=<id>` — the queue with one message's thread open. */
export function adminInboxMessagePath(messageId: string): string {
  return `${ADMIN_INBOX_PATH}?message=${messageId}`;
}

/**
 * `/admin/templates/<id>` — one template's editor.
 *
 * Here rather than beside `lib/admin/templates.ts` (#502a): the editor is a client component and
 * needs the route to link to, while that module opens a pool. A pure path in a module that
 * imports `lib/db/**` is the E34 crossing the client graph forbids — the same reason
 * `adminRelationshipPath` lives here and not in `session-registry`'s database half.
 */
export function adminTemplatePath(templateId: string): string {
  return `${ADMIN_TEMPLATES_PATH}/${templateId}`;
}

/**
 * `/admin/email-templates` — the transactional-mail override editor (#1138).
 *
 * Here for the reason every admin path in this file is: the screen's own components link to it and
 * to each template's editor, and `lib/admin/email-templates.ts` opens a pool. `templateId` is the
 * **register's** id (`counterparty-invitation`), not a row id — the row is the override, and there
 * may be none at all, which is why the address cannot be built from a version.
 */
export const ADMIN_EMAIL_TEMPLATES_PATH = "/admin/email-templates";

/** `/admin/email-templates/<id>` — one registered template, its versions and its editor. */
export function adminEmailTemplatePath(templateId: string): string {
  return `${ADMIN_EMAIL_TEMPLATES_PATH}/${templateId}`;
}

/** `/admin/instances/<id>` — one relationship, and its five repairs. */
export function adminRelationshipPath(sessionRecordId: string): string {
  return `${ADMIN_SESSIONS_PATH}/${sessionRecordId}`;
}

/**
 * `/admin/instances/<id>/report` — the relationship's Gap report (#504).
 *
 * A child of the repair screen rather than a sibling: the report belongs to the row, and the
 * operator who is repairing it is the one who reissues it.
 */
export function adminReportPath(sessionRecordId: string): string {
  return `${adminRelationshipPath(sessionRecordId)}/report`;
}

/**
 * `/admin/instances/<id>/report/export?format=json|pdf` — the audited download (#504).
 *
 * One handler, two formats, because the read, the gate and the audit row are identical and only
 * the bytes differ. A second route would be a second place to forget the gate.
 */
export function adminReportExportPath(sessionRecordId: string, format: "json" | "pdf"): string {
  return `${adminReportPath(sessionRecordId)}/export?format=${format}`;
}
