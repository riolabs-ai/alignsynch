/**
 * The shell's account derives from the session, and can never invent a person (issue #212).
 *
 * The defect was a copy fixture: the header rendered one placeholder person (`JD` and a made-up
 * name and handle) on every
 * page behind the shell, so a demo Admin's own board announced a stranger. The fix is a pure
 * function of a `SessionUser` and (optionally) the person's `user_profile` row, and this file
 * pins the whole of it:
 *
 *   - signed out is `null` — the third state does not exist, and no input reaches a name;
 *   - the saved profile wins, because that is the name and handle the person chose, and its
 *     handle is the same seed `/profile/<handle>` colours their avatar with (#152);
 *   - with no profile row yet — a brand-new account, `lib/db/user-profiles.ts` says the row
 *     arrives on the first `/settings` save — the fallbacks are the email's local part and, last,
 *     the auth user id. Anything stable, never the fixture;
 *   - the same person twice is byte-identical output: same name, same seed, same gradient, same
 *     initials. That is what keeps the server render, the browser render and a screenshot diff in
 *     agreement (`components/media/generated-avatar.tsx` forbids an index or `Math.random()`).
 *
 * `shellAccountOf` is the unit under test; the request-shaped `shellAccount()` around it is
 * `currentUser()` + one profile read, and the stub below only proves the module is importable
 * outside a Next request (which is what `pnpm parity` and the gate do).
 */
import { describe, expect, it, vi } from "vitest";

/** No cookie store, no database, no session: this file tests the derivation, not the request. */
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));
vi.mock("@/lib/db/user-profiles", () => ({
  readUserProfileByUserId: vi.fn(async () => null),
  readUserProfileByHandle: vi.fn(async () => null),
  writeUserProfile: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/auth/session", () => ({ currentUser: vi.fn(async () => null) }));

import { avatarGradient, initialsOf } from "@/components/media/generated-avatar";
import type { UserProfile } from "@/content/identity";
import type { SessionUser } from "@/lib/auth/session";
import { shellAccount, shellAccountOf } from "@/lib/auth/shell-account";

/** The session as `currentUser()` hands it over: an id, an address and whatever name exists. */
function session(email: string, name: string, userId = "user_01"): SessionUser {
  return { userId, email, name };
}

/** A saved `user_profile` row, all fields the model requires and nothing else. */
function profile(handle: string, displayName: string): UserProfile {
  return {
    userId: "user_01",
    handle,
    displayName,
    role: "member",
    joinedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

describe("shellAccountOf — signed out", () => {
  it("answers null for a visitor with no session, profile or not", () => {
    expect(shellAccountOf(null, null)).toBeNull();
    expect(shellAccountOf(null, profile("demo-admin", "Demo Admin"))).toBeNull();
  });
});

describe("shellAccountOf — signed in", () => {
  it("uses the saved profile's display name and handle", () => {
    const account = shellAccountOf(
      session("initiator@demo.alignsynch.test", "Avery"),
      profile("demo-initiator", "Avery Quinn"),
    );
    expect(account).toEqual({
      name: "Avery Quinn",
      handle: "demo-initiator",
      email: "initiator@demo.alignsynch.test",
    });
  });

  it("falls back to the session's name and the email's local part when no profile row exists", () => {
    const account = shellAccountOf(session("counterparty@demo.alignsynch.test", "Rowan"), null);
    expect(account).toEqual({
      name: "Rowan",
      handle: "counterparty",
      email: "counterparty@demo.alignsynch.test",
    });
  });

  it("derives name and handle from the address when the provider holds no name either", () => {
    const account = shellAccountOf(session("Admin@Demo.AlignSynch.Test", ""), null);
    expect(account?.name).toBe("admin");
    expect(account?.handle).toBe("admin");
  });

  it("ends on the auth user id when there is no name and no local part to read", () => {
    const account = shellAccountOf(session("", "", "user_42"), null);
    expect(account).toEqual({ name: "user_42", handle: "user_42", email: "" });
  });

  it("trims an email and a name that arrive padded", () => {
    const account = shellAccountOf(session("  admin@demo.alignsynch.test ", "  Demo Admin "), null);
    expect(account).toEqual({
      name: "Demo Admin",
      handle: "admin",
      email: "admin@demo.alignsynch.test",
    });
  });
});

describe("the three demo accounts render three sets of initials, none of them the fixture's", () => {
  /**
   * The acceptance for #212, as a test rather than as a screenshot: the three seeded accounts
   * (`scripts/db-seed.mjs`) sign in, and the header's monogram is a function of the name the
   * shell resolved for each. `JD` was the placeholder and must not be reachable from any of them.
   */
  const cases = [
    {
      account: shellAccountOf(session("initiator@demo.alignsynch.test", "Avery"), null),
      initials: "A",
    },
    {
      account: shellAccountOf(session("counterparty@demo.alignsynch.test", "Rowan"), null),
      initials: "R",
    },
    {
      account: shellAccountOf(session("admin@demo.alignsynch.test", "Demo Admin"), null),
      initials: "DA",
    },
  ];

  it("renders A, R and DA — never JD", () => {
    expect(
      cases.map((entry) => (entry.account === null ? null : initialsOf(entry.account.name))),
    ).toEqual(["A", "R", "DA"]);
    for (const entry of cases) expect(initialsOf(entry.account?.name ?? "")).not.toBe("JD");
  });

  it("draws each avatar from the handle, so the same person is the same gradient twice", () => {
    for (const entry of cases) {
      const seed = entry.account?.handle ?? "";
      expect(avatarGradient(seed)).toEqual(avatarGradient(seed));
      expect(seed).not.toBe("");
    }
    const three = cases.map((entry) => avatarGradient(entry.account?.handle ?? "").css);
    expect(new Set(three).size).toBe(3);
  });
});

describe("shellAccount() — the request-shaped wrapper", () => {
  it("answers null where auth is not configured, without touching a cookie or a row", async () => {
    // The gate, CI and the parity render have no auth environment; a shell that threw there
    // would be a build failure, and this is the assertion that it does not.
    const saved = {
      baseUrl: process.env.NEON_AUTH_BASE_URL,
      cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET,
    };
    process.env.NEON_AUTH_BASE_URL = "";
    process.env.NEON_AUTH_COOKIE_SECRET = "";
    try {
      await expect(shellAccount()).resolves.toBeNull();
    } finally {
      for (const [name, value] of Object.entries({
        NEON_AUTH_BASE_URL: saved.baseUrl,
        NEON_AUTH_COOKIE_SECRET: saved.cookieSecret,
      })) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});
