/**
 * The admin gate (#183): a refusal is a 404 or a redirect, never a 403.
 *
 * Two things are pinned here, and the second is the one that would rot silently:
 *
 *   - the policy — signed out redirects to `/login?next=…`, signed in without the role gets
 *     `notFound()`, signed in with it gets a grant;
 *   - the *shape* of a refusal. A 403 is an answer, and an answer confirms the surface exists,
 *     so the test asserts that the only two refusals the module can produce are the two that
 *     do not advertise it. If someone later "improves" the denial into an HTTP status, this
 *     file fails rather than the surface quietly telling an attacker where to look.
 *
 * The session and the database are stubs: `lib/auth/session.ts` needs Neon Auth and
 * `lib/db/user-profiles.ts` needs `DATABASE_URL`, and neither is a fact about this policy. The
 * gate is exercised with a fake `currentUser` and a fake profile row, which is also what keeps
 * the gate database-free like the rest of `pnpm test`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin, requireRole, roleAnswerFor, roleOfUser } from "@/lib/auth/require-role";

const { notFound, redirect, currentUser, readUserProfileByUserId } = vi.hoisted(() => ({
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((to: string): never => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
  currentUser: vi.fn(async (): Promise<unknown> => null),
  readUserProfileByUserId: vi.fn(async (_userId: string): Promise<unknown> => null),
}));

vi.mock("next/navigation", () => ({ notFound, redirect }));
vi.mock("@/lib/auth/session", () => ({ currentUser }));
vi.mock("@/lib/db/user-profiles", () => ({ readUserProfileByUserId }));

/** A profile row as `readUserProfileByUserId` hands it back — only `role` matters here. */
const profileWithRole = (role: "member" | "admin") => ({
  userId: "auth-user-1",
  handle: "ada-lovelace",
  displayName: "Ada Lovelace",
  role,
  joinedAt: "2026-10-30T12:00:00.000Z",
  updatedAt: "2026-10-30T12:00:00.000Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(null);
  readUserProfileByUserId.mockResolvedValue(null);
});

describe("roleAnswerFor", () => {
  it("redirects a signed-out visitor to /login, remembering where they were going", () => {
    const answer = roleAnswerFor({ needed: "admin", signedIn: false, role: null, next: "/admin" });
    expect(answer).toEqual({ kind: "redirect", to: "/login?next=%2Fadmin" });
  });

  it("refuses an open redirect: an absolute `next` becomes the default, not a URL", () => {
    for (const hostile of ["//evil.example", "https://evil.example", "javascript:alert(1)"]) {
      const answer = roleAnswerFor({ needed: "admin", signedIn: false, role: null, next: hostile });
      expect(answer).toEqual({ kind: "redirect", to: "/login?next=%2Fdashboard%2Fuser" });
    }
  });

  it("answers a signed-in member with not-found, which is the whole point", () => {
    const answer = roleAnswerFor({ needed: "admin", signedIn: true, role: "member" });
    expect(answer.kind).toBe("not-found");
    // Nothing in the answer names a status, a reason or the surface: it is the same answer a
    // URL that never existed gets.
    expect(answer).not.toHaveProperty("to");
  });

  it("treats a missing profile row as a member, not as a privilege", () => {
    expect(roleAnswerFor({ needed: "admin", signedIn: true, role: null }).kind).toBe("not-found");
  });

  it("admits an admin and reports the role it used", () => {
    expect(roleAnswerFor({ needed: "admin", signedIn: true, role: "admin" })).toEqual({
      kind: "allow",
      role: "admin",
    });
  });

  it("compares roles by equality: a member asking for a member surface is admitted", () => {
    expect(roleAnswerFor({ needed: "member", signedIn: true, role: "member" }).kind).toBe("allow");
  });

  it("has exactly three answers, and none of them is a forbidden", () => {
    const answers = [
      roleAnswerFor({ needed: "admin", signedIn: false, role: null }),
      roleAnswerFor({ needed: "admin", signedIn: true, role: "member" }),
      roleAnswerFor({ needed: "admin", signedIn: true, role: "admin" }),
    ];
    expect(new Set(answers.map((answer) => answer.kind))).toEqual(
      new Set(["redirect", "not-found", "allow"]),
    );
  });
});

describe("requireRole", () => {
  it("redirects a signed-out visitor and never reads the database", async () => {
    await expect(requireAdmin({ next: "/admin" })).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=%2Fadmin",
    );
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fadmin");
    expect(readUserProfileByUserId).not.toHaveBeenCalled();
  });

  it("answers a member with notFound() and no redirect", async () => {
    currentUser.mockResolvedValue({ userId: "auth-user-1", email: "ada@example.com", name: "Ada" });
    readUserProfileByUserId.mockResolvedValue(profileWithRole("member"));

    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("grants an admin the session and the role", async () => {
    const user = { userId: "auth-user-1", email: "ada@example.com", name: "Ada" };
    currentUser.mockResolvedValue(user);
    readUserProfileByUserId.mockResolvedValue(profileWithRole("admin"));

    await expect(requireAdmin()).resolves.toEqual({ user, role: "admin" });
    expect(notFound).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("answers a signed-in person with no profile row with notFound(), not a grant", async () => {
    currentUser.mockResolvedValue({ userId: "auth-user-2", email: "new@example.com", name: "" });

    await expect(requireRole("admin")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(readUserProfileByUserId).toHaveBeenCalledWith("auth-user-2");
  });

  it("propagates a failed profile read instead of turning an outage into a 404", async () => {
    currentUser.mockResolvedValue({ userId: "auth-user-1", email: "ada@example.com", name: "Ada" });
    readUserProfileByUserId.mockRejectedValue(new Error("connection refused"));

    await expect(requireAdmin()).rejects.toThrow(/connection refused/);
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe("roleOfUser", () => {
  it("is the row's role, or the default when there is no row", async () => {
    await expect(roleOfUser("auth-user-1")).resolves.toBe("member");

    readUserProfileByUserId.mockResolvedValue(profileWithRole("admin"));
    await expect(roleOfUser("auth-user-1")).resolves.toBe("admin");
  });
});
