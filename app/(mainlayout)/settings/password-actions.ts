"use server";

/**
 * The server action `/settings`' password card posts to — the signed-in "set a password" path.
 *
 * **The account is the session's, never the body's.** `currentUser()` resolves it from the request's
 * cookies on the server, so a caller cannot name somebody else's `userId`, and the session id comes
 * from the same read because it is the one session the revocation must keep alive. A request with no
 * session is `unauthorized`, not an error: it means the sign-in expired while the form was open,
 * which is a sentence the card already has.
 *
 * `currentUser()` throws when `NEON_AUTH_*` is missing — a deployment mistake — and that is left to
 * propagate: a page behind an auth wall that treats a configuration error as "signed out" is the
 * failure `lib/auth/session.ts` documents.
 */
import { currentUser } from "@/lib/auth/session";
import { setPasswordFromSession } from "@/lib/auth/reset-set";
import type { ResetSetOutcome } from "@/lib/auth/reset-token";

export interface SavePasswordInput {
  readonly password: string;
  readonly confirmation: string;
}

export async function savePassword(input: SavePasswordInput): Promise<ResetSetOutcome> {
  const user = await currentUser();
  if (user === null) return { kind: "unauthorized" };

  const password = typeof input?.password === "string" ? input.password : "";
  const confirmation = typeof input?.confirmation === "string" ? input.confirmation : "";

  return setPasswordFromSession({
    userId: user.userId,
    sessionId: user.sessionId,
    password,
    confirmation,
  });
}
