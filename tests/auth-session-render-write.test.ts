/**
 * A valid session survives a render that cannot persist its refreshed cookie.
 *
 * The defect this file pins: `currentUser()` caught **every** failure of `auth.getSession()` and
 * answered `null`. One of those failures is not a failed read at all — Next 16 refuses
 * `cookies().set()` during a React Server Component render with
 * `Cookies can only be modified in a Server Action or Route Handler`, and the Neon Auth SDK
 * writes the refreshed session cookie from inside `getSession()`. So the moment a session was due
 * for refresh, a perfectly good session was reported as signed out and the page redirected to
 * `/login`. Measured on the dev server: `/how-it-works` answered `307 → /login?next=…` for a
 * session with five days left on it.
 *
 * **The negative case is the point.** Every gate in this repo is green with the defect present:
 * the throw is caught and logged, the type is right, the page answers `200` — with the wrong
 * user. A happy-path test cannot see that, so this one makes the request that fails.
 *
 * The auth server is the one seam stubbed, because the failure under test *is* an SDK behaviour:
 * `getSession()` persisting a cookie. `legacyRead` is the client with the wrapper's writing
 * request context — the one that throws in a render — and `readOnlyRead` is the reader whose
 * context has no write to refuse. What is asserted is the decision `lib/auth/session.ts` makes
 * with those two answers, which is the whole of the fix.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Next's own sentence, verbatim from `ReadonlyRequestCookiesError` in the Next server. */
const READONLY_MESSAGE =
  "Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options";

/** What Better Auth's `/get-session` answers for a live session. */
const SESSION_BODY = {
  session: {
    id: "session-1",
    userId: "user-1",
    expiresAt: "2026-11-09T12:00:00.000Z",
  },
  user: {
    id: "user-1",
    email: "ada@example.com",
    name: "Ada Lovelace",
  },
};

const auth = vi.hoisted(() => ({
  /** `neonAuth()` — the SDK wrapper, whose context writes cookies. */
  writingRead: vi.fn(),
  /** `neonAuthReader()` — the same SDK with a context that cannot write. */
  readOnlyRead: vi.fn(),
  /** Set to make client construction fail, as a missing `NEON_AUTH_*` makes it fail. */
  configError: null as Error | null,
}));

vi.mock("@/lib/auth/server", () => ({
  neonAuth: () => {
    if (auth.configError !== null) throw auth.configError;
    return { getSession: auth.writingRead };
  },
  neonAuthReader: () => {
    if (auth.configError !== null) throw auth.configError;
    return { getSession: auth.readOnlyRead };
  },
}));

/**
 * `currentUser()` grants the allowlist after resolving — a database write that is not a fact
 * about this card, and `pnpm test` runs with no `DATABASE_URL`.
 */
vi.mock("@/lib/auth/admin-allowlist", () => ({ grantAdminIfAllowlisted: async () => undefined }));

import { isRenderCookieWriteRefusal, NEXT_READONLY_COOKIE_MESSAGE } from "@/lib/auth/render-cookie";
import { currentUser } from "@/lib/auth/session";

/** The error Next throws from `cookies().set()` mid-render. A plain `Error`, as Next's is. */
function readonlyRefusal(): Error {
  return new Error(READONLY_MESSAGE);
}

/** The answer a successful read gives. */
function answered() {
  return { data: SESSION_BODY, error: null };
}

beforeEach(() => {
  auth.writingRead.mockReset();
  auth.readOnlyRead.mockReset();
  auth.configError = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("currentUser() on a render that may not write a cookie", () => {
  it("resolves the session when only its refreshed cookie could not be persisted", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    auth.writingRead.mockRejectedValue(readonlyRefusal());
    auth.readOnlyRead.mockResolvedValue(answered());

    const user = await currentUser();

    expect(user).toEqual({
      userId: "user-1",
      email: "ada@example.com",
      name: "Ada Lovelace",
      sessionId: "session-1",
    });
    // The read that cannot write is the one that produced it: the session was not downgraded.
    expect(auth.readOnlyRead).toHaveBeenCalledTimes(1);
    // The sentence that filled the dev log and signed people out must not be said at all.
    expect(errors).not.toHaveBeenCalledWith(
      "auth: getSession failed — treating the request as signed out",
      expect.anything(),
    );
  });

  it("persists the refreshed cookie when it may — no retry, no second read", async () => {
    auth.writingRead.mockResolvedValue(answered());

    await expect(currentUser()).resolves.toMatchObject({ userId: "user-1" });
    expect(auth.readOnlyRead).not.toHaveBeenCalled();
  });

  it("still answers null for a genuinely signed-out request", async () => {
    auth.writingRead.mockResolvedValue({ data: { session: null, user: null }, error: null });

    await expect(currentUser()).resolves.toBeNull();
    expect(auth.readOnlyRead).not.toHaveBeenCalled();
  });

  it("still answers null when the read itself fails, and says so", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    auth.writingRead.mockRejectedValue(new Error("upstream /get-session answered 503"));

    await expect(currentUser()).resolves.toBeNull();
    expect(errors).toHaveBeenCalledWith(
      "auth: getSession failed — treating the request as signed out",
      expect.any(Error),
    );
    // A failed read must not be retried into a different answer: the second client is for a
    // refusal, not for a network that is down.
    expect(auth.readOnlyRead).not.toHaveBeenCalled();
  });

  it("answers null when the read-only retry also fails, rather than throwing out of a page", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    auth.writingRead.mockRejectedValue(readonlyRefusal());
    auth.readOnlyRead.mockRejectedValue(new Error("upstream /get-session answered 503"));

    await expect(currentUser()).resolves.toBeNull();
  });
});

describe("the configuration contract", () => {
  it("still lets a missing auth env throw, instead of reporting everyone signed out", async () => {
    // A deployment mistake must surface: "signed out" here is an endless `/login` redirect, and
    // this card's fix must not have bought the session with that guarantee.
    auth.configError = new Error(
      "NEON_AUTH_BASE_URL is not set: run `neon env pull` in the repo root",
    );

    await expect(currentUser()).rejects.toThrow(/NEON_AUTH_BASE_URL is not set/);
  });
});

describe("isRenderCookieWriteRefusal", () => {
  it("recognises Next's sentence, with the docs link and without it", () => {
    expect(isRenderCookieWriteRefusal(readonlyRefusal())).toBe(true);
    expect(isRenderCookieWriteRefusal(new Error(NEXT_READONLY_COOKIE_MESSAGE))).toBe(true);
  });

  it("does not claim a failed fetch, so a real outage stays a signed-out answer", () => {
    expect(isRenderCookieWriteRefusal(new Error("fetch failed"))).toBe(false);
    expect(isRenderCookieWriteRefusal({ message: READONLY_MESSAGE })).toBe(false);
    expect(isRenderCookieWriteRefusal(undefined)).toBe(false);
  });
});
