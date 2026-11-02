/**
 * `/how-it-works` answers the login redirect on a tree with no auth environment.
 *
 * The defect this file pins: on a clean build (`no .env.local`, `NEON_AUTH_*` unset, which is how
 * the gate and CI run) the route answered **500** while its own docstring promised
 * `redirect(loginPathFor(…))`. The cause was `currentUser()`: it constructs the auth server
 * *before* its `try`, on purpose, so a missing `NEON_AUTH_BASE_URL` surfaces as a configuration
 * error rather than as a signed-out session (`lib/auth/session.ts`). Correct for a console page
 * whose signed-out answer is nothing; wrong for this one, whose signed-out answer is the login
 * form — the page never reached its own redirect.
 *
 * **Nothing here mocks the session module.** That is the point: the real `lib/auth/session.ts`
 * runs, `authConfigured()` reads the environment, and the assertion is the decision the page makes
 * with the answer it gets. Only the two things a unit test cannot have are stubbed — the Neon SDK
 * (`@/lib/auth/server`, which wants `next/headers`) and the allowlist's database write. The SDK
 * stub **throws when constructed**, exactly as `neonAuth()` does with no `NEON_AUTH_BASE_URL`, so a
 * page that still called `currentUser()` would fail here with the production error, not with a
 * convenient `null`.
 *
 * The last case pins the distinction so it stays a decision rather than an accident: `currentUser()`
 * unguarded still throws with no auth env. That is what `/assessment/instances` and its neighbours
 * do, and a future "fix" of `currentUser()` that turns the throw into `null` would change every
 * console page at once — it has to fail this test first.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** `redirect` in Next throws a control-flow marker a real render catches; here the test reads it. */
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

/**
 * The Neon SDK, stubbed. `configError` is set whenever the real one would refuse to be built —
 * i.e. with `NEON_AUTH_*` unset — so `neonAuth()` throwing here is the production behaviour rather
 * than a stand-in for it.
 */
const auth = vi.hoisted(() => ({
  configuredRead: vi.fn(),
  readerRead: vi.fn(),
  configError: null as Error | null,
  constructed: 0,
}));

const missingEnvError = () =>
  new Error(
    "NEON_AUTH_BASE_URL is not set: run `neon env pull` in the repo root before using /api/auth",
  );

vi.mock("@/lib/auth/server", () => ({
  neonAuth: () => {
    if (auth.configError !== null) throw auth.configError;
    auth.constructed += 1;
    return { getSession: auth.configuredRead };
  },
  neonAuthReader: () => {
    if (auth.configError !== null) throw auth.configError;
    return { getSession: auth.readerRead };
  },
}));

/** The allowlist grant is a database write and not a fact about this route. */
vi.mock("@/lib/auth/admin-allowlist", () => ({ grantAdminIfAllowlisted: async () => undefined }));

import HowItWorksPage from "@/app/(mainlayout)/how-it-works/page";
import { howItWorksPageCopy } from "@/data/pages/how-it-works";
import { currentUser } from "@/lib/auth/session";

/** What a signed-in `getSession()` answers — the SDK's shape, so `session.ts` reads it unchanged. */
const SIGNED_IN = {
  data: {
    session: { id: "session-1", userId: "user-1", expiresAt: "2026-11-09T12:00:00.000Z" },
    user: { id: "user-1", email: "ada@example.com", name: "Ada Lovelace" },
  },
  error: null,
};

/** The auth env `neonAuth()` requires — set for the configured cases, removed for the defect. */
const AUTH_ENV = ["NEON_AUTH_BASE_URL", "NEON_AUTH_COOKIE_SECRET"] as const;

/** The route's own promise: a signed-out request goes to `/login` with the path preserved. */
const LOGIN_REDIRECT = "NEXT_REDIRECT:/login?next=%2Fhow-it-works";

/** Run the page and return the marker it threw, or the markup it rendered. */
async function render(): Promise<string> {
  try {
    const element = await HowItWorksPage();
    return renderToStaticMarkup(element);
  } catch (error) {
    return (error as Error).message;
  }
}

function unconfigured(): void {
  for (const name of AUTH_ENV) vi.stubEnv(name, undefined);
  auth.configError = missingEnvError();
}

function configured(): void {
  vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.test");
  vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "a-test-secret-that-is-long-enough");
  auth.configError = null;
}

beforeEach(() => {
  // Stated, not inherited (`tests/play-route.test.ts`): `/how-it-works` is the alignment product's
  // console page, and on a `BRAND=quizhub` build it is a 404 before the session is ever asked.
  vi.stubEnv("BRAND", "alignsynch");
  auth.configuredRead.mockReset();
  auth.readerRead.mockReset();
  auth.constructed = 0;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/how-it-works with no auth environment (the gate, CI, a fresh deploy)", () => {
  it("answers the login redirect instead of the 500 the missing variable used to raise", async () => {
    unconfigured();

    expect(await render()).toBe(LOGIN_REDIRECT);
    // The auth server is never built, which is why nothing can throw: `authConfigured()` answered
    // the question first. A page back on `currentUser()` fails here with the real error message.
    expect(auth.constructed).toBe(0);
    expect(auth.configuredRead).not.toHaveBeenCalled();
  });
});

describe("/how-it-works with auth configured", () => {
  it("sends a signed-out request to the same redirect", async () => {
    configured();
    auth.configuredRead.mockResolvedValue({ data: null, error: null });

    expect(await render()).toBe(LOGIN_REDIRECT);
  });

  it("renders the page for a session, so the redirect is only the signed-out answer", async () => {
    configured();
    auth.configuredRead.mockResolvedValue(SIGNED_IN);

    const html = await render();

    expect(html).not.toContain("NEXT_REDIRECT");
    expect(html).toContain(howItWorksPageCopy.heading);
  });
});

describe("the distinction this route relies on", () => {
  it("keeps `currentUser()` throwing with no auth env, so console neighbours stay a decision", async () => {
    unconfigured();

    await expect(currentUser()).rejects.toThrow("NEON_AUTH_BASE_URL is not set");
  });

  it("is still a 404 on a build that does not ship this product, before the session is asked", async () => {
    vi.stubEnv("BRAND", "quizhub");
    unconfigured();

    expect(await render()).toBe("NEXT_NOT_FOUND");
  });
});
