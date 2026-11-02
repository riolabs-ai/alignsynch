"use server";

/**
 * The server action `/reset/[token]` posts to — the token's one use.
 *
 * The body is checked before it reaches the flow: an action is a public endpoint, so `token`,
 * `password` and `confirmation` are each read as strings and nothing else is accepted from the
 * browser. There is no `userId` in the body and no `email`: the token is what names the account,
 * and a request that could name its own account would be a reset anybody could perform on anybody.
 *
 * The outcome is a value, not a redirect, so a refusal can be drawn in place. Success is the one
 * thing that does not come back: the view navigates to `/reset/complete` so the spent token leaves
 * the address bar, which is the reason the success screen is a different route rather than a band
 * on this one.
 */
import { setPasswordFromToken } from "@/lib/auth/reset-set";
import type { ResetSetOutcome } from "@/lib/auth/reset-token";

export interface SetPasswordInput {
  readonly token: string;
  readonly password: string;
  readonly confirmation: string;
}

export async function setPassword(input: SetPasswordInput): Promise<ResetSetOutcome> {
  if (typeof input !== "object" || input === null) return { kind: "unknown" };
  const token = typeof input.token === "string" ? input.token : "";
  const password = typeof input.password === "string" ? input.password : "";
  const confirmation = typeof input.confirmation === "string" ? input.confirmation : "";
  return setPasswordFromToken({ token, password, confirmation });
}
