/**
 * Re-invite: revoke and replace, behind a cooldown and a cap (#275).
 *
 * The rules are pure (`lib/flow/resend.ts`) and the write is a transaction, so this file drives
 * both halves the way the gate has to: the rule mapping with plain arguments, and the store through
 * a **recording `PoolClient`** — the gate is database-free (`docs/GATE.md`), so what is asserted
 * about `resendInvite()` is the statements it issued, in which order, with which values. The live
 * proof (a real row, a real claim of the old token answering `unknown`) is `pnpm db:verify` plus
 * the command run recorded on the card; it cannot be a test here.
 *
 * Five claims, one per failure this card could ship:
 *
 *   the rules      cap before cooldown, complete before claimed, and the boundary at exactly 24 h
 *   the token      `token_hash` gets the hash of a **new** token, never the old one and never raw
 *   the window     `expires_at = now + 7 days` and `resent_at = now`; `created_at` is not written
 *   the budget     `resent_count + 1` in SQL, and a refusal issues no UPDATE at all
 *   the request    the viewer comes from the tokens/account, never from an argument a form controls
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emailLooksDeliverable, resendRefusal, resendRefusalOf } from "@/lib/flow/resend";
import type { ResendFacts } from "@/lib/flow/resend";
import {
  hashToken,
  INVITE_TTL_MS,
  RESEND_COOLDOWN_MS,
  RESEND_LIFETIME_CAP,
} from "@/lib/flow/tokens";
import { resendInvite } from "@/lib/flow/store";
import type { PartyRole } from "@/content/assessment";

/* ------------------------------------------------------------------ *\
 * The stub client
 * ------------------------------------------------------------------ */

const stub = vi.hoisted(() => {
  interface Call {
    readonly text: string;
    readonly values: readonly unknown[];
  }

  interface InviteRow {
    readonly email: string;
    readonly counterparty_name: string;
    readonly claimed_at: Date | null;
    readonly expires_at: Date;
    readonly resent_at: Date | null;
    readonly resent_count: number;
    readonly initiator_name: string | null;
    readonly title: string;
  }

  const calls: Call[] = [];
  const state: {
    invite: InviteRow | undefined;
    /** The roles this browser's cookies / the signed-in account answer as. */
    roles: PartyRole[];
    hasCounterparty: boolean;
    aspects: number;
    answered: Record<PartyRole, number>;
  } = {
    invite: undefined,
    roles: [],
    hasCounterparty: false,
    aspects: 2,
    answered: { initiator: 0, counterparty: 0 },
  };

  const narrow = (text: string): string => text.replace(/\s+/g, " ").trim();

  function reset(): void {
    calls.length = 0;
    state.invite = undefined;
    state.roles = [];
    state.hasCounterparty = false;
    state.aspects = 2;
    state.answered = { initiator: 0, counterparty: 0 };
  }

  async function query(text: string, values: readonly unknown[] = []) {
    calls.push({ text, values });
    const sql = narrow(text);

    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [], rowCount: 0 };
    }
    // The invitation row, locked. `FOR UPDATE OF iv, ai` is part of what is asserted.
    if (sql.startsWith("SELECT iv.email, iv.counterparty_name")) {
      return { rows: state.invite === undefined ? [] : [state.invite], rowCount: 1 };
    }
    if (
      sql.startsWith(
        "SELECT role FROM party WHERE session_record_id = $1 AND access_token_hash = ANY",
      )
    ) {
      const role = state.roles[0];
      return { rows: role === undefined ? [] : [{ role }], rowCount: role === undefined ? 0 : 1 };
    }
    if (sql.startsWith("SELECT role FROM party WHERE session_record_id = $1 AND user_id")) {
      const role = state.roles[0];
      return { rows: role === undefined ? [] : [{ role }], rowCount: role === undefined ? 0 : 1 };
    }
    if (sql.startsWith("SELECT count(*)::int AS n FROM item WHERE record_id = $1")) {
      return { rows: [{ n: state.aspects }], rowCount: 1 };
    }
    if (sql.startsWith("SELECT p.role, (SELECT count(*) FROM opinion o")) {
      const roles: PartyRole[] = state.hasCounterparty
        ? ["initiator", "counterparty"]
        : ["initiator"];
      return { rows: roles.map((role) => ({ role, answered: state.answered[role] })), rowCount: 2 };
    }
    if (sql.startsWith("UPDATE session_invite SET token_hash = $2")) {
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`the stub client has no answer for: ${sql.slice(0, 90)}`);
  }

  return { calls, state, reset, query, narrow };
});

vi.mock("@/lib/db/client", () => ({
  getPool: () => ({
    connect: async () => ({ query: stub.query, release: () => undefined }),
  }),
  DatabaseUnavailableError: class DatabaseUnavailableError extends Error {},
}));

/* ------------------------------------------------------------------ *\
 * Fixtures
 * ------------------------------------------------------------------ */

const INSTANCE_ID = "instance-resend-test";
const NOW = new Date("2026-11-04T12:00:00.000Z");
const OLD_TOKEN = "o".repeat(43);

function callsMatching(pattern: RegExp) {
  return stub.calls.filter((call) => pattern.test(stub.narrow(call.text)));
}

function unclaimedInvitation(over: Partial<NonNullable<(typeof stub.state)["invite"]>> = {}) {
  stub.reset();
  stub.state.invite = {
    email: "rowan@example.com",
    counterparty_name: "Rowan",
    claimed_at: null,
    expires_at: new Date("2026-11-06T12:00:00.000Z"),
    resent_at: null,
    resent_count: 0,
    initiator_name: "Avery",
    title: "Relationship Basics",
    ...over,
  };
  stub.state.roles = ["initiator"];
}

function facts(over: Partial<ResendFacts> = {}): ResendFacts {
  return {
    viewerRole: "initiator",
    inviteExists: true,
    complete: false,
    claimed: false,
    resentAt: null,
    resentCount: 0,
    email: null,
    ...over,
  };
}

beforeEach(() => stub.reset());

/* ------------------------------------------------------------------ *\
 * The rules
 * ------------------------------------------------------------------ */

describe("who may re-invite", () => {
  it("refuses a browser that is not the Initiator", () => {
    expect(resendRefusal(facts({ viewerRole: undefined }), NOW)).toBe("not-initiator");
    expect(resendRefusal(facts({ viewerRole: "counterparty" }), NOW)).toBe("not-initiator");
  });

  it("refuses an instance with no invitation at all", () => {
    expect(resendRefusal(facts({ inviteExists: false }), NOW)).toBe("no-invite");
  });
});

describe("the invitation's own state", () => {
  it("refuses once the Counterparty holds the seat", () => {
    expect(resendRefusal(facts({ claimed: true }), NOW)).toBe("already-claimed");
  });

  it("names a finished relationship as complete, not merely claimed", () => {
    // A complete instance is necessarily claimed; the stronger, terminal fact is the one to say,
    // because its honest next step ("start a new instance") is different from a spent link's.
    expect(resendRefusal(facts({ claimed: true, complete: true }), NOW)).toBe("instance-complete");
  });
});

describe("the cooldown", () => {
  it("refuses a second re-invite inside 24 hours", () => {
    const lastHour = new Date(NOW.getTime() - 60 * 60 * 1000);
    expect(resendRefusal(facts({ resentAt: lastHour, resentCount: 1 }), NOW)).toBe("cooldown");
  });

  it("refuses one millisecond before the day is up, and allows it at exactly 24 h", () => {
    const almost = new Date(NOW.getTime() - RESEND_COOLDOWN_MS + 1);
    const exactly = new Date(NOW.getTime() - RESEND_COOLDOWN_MS);
    expect(resendRefusal(facts({ resentAt: almost, resentCount: 1 }), NOW)).toBe("cooldown");
    expect(resendRefusal(facts({ resentAt: exactly, resentCount: 1 }), NOW)).toBeUndefined();
  });
});

describe("the lifetime cap", () => {
  it("refuses the fourth re-invite and allows the third", () => {
    const old = new Date(NOW.getTime() - 2 * RESEND_COOLDOWN_MS);
    expect(
      resendRefusal(facts({ resentAt: old, resentCount: RESEND_LIFETIME_CAP - 1 }), NOW),
    ).toBeUndefined();
    expect(resendRefusal(facts({ resentAt: old, resentCount: RESEND_LIFETIME_CAP }), NOW)).toBe(
      "cap-reached",
    );
  });

  it("wins over the cooldown — the action is over for good, not later today", () => {
    const lastHour = new Date(NOW.getTime() - 60 * 60 * 1000);
    expect(
      resendRefusal(facts({ resentAt: lastHour, resentCount: RESEND_LIFETIME_CAP }), NOW),
    ).toBe("cap-reached");
  });
});

describe("the corrected address", () => {
  it("refuses an address a message cannot be sent to", () => {
    expect(resendRefusal(facts({ email: "rowan@example" }), NOW)).toBe("invalid-email");
    expect(resendRefusal(facts({ email: "not an address" }), NOW)).toBe("invalid-email");
  });

  it("accepts a deliverable one, and no address at all", () => {
    expect(resendRefusal(facts({ email: "rowan@example.com" }), NOW)).toBeUndefined();
    expect(resendRefusal(facts({ email: null }), NOW)).toBeUndefined();
  });

  it("is the last question asked — a refused action does not also scold the address", () => {
    expect(
      resendRefusal(
        facts({ email: "nope", resentAt: new Date(NOW.getTime() - 1000), resentCount: 1 }),
        NOW,
      ),
    ).toBe("cooldown");
  });

  it("shares one definition of deliverable with the create form", () => {
    expect(emailLooksDeliverable("rowan@example.com")).toBe(true);
    expect(emailLooksDeliverable("rowan@example")).toBe(false);
    expect(emailLooksDeliverable(" rowan@example.com")).toBe(false);
  });
});

describe("the query value the screen reads", () => {
  it("accepts only the codes this build knows", () => {
    expect(resendRefusalOf("cooldown")).toBe("cooldown");
    expect(resendRefusalOf("cap-reached")).toBe("cap-reached");
    expect(resendRefusalOf("whatever")).toBeUndefined();
    expect(resendRefusalOf(undefined)).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ *\
 * The write
 * ------------------------------------------------------------------ */

describe("resendInvite writes one replacement token", () => {
  it("mints a new token, hashes it, and never stores the raw value", async () => {
    unclaimedInvitation();

    const result = await resendInvite({
      instanceRecordId: INSTANCE_ID,
      viewerTokens: ["party-token"],
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [update] = callsMatching(/^UPDATE session_invite SET token_hash/);
    expect(update).toBeDefined();
    expect(update.values[1]).toBe(hashToken(result.inviteToken));
    expect(update.values[1]).not.toBe(result.inviteToken);
    expect(update.values[1]).not.toBe(hashToken(OLD_TOKEN));
    expect(update.values[0]).toBe(INSTANCE_ID);
    // Nothing in the transaction carried the raw token: only its digest reached SQL.
    for (const call of stub.calls) expect(call.values).not.toContain(result.inviteToken);
    // Two tokens from the same generator are different tokens.
    expect(result.inviteToken).not.toBe(OLD_TOKEN);
    expect(result.inviteToken).toHaveLength(43);
  });

  it("moves the window to now + 7 days and records the reissue instant", async () => {
    unclaimedInvitation();
    await resendInvite({ instanceRecordId: INSTANCE_ID, viewerTokens: ["t"], now: NOW });

    const [update] = callsMatching(/^UPDATE session_invite SET token_hash/);
    expect(update.values[3]).toBe(new Date(NOW.getTime() + INVITE_TTL_MS).toISOString());
    expect(update.values[4]).toBe(NOW.toISOString());
    // `created_at` is the instance's own fact and is not rewritten by a reissue.
    expect(stub.narrow(update.text)).not.toContain("created_at");
    expect(stub.narrow(update.text)).toContain("resent_count = resent_count + 1");
  });

  it("keeps the address on the row when the form posts none", async () => {
    unclaimedInvitation();
    await resendInvite({ instanceRecordId: INSTANCE_ID, viewerTokens: ["t"], now: NOW });

    const [update] = callsMatching(/^UPDATE session_invite SET token_hash/);
    expect(update.values[2]).toBe("rowan@example.com");
  });

  it("writes a corrected address, and reports where the invitation went", async () => {
    unclaimedInvitation();
    const result = await resendInvite({
      instanceRecordId: INSTANCE_ID,
      email: "  rowan.corrected@example.com  ",
      viewerTokens: ["t"],
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.email).toBe("rowan.corrected@example.com");
    const [update] = callsMatching(/^UPDATE session_invite SET token_hash/);
    expect(update.values[2]).toBe("rowan.corrected@example.com");
    // The email's own facts come from the row read under the lock, not from a second query.
    expect(result.initiatorName).toBe("Avery");
    expect(result.counterpartyName).toBe("Rowan");
    expect(result.templateTitle).toBe("Relationship Basics");
    expect(result.resentCount).toBe(1);
  });

  it("locks the invitation before it decides, and commits the success", async () => {
    unclaimedInvitation();
    await resendInvite({ instanceRecordId: INSTANCE_ID, viewerTokens: ["t"], now: NOW });

    const [select] = callsMatching(/^SELECT iv\.email/);
    expect(stub.narrow(select.text)).toContain("FOR UPDATE OF iv, ai");
    expect(stub.calls.some((call) => stub.narrow(call.text) === "COMMIT")).toBe(true);
    expect(stub.calls.some((call) => stub.narrow(call.text) === "ROLLBACK")).toBe(false);
  });
});

describe("every refusal writes nothing", () => {
  const cases: readonly { name: string; setup: () => void; code: string }[] = [
    {
      name: "cooldown",
      setup: () =>
        unclaimedInvitation({
          resent_at: new Date(NOW.getTime() - 60 * 60 * 1000),
          resent_count: 1,
        }),
      code: "cooldown",
    },
    {
      name: "cap-reached",
      setup: () =>
        unclaimedInvitation({
          resent_at: new Date(NOW.getTime() - 3 * RESEND_COOLDOWN_MS),
          resent_count: RESEND_LIFETIME_CAP,
        }),
      code: "cap-reached",
    },
    {
      name: "already-claimed",
      setup: () => unclaimedInvitation({ claimed_at: new Date("2026-11-01T12:00:00.000Z") }),
      code: "already-claimed",
    },
    {
      name: "instance-complete",
      setup: () => {
        unclaimedInvitation({ claimed_at: new Date("2026-11-01T12:00:00.000Z") });
        stub.state.hasCounterparty = true;
        stub.state.answered = { initiator: 2, counterparty: 2 };
      },
      code: "instance-complete",
    },
    {
      name: "not-initiator",
      setup: () => {
        unclaimedInvitation();
        stub.state.roles = ["counterparty"];
      },
      code: "not-initiator",
    },
    {
      name: "no-invite",
      // The seat still exists (the instance has its Initiator); it is the invitation row that is
      // missing, which is the one thing `no-invite` is about.
      setup: () => {
        stub.reset();
        stub.state.roles = ["initiator"];
      },
      code: "no-invite",
    },
  ];

  for (const scenario of cases) {
    it(`refuses ${scenario.name} with a named code and no UPDATE`, async () => {
      scenario.setup();

      const result = await resendInvite({
        instanceRecordId: INSTANCE_ID,
        viewerTokens: ["t"],
        now: NOW,
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe(scenario.code);
      expect(result.reason.length).toBeGreaterThan(0);
      expect(callsMatching(/^(UPDATE|INSERT|DELETE)/)).toHaveLength(0);
      expect(stub.calls.some((call) => stub.narrow(call.text) === "ROLLBACK")).toBe(true);
    });
  }

  it("refuses an undeliverable address without writing", async () => {
    unclaimedInvitation();
    const result = await resendInvite({
      instanceRecordId: INSTANCE_ID,
      email: "rowan@example",
      viewerTokens: ["t"],
      now: NOW,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid-email");
    expect(callsMatching(/^UPDATE session_invite/)).toHaveLength(0);
  });
});
