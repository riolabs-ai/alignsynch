/**
 * Identity — the profile a signed-in person owns (issue #164).
 *
 * Why this module exists: the app had five surfaces that assumed a signed-in person and
 * none that had one. `/login` and `/register` were screens whose submit routed to `/`, and
 * `/settings`, `/profile/[username]` and `/dashboard/user` rendered fixtures — `lib/data/
 * users.ts` (a hand-written `User` interface) and `data/players.ts` (the leaderboard roster).
 * Those two stay where they are: they are *demo* people, and `content/people.ts` already
 * names them as the other identity namespaces. This module is the real one — the record a
 * person creates for themselves once Neon's Managed Auth has given them a user id.
 *
 * The split of authority, which is the whole design:
 *
 *   Neon Auth (`neon_auth`, managed)  email, password, session. The app never migrates it and
 *                                    cannot change email or password from the app.
 *   `user_profile` (this module)      what a person says about themselves in public — handle,
 *                                    display name, bio, country. One row per auth user id.
 *
 * So the profile carries no credentials. It carries one authorization fact, `role`, added by
 * #183 once "admin vs member" stopped being a decision nobody had made: the demo surface needs
 * a signed-in admin to mean something, and one named boolean is the whole of it. `role` is
 * **not** in `PROFILE_FIELDS` — the settings form is a person writing about themselves, and a
 * field it can set is a field they can promote themselves with.
 *
 * PUBLIC vs OWNER is `publicProfileOf()`, not a UI flag: strangers read the public projection,
 * the owner reads the row plus their session. Dropping `userId` in the projection is what makes
 * "the owner sees more" a property of the type rather than of a conditional in a component.
 *
 * Field notes:
 *
 *   handle        the URL identity (`/profile/<handle>`). Lowercase, so one person cannot
 *                 occupy two URLs that look like two people. The same rule `zId` enforces,
 *                 narrowed to what a URL can carry: 3–30 characters, no leading/trailing or
 *                 doubled hyphen.
 *   displayName   the words on the page. May change without breaking a link, which is why it
 *                 is not the identity.
 *   bio           one paragraph. Optional: absence is "not said", not an empty string — a
 *                 stored `""` renders a blank band, and the owner never chose to be blank.
 *   country + countryCode
 *                 the pair `content/people.ts::zPlayer` already models (the ISO-3166 display
 *                 name and the lowercase alpha-2 the flag is keyed by). Both or neither, the
 *                 same way `think` and `guess` come together in `zOpinions`: a flag with no
 *                 label, or a label with no flag, is half a field.
 *
 * Numbering: this is E32 in `docs/DATA-MODEL.md`'s additive set — the profile is the first
 * table in the tree that is not authored content (no fixture authors it) and the first whose
 * rows a person writes at runtime.
 */
import { z } from "zod";

import { zIsoDateTime } from "./core";

/* ------------------------------------------------------------------ *
 * Closed vocabularies and field shapes
 * ------------------------------------------------------------------ */

/**
 * A handle is a URL segment. Lowercase is not cosmetic: `/profile/AlexJohnson` and
 * `/profile/alexjohnson` would be two identities for one person, and a lookup that
 * lowercases on read (which this one does) would make the second unreachable.
 *
 * The pattern is `zId`'s, bounded: 3–30 characters, alphanumeric at both ends. Two- and
 * one-character handles are real people's initials, so the floor is 3 rather than 1 — a
 * single-character URL is indistinguishable from a route segment.
 */
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

export const zHandle = z
  .string()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/,
    "handle must be 3–30 lowercase letters, digits or single hyphens, starting and ending alphanumeric",
  );

/** The display name. Trimmed, so a name of spaces is not a name. */
export const DISPLAY_NAME_MAX = 60;
export const zDisplayName = z.string().trim().min(1).max(DISPLAY_NAME_MAX);

/** One paragraph. `280` is the profile's own budget, not a tweet length copied in. */
export const BIO_MAX = 280;
export const zBio = z.string().trim().min(1).max(BIO_MAX);

/** ISO-3166 display name, as `zPlayer.country` spells it (`United States`). */
export const zCountry = z.string().trim().min(1).max(60);

/** ISO-3166 alpha-2, lowercase (`us`) — the flag asset is keyed by it. */
export const zCountryCode = z
  .string()
  .regex(/^[a-z]{2}$/, "countryCode is lowercase ISO-3166 alpha-2 (us, ca, gb)");

/**
 * The auth user id. Deliberately not `zId`: it is Neon Auth's identifier (an opaque
 * alphanumeric string from the managed `neon_auth` schema), not a kebab-case id this repo
 * authors. Constraining its *shape* would be a promise about somebody else's identifier.
 */
export const zUserId = z.string().min(1).max(128);

/* ------------------------------------------------------------------ *
 * Role — one named boolean (#183)
 * ------------------------------------------------------------------ */

/**
 * The vocabulary, closed at two. Not a permission system: `admin` means "may reach the surfaces
 * `lib/auth/require-role.ts` gates", and `member` means everything else — there is no third
 * value, no rank order (a role is compared for equality, never for `>=`), and no per-resource
 * grant. A third role is a new decision, and it arrives with the pages that need it.
 */
export const USER_ROLES = ["member", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const zUserRole = z.enum(USER_ROLES);

/**
 * What a person is when nobody said otherwise — the same value the column's `DEFAULT` carries,
 * named here so a missing row and a defaulted row answer alike: no `user_profile` row is not a
 * reason to be an admin, and "the profile write does not mention role" is not either.
 */
export const DEFAULT_USER_ROLE: UserRole = "member";

/** Is this role allowed on a surface that requires `needed`? Equality, not a rank. */
export function roleAdmits(needed: UserRole, viewer: UserRole | null): boolean {
  return viewer !== null && viewer === needed;
}

/** Both country fields, or neither — the twin of `zOpinions`' think/guess refinement. */
export function countryPairProblem(value: {
  country?: string;
  countryCode?: string;
}): string | null {
  const hasCountry = value.country !== undefined;
  const hasCode = value.countryCode !== undefined;
  if (hasCountry === hasCode) return null;
  return hasCountry
    ? "country and countryCode come together: a country name with no alpha-2 has no flag"
    : "country and countryCode come together: an alpha-2 with no country name has no label";
}

/* ------------------------------------------------------------------ *
 * The profile
 * ------------------------------------------------------------------ */

/**
 * What a person can write about themselves. This is the settings form's payload and the
 * write path's parse — one shape, so the form and the route cannot disagree about what a
 * profile is. `strict()`: an unknown key is a drift, not a carried field.
 */
const PROFILE_FIELDS = {
  handle: zHandle,
  displayName: zDisplayName,
  bio: zBio.optional(),
  country: zCountry.optional(),
  countryCode: zCountryCode.optional(),
} as const;

export const zProfileFields = z
  .object(PROFILE_FIELDS)
  .strict()
  .superRefine((value, ctx) => {
    const problem = countryPairProblem(value);
    if (problem !== null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  });

export type ProfileFields = z.infer<typeof zProfileFields>;

/**
 * One row of `user_profile`: the fields a person writes, the auth user they belong to, and
 * the two instants the table owns. `joinedAt` is when the profile row was created, not when
 * the account was: the app cannot see the auth user's `createdAt` on every read, and a page
 * that claimed a join date it did not read would be a fixture again.
 */
export const zUserProfile = z
  .object({
    userId: zUserId,
    ...PROFILE_FIELDS,
    /**
     * The one authorization fact, and the one field here a person may not write. It is read
     * into the profile rather than passed beside it so that "who is this and what may they do"
     * is one row and one parse; `publicProfileOf()` drops it, exactly like `userId`, because a
     * stranger's view has no business knowing who is an admin.
     */
    role: zUserRole,
    joinedAt: zIsoDateTime,
    updatedAt: zIsoDateTime,
  })
  .strict()
  .superRefine((value, ctx) => {
    const problem = countryPairProblem(value);
    if (problem !== null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  });

export type UserProfile = z.infer<typeof zUserProfile>;

/**
 * What a stranger may see. `userId` is dropped on purpose — it is the join key to the auth
 * table, and a public page has no business carrying it. `role` is dropped for the same reason
 * and a sharper one: publishing "this account is an admin" tells an attacker which account to
 * go after, and no public page reads it. Everything else here is public by construction, so
 * "public fields" is a type rather than a list of props one view remembers not to pass.
 */
export const zPublicProfile = z
  .object({
    handle: zHandle,
    displayName: zDisplayName,
    bio: zBio.optional(),
    country: zCountry.optional(),
    countryCode: zCountryCode.optional(),
    joinedAt: zIsoDateTime,
    updatedAt: zIsoDateTime,
  })
  .strict();

export type PublicProfile = z.infer<typeof zPublicProfile>;

/** The public projection of one profile — the only way a stranger's view is built. */
export function publicProfileOf(profile: UserProfile): PublicProfile {
  return zPublicProfile.parse({
    handle: profile.handle,
    displayName: profile.displayName,
    ...(profile.bio === undefined ? {} : { bio: profile.bio }),
    ...(profile.country === undefined ? {} : { country: profile.country }),
    ...(profile.countryCode === undefined ? {} : { countryCode: profile.countryCode }),
    joinedAt: profile.joinedAt,
    updatedAt: profile.updatedAt,
  });
}

/**
 * Does this profile belong to the person looking? The one comparison the owner's extra
 * affordances hang off, kept here so `/settings` and `/profile/[username]` cannot answer it
 * differently.
 */
export function isOwner(profile: UserProfile, userId: string | undefined): boolean {
  return userId !== undefined && profile.userId === userId;
}

/**
 * A handle derived from a display name, for the moment a person has not chosen one yet.
 *
 * Not a random suffix: the server returns `handle-taken` and the form asks, rather than
 * silently minting `alex-johnson-2` — a handle is an identity, and a person who did not pick
 * it has not been told what their URL is.
 */
export function handleSuggestion(displayName: string): string {
  const slug = displayName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, HANDLE_MAX)
    .replace(/-+$/g, "");
  return zHandle.safeParse(slug).success ? slug : "";
}

/**
 * A handle that is also a route segment of its own would shadow the app. `/profile/<handle>`
 * is safe by construction (the handle is one segment under `/profile`), so the reserved list
 * is the *profile* namespace's, not the app's: these words would be a second `/profile` page.
 */
export const RESERVED_HANDLES = ["settings", "login", "register", "dashboard", "profile"] as const;

/** Is this handle free of the profile namespace's own names? */
export function isReservedHandle(handle: string): boolean {
  return (RESERVED_HANDLES as readonly string[]).includes(handle.trim().toLowerCase());
}
