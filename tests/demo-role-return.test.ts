/**
 * A demo role button returns the browser to where it was going (#1187).
 *
 * `?next=` is the whole reason a person is on `/login`: a signed-out POST to the flow's stage 4
 * answers `303 → loginPathFor(createCommitPath(slug))`, and every other sign-in door honours it —
 * the password form (`login-view.tsx` → `router.push(next)`) and the Google start
 * (`startGoogleFlow(next)`) both do. The three demo role buttons did not: the action ended with
 * `redirect(destinationFor(role))`, so a browser that signed in as the **admin** account mid-flow
 * landed on `/admin/instances` and the relationship it had just described was stranded.
 *
 * The action is driven here with its four dependencies stubbed — unlock verdict, credential,
 * auth server, redirect — because the gate is database-free (`docs/operations/gate.md`): what is
 * asserted is the destination the action chose, which is the fact the browser walk on the card
 * reproduces. The role panel's own `destinationFor()` table stays pinned by
 * `tests/demo-accounts.test.ts`; this file holds the rule that a *requested* destination wins.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  /** Where `redirect()` was told to go, or `null` when it was never reached. */
  redirectedTo: null as string | null,
  /** What the PIN gate's unlock cookie answered. */
  unlocked: true,
  /** The seeded credential `demo_account` would return, or `null` for the not-seeded case. */
  credential: { email: "admin@demo.alignsynch.test", password: "x", role: "admin" } as {
    email: string;
    password: string;
    role: string;
  } | null,
}));

/** The control-flow signal Next's `redirect()` raises; the action never catches it. */
class RedirectSignal extends Error {
  readonly to: string;
  constructor(to: string) {
    super(`NEXT_REDIRECT: ${to}`);
    this.to = to;
  }
}

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: (to: string) => {
    stub.redirectedTo = to;
    throw new RedirectSignal(to);
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

vi.mock("@/lib/auth/demo-mode", () => ({
  demoMode: () => ({ kind: "demo" as const }),
}));

vi.mock("@/lib/auth/demo-unlock-cookie", () => ({
  readDemoUnlock: async () => (stub.unlocked ? { ok: true } : { ok: false, reason: "expired" }),
}));

vi.mock("@/lib/db/demo-accounts", () => ({
  readDemoCredential: async () => stub.credential,
}));

vi.mock("@/lib/auth/server", () => ({
  neonAuth: () => ({ signIn: { email: async () => ({}) } }),
}));

import { DEMO_ROLE_FIELD } from "@/lib/auth/demo-form";
import { INITIAL_DEMO_ROLE_STATE } from "@/lib/auth/demo-form";
import { createCommitPath } from "@/lib/flow/paths";

/** The field the panel carries so the action can see what the browser asked for. */
const DEMO_NEXT_FIELD = "next";

const COMMIT = createCommitPath("relationship-basics");

/** Run the action with one role (and optionally a requested `next`), returning where it went. */
async function signInAs(role: string, next?: string): Promise<string> {
  const { signInAsDemoRole } = await import("@/app/(auth)/login/demo-actions");
  const form = new FormData();
  form.set(DEMO_ROLE_FIELD, role);
  if (next !== undefined) form.set(DEMO_NEXT_FIELD, next);
  try {
    await signInAsDemoRole(INITIAL_DEMO_ROLE_STATE, form);
  } catch (error) {
    if (error instanceof RedirectSignal) return error.to;
    throw error;
  }
  throw new Error("the action answered without redirecting");
}

beforeEach(() => {
  stub.redirectedTo = null;
  stub.unlocked = true;
  stub.credential = { email: "admin@demo.alignsynch.test", password: "x", role: "admin" };
});

describe("a demo role sign-in returns to the page the browser asked for", () => {
  it("lands on the requested create stage, not on the role's own home", async () => {
    expect(await signInAs("admin", COMMIT)).toBe(COMMIT);
  });

  it("lands the two members on the requested stage too", async () => {
    stub.credential = { email: "initiator@demo.alignsynch.test", password: "x", role: "member" };
    expect(await signInAs("initiator", COMMIT)).toBe(COMMIT);
  });

  it("keeps the role's own destination when nothing was asked for", async () => {
    expect(await signInAs("admin")).toBe("/admin/instances");
    stub.credential = { email: "initiator@demo.alignsynch.test", password: "x", role: "member" };
    expect(await signInAs("initiator")).toBe(
      "/assessment/instances/assessment-instance-avery-rowan",
    );
  });

  it("refuses a value that leaves this site, falling back to the role's destination", async () => {
    for (const hostile of [
      "//evil.example/commit",
      "https://evil.example/commit",
      "javascript:1",
    ]) {
      expect(await signInAs("admin", hostile)).toBe("/admin/instances");
    }
  });

  it("honours a query-carrying destination verbatim", async () => {
    const withQuery = `${COMMIT}?instance=abc123`;
    expect(await signInAs("admin", withQuery)).toBe(withQuery);
  });
});
