/**
 * Setting a password through Neon Auth's own endpoint — the one path that exists.
 *
 * The app does not hash passwords. If it did, Better Auth's format would become this repo's
 * problem: a change of algorithm or cost parameter on the hosted server would lock every account
 * out of the flow that exists to stop exactly that, and the drift would be invisible until a
 * sign-in failed. So the hash is always the provider's, and the job here is to hand it the one
 * thing it accepts: a single-use grant.
 *
 * ## Which endpoint, and why it is this one (measured against the demo branch)
 *
 *   POST /set-password       **404 — not a route.** `setPassword` is `createAuthEndpoint.serverOnly`
 *                            in `better-auth@1.7.6` (`api/routes/update-user.mjs`), so it exists for
 *                            code running inside the auth server and is never mounted on HTTP.
 *                            This is why `/settings` used to say a password change was something
 *                            "Managed Auth cannot perform from the app": the obvious call is absent.
 *   POST /change-password    mounted, but requires `currentPassword` and a credential row. It is the
 *                            wrong tool twice over: a Google-only account has no current password,
 *                            and a person who forgot theirs does not either.
 *   POST /reset-password     mounted, takes `{ newPassword, token }`, and its own code is exactly
 *                            the operation this card needs — it looks the token up in
 *                            `neon_auth.verification` as `reset-password:<token>`, consumes it,
 *                            hashes the password with the server's hasher, and **creates the
 *                            `credential` account when the user has none** before falling back to
 *                            updating one (`api/routes/password.mjs`). That create branch is the
 *                            Google-only case, solved by the provider rather than by us.
 *
 * So the grant is minted here — one row in `neon_auth.verification`, in the shape the provider
 * writes for itself (`identifier: reset-password:<token>`, `value: <userId>`, `expiresAt`) — and
 * spent in the same request. It is a *different* token from the one in the link: the link's token
 * is hashed into `password_reset` and never stored raw, and this one exists only for the
 * milliseconds between the insert and the call, is never logged, never rendered and never placed
 * in a URL. A failed call deletes its row rather than leaving a live grant behind.
 *
 * **Why not call `/request-password-reset` and read the grant back?** Because that endpoint is
 * enabled on this deployment and would send Neon's own email with Neon's own wording
 * (measured: a 200, not the `RESET_PASSWORD_DISABLED` refusal the route raises when it is off,
 * which means the hosted server has a `sendResetPassword` callback configured). The card is
 * explicit that the message is this app's, sent through `lib/flow/email.ts`, and honest about
 * `RESEND_*` being unset. Minting the grant is the only way to have both that message and the
 * provider's hash.
 *
 * ## What a refusal means
 *
 * `refused` carries the provider's own code (`INVALID_TOKEN`, `USER_NOT_FOUND`,
 * `PASSWORD_TOO_SHORT`, …) for the server log only — a reader is told "could not set it", and the
 * form has already checked the password's length, so a `PASSWORD_TOO_SHORT` here is a bug rather
 * than something to explain to the person. `unreachable` is the transport: DNS, a timeout, a
 * refused connection. The caller un-spends the request on `unreachable` only, because that is the
 * case where trying again is the right advice.
 */
import { randomBytes } from "node:crypto";
import { getPool } from "@/lib/db/client";
import { AUTH_ENV_BASE_URL } from "@/lib/auth/config";
import { baseUrl } from "@/lib/flow/email";

/** How long a call may take. The auth server answers in milliseconds; a hung socket must not hold a page. */
const TIMEOUT_MS = 10_000;

/**
 * How long the minted grant would live if it were not spent immediately.
 *
 * Five minutes, not the hour the link gets: this row is written and consumed inside one request, so
 * its expiry only bounds the damage of a request that died between the two, and a shorter bound is
 * strictly better. It is not a value the person can be affected by — the grant is never shown to
 * them.
 */
const GRANT_TTL_MS = 5 * 60 * 1000;

/** The prefix the provider's own reset route reads. A constant because it is a wire format, not copy. */
const GRANT_IDENTIFIER_PREFIX = "reset-password:";

/** The auth origin, or `null` when this deployment has no auth configured. */
function authBaseUrl(): string | null {
  const value = process.env[AUTH_ENV_BASE_URL]?.trim();
  return value === undefined || value === "" ? null : value;
}

/**
 * The origin this app is served on — `NEXT_PUBLIC_BASE_URL`, the same value every link in the flow
 * is built from.
 *
 * `/reset-password` **does** carry an origin check on this deployment (measured: a call without one
 * answers `400 MISSING_ORIGIN`), unlike `/sign-in/social`'s explicit `originCheck`. The value the
 * auth server accepts is this app's own origin, which is on its trusted list because it is the
 * origin the browser already uses to reach `/api/auth` — so the deployment's `NEXT_PUBLIC_BASE_URL`
 * is the honest answer, and an unset or wrong one surfaces as a refusal in the log rather than as a
 * silent success.
 */
function appOrigin(): string {
  return baseUrl();
}

/** A password that was set, or why it was not. */
export type ProviderResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "unreachable" }
  | { readonly ok: false; readonly reason: "refused"; readonly code?: string };

/** The grant token for one call: 32 bytes of base64url, the same shape as every other token here. */
function mintGrant(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Write the grant the provider will read.
 *
 * Only three columns are set, and none of them has to be: the table defaults `id`, `createdAt` and
 * `updatedAt` (`gen_random_uuid()` and `CURRENT_TIMESTAMP`), which is why this insert is three
 * parameters rather than six. The row is in Neon's schema — the same narrow write
 * `lib/db/password-reset.ts` documents for sessions, and for the same reason: the app is not
 * allowed to own the hash, and this row is the provider's own currency for changing one.
 */
async function mintGrantFor(userId: string): Promise<string> {
  const token = mintGrant();
  await getPool().query(
    `INSERT INTO neon_auth.verification (identifier, value, "expiresAt")
     VALUES ($1, $2, now() + ($3::bigint || ' milliseconds')::interval)`,
    [`${GRANT_IDENTIFIER_PREFIX}${token}`, userId, GRANT_TTL_MS],
  );
  return token;
}

/** Remove a grant this call minted and could not spend, so nothing live is left behind. */
async function dropGrant(token: string): Promise<void> {
  await getPool().query(`DELETE FROM neon_auth.verification WHERE identifier = $1`, [
    `${GRANT_IDENTIFIER_PREFIX}${token}`,
  ]);
}

/** Read a JSON body defensively: a proxy's HTML error page is not a `SyntaxError` we want to surface. */
async function jsonOf(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await response.json();
    return body !== null && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Set `userId`'s password, through the provider, with a grant this call mints and spends.
 *
 * Never throws for a provider answer: a refusal, a timeout and a dead host are all return values,
 * because the caller has a page to render in every one of those states. A database failure while
 * minting the grant *does* throw — that is `DatabaseUnavailableError` from the pool and the caller
 * has no honest answer to invent for it.
 *
 * The `origin` header is the app's own (`appOrigin()`); the request is a server-to-server call
 * standing in for the page that posted it, and the auth server checks the origin because the write
 * it performs is as sensitive as a sign-in.
 */
export async function setPasswordViaProvider(
  userId: string,
  newPassword: string,
): Promise<ProviderResult> {
  const baseUrl = authBaseUrl();
  if (baseUrl === null) return { ok: false, reason: "unreachable" };

  const grant = await mintGrantFor(userId);

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/+$/, "")}/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: appOrigin() },
      body: JSON.stringify({ newPassword, token: grant }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.warn(
      "[reset] the auth server was unreachable — the password was not set and the link stays usable",
      // The transport's own name and code only: the request body carries the new password, and a
      // failed fetch's message can echo the URL.
      error instanceof Error ? error.name : "unknown",
    );
    await dropGrant(grant);
    return { ok: false, reason: "unreachable" };
  }

  if (response.ok) return { ok: true };

  const body = await jsonOf(response);
  const code = typeof body?.code === "string" ? body.code : undefined;
  // The status and the provider's code: enough for an operator to name the cause. Never the body,
  // which echoes the request, and never the password or the grant.
  console.error(
    `[reset] the auth server refused the password change (HTTP ${response.status})`,
    code,
  );
  await dropGrant(grant);
  return { ok: false, reason: "refused", code };
}
