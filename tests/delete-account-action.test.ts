/**
 * `deleteAccountAction` — the one server entry point that destroys an account (`t_31f95f36`, #278).
 *
 * `lib/account/purge.ts` has its own tests (`tests/account-purge.test.ts`) and the live matrix runs
 * the whole feature on the demo branch. What neither covers is this file's two gates, and they are
 * the ones a caller can actually get wrong:
 *
 *   the session    the account deleted is the request's own. `currentUser()` reads it from the
 *                  cookies, the payload carries no `userId` at all, and a request with no session
 *                  is answered `unauthorized` **without reaching the purge**. A test that only
 *                  exercises a signed-in call cannot see that branch, and it is the branch that
 *                  decides whether a stranger can delete somebody else.
 *   the phrase     a mismatch answers `mismatch` and calls nothing. The phrase is compared against
 *                  `data/pages/settings.ts`'s `confirm-phrase` — the string the card rendered — so
 *                  the test reads the same fixture the card does rather than a literal here.
 *
 * The last case is the honest-failure rule: a purge that throws is `unavailable` (retryable), never
 * `deleted`. The card renders "Your account is unchanged — try again" from it.
 *
 * **POST-only is not tested here because it is not a branch.** The function is exported from a
 * `"use server"` module, so its only transport is the action protocol, which is a POST; there is no
 * route handler to GET (the assertion that none exists is in the copy test's sibling check on
 * `app/api`), and the tree carries no `href` or `router.push` to it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { currentUser, runAccountDeletion } = vi.hoisted(() => ({
  currentUser: vi.fn(async (): Promise<unknown> => null),
  runAccountDeletion: vi.fn(async (_userId: string): Promise<unknown> => ({ kind: "deleted" })),
}));

/**
 * The session cannot be the real one: importing `@/lib/auth/session` pulls `@neon/auth/next/server`
 * and `next/headers` into a plain-node run. The branch under test is what this file does with the
 * answer, not how a cookie is parsed. The purge is stubbed for the same reason — it wants a pool.
 */
vi.mock("@/lib/auth/session", () => ({ currentUser }));
vi.mock("@/lib/account/purge", () => ({ runAccountDeletion }));

import { deleteAccountAction } from "@/app/(mainlayout)/settings/delete-account-actions";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { settingsPageCopy } from "@/data/pages/settings";

const phrase = itemLabel(sectionOf(settingsPageCopy, "deletion"), "confirm-phrase");

const signedIn = {
  userId: "user-1",
  email: "person@example.test",
  name: "Person",
  sessionId: "s1",
};

beforeEach(() => {
  currentUser.mockReset();
  runAccountDeletion.mockReset();
});

describe("deleteAccountAction: the session gate", () => {
  it("answers unauthorized and purges nothing when there is no session", async () => {
    currentUser.mockResolvedValue(null);
    await expect(deleteAccountAction(phrase)).resolves.toEqual({ kind: "unauthorized" });
    expect(runAccountDeletion).not.toHaveBeenCalled();
  });

  it("deletes the session's own account, and takes no user id from the caller", async () => {
    currentUser.mockResolvedValue(signedIn);
    runAccountDeletion.mockResolvedValue({ kind: "deleted", counts: {} });
    await deleteAccountAction(phrase);
    // The id is the session's. `deleteAccountAction` is typed `(confirmation: string)`, so there is no
    // parameter a caller could put somebody else's id in — this asserts the value it does pass.
    expect(runAccountDeletion).toHaveBeenCalledWith("user-1");
  });
});

describe("deleteAccountAction: the phrase gate", () => {
  it("answers mismatch and purges nothing for a wrong phrase", async () => {
    currentUser.mockResolvedValue(signedIn);
    await expect(deleteAccountAction("delete account")).resolves.toEqual({ kind: "mismatch" });
    expect(runAccountDeletion).not.toHaveBeenCalled();
  });

  it("answers mismatch for an empty phrase", async () => {
    currentUser.mockResolvedValue(signedIn);
    await expect(deleteAccountAction("   ")).resolves.toEqual({ kind: "mismatch" });
    expect(runAccountDeletion).not.toHaveBeenCalled();
  });

  it("accepts the fixture's phrase regardless of case and surrounding space", async () => {
    currentUser.mockResolvedValue(signedIn);
    runAccountDeletion.mockResolvedValue({ kind: "deleted", counts: {} });
    await expect(deleteAccountAction(`  ${phrase.toUpperCase()} `)).resolves.toEqual({
      kind: "deleted",
    });
    expect(runAccountDeletion).toHaveBeenCalledTimes(1);
  });
});

describe("deleteAccountAction: every purge outcome is mapped, and a throw is never 'deleted'", () => {
  beforeEach(() => {
    currentUser.mockResolvedValue(signedIn);
  });

  it("maps deleted → deleted", async () => {
    runAccountDeletion.mockResolvedValue({ kind: "deleted", counts: {} });
    await expect(deleteAccountAction(phrase)).resolves.toEqual({ kind: "deleted" });
  });

  it("maps unknown-account → not-found", async () => {
    runAccountDeletion.mockResolvedValue({ kind: "unknown-account" });
    await expect(deleteAccountAction(phrase)).resolves.toEqual({ kind: "not-found" });
  });

  it("maps auth-failed → unavailable, the retryable answer", async () => {
    runAccountDeletion.mockResolvedValue({ kind: "auth-failed", reason: "503" });
    await expect(deleteAccountAction(phrase)).resolves.toEqual({ kind: "unavailable" });
  });

  it("answers unavailable — never deleted — when the purge throws", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    runAccountDeletion.mockRejectedValue(new Error("connection terminated"));
    await expect(deleteAccountAction(phrase)).resolves.toEqual({ kind: "unavailable" });
    quiet.mockRestore();
  });
});
