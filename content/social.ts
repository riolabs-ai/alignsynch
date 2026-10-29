/**
 * C4 — social (chat · notifications) content model.
 *
 * Deliverable of task t_d4fa716e (cluster C4 of the content-model extraction).
 * Target location in the repo: `types/content/social.ts` (imports `./core`).
 *
 * Design rules encoded below (each one retires a measured drift):
 *   D9  — every instant is `zIsoDateTime`; no `"5m ago"`, no `Date.now()` at module import.
 *   D10 — `notification.iconKey: string` + `NOTIFICATION_ICONS` registry; zero JSX in data.
 *   D12 — `conversation.lastMessage`, `conversation.unread` and the `recentMessages` array are
 *         NOT stored. `deriveUnread` / `deriveLastMessage` / `selectRecentMessages` replace them,
 *         so a preview row can never disagree with the contact it is previewing.
 *   D13 — `link` is shape-checked here and referentially checked against the route manifest
 *         (`checkNotificationRefs`), including the dynamic-segment trap that let
 *         `/profile/achievements` render a user named "achievements".
 *   D17 — people are `zPersonRef`; an id is optional because most names in the fixtures are not
 *         accounts. No ids are invented here.
 *
 * Every object is `.strict()`: an unknown key is a migration failure, not a silent passthrough.
 * That is what makes "no JSX / no StaticImageData in data" mechanically enforceable.
 */
import { z } from "zod";
import { zId, zIsoDateTime, zImageRef, zPersonRef } from "./core";

/* ────────────────────────────────────────────────────────────────────────────
 * Persons and contacts
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The reserved id of the signed-in user inside a conversation. Messages from this id are
 * outbound; everything else is inbound (that distinction is the whole of `deriveUnread`).
 */
export const CURRENT_USER_ID = "current-user";

export const zContactStatus = z.enum(["online", "offline", "away"]);

/**
 * A contact is a `PersonRef` (name + optional avatar + optional account id) with a presence
 * state. `lastSeenAt` is an absolute instant and is present **iff** `status === "offline"`
 * (invariant holds 5/5 in today's fixture; encoded here so it cannot regress).
 */
export const zContact = zPersonRef
  .extend({
    id: zId,
    status: zContactStatus,
    lastSeenAt: zIsoDateTime.optional(),
  })
  .strict()
  .superRefine((contact, ctx) => {
    const isOffline = contact.status === "offline";
    if (isOffline && contact.lastSeenAt === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lastSeenAt"],
        message: 'lastSeenAt is required when status === "offline"',
      });
    }
    if (!isOffline && contact.lastSeenAt !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lastSeenAt"],
        message: 'lastSeenAt must be absent when status !== "offline"',
      });
    }
  });

/* ────────────────────────────────────────────────────────────────────────────
 * Messages
 * ──────────────────────────────────────────────────────────────────────────── */

export const zMessageStatus = z.enum(["sent", "delivered", "read"]);

/**
 * A message is **either** text **or** an image, never both and never neither.
 * Today's fixture: 25 text, 1 image, 0 both, 0 neither. The XOR is a refine, not two optionals,
 * because `body?: string; image?: ImageRef` alone accepts `{}` (an empty bubble) and
 * `{body, image}` (a bubble that renders twice).
 */
export const zMessage = z
  .object({
    id: zId,
    senderId: zId, // CURRENT_USER_ID is a valid sender
    body: z.string().min(1).optional(),
    image: zImageRef.optional(),
    sentAt: zIsoDateTime,
    status: zMessageStatus,
  })
  .strict()
  .refine((message) => (message.body === undefined) !== (message.image === undefined), {
    message: "exactly one of `body` | `image` must be present (found both or neither)",
    path: ["body"],
  });

/* ────────────────────────────────────────────────────────────────────────────
 * Conversations  (lastMessage and unread are DERIVED — see the selectors below)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Stored shape. Note what is absent: `lastMessage` (equals the final message in 5/5 today) and
 * `unread` (equals inbound messages whose status ≠ "read" in 5/5 today). Both are projections,
 * so they cannot drift from `messages`.
 */
export const zConversation = z
  .object({
    id: zId,
    contactId: zId,
    messages: z.array(zMessage).min(1),
  })
  .strict()
  .superRefine((conversation, ctx) => {
    const seen = new Set<string>();
    let previous = -Infinity;
    conversation.messages.forEach((message, index) => {
      if (seen.has(message.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["messages", index, "id"],
          message: `duplicate message id "${message.id}" inside conversation "${conversation.id}"`,
        });
      }
      seen.add(message.id);

      // Every message belongs to exactly this conversation: it is outbound (the signed-in user)
      // or it is the counterparty. This is what makes the fixture's `senderId` referential.
      if (message.senderId !== CURRENT_USER_ID && message.senderId !== conversation.contactId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["messages", index, "senderId"],
          message: `senderId "${message.senderId}" is neither "${CURRENT_USER_ID}" nor the conversation's contactId "${conversation.contactId}"`,
        });
      }

      // Chronological order is a property of the data, not of the renderer's luck.
      const at = Date.parse(message.sentAt);
      if (at < previous) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["messages", index, "sentAt"],
          message: `messages must be in ascending sentAt order ("${message.id}" is out of order)`,
        });
      }
      previous = at;
    });
  });

/* ────────────────────────────────────────────────────────────────────────────
 * Notifications
 * ──────────────────────────────────────────────────────────────────────────── */

export const zNotificationType = z.enum([
  "achievement",
  "social",
  "reward",
  "event",
  "system",
  "featured",
]);

/**
 * In-app route shape. Absolute URLs, external links and (importantly) anything that is not
 * rooted at "/" are rejected. Static/dynamic resolution is a *referential* check and needs the
 * route manifest — see `checkNotificationRefs` and `createRouteResolver`.
 */
export const zNotificationLink = z
  .string()
  .min(1)
  .startsWith("/")
  .refine((link) => !link.startsWith("//"), "protocol-relative URLs are not in-app links");

/**
 * The closed set of `iconKey` values the drawer can render (6/6 records).
 *
 * This list lives in the MODEL, not next to the React components, because it is
 * the set `data:check` validates against — and because `content/` must stay free
 * of React/lucide imports so the fixture validator runs under plain node. The
 * key -> component + className mapping is `components/header/notification-icon.tsx`.
 */
export const NOTIFICATION_ICON_KEYS = [
  "trophy",
  "users",
  "gift",
  "calendar",
  "alert-circle",
  "star",
] as const;

export type NotificationIconKey = (typeof NOTIFICATION_ICON_KEYS)[number];

export function isNotificationIconKey(key: string): key is NotificationIconKey {
  return (NOTIFICATION_ICON_KEYS as readonly string[]).includes(key);
}

/**
 * `iconKey` is a plain string in the record so adding an icon is a registry edit,
 * not a data migration; completeness is enforced referentially at check time by
 * `checkNotificationRefs(notifications, { iconKeys: NOTIFICATION_ICON_KEYS })`.
 */
export const zNotification = z
  .object({
    id: zId,
    type: zNotificationType,
    title: z.string().min(1),
    body: z.string().min(1), // was `description`
    iconKey: z.string().min(1), // was JSX.Element
    createdAt: zIsoDateTime, // was "10m ago"
    read: z.boolean().default(false),
    link: zNotificationLink,
  })
  .strict();

/* ────────────────────────────────────────────────────────────────────────────
 * Inferred types
 * ──────────────────────────────────────────────────────────────────────────── */

export type ContactStatus = z.infer<typeof zContactStatus>;
export type Contact = z.infer<typeof zContact>;
export type MessageStatus = z.infer<typeof zMessageStatus>;
export type Message = z.infer<typeof zMessage>;
export type Conversation = z.infer<typeof zConversation>;
export type NotificationType = z.infer<typeof zNotificationType>;
export type Notification = z.infer<typeof zNotification>;
export type PersonRef = z.infer<typeof zPersonRef>;
export type ImageRef = z.infer<typeof zImageRef>;

/* ────────────────────────────────────────────────────────────────────────────
 * Derived views (plain TS — these are projections, never parsed)
 * ──────────────────────────────────────────────────────────────────────────── */

export interface ConversationView {
  conversation: Conversation;
  /** count of inbound messages whose status ≠ "read" */
  unread: number;
  lastMessage: Message;
  lastMessageAt: string;
}

export interface RecentMessagePreview {
  conversationId: string;
  contactId: string;
  /** The contact's own identity — the ONLY source of name/avatar for a preview row. */
  person: PersonRef;
  /** The conversation's tail message. UI derives its label (body ?? photo placeholder). */
  lastMessage: Message;
  lastMessageAt: string;
  /** count of inbound messages whose status ≠ "read" */
  unread: number;
  hasUnread: boolean;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Selectors
 * ──────────────────────────────────────────────────────────────────────────── */

function ts(iso: string): number {
  const value = Date.parse(iso);
  if (Number.isNaN(value)) throw new Error(`invalid ISO instant: ${iso}`);
  return value;
}

export function isInbound(message: Message, currentUserId: string = CURRENT_USER_ID): boolean {
  return message.senderId !== currentUserId;
}

/**
 * `conversation.unread` — inbound messages that have not been read.
 * Reproduces the fixture's stored `unread` for 5/5 conversations (see social-migration.md §4).
 */
export function deriveUnread(
  conversation: Conversation,
  currentUserId: string = CURRENT_USER_ID,
): number {
  return conversation.messages.filter(
    (message) => isInbound(message, currentUserId) && message.status !== "read",
  ).length;
}

/**
 * `conversation.lastMessage` — the tail by `sentAt`, not by array position.
 * (Array position is a convention; `sentAt` is the fact. Ties resolve to the later array index.)
 */
export function deriveLastMessage(conversation: Conversation): Message {
  const messages = conversation.messages;
  if (messages.length === 0) {
    throw new Error(`deriveLastMessage: conversation "${conversation.id}" has no messages`);
  }
  let last = messages[0];
  for (let index = 1; index < messages.length; index += 1) {
    if (ts(messages[index].sentAt) >= ts(last.sentAt)) last = messages[index];
  }
  return last;
}

export function deriveConversationView(
  conversation: Conversation,
  currentUserId: string = CURRENT_USER_ID,
): ConversationView {
  const lastMessage = deriveLastMessage(conversation);
  return {
    conversation,
    unread: deriveUnread(conversation, currentUserId),
    lastMessage,
    lastMessageAt: lastMessage.sentAt,
  };
}

/**
 * `recentMessages` — the header drawer's preview list, derived instead of duplicated (D12).
 *
 * One row per conversation, newest first, name/avatar taken from the contact record. The old
 * hand-maintained array disagreed with the contacts on 3/5 avatars, on one unread flag and on
 * one timestamp ("15h ago" for a message that is 15 minutes old in the conversation), and its
 * ids (`msg-1…5`) collided with real message ids (`msg-1-1`). None of that is representable
 * in this projection: the row has no name, no avatar and no id of its own.
 *
 * @param conversations stored conversations
 * @param contacts      the contact registry (single source of truth for name + avatar)
 * @param options.limit how many conversations to preview (default 5)
 * @throws if a conversation points at an unknown contact — a fixture bug, not a render case
 */
export function selectRecentMessages(
  conversations: readonly Conversation[],
  contacts: readonly Contact[],
  options: { limit?: number; currentUserId?: string } = {},
): RecentMessagePreview[] {
  const { limit = 5, currentUserId = CURRENT_USER_ID } = options;
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));

  const rows = conversations.map((conversation) => {
    const contact = byId.get(conversation.contactId);
    if (!contact) {
      throw new Error(
        `selectRecentMessages: conversation "${conversation.id}" references unknown contact "${conversation.contactId}"`,
      );
    }
    const lastMessage = deriveLastMessage(conversation);
    const unread = deriveUnread(conversation, currentUserId);
    const person: PersonRef = {
      id: contact.id,
      name: contact.name,
      avatar: contact.avatar,
    };
    return {
      conversationId: conversation.id,
      contactId: contact.id,
      person,
      lastMessage,
      lastMessageAt: lastMessage.sentAt,
      unread,
      hasUnread: unread > 0,
    } satisfies RecentMessagePreview;
  });

  rows.sort((a, b) => ts(b.lastMessageAt) - ts(a.lastMessageAt));
  return rows.slice(0, limit);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Referential checks (data:check)
 * ──────────────────────────────────────────────────────────────────────────── */

export interface RouteResolution {
  ok: boolean;
  /** matched route pattern, e.g. "/profile/[username]" */
  pattern?: string;
  /** params filled from real fixture ids, e.g. { username: "alexjohnson" } */
  params?: Record<string, string>;
  reason?: string;
}

export interface RefIssue {
  id: string;
  field: string;
  value: string;
  reason: string;
}

/**
 * Collection invariants for the contact registry — the "one avatar per person" rule, enforceable
 * because a contact list is small and identity is the one thing that must not be ambiguous:
 *   • contact ids unique, names unique
 *   • avatar `src` unique — two people never share a face inside the social fixture
 *     (this is the check the old `recentMessages` duplication violated for 3/5 people)
 *   • a contact whose name matches an account must carry that account's avatar (passed in)
 */
export function checkContactRefs(
  contacts: readonly Contact[],
  accounts: readonly { id?: string; name: string; avatar?: { src: string } }[] = [],
): RefIssue[] {
  const issues: RefIssue[] = [];
  const ids = new Set<string>();
  const names = new Map<string, string>();
  const avatars = new Map<string, string>();

  for (const contact of contacts) {
    if (ids.has(contact.id)) {
      issues.push({
        id: contact.id,
        field: "id",
        value: contact.id,
        reason: "duplicate contact id",
      });
    }
    ids.add(contact.id);

    const sameName = names.get(contact.name);
    if (sameName !== undefined) {
      issues.push({
        id: contact.id,
        field: "name",
        value: contact.name,
        reason: `the same person appears twice ("${sameName}" and "${contact.id}")`,
      });
    }
    names.set(contact.name, contact.id);

    const src = contact.avatar?.src;
    if (src) {
      const owner = avatars.get(src);
      if (owner !== undefined) {
        issues.push({
          id: contact.id,
          field: "avatar.src",
          value: src,
          reason: `avatar already used by "${owner}" — one avatar per person`,
        });
      }
      avatars.set(src, contact.id);
    }

    const account = accounts.find((candidate) => candidate.name === contact.name);
    if (account?.avatar && src && account.avatar.src !== src) {
      issues.push({
        id: contact.id,
        field: "avatar.src",
        value: src,
        reason: `contact "${contact.name}" disagrees with the account of the same name (${account.avatar.src})`,
      });
    }
  }
  return issues;
}

/**
 * Collection invariants for conversations. Per-record validation cannot see these:
 *   • conversation ids unique
 *   • one conversation per contact
 *   • message ids unique ACROSS conversations — the fixture's old `recentMessages` ids
 *     (`msg-1`…`msg-5`) collided with the message namespace (`msg-1-1`) precisely because they
 *     were stored in a second array; keeping the check means the next denormalized array cannot
 *     reintroduce it silently.
 */
export function checkConversationRefs(conversations: readonly Conversation[]): RefIssue[] {
  const issues: RefIssue[] = [];
  const conversationIds = new Set<string>();
  const contactIds = new Set<string>();
  const messageOwner = new Map<string, string>();

  for (const conversation of conversations) {
    if (conversationIds.has(conversation.id)) {
      issues.push({
        id: conversation.id,
        field: "id",
        value: conversation.id,
        reason: "duplicate conversation id",
      });
    }
    conversationIds.add(conversation.id);

    if (contactIds.has(conversation.contactId)) {
      issues.push({
        id: conversation.id,
        field: "contactId",
        value: conversation.contactId,
        reason: "a second conversation for the same contact",
      });
    }
    contactIds.add(conversation.contactId);

    for (const message of conversation.messages) {
      const owner = messageOwner.get(message.id);
      if (owner !== undefined) {
        issues.push({
          id: conversation.id,
          field: "messages.id",
          value: message.id,
          reason: `message id "${message.id}" is already used in conversation "${owner}"`,
        });
      } else {
        messageOwner.set(message.id, conversation.id);
      }
    }
  }
  return issues;
}

/**
 * Every social instant must be at or before the fixture clock (`content/core.ts`
 * `DEMO_NOW_ISO`).
 *
 * The UI renders relative labels against that clock, so a fixture dated after it renders
 * `in 1 hour` — which is what the P1 migration shipped (`2026-10-29T11:55:00Z` authored
 * against a build that ran earlier the same morning). Relative labels are only meaningful
 * when "now" is after everything they describe; this makes that a checked invariant instead
 * of a thing you notice in a screenshot. It is also the reason a label can be a pure function
 * of its input: there is exactly one clock, and it does not move.
 */
export function checkSocialInstants(
  input: {
    contacts: readonly Contact[];
    conversations: readonly Conversation[];
    notifications: readonly Notification[];
  },
  nowIso: string,
): RefIssue[] {
  const issues: RefIssue[] = [];
  const limit = ts(nowIso);

  const report = (id: string, field: string, value: string) => {
    issues.push({
      id,
      field,
      value,
      reason: `is after the fixture clock ${nowIso} — a relative label would read "in ...". Move the instant earlier or move DEMO_NOW_ISO forward.`,
    });
  };

  for (const contact of input.contacts) {
    if (contact.lastSeenAt !== undefined && ts(contact.lastSeenAt) > limit) {
      report(contact.id, "lastSeenAt", contact.lastSeenAt);
    }
  }
  for (const conversation of input.conversations) {
    for (const message of conversation.messages) {
      if (ts(message.sentAt) > limit) report(message.id, "sentAt", message.sentAt);
    }
  }
  for (const notification of input.notifications) {
    if (ts(notification.createdAt) > limit) {
      report(notification.id, "createdAt", notification.createdAt);
    }
  }
  return issues;
}

/**
 * `notification.link` against the route manifest (C2 owns the manifest; this only consumes it).
 * The resolver MUST distinguish "static route exists" from "fell into a dynamic route with a
 * value that is not a real id" — `/profile/achievements` matched `/profile/[username]` and would
 * have rendered the profile of a user called "achievements". A resolver that answers
 * `ok: true` for that is not a resolver; `createRouteResolver` in the harness shows the shape.
 */
export function checkNotificationRefs(
  notifications: readonly Notification[],
  deps: {
    resolveRoute: (link: string) => RouteResolution;
    iconKeys: readonly string[];
  },
): RefIssue[] {
  const iconKeys = new Set(deps.iconKeys);
  const issues: RefIssue[] = [];
  const ids = new Set<string>();

  for (const notification of notifications) {
    if (ids.has(notification.id)) {
      issues.push({
        id: notification.id,
        field: "id",
        value: notification.id,
        reason: "duplicate notification id",
      });
    }
    ids.add(notification.id);

    if (!iconKeys.has(notification.iconKey)) {
      issues.push({
        id: notification.id,
        field: "iconKey",
        value: notification.iconKey,
        reason: `iconKey is not in the icon registry (${[...iconKeys].join(", ")})`,
      });
    }

    const route = deps.resolveRoute(notification.link);
    if (!route.ok) {
      issues.push({
        id: notification.id,
        field: "link",
        value: notification.link,
        reason: route.reason ?? "link does not resolve to a route",
      });
    }
  }
  return issues;
}
