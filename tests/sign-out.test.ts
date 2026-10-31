/**
 * Signal ended, or say it did not (issue #272).
 *
 * `endSession` is the one step both sign-out controls run — the account page's button and the
 * shell's rail row, which used to be a link that revoked nothing. The cases below are the three
 * things the SDK can do, because the middle one is the one that shipped broken: a rejected
 * request (no `NEON_AUTH_BASE_URL`, so `/api/auth/sign-out` answers 500) used to throw out of the
 * caller's `await`, leaving the control on "Signing out…" forever.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@/lib/auth/client", () => ({ authClient: { signOut } }));

import { endSession } from "@/lib/auth/sign-out";

describe("endSession", () => {
  beforeEach(() => {
    signOut.mockReset();
  });

  it("reports success when the SDK revokes the session", async () => {
    signOut.mockResolvedValue({ error: null });
    await expect(endSession()).resolves.toBe(true);
  });

  it("reports failure when the SDK answers an error", async () => {
    signOut.mockResolvedValue({ error: { message: "nope" } });
    await expect(endSession()).resolves.toBe(false);
  });

  it("reports failure instead of throwing when the request itself fails", async () => {
    signOut.mockRejectedValue(new Error("Unexpected end of JSON input"));
    await expect(endSession()).resolves.toBe(false);
  });
});
