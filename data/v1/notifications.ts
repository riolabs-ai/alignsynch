/**
 * The v1 prototype's notifications — the four events the product actually emits, seeded per
 * persona, plus the selectors the bell and the notifications page share.
 *
 * This is the /v1 answer to `data/notifications.ts`: where the quiz product's drawer lists
 * achievements, rewards and followers, the alignment product's notifications are the events
 * its own flow fires — an invite accepted, a session scored, a new comment, a payment that
 * failed. The type enum below is the whole vocabulary; nothing here invents an event the
 * product does not emit (#384).
 *
 * Every instant is an ISO literal at or before the fixture clock (`DEMO_NOW_ISO`), the same
 * convention as `data/chat-data.ts` and `data/v1/fixtures.ts`. Nothing reads a clock and no
 * component pastes a row: the bell and the page both call `notificationsFor` / `unreadCountOf`.
 *
 * Read state is the `read` flag on each record. It is mutable store state, not fixture truth:
 * the store seeds from these rows and persists the mutated copy under its own key, so "mark as
 * read" survives navigation exactly the way the quiz header's drawer does not (that one is a
 * no-op). The flag starts here because a fresh store must open with a believable mix of read
 * and unread.
 */
import { z } from "zod";
import type { Persona } from "./fixtures";

/* ------------------------------------------------------------------ *
 * The four event types the product emits
 * ------------------------------------------------------------------ */

export const zV1NotificationType = z.enum([
  "invite_accepted",
  "session_scored",
  "new_comment",
  "payment_failed",
]);

export type V1NotificationType = z.infer<typeof zV1NotificationType>;

/** The personas a notification is delivered to — the four that own a dashboard. */
const zV1NotificationPersona = z.enum(["initiator", "counterparty", "coach", "admin"]);

export type V1NotificationPersona = z.infer<typeof zV1NotificationPersona>;

export const zV1Notification = z
  .object({
    id: z.string().min(1),
    type: zV1NotificationType,
    title: z.string().min(1),
    body: z.string().min(1),
    createdAt: z.string().min(1),
    /** Who this row is delivered to — the bell and the page filter on it. */
    persona: zV1NotificationPersona,
    /** The /v1 destination the row opens. Rooted, like `zNotificationLink`. */
    link: z
      .string()
      .min(1)
      .startsWith("/")
      .refine((value) => !value.startsWith("//"), "protocol-relative links are not in-app"),
    /** Mutable: the store flips this on `markNotificationRead`. */
    read: z.boolean(),
  })
  .strict();

export type V1Notification = z.infer<typeof zV1Notification>;

/* ------------------------------------------------------------------ *
 * Seed rows — one believable event per persona, all ≤ DEMO_NOW_ISO
 * ------------------------------------------------------------------ */

const seedRows: readonly V1Notification[] = [
  // Initiator (Jordan) — the invite Sam accepted, Sam's reply, and the payment that failed.
  {
    id: "v1n-init-invite",
    type: "invite_accepted",
    title: "Invitation accepted",
    body: "Sam accepted your invitation to Staff & Manager.",
    createdAt: "2026-10-29T11:40:00.000Z",
    persona: "initiator",
    link: "/v1/initiator/relationships/rel-connected-blind",
    read: false,
  },
  {
    id: "v1n-init-comment",
    type: "new_comment",
    title: "New comment on Priorities",
    body: "Sam replied to your note about how the week's priorities are agreed.",
    createdAt: "2026-10-29T09:46:00.000Z",
    persona: "initiator",
    link: "/v1/initiator/chat/rel-connected-blind--aspect-priorities",
    read: false,
  },
  {
    id: "v1n-init-payment",
    type: "payment_failed",
    title: "Payment failed",
    body: "Your monthly payment for Relationship Basics did not go through.",
    createdAt: "2026-10-29T08:00:00.000Z",
    persona: "initiator",
    link: "/v1/initiator/relationships/rel-invited",
    read: true,
  },
  // Counterparty (Sam) — the scored session with Ruth, and Ruth's replies.
  {
    id: "v1n-cp-scored",
    type: "session_scored",
    title: "Session scored",
    body: "Your session with Ruth is ready to review.",
    createdAt: "2026-10-29T10:05:00.000Z",
    persona: "counterparty",
    link: "/v1/counterparty/relationships/rel-aligned",
    read: false,
  },
  {
    id: "v1n-cp-comment",
    type: "new_comment",
    title: "New comment",
    body: "Ruth replied on your relationship thread.",
    createdAt: "2026-10-29T10:36:00.000Z",
    persona: "counterparty",
    link: "/v1/counterparty/chat/rel-aligned",
    read: false,
  },
  // Coach (Riley) — a shared, scored session and fresh comments on it.
  {
    id: "v1n-coach-scored",
    type: "session_scored",
    title: "Session scored",
    body: "Ruth & Sam's session is scored and shared with you.",
    createdAt: "2026-10-29T10:02:00.000Z",
    persona: "coach",
    link: "/v1/coach/relationships/rel-aligned",
    read: false,
  },
  {
    id: "v1n-coach-comment",
    type: "new_comment",
    title: "New comment",
    body: "Ruth & Sam left new comments on their relationship.",
    createdAt: "2026-10-29T10:41:00.000Z",
    persona: "coach",
    link: "/v1/coach/chat/rel-aligned",
    read: true,
  },
  // Admin — a view of the same events, delivered to the console persona.
  {
    id: "v1n-admin-invite",
    type: "invite_accepted",
    title: "Invitation accepted",
    body: "Sam accepted Jordan's invitation to Staff & Manager.",
    createdAt: "2026-10-29T11:41:00.000Z",
    persona: "admin",
    link: "/v1/admin/relationships/rel-connected-blind",
    read: true,
  },
  {
    id: "v1n-admin-payment",
    type: "payment_failed",
    title: "Payment failed",
    body: "A subscription payment failed (Avery & Rowan, quarterly).",
    createdAt: "2026-10-29T08:05:00.000Z",
    persona: "admin",
    link: "/v1/admin/relationships/rel-sharing-unmet",
    read: false,
  },
];

export const seedNotifications: readonly V1Notification[] = z
  .array(zV1Notification)
  .parse(seedRows);

/* ------------------------------------------------------------------ *
 * Selectors — the bell and the page read the same two functions
 * ------------------------------------------------------------------ */

/** The rows delivered to one persona, newest first. */
export function notificationsFor(
  persona: Persona,
  notifications: readonly V1Notification[] = seedNotifications,
): readonly V1Notification[] {
  if (
    persona !== "initiator" &&
    persona !== "counterparty" &&
    persona !== "coach" &&
    persona !== "admin"
  ) {
    return [];
  }
  return notifications
    .filter((notification) => notification.persona === persona)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** How many of a persona's notifications are still unread — the bell's badge, computed not stored. */
export function unreadNotificationCountOf(
  persona: Persona,
  notifications: readonly V1Notification[] = seedNotifications,
): number {
  return notificationsFor(persona, notifications).filter((notification) => !notification.read)
    .length;
}
