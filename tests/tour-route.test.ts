/**
 * `GET|POST /api/tour` (#456) — the guards, before the write.
 *
 * The column is per person, so the two things that must never drift are the session and the row
 * it writes: an unauthenticated caller gets 401 and the body is never read, the `userId` comes
 * from the session and cannot be named in the body (`strict()` makes an attempt a 400 rather than
 * a silently dropped key), and the answer is the row's value (`RETURNING`) rather than the
 * request's. Each of those is a test here, because each is one refactor away from being untrue.
 *
 * Also pinned: a tree with no `DATABASE_URL` answers 503 with the missing variable named. The gate
 * builds with no connection string and this route must report that honestly instead of 500ing —
 * and it must not be the reason a build tries to connect.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  currentUser: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  configured: vi.fn(() => true),
  // The real class carries `reason` (the sentence a screen prints); a stub without it would pass
  // the branch assertion while answering a body production never sends.
  DatabaseUnavailableError: class DatabaseUnavailableError extends Error {
    readonly reason: string;

    constructor(reason: string) {
      super(reason);
      this.name = "DatabaseUnavailableError";
      this.reason = reason;
    }
  },
}));

vi.mock("@/lib/auth/session", () => ({ currentUser: stub.currentUser }));
vi.mock("@/lib/db/client", () => ({
  databaseConfigured: stub.configured,
  DatabaseUnavailableError: stub.DatabaseUnavailableError,
}));
vi.mock("@/lib/db/tour", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/tour")>();
  return { ...actual, readTourState: stub.read, writeTourSeen: stub.write };
});

import { GET, POST } from "@/app/api/tour/route";

const USER = {
  userId: "3f2a1b4c-9d8e-4f6a-8b0c-1d2e3f4a5b6c",
  email: "avery@demo.alignsynch.test",
  name: "Avery Rowan",
  sessionId: "session-1",
};

const SEEN = { seen: true, seenAt: "2026-11-03T10:00:00.000Z" };

/** A JSON post the component would make. */
function post(body: unknown): Request {
  return new Request("http://localhost/api/tour", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.currentUser.mockResolvedValue(USER);
  stub.configured.mockReturnValue(true);
  stub.read.mockResolvedValue({ seen: false, seenAt: null });
  stub.write.mockResolvedValue({ ok: true, state: SEEN });
});

describe("GET /api/tour", () => {
  it("401s without a session, and never reads a row", async () => {
    stub.currentUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthenticated" });
    expect(stub.read).not.toHaveBeenCalled();
  });

  it("answers the session's own state — unseen is what a first sign-in gets", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ seen: false, seenAt: null });
    expect(stub.read).toHaveBeenCalledWith(USER.userId);
  });

  it("answers seen on the next call, which is what stops the tour showing twice", async () => {
    stub.read.mockResolvedValue(SEEN);
    expect(await (await GET()).json()).toEqual(SEEN);
  });

  it("503s, naming the variable, when the tree has no connection string", async () => {
    stub.configured.mockReturnValue(false);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "unavailable" });
    expect(stub.read).not.toHaveBeenCalled();
  });

  it("503s, not 500s, when the database stops answering", async () => {
    stub.read.mockRejectedValue(new stub.DatabaseUnavailableError("the database did not answer"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "unavailable",
      message: "the database did not answer",
    });
  });
});

describe("POST /api/tour", () => {
  it("401s without a session, before the body is read", async () => {
    stub.currentUser.mockResolvedValue(null);
    const response = await POST(post({ seen: true }));
    expect(response.status).toBe(401);
    expect(stub.write).not.toHaveBeenCalled();
  });

  it("marks the session's own row — the userId is never taken from the body", async () => {
    const response = await POST(post({ seen: true }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SEEN);
    expect(stub.write).toHaveBeenCalledTimes(1);
    expect(stub.write).toHaveBeenCalledWith(
      USER.userId,
      { email: USER.email, name: USER.name },
      true,
    );
  });

  it("clears it for replay, through the same verb with seen: false (#458)", async () => {
    stub.write.mockResolvedValue({ ok: true, state: { seen: false, seenAt: null } });
    const response = await POST(post({ seen: false }));
    expect(response.status).toBe(200);
    expect(stub.write).toHaveBeenCalledWith(
      USER.userId,
      { email: USER.email, name: USER.name },
      false,
    );
  });

  it("400s a body that is not JSON, and writes nothing", async () => {
    const response = await POST(post("not json"));
    expect(response.status).toBe(400);
    expect(stub.write).not.toHaveBeenCalled();
  });

  it("400s a non-boolean seen", async () => {
    expect((await POST(post({ seen: "yes" }))).status).toBe(400);
    expect(stub.write).not.toHaveBeenCalled();
  });

  it("400s a body that names a user — one person cannot mark another's tour", async () => {
    const response = await POST(post({ seen: true, userId: "somebody-else" }));
    expect(response.status).toBe(400);
    expect(stub.write).not.toHaveBeenCalled();
  });

  it("409s when the provisioned handle is somebody else's URL, and claims nothing", async () => {
    stub.write.mockResolvedValue({
      ok: false,
      reason: "handle-taken",
      message: "the provisioned profile handle is already in use",
    });
    const response = await POST(post({ seen: true }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "handle-taken" });
  });

  it("503s when the tree has no connection string", async () => {
    stub.configured.mockReturnValue(false);
    expect((await POST(post({ seen: true }))).status).toBe(503);
    expect(stub.write).not.toHaveBeenCalled();
  });
});
