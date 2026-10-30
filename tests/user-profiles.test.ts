/**
 * The identity model and its row mapping (issue #164), with a negative case for every way a row
 * can be wrong. No connection, no `DATABASE_URL`: the mapping is pure, which is what keeps the
 * gate database-free while the profile is still gated.
 */
import { describe, expect, it } from "vitest";

import {
  handleSuggestion,
  isOwner,
  isReservedHandle,
  publicProfileOf,
  zProfileFields,
  zUserProfile,
} from "@/content/identity";
import { type UserProfileRow, userProfileFromRow } from "@/lib/db/profile-rows";

const ROW: UserProfileRow = {
  user_id: "auth-user-1",
  handle: "ada-lovelace",
  display_name: "Ada Lovelace",
  bio: "Analyst, engines.",
  country: "United Kingdom",
  country_code: "gb",
  joined_at: new Date("2026-10-30T12:00:00.000Z"),
  updated_at: "2026-10-30T12:00:00.000Z",
};

describe("userProfileFromRow", () => {
  it("maps a row to the model, with TIMESTAMPTZ as the one UTC instant", () => {
    const profile = userProfileFromRow(ROW);
    expect(profile.userId).toBe("auth-user-1");
    expect(profile.joinedAt).toBe("2026-10-30T12:00:00.000Z");
    expect(profile.updatedAt).toBe("2026-10-30T12:00:00.000Z");
  });

  it("turns NULL into an omitted key, never an empty string", () => {
    const profile = userProfileFromRow({
      ...ROW,
      bio: null,
      country: null,
      country_code: null,
    });
    expect("bio" in profile).toBe(false);
    expect("country" in profile).toBe(false);
    expect("countryCode" in profile).toBe(false);
  });

  it("rejects a handle that is not a URL segment", () => {
    expect(() => userProfileFromRow({ ...ROW, handle: "Ada Lovelace" })).toThrow(/handle/);
    expect(() => userProfileFromRow({ ...ROW, handle: "ADA" })).toThrow(/handle/);
  });

  it("rejects a country with no alpha-2, and an alpha-2 with no country", () => {
    expect(() => userProfileFromRow({ ...ROW, country_code: null })).toThrow(/come together/);
    expect(() => userProfileFromRow({ ...ROW, country: null })).toThrow(/come together/);
    expect(() => userProfileFromRow({ ...ROW, country_code: "GB" })).toThrow(/alpha-2/);
  });

  it("rejects an empty display name", () => {
    expect(() => userProfileFromRow({ ...ROW, display_name: "   " })).toThrow(/displayName/);
  });
});

describe("zUserProfile", () => {
  const PROFILE = userProfileFromRow(ROW);

  it("is strict: an unknown key is drift, not a carried field", () => {
    expect(zUserProfile.safeParse({ ...PROFILE, role: "admin" }).success).toBe(false);
  });

  it("names the field that failed, not just 'invalid'", () => {
    const result = zUserProfile.safeParse({ ...PROFILE, bio: "" });
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error.issues[0]?.path.join(".")).toBe("bio");
  });
});

describe("publicProfileOf", () => {
  it("drops the auth user id — a stranger's view cannot carry the join key", () => {
    const publicProfile = publicProfileOf(userProfileFromRow(ROW));
    expect(publicProfile).not.toHaveProperty("userId");
    expect(publicProfile.handle).toBe("ada-lovelace");
    expect(publicProfile.displayName).toBe("Ada Lovelace");
  });
});

describe("isOwner", () => {
  const profile = userProfileFromRow(ROW);

  it("is true only for the same auth user", () => {
    expect(isOwner(profile, "auth-user-1")).toBe(true);
    expect(isOwner(profile, "auth-user-2")).toBe(false);
    expect(isOwner(profile, undefined)).toBe(false);
  });
});

describe("zProfileFields", () => {
  it("accepts the minimum a person must type", () => {
    expect(zProfileFields.safeParse({ handle: "ada-l", displayName: "Ada" }).success).toBe(true);
  });

  it("rejects a bio over 280 characters", () => {
    expect(
      zProfileFields.safeParse({ handle: "ada-l", displayName: "Ada", bio: "x".repeat(281) })
        .success,
    ).toBe(false);
  });

  it("rejects a 31-character handle and a 2-character one", () => {
    expect(zProfileFields.safeParse({ handle: "a".repeat(31), displayName: "Ada" }).success).toBe(
      false,
    );
    expect(zProfileFields.safeParse({ handle: "ab", displayName: "Ada" }).success).toBe(false);
  });
});

describe("handleSuggestion", () => {
  it("slugs a display name", () => {
    expect(handleSuggestion("Ada Lovelace")).toBe("ada-lovelace");
    expect(handleSuggestion("  Zoë   O'Brien ")).toBe("zoe-o-brien");
  });

  it("returns nothing rather than an invalid handle", () => {
    expect(handleSuggestion("李")).toBe("");
  });
});

describe("reserved handles", () => {
  it("keeps the profile namespace's own names out of the URL space", () => {
    expect(isReservedHandle("settings")).toBe(true);
    expect(isReservedHandle("SETTINGS ")).toBe(true);
    expect(isReservedHandle("ada-lovelace")).toBe(false);
  });
});
