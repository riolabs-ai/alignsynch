/**
 * A withdrawn invitation is dead at the door (#503) — `claimInvite()` refuses it and writes nothing.
 *
 * The admin side of "a revoke is terminal" lives in `tests/admin-relationship-ops.test.ts`: a second
 * revoke is refused, and a resend refuses a withdrawn invitation rather than clearing the column. The
 * other half is the party's own link, and it is the half a reader of the database never sees: an
 * operator withdraws an invitation, the recipient opens the mail a minute later, and the answer has
 * to be "an operator revoked that invitation" with no `claimed_at`, no party row and no session
 * token handed out.
 *
 * `claimInvite()` asks the revocation **before** the expiry on purpose — the fact the recipient needs
 * is that the link was withdrawn, not the date it would have died — so the case below uses a row
 * that is both revoked and expired and asserts the revocation is the answer. The second case is the
 * same row with only the date, which is how the test proves the first one is about the revocation
 * and not about the clock.
 *
 * The pool is faked: what is asserted is the refusal code and the statement log, neither of which
 * needs Postgres, and the gate stays database-free.
 */
import { describe, expect, it, vi } from "vitest";

import { hashToken } from "@/lib/flow/tokens";

/**
 * The fake pool, hoisted so `vi.mock`'s factory can reach it.
 *
 * `row` is what the invitation lookup answers. Every statement is recorded with its parameters, so
 * "nothing was written" and "the lookup used the token's hash" are assertions rather than beliefs.
 */
const fake = vi.hoisted(() => ({
  calls: [] as { readonly text: string; readonly values: readonly unknown[] }[],
  row: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/db/client", () => {
  const client = {
    query: async (text: string, values: readonly unknown[] = []) => {
      fake.calls.push({ text: text.trimStart().replace(/\s+/g, " "), values });
      if (/FROM session_invite/i.test(text)) {
        return { rows: fake.row === null ? [] : [fake.row], rowCount: fake.row === null ? 0 : 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };
  return {
    getPool: () => ({ connect: async () => client }),
    query: async () => [],
    queryRows: async () => [],
    DatabaseUnavailableError: class extends Error {},
  };
});

/**
 * The store, imported **after** the mock so it binds the fake pool.
 *
 * A dynamic import rather than a top-level `await`: the node test project compiles to a module target
 * that refuses top-level await, and `vi.mock` is hoisted above a static import anyway.
 */
async function store() {
  return import("@/lib/flow/store");
}

const INSTANCE = "inst-revoked";
/** 43 base64url characters — `tokenIsWellFormed()`'s shape, so the token reaches the query. */
const TOKEN = "a".repeat(43);
const NOW = new Date("2026-11-03T00:00:00.000Z");
const REVOKED_INSTANT = new Date("2026-11-02T09:32:00.000Z");
/** Already past: the revocation must outrank the date, so the row is both. */
const EXPIRED_INSTANT = new Date("2026-11-01T09:32:00.000Z");

function inviteRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    session_record_id: INSTANCE,
    counterparty_name: "Rowan",
    claimed_at: null,
    expires_at: EXPIRED_INSTANT,
    revoked_at: null,
    ...over,
  };
}

/** The claim as the invite route makes it: a token, a confirmation, and no signed-in account. */
function claim() {
  return { token: TOKEN, viewerTokens: [], viewerUserId: null, confirm: "Rowan", now: NOW };
}

describe("a withdrawn invitation cannot be claimed", () => {
  it("answers `revoked` and writes nothing — not `expired`, though the row is both", async () => {
    fake.calls.length = 0;
    fake.row = inviteRow({ revoked_at: REVOKED_INSTANT });
    const { claimInvite } = await store();

    const result = await claimInvite(claim());

    expect(result).toMatchObject({ ok: false, code: "revoked" });
    if (!result.ok) expect(result.reason).toContain(REVOKED_INSTANT.toISOString());

    // It began, looked the token up by its hash, rolled back. No write, no commit, no token issued.
    expect(fake.calls).toHaveLength(3);
    expect(fake.calls[0].text).toBe("BEGIN");
    expect(fake.calls[1].text).toMatch(/^SELECT session_record_id, counterparty_name, claimed_at/);
    expect(fake.calls[1].values).toEqual([hashToken(TOKEN)]);
    expect(fake.calls.at(-1)?.text).toBe("ROLLBACK");
    expect(fake.calls.some(({ text }) => /^(UPDATE|INSERT|DELETE)/i.test(text))).toBe(false);
    expect(fake.calls.some(({ text }) => text === "COMMIT")).toBe(false);
    // The result hands back no session token on a refusal — there is nothing to set a cookie from.
    expect(result).not.toHaveProperty("sessionToken");
  });

  it("still answers `expired` for the same row with nobody's withdrawal on it", async () => {
    fake.calls.length = 0;
    fake.row = inviteRow();
    const { claimInvite } = await store();

    // The contrast that makes the case above about the revocation: same instant, same token, only
    // `revoked_at` differs, and the refusal changes with it.
    expect(await claimInvite(claim())).toMatchObject({ ok: false, code: "expired" });
    expect(fake.calls.at(-1)?.text).toBe("ROLLBACK");
  });

  it("answers `claimed` for a link somebody already spent, never `revoked`", async () => {
    fake.calls.length = 0;
    fake.row = inviteRow({ claimed_at: REVOKED_INSTANT });
    const { claimInvite } = await store();

    expect(await claimInvite(claim())).toMatchObject({ ok: false, code: "claimed" });
  });
});
