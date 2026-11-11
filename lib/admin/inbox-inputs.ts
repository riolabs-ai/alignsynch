/**
 * The vocabulary the inbox screen and its server action share (#506).
 *
 * **Why this is not in `actions.ts`.** That file is `"use server"`, and Next refuses a module with
 * that directive that exports anything but async functions — the build fails while collecting
 * configuration with "A \"use server\" file can only export async functions". The input shape and
 * the outcome below are values and types a client component also needs, so they live here, in a
 * module with no directive and no imports that reach `pg`: the component takes the types, the
 * action takes the names, and neither drags a database module into the browser graph (E34).
 *
 * **The payload carries data, not policy.** There is no `actorUserId` and no role in it — the actor
 * comes from the session on the server and the rung out of `user_profile` inside `act()`'s
 * transaction. A field the client could set would be a client choosing whose audit row it gets.
 */

/** What the screen is asking for. A closed list, so an unknown operation is a refusal, not a 500. */
export const INBOX_OPERATIONS = ["reply", "status", "assign"] as const;

export type InboxOperation = (typeof INBOX_OPERATIONS)[number];

/** What the screen posts. Each field is read only by the operation that names it. */
export interface InboxOperationInput {
  readonly operation: string;
  readonly messageId: string;
  /**
   * The operator's reason, for the audit row, when they state one. Optional since #732: the thread
   * no longer asks, and `act()` records `NULL` when nobody does.
   */
  readonly reason?: string;
  /** The reply's words (`reply`). */
  readonly body?: string;
  /** The status to move to (`status`). */
  readonly status?: string;
  /** The seat's `user_profile.user_id`, or `null` to clear it (`assign`). */
  readonly seatUserId?: string | null;
}

/**
 * What the screen draws. `code` is always one the copy fixture has a sentence for — a refusal or
 * an `ActRefused` reason — and a success carries the audit row's id so the screen can say which
 * entry recorded it.
 */
export type InboxOperationOutcome =
  | {
      readonly ok: true;
      readonly operation: "reply";
      readonly replyId: string;
      /** The instant the provider accepted, or null when it did not. */
      readonly sentAt: string | null;
      readonly error: string | null;
      readonly status: string;
      readonly actionIds: readonly string[];
    }
  | {
      readonly ok: true;
      readonly operation: "status";
      readonly status: string;
      readonly actionId: string;
    }
  | {
      readonly ok: true;
      readonly operation: "assign";
      readonly seatUserId: string | null;
      readonly status: string;
      readonly actionId: string;
    }
  | { readonly ok: false; readonly code: string };
