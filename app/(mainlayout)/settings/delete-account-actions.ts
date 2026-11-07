"use server";

/**
 * The server action `/settings`' delete card posts to (#278).
 *
 * **The account is the session's, never the form's.** `currentUser()` resolves it from the
 * request's own cookies on the server, so a caller cannot name somebody else's account, and there
 * is no `userId` in the payload at all. A request with no session is `unauthorized`, not an error:
 * it means the sign-in expired while the card was open.
 *
 * **It is a `POST`, always.** A server action is invoked by the action protocol, which is a POST;
 * there is no route handler and no GET that could delete an account from a link, a prefetch or a
 * crawler. That is the card's "never a GET" held structurally rather than by a check.
 *
 * **The confirmation phrase is the fixture's.** `data/pages/settings.ts`'s `deletion` band carries
 * both the phrase a person types and every sentence the card renders, so this module compares
 * against the same string the form showed — a copy edit moves both, and neither can drift into a
 * phrase nobody can guess.
 *
 * The deletion itself is `lib/account/purge.ts`'s `runAccountDeletion`: read the identity, delete
 * the managed-auth user, then scrub `public` in one transaction. The order is the spec's (§7) and
 * the reason is that a failed scrub must never leave an account that can still sign in.
 *
 * `currentUser()` throws when `NEON_AUTH_*` is missing — a deployment mistake — and that is left
 * to propagate, the same way `password-actions.ts` leaves it: a page behind an auth wall must not
 * read a configuration error as "signed out".
 */
import { runAccountDeletion } from "@/lib/account/purge";
import { currentUser } from "@/lib/auth/session";
import { settingsPageCopy } from "@/data/pages/settings";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** What the card renders after one attempt. */
export type DeleteAccountOutcome =
  /** The account is gone: the auth user and every row §1.1 lists. The session is void with it. */
  | { readonly kind: "deleted" }
  /** No session: the sign-in expired while the card was open. */
  | { readonly kind: "unauthorized" }
  /** The phrase did not match, so nothing was attempted. */
  | { readonly kind: "mismatch" }
  /** No auth user carries that id — the deletion already happened. */
  | { readonly kind: "not-found" }
  /** The managed-auth delete or the scrub failed. The account still works; the request retries. */
  | { readonly kind: "unavailable" };

/**
 * Delete the signed-in person's account.
 *
 * `confirmation` is the typed phrase. A mismatch answers `mismatch` and touches nothing — that is
 * the whole reason a destructive control has one: it cannot be triggered by a stray click.
 */
export async function deleteAccountAction(confirmation: string): Promise<DeleteAccountOutcome> {
  const user = await currentUser();
  if (user === null) return { kind: "unauthorized" };

  // The phrase the card rendered, read from the same band it reads. A copy edit moves both.
  const phrase = itemLabel(sectionOf(settingsPageCopy, "deletion"), "confirm-phrase");
  const typed = typeof confirmation === "string" ? confirmation.trim().toLowerCase() : "";
  if (typed === "" || typed !== phrase.trim().toLowerCase()) {
    return { kind: "mismatch" };
  }

  let outcome: Awaited<ReturnType<typeof runAccountDeletion>>;
  try {
    outcome = await runAccountDeletion(user.userId);
  } catch (error) {
    // A database that did not answer is not a deleted account. The auth user may or may not be
    // gone at this point, which is exactly why the answer is "try again" rather than "deleted".
    console.error("account deletion: the request failed", error);
    return { kind: "unavailable" };
  }

  switch (outcome.kind) {
    case "deleted":
      return { kind: "deleted" };
    case "unknown-account":
      return { kind: "not-found" };
    case "auth-failed":
      // Nothing was scrubbed: the account still works and the request can be retried.
      console.error("account deletion: the auth user could not be deleted", outcome.reason);
      return { kind: "unavailable" };
  }
}
