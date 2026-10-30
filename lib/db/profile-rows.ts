/**
 * The profile row → `content/identity.ts`, and nothing else (issue #164).
 *
 * The read boundary for the one `public` table the app writes: plain objects in, `zUserProfile`
 * out. Pure — no `pg`, no `process.env`, no clock — so `tests/user-profiles.test.ts` runs it
 * with no `DATABASE_URL` set, which is the same proof `lib/db/rows.ts` carries for the
 * assessment reads: the gate stays database-free while the mapping is still gated.
 *
 * `NULL` is absence, never `""`. The schema forbids an empty `bio` on purpose (a blank band the
 * owner never chose), so a `NULL` column becomes an *omitted* key here rather than a field with
 * an empty string in it — the same conversion `zProfileFields` performs in the other direction.
 */
import { zUserProfile, type UserProfile } from "@/content/identity";
import { isoInstantOf, parseOrThrow } from "./rows";

/** One `user_profile` row, named after its columns. */
export interface UserProfileRow {
  readonly user_id: string;
  readonly handle: string;
  readonly display_name: string;
  readonly bio: string | null;
  readonly country: string | null;
  readonly country_code: string | null;
  /** `TIMESTAMPTZ`, so `pg` hands back a `Date`; a string is accepted for script-shaped rows. */
  readonly joined_at: Date | string;
  readonly updated_at: Date | string;
}

/**
 * One row → `zUserProfile`. A row the model rejects throws, naming the field: a profile that is
 * half-valid would render a page nobody can explain, and the model is the only thing that
 * decides what a profile is.
 */
export function userProfileFromRow(row: UserProfileRow): UserProfile {
  return parseOrThrow(
    zUserProfile,
    {
      userId: row.user_id,
      handle: row.handle,
      displayName: row.display_name,
      ...(row.bio === null ? {} : { bio: row.bio }),
      ...(row.country === null ? {} : { country: row.country }),
      ...(row.country_code === null ? {} : { countryCode: row.country_code }),
      joinedAt: isoInstantOf(row.joined_at),
      updatedAt: isoInstantOf(row.updated_at),
    },
    `user_profile row for "${row.handle}"`,
  );
}
