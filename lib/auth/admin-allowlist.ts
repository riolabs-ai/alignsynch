/**
 * The admin allowlist — grant `admin` at sign-in when the verified email is in `ADMIN_EMAILS`.
 *
 * The rule this module exists for: **on sign-in, if the verified email is in the allowlist, the
 * profile is upserted as `admin`.** "Verified" means the email the identity provider returned in
 * the session — `lib/auth/session.ts` reads it from `getSession()`, never from a form field, a
 * request body or a query string. The value this module compares is that session email, so there
 * is no path where an address a person typed into a form can promote them.
 *
 * Three properties that make the grant safe to run on every session resolution:
 *
 *   - **It is the only writer that can promote here, and it only promotes.** The one upsert sets
 *     `role = 'admin'`, and its `ON CONFLICT` clause refuses to run for a row that is already
 *     `admin` (`WHERE user_profile.role <> 'admin'`); no statement anywhere in this module can
 *     write `member`. Removing an address from the allowlist therefore cannot demote — the grant is
 *     a one-way door, and demotion is a deliberate, separate action (today that is
 *     `scripts/db-seed.mjs`, the only other `role` writer).
 *   - **It is idempotent and cheap for everyone else.** The allowlist is parsed first and the
 *     address matched before any database work, so a member who is not on the list costs nothing;
 *     an admin already `admin` costs one no-op statement and no log line.
 *   - **A failed grant fails closed.** A database that cannot be read or written is logged and
 *     swallowed, so a transient outage leaves the role as it was (a member stays a member) rather
 *     than taking the page down. The *check* path (`lib/auth/require-role.ts`) is the one that
 *     must stay loud; the *grant* path is best-effort by design.
 *
 * **Brand-gated.** The allowlist is an AlignSynch admin concern — the quiz product's build must
 * not promote anyone from it. The gate is `allowlistApplies(template)`, decided against
 * `lib/flags.ts::currentTemplate()`, so only `BRAND=alignsynch` reaches the database; `quizhub`
 * (the default) and any future template return before the allowlist is even parsed. The brand is a
 * build-time constant, never a value a request or a browser can set.
 *
 * Server-only by construction (it reaches `pg` through `@/lib/db/client`) and by the module-scope
 * guard below, the same marker `lib/auth/require-role.ts` carries. `ADMIN_EMAILS` is read here and
 * nowhere else, and never rendered: it is not in `next.config.mjs`'s `env` block, so it cannot be
 * inlined into a client bundle.
 */
import { DISPLAY_NAME_MAX, HANDLE_MAX, isReservedHandle, zHandle } from "@/content/identity";
import { getPool } from "@/lib/db/client";
import { currentTemplate } from "@/lib/flags";

/** The environment variable. Server-only — never a `NEXT_PUBLIC_` name, never in an `env` block. */
export const ADMIN_EMAILS_ENV = "ADMIN_EMAILS";

/** The one template whose build grants admin from the allowlist. The quiz product never does. */
export const ADMIN_ALLOWLIST_TEMPLATE = "alignsynch";

/** A mistaken client import fails loudly, like `lib/auth/require-role.ts`. */
if (typeof window !== "undefined") {
  throw new Error(
    "lib/auth/admin-allowlist.ts is server-only: it reads the session's email and writes user_profile. Call it from a page, a server action or a route handler.",
  );
}

/* ------------------------------------------------------------------ *
 * The policy, as pure functions a test can drive with no env and no db
 * ------------------------------------------------------------------ */

/**
 * `ADMIN_EMAILS` → a set of addresses. Comma-separated, each entry trimmed and lowercased, empty
 * entries dropped, so " Alice@X.com , bob@x.com ,, " reads as {alice@x.com, bob@x.com}. An unset
 * or blank variable is an empty set — the feature then does nothing, and no error is raised.
 */
export function adminAllowlistOf(raw: string | undefined): ReadonlySet<string> {
  if (raw === undefined) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry !== ""),
  );
}

/** Is this address on the list? Case-insensitive, trimmed — the same shape the list stores. */
export function isAdminAllowlisted(email: string, allowlist: ReadonlySet<string>): boolean {
  return allowlist.has(email.trim().toLowerCase());
}

/** Does the allowlist apply on this template at all? `alignsynch` only — the brand gate. */
export function allowlistApplies(template: string): boolean {
  return template === ADMIN_ALLOWLIST_TEMPLATE;
}

/** `alice@x.com` → `alice`; a string with no `@` returns itself, lowercased and trimmed. */
function localPartOf(email: string): string {
  const at = email.indexOf("@");
  return (at > 0 ? email.slice(0, at) : email).trim().toLowerCase();
}

/** Lowercase, non-alphanumeric runs collapse to one hyphen, leading/trailing hyphens dropped. */
function slugOf(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Is this a handle the model accepts and the profile namespace does not reserve? */
function isUsableHandle(candidate: string): boolean {
  return zHandle.safeParse(candidate).success && !isReservedHandle(candidate);
}

/**
 * A handle for the profile the grant creates when the person has none yet.
 *
 * The email's local part is preferred — it is the identity an operator recognises on
 * `/profile/<handle>`. When it does not survive `zHandle`'s shape (a dot, too short, a reserved
 * word), the fallback is a slug of the auth user id, which is unique because the id is. The last
 * resort is `admin-<id fragment>`, which is always a valid, non-reserved handle. The person can
 * change any of these in `/settings`; this is the "first save" name, not a promise about their URL.
 */
export function adminProfileHandle(email: string, userId: string): string {
  const candidates = [slugOf(localPartOf(email)), slugOf(userId)];
  for (const candidate of candidates) {
    if (candidate === "") continue;
    const trimmed = candidate.slice(0, HANDLE_MAX).replace(/-+$/g, "");
    if (isUsableHandle(trimmed)) return trimmed;
  }
  const fragment = slugOf(userId).slice(0, HANDLE_MAX - "admin-".length) || "user";
  return `admin-${fragment}`;
}

/**
 * The display name the grant writes when there is no profile yet: the provider's name when it has
 * one, else the email's local part, else `Admin`. Bounded to the model's `DISPLAY_NAME_MAX`.
 */
export function adminProfileDisplayName(name: string, email: string): string {
  const fromName = name.trim();
  if (fromName !== "") return fromName.slice(0, DISPLAY_NAME_MAX);
  const local = localPartOf(email);
  if (local !== "") return local.slice(0, DISPLAY_NAME_MAX);
  return "Admin";
}

/* ------------------------------------------------------------------ *
 * The grant
 * ------------------------------------------------------------------ */

/** Postgres' unique-violation code — a handle another profile already owns. */
const UNIQUE_VIOLATION = "23505";

/**
 * One atomic statement: create the row as `admin`, or promote an existing row — and return the
 * row **only when this call is the one that made the change**.
 *
 * The `ON CONFLICT … DO UPDATE … WHERE user_profile.role <> 'admin'` is the whole
 * "never demote" rule as SQL: a row that is already `admin` fails the `WHERE`, so the conflict
 * clause is a no-op and `RETURNING` answers nothing. A row that is `member` is promoted; a missing
 * row is inserted. Because the statement is atomic, two concurrent resolutions of the same fresh
 * sign-in cannot both claim the transition — one returns the row and logs, the other returns
 * nothing — which is what keeps the grant line to a single line per grant.
 */
const GRANT_SQL = `
  INSERT INTO user_profile (user_id, handle, display_name, role)
  VALUES ($1, $2, $3, 'admin')
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'admin', updated_at = now()
    WHERE user_profile.role <> 'admin'
  RETURNING user_id`;

/** Run the grant. `true` means this call created or promoted the row; `false` means it was already admin. */
async function grantOnce(userId: string, handle: string, displayName: string): Promise<boolean> {
  const result = await getPool().query(GRANT_SQL, [userId, handle, displayName]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * The one place a session's user can be promoted.
 *
 * Called from `lib/auth/session.ts::currentUser()`, the single point the tree resolves a signed-in
 * person after OAuth, so every sign-in path (Google OAuth, password, the demo role buttons) reaches
 * this one function. It returns having done nothing, or having granted once; it never demotes.
 */
export async function grantAdminIfAllowlisted(user: {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
}): Promise<void> {
  if (!allowlistApplies(currentTemplate())) return;

  const allowlist = adminAllowlistOf(process.env[ADMIN_EMAILS_ENV]);
  if (!isAdminAllowlisted(user.email, allowlist)) return;

  const displayName = adminProfileDisplayName(user.name, user.email);
  try {
    if (await grantOnce(user.userId, adminProfileHandle(user.email, user.userId), displayName)) {
      // The one line this module emits, spelled exactly as the card requires — no token, no session id.
      console.info(`admin granted to ${user.email} via allowlist`);
    }
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      // The email-derived handle is someone else's URL. The user id is unique, so a slug of it
      // cannot collide the same way; retry once with it.
      try {
        if (await grantOnce(user.userId, adminProfileHandle("", user.userId), displayName)) {
          console.info(`admin granted to ${user.email} via allowlist`);
        }
      } catch (retryError) {
        // A failed grant fails closed: the role stays what it was, and the next resolution retries.
        console.error(
          "admin-allowlist: the grant could not be written — the profile is unchanged",
          retryError,
        );
      }
    } else {
      // A failed grant fails closed: the role stays what it was, and the next resolution retries.
      console.error(
        "admin-allowlist: the grant could not be written — the profile is unchanged",
        error,
      );
    }
  }
}
