/**
 * The account a two-field claim binds its seat to (#1115 task 4).
 *
 * The counterparty is asked for a name and an address and nothing else — no password, no card, no
 * plan (issue #1115, US-2: *"an invitation link … requires at most two fields before the
 * counterparty can begin answering"*). That leaves this module one question: **which account does
 * the address name?** It answers in the only two ways the auth provider allows:
 *
 *   the address has an account   return its id. Nothing is created, nothing is signed in — the
 *                                person already has credentials and will use them.
 *   the address has none        create one through the branch's own `sign-up/email` endpoint, the
 *                                same call `scripts/db-seed.mjs` makes, and return the session
 *                                cookies it sets. No password is asked of the person; the one the
 *                                account is created with is generated here and never shown,
 *                                printed or stored, and a later "forgot password" on `/login` is
 *                                how they set a real one.
 *
 * **Why an HTTP sign-up and not a row.** Users live in Neon's Managed Auth (`neon_auth`), which
 * this app does not migrate and must not write directly: Better Auth owns the hash, the `account`
 * row and the session. `db:seed` learned the same thing — a sign-up is an HTTP request, and it
 * cannot see an uncommitted transaction — which is why this runs **before** the claim's
 * transaction and never inside it. The claim's own writes stay one transaction; the account is the
 * one fact about the person that cannot join it.
 *
 * **Every failure is a smaller claim, never a 500.** No `NEON_AUTH_BASE_URL` (a gate tree, a
 * preview), an unreachable auth host, a provider refusal this module does not name: each is logged
 * and answered `userId: null`. The seat still binds to the browser's cookie — which is what a
 * signed-out claim has always done — and the person can answer. An error here must not cost someone
 * the invitation they were sent.
 *
 * Server-only by construction: it reads `process.env` and `pg`. Nothing that renders may import it
 * (E34's client-graph rule).
 */
import { randomBytes } from "node:crypto";
import { claimEmailOf } from "@/lib/flow/claim";
import { getPool } from "@/lib/db/client";

/** What a claim learned about the address: the account, and a session when one was just created. */
export interface ClaimAccount {
  /** The account the seat should bind to, or `null` when none could be resolved. */
  readonly userId: string | null;
  /**
   * `Set-Cookie` values from the sign-up, when this call created the account: relaying them is what
   * lands the new person signed in on the dashboard. Empty when an existing account was found —
   * this module never signs anybody in.
   */
  readonly setCookies: readonly string[];
  /** `true` when this call created the account. Provenance for the caller's log line, not a rule. */
  readonly created: boolean;
}

const NO_ACCOUNT: ClaimAccount = { userId: null, setCookies: [], created: false };

/** The auth server's base URL, or `null` when this tree has none (the gate, a bare preview). */
function authBaseUrl(): string | null {
  const value = process.env.NEON_AUTH_BASE_URL?.trim();
  return value === undefined || value === "" ? null : value.replace(/\/+$/, "");
}

/** The table Neon's Managed Auth keeps its users in — `user`, or `users` on an older branch. */
async function usersTable(): Promise<string | null> {
  const { rows } = await getPool().query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'neon_auth' AND table_name IN ('user', 'users')`,
  );
  const names = rows.map((row) => row.table_name);
  return names.includes("user") ? "user" : names.includes("users") ? "users" : null;
}

/**
 * The account an address already names, or `null`.
 *
 * A read of the auth schema, never a write: the id is the only fact the claim needs, and going
 * through Better Auth's own API for it would need an admin credential this app does not hold. The
 * lookup is case-insensitive because addresses are, and it answers `null` on any failure — an
 * unreadable auth schema is "no account found", which the caller answers by creating one.
 */
async function accountIdForEmail(email: string): Promise<string | null> {
  try {
    const table = await usersTable();
    if (table === null) return null;
    const { rows } = await getPool().query<{ id: string }>(
      `SELECT id::text AS id FROM neon_auth."${table}" WHERE lower(email) = $1 LIMIT 1`,
      [email],
    );
    return rows[0]?.id ?? null;
  } catch (error) {
    console.warn(
      "[claim] the account lookup could not read the auth schema — the seat binds without one",
      error instanceof Error ? error.name : "unknown",
    );
    return null;
  }
}

/** 24 random bytes, base64url — the account's password, which no person is ever shown. */
function generatedPassword(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Resolve the account a claim's address names, creating one when it names none.
 *
 * `name` is the seat's name — the words the inviter typed, or the claimer's own if the form posted
 * them — because an account with no display name reads as an address in every console that lists
 * it. `origin` is the app's own origin: Better Auth refuses a server-side sign-up that carries no
 * `Origin` header (the seed learned it, `scripts/db-seed.mjs`), and a mismatch is a CSRF refusal.
 */
export async function resolveClaimAccount(input: {
  readonly email: string | null | undefined;
  readonly name?: string | null;
  readonly origin?: string | null;
}): Promise<ClaimAccount> {
  const email = claimEmailOf(input.email);
  if (email === null) return NO_ACCOUNT;

  const existing = await accountIdForEmail(email);
  if (existing !== null) return { userId: existing, setCookies: [], created: false };

  const base = authBaseUrl();
  if (base === null) return NO_ACCOUNT;

  const name = (input.name ?? "").trim();
  const origin = (input.origin ?? "").trim();
  try {
    const response = await fetch(`${base}/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(origin === "" ? {} : { origin }),
      },
      body: JSON.stringify({
        email,
        password: generatedPassword(),
        name: name === "" ? email : name,
      }),
    });

    if (!response.ok) {
      // `USER_ALREADY_EXISTS` is the one refusal that has an answer: somebody created the account
      // between the lookup above and this call. Re-read rather than fail the claim.
      const raced = await accountIdForEmail(email);
      if (raced !== null) return { userId: raced, setCookies: [], created: false };
      console.warn(
        `[claim] the auth server refused a sign-up (HTTP ${response.status}) — the seat binds without an account`,
      );
      return NO_ACCOUNT;
    }

    const body = (await response.json().catch(() => ({}))) as { user?: { id?: unknown } };
    const userId = typeof body.user?.id === "string" ? body.user.id : null;
    if (userId === null) {
      console.warn("[claim] the auth server answered a sign-up with no user id");
      return NO_ACCOUNT;
    }
    return { userId, setCookies: response.headers.getSetCookie(), created: true };
  } catch (error) {
    console.warn(
      "[claim] the auth server could not be reached — the seat binds without an account",
      error instanceof Error ? error.name : "unknown",
    );
    return NO_ACCOUNT;
  }
}
