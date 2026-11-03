/**
 * The first-run tour's mark (#456): the rule, the provisioned identity, and the two statements.
 *
 * The row shape is one nullable column, so the interesting decisions are elsewhere and each one
 * is pinned here:
 *
 *   **`NULL` is unseen.** `tourStateOf` is the only place that turns a column into a decision, so
 *   a page and a route cannot disagree about it.
 *
 *   **The first completion provisions a row.** A brand-new account has no `user_profile` row, and
 *   an `UPDATE` against it would write nothing — the tour would show on every sign-in. The test
 *   asserts the INSERT … ON CONFLICT shape for `seen: true` and, just as importantly, that
 *   `seen: false` never inserts: a missing row is already unseen, so replay (#458) creates nothing.
 *
 *   **A collision is a state, not a crash.** Two provisioned handles can collide; the second
 *   candidate is the auth user id's slug, which is unique because the id is. A third collision
 *   answers `handle-taken` (the route turns that into a 409) rather than pretending it wrote.
 *
 * The pool is stubbed the way the repo's other database tests stub it (`vi.mock` on
 * `@/lib/db/client`), so nothing here needs `DATABASE_URL` and the assertions are about the
 * statement the real code would send.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({ queryRows: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  queryRows: stub.queryRows,
  databaseConfigured: () => true,
}));

import {
  provisionedDisplayName,
  provisionedHandles,
  readTourState,
  tourStateOf,
  writeTourSeen,
} from "@/lib/db/tour";

/** The email the demo accounts use, so a handle collision with the fixture is visible. */
const EMAIL = "avery@demo.alignsynch.test";
const USER_ID = "3f2a1b4c-9d8e-4f6a-8b0c-1d2e3f4a5b6c";
const IDENTITY = { email: EMAIL, name: "Avery Rowan" };

beforeEach(() => {
  vi.clearAllMocks();
  stub.queryRows.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tourStateOf", () => {
  it("reads NULL as unseen, with no instant to show", () => {
    expect(tourStateOf(null)).toEqual({ seen: false, seenAt: null });
  });

  it("reads a Date as seen, normalised to ISO", () => {
    const state = tourStateOf(new Date("2026-11-03T10:00:00.000Z"));
    expect(state).toEqual({ seen: true, seenAt: "2026-11-03T10:00:00.000Z" });
  });

  it("reads a string the way pg hands a timestamp over", () => {
    expect(tourStateOf("2026-11-03 10:00:00+00")).toEqual({
      seen: true,
      seenAt: "2026-11-03T10:00:00.000Z",
    });
  });
});

describe("provisionedHandles", () => {
  it("uses the email's local part, which is the handle the shell already prints", () => {
    expect(provisionedHandles(EMAIL, USER_ID)[0]).toBe("avery");
  });

  it("keeps the user-id slug as the second candidate, bounded to 30 characters", () => {
    const handles = provisionedHandles(EMAIL, USER_ID);
    expect(handles).toHaveLength(2);
    expect(handles[1]).toBe(`user-${USER_ID}`.slice(0, 30));
  });

  it("drops a local part that is not a handle, leaving the id fragment", () => {
    const handles = provisionedHandles("ab@example.test", "ab");
    expect(handles).toHaveLength(1);
    expect(handles[0]).toBe("user-ab");
  });

  it("bounds the id fragment to the handle's 30 characters", () => {
    const handles = provisionedHandles("", USER_ID);
    expect(handles).toHaveLength(1);
    expect(handles[0]).toHaveLength(30);
    expect(handles[0]?.startsWith("user-")).toBe(true);
  });
});

describe("provisionedDisplayName", () => {
  it("prefers the provider's name", () => {
    expect(provisionedDisplayName("Avery Rowan", EMAIL)).toBe("Avery Rowan");
  });

  it("falls back to the email's local part, then to Member", () => {
    expect(provisionedDisplayName("   ", EMAIL)).toBe("avery");
    expect(provisionedDisplayName("   ", "")).toBe("Member");
  });

  it("bounds the name to the model's 60 characters", () => {
    expect(provisionedDisplayName("a".repeat(80), EMAIL)).toHaveLength(60);
  });
});

describe("readTourState", () => {
  it("asks for the session's own row and reads NULL as unseen", async () => {
    stub.queryRows.mockResolvedValue([{ tour_seen_at: null }]);
    expect(await readTourState(USER_ID)).toEqual({ seen: false, seenAt: null });

    const [sql, values] = stub.queryRows.mock.calls[0] as [string, string[]];
    expect(sql).toContain("SELECT tour_seen_at FROM user_profile WHERE user_id = $1");
    expect(values).toEqual([USER_ID]);
  });

  it("reads a person with no profile row as unseen rather than failing", async () => {
    stub.queryRows.mockResolvedValue([]);
    expect(await readTourState(USER_ID)).toEqual({ seen: false, seenAt: null });
  });

  it("reads an instant as seen", async () => {
    stub.queryRows.mockResolvedValue([{ tour_seen_at: new Date("2026-11-03T10:00:00.000Z") }]);
    expect(await readTourState(USER_ID)).toEqual({
      seen: true,
      seenAt: "2026-11-03T10:00:00.000Z",
    });
  });
});

describe("writeTourSeen", () => {
  it("marks seen with one upsert, provisioning the row when there is none", async () => {
    stub.queryRows.mockResolvedValue([{ tour_seen_at: new Date("2026-11-03T10:00:00.000Z") }]);
    const outcome = await writeTourSeen(USER_ID, IDENTITY, true);

    expect(outcome).toEqual({
      ok: true,
      state: { seen: true, seenAt: "2026-11-03T10:00:00.000Z" },
    });

    const [sql, values] = stub.queryRows.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO user_profile (user_id, handle, display_name, tour_seen_at)");
    expect(sql).toContain("ON CONFLICT (user_id) DO UPDATE");
    expect(sql).toContain("tour_seen_at = now()");
    // The profile's own "I saved my settings" column is not this write's to move.
    expect(sql).not.toContain("updated_at");
    expect(values).toEqual([USER_ID, "avery", "Avery Rowan"]);
  });

  it("clears with an UPDATE and never inserts — replay creates no row (#458)", async () => {
    stub.queryRows.mockResolvedValue([{ tour_seen_at: null }]);
    const outcome = await writeTourSeen(USER_ID, IDENTITY, false);

    expect(outcome).toEqual({ ok: true, state: { seen: false, seenAt: null } });

    const [sql, values] = stub.queryRows.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("UPDATE user_profile SET tour_seen_at = NULL");
    expect(sql).not.toContain("INSERT");
    expect(values).toEqual([USER_ID]);
  });

  it("clearing a person with no row answers unseen, without an error", async () => {
    stub.queryRows.mockResolvedValue([]);
    expect(await writeTourSeen(USER_ID, IDENTITY, false)).toEqual({
      ok: true,
      state: { seen: false, seenAt: null },
    });
  });

  it("tries the user-id handle when the email's is somebody else's URL", async () => {
    // The shape `queryRows` actually throws: a `DatabaseUnavailableError` with the driver's error
    // as `cause`. A code on the top of that chain is not where Postgres put it.
    const taken = Object.assign(new Error("duplicate key"), { code: "23505" });
    stub.queryRows
      .mockRejectedValueOnce(taken)
      .mockResolvedValueOnce([{ tour_seen_at: new Date("2026-11-03T10:00:00.000Z") }]);

    const outcome = await writeTourSeen(USER_ID, IDENTITY, true);
    expect(outcome.ok).toBe(true);

    const second = stub.queryRows.mock.calls[1] as [string, unknown[]];
    expect(second[1]).toEqual([USER_ID, `user-${USER_ID}`.slice(0, 30), "Avery Rowan"]);
  });

  it("sees the code through the wrapper `queryRows` puts around a failed statement", async () => {
    const wrapped = Object.assign(new Error("the database could not be reached"), {
      cause: Object.assign(new Error("duplicate key"), { code: "23505" }),
    });
    stub.queryRows
      .mockRejectedValueOnce(wrapped)
      .mockResolvedValueOnce([{ tour_seen_at: new Date("2026-11-03T10:00:00.000Z") }]);

    expect((await writeTourSeen(USER_ID, IDENTITY, true)).ok).toBe(true);
    const second = stub.queryRows.mock.calls[1] as [string, unknown[]];
    expect(second[1]).toEqual([USER_ID, `user-${USER_ID}`.slice(0, 30), "Avery Rowan"]);
  });

  it("answers handle-taken when every provisioned handle is taken", async () => {
    const taken = Object.assign(new Error("duplicate key"), { code: "23505" });
    stub.queryRows.mockRejectedValue(taken);

    expect(await writeTourSeen(USER_ID, IDENTITY, true)).toEqual({
      ok: false,
      reason: "handle-taken",
      message: "the provisioned profile handle is already in use",
    });
  });

  it("lets a failure that is not a handle collision through", async () => {
    stub.queryRows.mockRejectedValue(new Error("connection terminated"));
    await expect(writeTourSeen(USER_ID, IDENTITY, true)).rejects.toThrow("connection terminated");
  });
});
