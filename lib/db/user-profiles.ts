/**
 * The profile read/write path — `user_profile` against the model (issue #164).
 *
 * Three statements: read one row by handle (the public lookup `/profile/<handle>` performs),
 * read one row by auth user id (what `/settings` edits), and upsert the signed-in person's row.
 * Nothing here decides who may write — that is `lib/auth/session.ts` plus the one route handler
 * — so this module has no idea a session exists. The caller passes the `userId` it has already
 * resolved.
 *
 * Why an upsert rather than a create: a person who signed up before this card existed has an
 * auth user and no profile row, and the settings form is how they get one. One statement means
 * "save my settings" cannot half-succeed on a first save.
 *
 * No `server-only` marker: this repo has no such package (adding one would be a dependency),
 * and `lib/db/client.ts`'s comment records the same construction — the module is reachable only
 * from server components, server actions and route handlers, and it reads `DATABASE_URL`, which
 * is in no `next.config.mjs` `env` block.
 */
import { type ProfileFields, type UserProfile, zProfileFields } from "@/content/identity";
import { queryRows } from "@/lib/db/client";
import { type UserProfileRow, userProfileFromRow } from "@/lib/db/profile-rows";

/** Every column the model needs, in the order `userProfileFromRow` reads them. */
const COLUMNS =
  "user_id, handle, display_name, bio, country, country_code, role, joined_at, updated_at";

/** `/profile/<handle>` — `null` when nobody answers to it, because absence is not an error. */
export async function readUserProfileByHandle(handle: string): Promise<UserProfile | null> {
  const rows = await queryRows<UserProfileRow>(
    `SELECT ${COLUMNS} FROM user_profile WHERE handle = $1`,
    [handle.trim().toLowerCase()],
  );
  return rows[0] === undefined ? null : userProfileFromRow(rows[0]);
}

/** `/settings` — the signed-in person's own row, before they have ever saved one (`null`). */
export async function readUserProfileByUserId(userId: string): Promise<UserProfile | null> {
  const rows = await queryRows<UserProfileRow>(
    `SELECT ${COLUMNS} FROM user_profile WHERE user_id = $1`,
    [userId],
  );
  return rows[0] === undefined ? null : userProfileFromRow(rows[0]);
}

/**
 * What a write can answer. `handle-taken` is a *user* error the form must show on the field, not
 * a 500: the handle is a URL identity and two people cannot share one.
 *
 * `invalid` carries the model's own message so the form can put it where the person is looking —
 * the schema is the only thing that decides what a profile is, so a field the form did not
 * validate is still rejected here with the reason the schema gives.
 */
export type ProfileWriteOutcome =
  | { readonly ok: true; readonly profile: UserProfile }
  | {
      readonly ok: false;
      readonly reason: "invalid" | "handle-taken" | "unavailable";
      readonly message: string;
    };

/** Postgres' unique-violation code. Named rather than explained at the catch site. */
const UNIQUE_VIOLATION = "23505";

/**
 * Save (or first-time create) one person's profile.
 *
 * The `ON CONFLICT (user_id)` clause is the "first save" path; a handle that belongs to somebody
 * else is *not* an upsert target, so Postgres raises the unique violation and this returns
 * `handle-taken`. The alternative — read-then-write — would leave a window where two people
 * choosing the same handle both pass the read.
 *
 * **It never writes `role`.** The INSERT names no role, so a first save lands on the column's
 * `DEFAULT 'member'`, and the UPDATE clause does not mention it, so a later save cannot change
 * it in either direction. That is #183's rule as a property of the statement: the settings form
 * is a person writing about themselves, and a column the form's write path cannot name is not
 * one it can escalate with.
 */
export async function writeUserProfile(
  userId: string,
  fields: unknown,
): Promise<ProfileWriteOutcome> {
  const parsed = zProfileFields.safeParse(fields);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, reason: "invalid", message };
  }
  const profile: ProfileFields = parsed.data;

  try {
    const rows = await queryRows<UserProfileRow>(
      `INSERT INTO user_profile (user_id, handle, display_name, bio, country, country_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         handle       = EXCLUDED.handle,
         display_name = EXCLUDED.display_name,
         bio          = EXCLUDED.bio,
         country      = EXCLUDED.country,
         country_code = EXCLUDED.country_code,
         updated_at   = now()
       RETURNING ${COLUMNS}`,
      [
        userId,
        profile.handle,
        profile.displayName,
        profile.bio ?? null,
        profile.country ?? null,
        profile.countryCode ?? null,
      ],
    );
    return { ok: true, profile: userProfileFromRow(rows[0]) };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === UNIQUE_VIOLATION) {
      return {
        ok: false,
        reason: "handle-taken",
        message: `the handle "${profile.handle}" is already someone else's URL`,
      };
    }
    throw error;
  }
}
