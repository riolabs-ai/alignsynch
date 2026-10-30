/**
 * The two cookies a browser carries through the flow (#146).
 *
 * **One party cookie per instance.** `flow_party_<instanceRecordId>` holds the party's
 * session token; the token's hash is what `party.access_token_hash` carries, so the cookie
 * identifies *which party* by lookup and never by a claim in the request body. It is
 * `httpOnly` — no script needs it — and `sameSite: "lax"`, because the invitation link is
 * followed from an email client, where a cross-site `POST` would drop a `strict` cookie.
 *
 * **A second cookie, held by the Initiator only**, carries the raw invitation token
 * (`flow_invite_<instanceRecordId>`) so the screen can show the link while the invite is
 * unclaimed — the degraded path when `RESEND_API_KEY` is absent. It is set at creation,
 * `httpOnly` for the same reason, and it is the Initiator's own copy of a token they were
 * always allowed to see: they are the one who has to deliver it.
 *
 * Neither cookie is a session for anything else. There is no `getSession()` here: this
 * version has no auth wall (Neon Auth is not enabled on the branch, and `party` has no
 * user column — #145 landed parties as `(role, name)`), so a party proves itself with the
 * token that instance gave it and with nothing wider.
 *
 * Cookies are `secure` in production only: a local `http://localhost:3000` run cannot set a
 * secure cookie, and the dev server is the flow's own working environment.
 */
export const PARTY_COOKIE_PREFIX = "flow_party_";
export const INVITE_COOKIE_PREFIX = "flow_invite_";

export function partyCookieName(instanceRecordId: string): string {
  return `${PARTY_COOKIE_PREFIX}${instanceRecordId}`;
}

export function inviteCookieName(instanceRecordId: string): string {
  return `${INVITE_COOKIE_PREFIX}${instanceRecordId}`;
}

/** The cookie options both cookies share. `maxAge` is the invitation's seven days. */
export function flowCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}

/** Seven days, the invite's own lifetime — the party cookie rides along with it. */
export const FLOW_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
