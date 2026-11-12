/**
 * The vocabulary `/admin/review`'s screen and its server actions share (#665 follow-up).
 *
 * **Why this is not in `actions.ts`.** That module is `"use server"`, and Next refuses a module
 * with that directive that exports anything but async functions — the build fails while collecting
 * configuration with "A \"use server\" file can only export async functions". The input shapes and
 * the outcome below are values a client component also needs, so they live here, in a module with
 * no directive and no import that reaches `pg`: the component takes the types, the action takes
 * the names, and neither drags a database module into the browser graph (E34).
 *
 * **The payload carries data, not policy.** There is no `actorUserId` and no role in it — the actor
 * comes from the session on the server, and the rung out of `user_profile` inside `act()`'s
 * transaction. A field the client could set would be a client choosing whose audit row it gets.
 *
 * **A to-do has no reason field, and that is the store's decision, not this module's.** A checkbox
 * posts the item's own words (`body`) and the server turns them into the audit sentence
 * (`lib/admin/review-ops.ts::reviewTodoReasonOf`), because asking somebody to type a sentence to
 * tick a box is the friction that makes a checklist stop being used. The two issue operations do
 * carry a `reason`, drawn from the screen's own copy.
 */

/** Tick or untick one checklist item. */
export interface ReviewTodoInput {
  readonly artifactId: string;
  readonly todoId: string;
  /** The item's own words — the audit row's `why`, when nobody typed one. */
  readonly body: string;
  readonly done: boolean;
}

/** Add one comment under an issue. */
export interface ReviewCommentInput {
  readonly issueId: string;
  readonly body: string;
  /** The operator's reason, for the audit row (`act()` requires eight characters). */
  readonly reason: string;
}

/** Move one issue between `open` and `closed`. */
export interface ReviewIssueStateInput {
  readonly issueId: string;
  readonly state: "open" | "closed";
  /** The operator's reason, for the audit row (`act()` requires eight characters). */
  readonly reason: string;
}

/**
 * What every action answers. `code` is a refusal the screen has a sentence for — an `act()`
 * reason, a store refusal, or `signed-out` — and a success optionally carries a detail (the issue
 * number a raise was given). A genuine failure is rethrown rather than flattened into a code: a
 * caller told "nothing happened" while the stack is lost cannot report the bug.
 */
export type ReviewActionOutcome =
  | { readonly ok: true; readonly detail?: string }
  | { readonly ok: false; readonly code: string };
