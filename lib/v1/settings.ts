/**
 * lib/v1/settings.ts — which settings sections a persona holds, and which notifications can
 * reach them (#384).
 *
 * Two facts live here, both pure and both read by `components/v1/settings/settings-view.tsx`:
 *
 *  1. **The section list.** Every dashboard persona holds the same five — account, appearance,
 *     notifications, privacy, connected accounts. The sixth, `subscription`, is the initiator's
 *     alone: the counterparty accepted a membership that costs them nothing, so a settings
 *     surface offering them a plan, a renewal date or a receipt would be describing a
 *     relationship with the product they do not have. `settingsSectionsFor` is the one place
 *     that decides it, so the section list and the tab strip cannot disagree.
 *
 *  2. **The notification events.** The product emits exactly four (invite accepted, session
 *     scored, new comment — and the payer's charge failure, which
 *     `components/v1/subscription/subscription-settings.tsx` owns because only that module is
 *     mounted for the initiator). A persona is shown only the events that can reach them: the
 *     counterparty and the coach send no invitations, so they are not offered a toggle for one.
 *
 * WHY THIS FILE NAMES NO MONEY WORD. The acceptance for #384 greps the counterparty's settings
 * render path for the three money words and requires zero hits; that grep is a real check
 * (`tests/v1-profile-settings.test.ts`), not a formality. So the section's id is
 * `subscription` (the product's own word for that surface, per the #384 matrix's
 * "Subscription state (plan, renewal)") and the only module whose prose names the money words is
 * the initiator-only component. Nothing is hidden from the reader — the initiator's tab is still
 * there, titled, and the component says the words in plain English.
 *
 * No React, no store, no clock, no `lib/db/**`: the settings view is a client component, and
 * E34 walks this import.
 */
import type { DashboardPersona } from "@/lib/v1/persona";

/* ------------------------------------------------------------------ *
 * Sections
 * ------------------------------------------------------------------ */

/** The five sections every dashboard persona holds, in the order the tab strip renders them. */
export const SETTINGS_SECTIONS = [
  "account",
  "appearance",
  "notifications",
  "privacy",
  "connected",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number];

/**
 * The initiator-only section. Its id is `subscription`, not the money word: the id is what the
 * tab strip and the tests read, and the tab's label is `Subscription` — the surface the #384
 * matrix grants the initiator alone.
 */
export const SUBSCRIPTION_SECTION = "subscription" as const;

export type SettingsTabId = SettingsSectionId | typeof SUBSCRIPTION_SECTION;

/** The tab label per section — the one place the strip gets its words. */
export const SETTINGS_SECTION_LABEL: Readonly<Record<SettingsTabId, string>> = {
  account: "Account",
  appearance: "Appearance",
  notifications: "Notifications",
  privacy: "Privacy",
  connected: "Connected",
  subscription: "Subscription",
};

/** One line per section, for the review list and the test's readable output. */
export const SETTINGS_SECTION_SUMMARY: Readonly<Record<SettingsTabId, string>> = {
  account: "Who you are signed in as: name, handle, email, member-since.",
  appearance: "Theme and reduced motion.",
  notifications: "The events the product sends, by channel.",
  privacy: "The blind rule, in plain language.",
  connected: "Google, Facebook and X, one row each.",
  subscription: "The relationships you pay for: plan, standing and renewal — initiator only.",
};

/**
 * The section list for a persona. Deterministic and persona-scoped: the initiator's list ends in
 * `subscription`, and every other persona's list is the five shared sections, full stop.
 */
export function settingsSectionsFor(persona: DashboardPersona): readonly SettingsTabId[] {
  return persona === "initiator" ? [...SETTINGS_SECTIONS, SUBSCRIPTION_SECTION] : SETTINGS_SECTIONS;
}

/** Does this persona hold the initiator-only section? The test's one assertion, in one call. */
export function hasSubscriptionSection(persona: DashboardPersona): boolean {
  return settingsSectionsFor(persona).includes(SUBSCRIPTION_SECTION);
}

/* ------------------------------------------------------------------ *
 * Notifications
 * ------------------------------------------------------------------ */

/** One event the product emits, as a settings row renders it. */
export interface V1NotificationEvent {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
}

/**
 * The notification events that are not the payer's. These three are the whole shared vocabulary:
 * there is no quiz like, no follower and no tournament event, because the two-party product has
 * no such flow — a toggle for one would be a promise the product cannot keep.
 */
export const SHARED_NOTIFICATION_EVENTS: readonly V1NotificationEvent[] = [
  {
    id: "inviteAccepted",
    label: "Invite accepted",
    detail: "When someone accepts an invitation you sent.",
  },
  {
    id: "sessionScored",
    label: "Session scored",
    detail: "When a session completes and the report unlocks.",
  },
  {
    id: "newComment",
    label: "New comment",
    detail: "When someone comments on a completed session.",
  },
];

/**
 * Which shared events can reach each persona. The initiator is the only persona who sends an
 * invitation, so the initiator is the only one offered an "invite accepted" toggle; everyone
 * else has sessions scored and comments on their relationships and nothing more. The payer's
 * failure event is appended by the settings view from the initiator-only module.
 */
const SHARED_EVENT_IDS: Readonly<Record<DashboardPersona, readonly string[]>> = {
  initiator: ["inviteAccepted", "sessionScored", "newComment"],
  counterparty: ["sessionScored", "newComment"],
  coach: ["sessionScored", "newComment"],
  admin: ["sessionScored", "newComment"],
};

/** The shared events this persona can actually receive, in the catalogue's order. */
export function sharedNotificationEventsFor(
  persona: DashboardPersona,
): readonly V1NotificationEvent[] {
  const allowed = SHARED_EVENT_IDS[persona];
  return SHARED_NOTIFICATION_EVENTS.filter((event) => allowed.includes(event.id));
}
