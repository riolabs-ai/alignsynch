/**
 * `enabledForCaller` (#184) — the one question a gated route asks, and the order it asks it in.
 *
 * Three claims, and the third is the one that would rot quietly:
 *
 *   1. a flag that is on by its own precedence answers without a session — the role is not read,
 *      so a surface everyone may see costs no auth round trip and no Postgres read;
 *   2. a flag that did **not** opt in never reads the role either: it is off, and "off" is not a
 *      question the session can change;
 *   3. only an `adminBypass` flag consults the session, and only an `admin` turns it on.
 *
 * `currentRole()` is a stub here, exactly as `tests/require-role.test.ts` stubs the session and
 * the profile read: the real one reaches Neon Auth and Postgres, and neither is a fact about this
 * composition. What the stub *returns* is the whole input, so a member, a signed-out visitor and
 * an admin are three lines rather than three databases.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { enabledForCaller } from "@/lib/auth/flag-gate";

const { currentRole } = vi.hoisted(() => ({
  currentRole: vi.fn(async (): Promise<unknown> => null),
}));

vi.mock("@/lib/auth/require-role", () => ({ currentRole }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  currentRole.mockResolvedValue(null);
});

describe("enabledForCaller", () => {
  it("answers from the flag alone when the flag is on, without reading the session", async () => {
    vi.stubEnv("FLAG_COMMUNITY_LEADERBOARD", "1");

    expect(await enabledForCaller("community.leaderboard")).toBe(true);
    expect(currentRole).not.toHaveBeenCalled();
  });

  it("never reads the session for a flag that did not opt in to the bypass", async () => {
    // `community.tournaments` is off and has no `adminBypass`: an admin role could not change it,
    // so asking for one would be a read with no possible effect on the answer.
    currentRole.mockResolvedValue("admin");

    expect(await enabledForCaller("community.tournaments")).toBe(false);
    expect(currentRole).not.toHaveBeenCalled();
  });

  it("lets an admin through a flag that opted in — while the flag is off for everyone else", async () => {
    currentRole.mockResolvedValue("admin");

    // The record is unchanged: `community.leaderboard` still defaults to false.
    expect(await enabledForCaller("community.leaderboard")).toBe(true);
    expect(currentRole).toHaveBeenCalledTimes(1);
  });

  it("refuses a member and a signed-out visitor with the same answer", async () => {
    for (const role of ["member", null] as const) {
      currentRole.mockClear();
      currentRole.mockResolvedValue(role);

      expect(await enabledForCaller("community.leaderboard"), String(role)).toBe(false);
      expect(currentRole).toHaveBeenCalledTimes(1);
    }
  });

  it("does not let the environment take the bypass away from an admin", async () => {
    vi.stubEnv("FLAG_COMMUNITY_LEADERBOARD", "0");
    currentRole.mockResolvedValue("admin");

    expect(await enabledForCaller("community.leaderboard")).toBe(true);

    // …and does not invent one for a member.
    currentRole.mockResolvedValue("member");
    expect(await enabledForCaller("community.leaderboard")).toBe(false);
  });
});
