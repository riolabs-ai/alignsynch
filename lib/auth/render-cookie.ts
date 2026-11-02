/**
 * The one Next refusal a session read must survive, recognised by sentence.
 *
 * Next 16 seals the request's cookie store during a React Server Component render: `set()` and
 * `delete()` throw `ReadonlyRequestCookiesError`, whose only stable feature is its message —
 * the class is not exported and the error carries no digest or code. This module is the single
 * place that string is matched, so the auth code that has to distinguish "the session answered
 * and could not persist" from "the session read failed" is not matching a sentence inline.
 *
 * **Why this error is not exotic.** Better Auth re-signs the session cookie when a session is
 * due for refresh, and the Neon Auth SDK writes every `Set-Cookie` it receives from inside
 * `getSession()`. So a render of a perfectly good session periodically *does* attempt a cookie
 * write, and Next refuses it. Treating that refusal as "no session" signed people out
 * (kanban t_98acf062): the page answered `200` with the signed-out chrome, or redirected to
 * `/login`.
 *
 * The match is deliberately narrow. A message Next rewrites in a future major makes the refusal
 * unrecognisable, which fails **loud** — the read answers `null` and logs — instead of widening
 * this to "any error during a session read", which is the defect this module exists to undo.
 */

/** Next's sentence, verbatim from `ReadonlyRequestCookiesError` in `next/dist/server/app-render`. */
export const NEXT_READONLY_COOKIE_MESSAGE =
  "Cookies can only be modified in a Server Action or Route Handler";

/**
 * Was this error Next refusing a cookie write during a render?
 *
 * Matched on the sentence, because that is all Next gives: the class is private and the error
 * carries no `digest`. `cause` is not consulted — the refusal is thrown directly by
 * `cookies().set()`, so it arrives as the rejection itself.
 */
export function isRenderCookieWriteRefusal(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes(NEXT_READONLY_COOKIE_MESSAGE);
}
