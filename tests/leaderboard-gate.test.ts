/**
 * `/leaderboard` — the one surface that proves the bypass end to end (#184).
 *
 * The page is a function, so the acceptance can be driven without a server: the gate answers
 * first, and `notFound()` throws before anything is projected. That is the claim worth pinning,
 * and it is pinned by the spy: a member and a signed-out visitor must reach the 404 with
 * `leaderboardEntries` never called, because "the HTML is a 404" and "no data was read" are two
 * different promises and only the second one is about the gate.
 *
 * The second block is about the *input*. A role is only ever the one `enabledForCaller` resolved
 * from the session, so the page must not touch a header, a cookie or a search param — asserted
 * against the source with the comments stripped first, because these modules explain at length
 * that they read none of those, and an assertion that matched its own documentation would fail
 * on the explanation rather than on a regression.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFound, enabledForCaller, leaderboardEntries, LeaderboardPage } = vi.hoisted(() => ({
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  enabledForCaller: vi.fn(async (_name: string): Promise<boolean> => false),
  leaderboardEntries: vi.fn((scope: string, limit?: number) => ({
    scope,
    limit,
    entries: [],
  })),
  LeaderboardPage: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/auth/flag-gate", () => ({ enabledForCaller }));
vi.mock("@/lib/players", () => ({ leaderboardEntries }));
vi.mock("@/components/leaderboard/leaderboard-page", () => ({ LeaderboardPage }));

import LeaderboardRoute from "@/app/(mainlayout)/leaderboard/page";

beforeEach(() => {
  vi.clearAllMocks();
  enabledForCaller.mockResolvedValue(false);
});

describe("/leaderboard gate", () => {
  it("asks the flag gate for the leaderboard flag, and nothing else", async () => {
    enabledForCaller.mockResolvedValue(false);

    await expect(LeaderboardRoute()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(enabledForCaller).toHaveBeenCalledWith("community.leaderboard");
  });

  it("answers 404 for a member and for a signed-out visitor before reading a single row", async () => {
    // The gate collapses both into `false`, which is the point: the two callers are
    // indistinguishable from outside. Run twice — once per caller — with the same expectation.
    for (const caller of ["member", "signed-out"]) {
      vi.clearAllMocks();
      enabledForCaller.mockResolvedValue(false);

      await expect(LeaderboardRoute(), caller).rejects.toThrow("NEXT_NOT_FOUND");
      expect(leaderboardEntries, caller).not.toHaveBeenCalled();
      expect(LeaderboardPage, caller).not.toHaveBeenCalled();
    }
  });

  it("renders the page for an admin session while the flag is still off for everyone", async () => {
    enabledForCaller.mockResolvedValue(true);

    const element = await LeaderboardRoute();

    expect(notFound).not.toHaveBeenCalled();
    // The data is projected only after the gate said yes — three boards, the surface's own slice.
    expect(leaderboardEntries).toHaveBeenCalledTimes(3);
    expect(leaderboardEntries).toHaveBeenNthCalledWith(1, "global");
    expect(leaderboardEntries).toHaveBeenNthCalledWith(2, "science", 5);
    expect(leaderboardEntries).toHaveBeenNthCalledWith(3, "trending", 5);

    const props = (element as { props: { boards: Record<string, unknown> } }).props;
    expect(Object.keys(props.boards).sort()).toEqual(["global", "science", "trending"]);
  });
});

describe("the role is never client-supplied", () => {
  /** Source with comments removed, so a doc block cannot satisfy or fail the assertion. */
  const code = (path: string): string =>
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

  it("does not read a header, a cookie or a search param anywhere in the path", () => {
    for (const path of [
      "app/(mainlayout)/leaderboard/page.tsx",
      "lib/auth/flag-gate.ts",
      "lib/flags.ts",
    ]) {
      const source = code(path);
      for (const forbidden of ["next/headers", "headers(", "cookies()", "searchParams"]) {
        expect(source.includes(forbidden), `${path} mentions ${forbidden}`).toBe(false);
      }
    }
  });
});
