/**
 * The `/v1` gate, as a decision rather than a running server — the three ways a request may arrive
 * at the prototype's front door, and the one answer each gets.
 *
 * The gate lives in `app/(prototype)/layout.tsx` precisely so it cannot be forgotten by the next
 * `/v1` route somebody adds, and this file pins the three things that make that worth anything:
 *
 *   - **the demo unlock alone is enough**, and it is checked *without* a session read — the demo
 *     host must not pay for an auth round-trip per prototype request;
 *   - **a session alone is enough** — the gate is an access gate, not a retirement, so a signed-in
 *     reviewer keeps the `200` the card's acceptance asks for;
 *   - **neither is a redirect to `/login?next=%2Fv1`** — not a 404, not a blank screen, and not a
 *     bare `/` that makes a working link look broken.
 *
 * `dynamic` is asserted too, because it is the one-line difference between a gate and a build-time
 * snapshot of one: a prerendered layout would bake one visitor's verdict into every `/v1` page.
 *
 * The two auth helpers are mocked rather than driven, because both are documented elsewhere and
 * already tested (`tests/demo-unlock.test.ts` verifies the cookie in every branch; the session is
 * the auth server's answer). What is untested without them is the *wiring*, which is this file.
 */
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UnlockVerdict } from "@/lib/auth/demo-unlock";

const { redirect, readDemoUnlock, currentUserIfConfigured } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    // Next's own `redirect()` is a control-flow signal: it throws, and a caller that catches it
    // renders anyway. The fake throws for the same reason — a test that let the gate continue
    // would pass on a gate that does not stop anybody.
    throw new Error(`REDIRECT ${path}`);
  }),
  readDemoUnlock: vi.fn(),
  currentUserIfConfigured: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/demo-unlock-cookie", () => ({ readDemoUnlock }));
vi.mock("@/lib/auth/session", () => ({ currentUserIfConfigured }));

import PrototypeLayout, { dynamic } from "@/app/(prototype)/layout";
import { loginPathFor } from "@/lib/auth/paths";

const CHILD = createElement("div", null, "prototype");

const UNLOCKED: UnlockVerdict = { ok: true, expiresAt: 1_793_400_000_000 };
const LOCKED: UnlockVerdict = { ok: false, reason: "absent" };

const SIGNED_IN = {
  userId: "a-user-id",
  email: "avery@demo.alignsynch.test",
  name: "Avery",
  sessionId: "a-session-id",
};

/** The one target an anonymous `/v1` request may be sent to. */
const LOGIN = loginPathFor("/v1");

describe("the /v1 group gate", () => {
  beforeEach(() => {
    redirect.mockClear();
    readDemoUnlock.mockReset();
    currentUserIfConfigured.mockReset();
  });

  it("is request-time, so no visitor's verdict is baked into the build", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("renders the prototype for the demo unlock alone, and reads no session", async () => {
    readDemoUnlock.mockResolvedValue(UNLOCKED);

    await expect(PrototypeLayout({ children: CHILD })).resolves.toBe(CHILD);
    expect(redirect).not.toHaveBeenCalled();
    expect(currentUserIfConfigured).not.toHaveBeenCalled();
  });

  it("renders the prototype for a signed-in visitor with no unlock", async () => {
    readDemoUnlock.mockResolvedValue(LOCKED);
    currentUserIfConfigured.mockResolvedValue(SIGNED_IN);

    await expect(PrototypeLayout({ children: CHILD })).resolves.toBe(CHILD);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends an anonymous visitor to /login with the prototype as next", async () => {
    readDemoUnlock.mockResolvedValue(LOCKED);
    currentUserIfConfigured.mockResolvedValue(null);

    await expect(PrototypeLayout({ children: CHILD })).rejects.toThrow(`REDIRECT ${LOGIN}`);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fv1");
  });
});
