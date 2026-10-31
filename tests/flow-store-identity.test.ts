/**
 * A party row carries the account that was there, and nothing a browser says about it
 * (#213's follow-up).
 *
 * The hole these cases close: `/assessment/instances` filters `party.user_id`, and until this
 * card **nothing wrote that column except `db:seed`** — so a signed-in person who created an
 * instance, or claimed an invitation, did not appear in their own list. The list worked for the
 * four seeded instances and for nobody else.
 *
 * Three rules come out of the card, and each has a case here:
 *
 *   the writer      creation writes the caller's account on the **Initiator's** row and never
 *                   on the Counterparty's (they are not the person creating it); a claim writes
 *                   it on the **Counterparty's** row. Both ride in the INSERT, inside the same
 *                   transaction that creates the row, so an instance cannot exist with a party
 *                   row that says nobody was there when somebody was.
 *   the signed-out  `null` is a value, not a missing feature: a creator or claimer with no
 *                   session leaves `party.user_id` NULL, exactly as #146 shipped it.
 *   the refusal     a session that already answers as a party of the instance cannot claim the
 *                   other seat (`already-a-party`), and a seat that is already taken cannot be
 *                   taken again (`already-bound`). Nothing on any path `UPDATE`s `party`, so an
 *                   existing non-NULL `user_id` is never overwritten — and one account cannot
 *                   be both parties (`party_instance_user_key`).
 *
 * **The client is a stub, on purpose.** The gate is database-free (`docs/GATE.md`), so the
 * store's SQL is driven through a recording `PoolClient` and the claims above are asserted on
 * the statements it issued: which table, which binding value, in which transaction. The port
 * that reads live rows is `pnpm db:verify`'s V10 (a seeded party still has its binding; every
 * binding names an account that exists), and the two-browser proof is a live probe, not a test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimInvite, createInstanceFromTemplate } from "@/lib/flow/store";
import { hashToken, mintToken } from "@/lib/flow/tokens";
import type { ClaimInput, CreateInstanceInput } from "@/lib/flow/store";

/* ------------------------------------------------------------------ *\
 * The stub client
 * ------------------------------------------------------------------ */

type PartySeat = {
  readonly role: "initiator" | "counterparty";
  readonly access_token_hash: string | null;
  readonly user_id: string | null;
};

const stub = vi.hoisted(() => {
  interface Call {
    readonly text: string;
    readonly values: readonly unknown[];
  }

  const calls: Call[] = [];
  const state: {
    /** The template the create copies from; `false` makes it the unknown-template refusal. */
    templatePresent: boolean;
    /** The invitation the claim locks, or `undefined` for an unknown token. */
    invite:
      | {
          readonly instance_record_id: string;
          readonly counterparty_name: string;
          readonly claimed_at: Date | null;
          readonly expires_at: Date;
        }
      | undefined;
    /** The instance's existing party rows — the seats a browser or an account may already hold. */
    seats: PartySeat[];
    /** `true` makes the claim's INSERT … ON CONFLICT DO NOTHING report a conflict. */
    seatTaken: boolean;
    /**
     * The billing gate's two reads (#289): how many active instances the account already holds.
     * `0` is "nothing open", which is what every pre-#289 case in this file is — and the live
     * subscription read is answered `null` (no row), i.e. the Free plan.
     */
    activeInstances: number;
  } = { templatePresent: true, invite: undefined, seats: [], seatTaken: false, activeInstances: 0 };

  /** One SQL statement, whitespace collapsed so a stub case reads as one line. */
  const narrow = (text: string) => text.replace(/\s+/g, " ").trim();

  function reset(): void {
    calls.length = 0;
    state.templatePresent = true;
    state.invite = undefined;
    state.seats = [];
    state.seatTaken = false;
    state.activeInstances = 0;
  }

  async function query(text: string, values: readonly unknown[] = []) {
    calls.push({ text, values });
    const sql = narrow(text);
    const wrote = { rows: [], rowCount: 1 };

    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: null };
    if (sql.startsWith("SELECT r.id, r.slug, r.title, r.record_type, r.status")) {
      return {
        rows: state.templatePresent
          ? [
              {
                id: "assessment-relationship-basics",
                slug: "relationship-basics",
                title: "Relationship Basics",
                record_type: "assessment",
                status: "published",
                aspects: 3,
                is_instance: false,
              },
            ]
          : [],
        rowCount: 1,
      };
    }
    if (sql.startsWith("INSERT INTO party")) {
      return state.seatTaken ? { rows: [], rowCount: 0 } : wrote;
    }
    if (sql.startsWith("SELECT instance_record_id, counterparty_name, claimed_at, expires_at")) {
      return { rows: state.invite === undefined ? [] : [state.invite], rowCount: 1 };
    }
    if (sql.includes("access_token_hash = ANY")) {
      const hashes = values[1] as readonly string[];
      return {
        rows: state.seats.filter(
          (seat) => seat.access_token_hash !== null && hashes.includes(seat.access_token_hash),
        ),
        rowCount: 1,
      };
    }
    if (sql.includes("AND user_id = $2")) {
      return { rows: state.seats.filter((seat) => seat.user_id === values[1]), rowCount: 1 };
    }
    if (
      sql.startsWith("INSERT INTO record") ||
      sql.startsWith("INSERT INTO item") ||
      sql.startsWith("INSERT INTO response_option") ||
      sql.startsWith("INSERT INTO assessment_instance") ||
      sql.startsWith("INSERT INTO instance_invite") ||
      sql.startsWith("UPDATE instance_invite")
    ) {
      return wrote;
    }
    throw new Error(`the stub client has no answer for: ${sql.slice(0, 80)}`);
  }

  /**
   * The pool-level reads (#289). They arrive through `queryRows`, not through a pooled client,
   * because `lib/db/billing.ts` reads on the pool — so they get their own stub rather than two
   * more cases in `query`, which is the transaction's client.
   */
  async function rows<T>(text: string, values: readonly unknown[] = []): Promise<T[]> {
    calls.push({ text, values });
    const sql = narrow(text);
    // No subscription row: the account is on the Free plan.
    if (sql.includes("FROM billing_subscription")) return [] as T[];
    if (sql.includes("FROM party vp") && sql.includes("JOIN assessment_instance ai")) {
      return [{ n: state.activeInstances }] as T[];
    }
    throw new Error(`the stub has no rows for: ${sql.slice(0, 80)}`);
  }

  return { calls, state, reset, query, rows, narrow };
});

vi.mock("@/lib/db/client", () => ({
  getPool: () => ({
    connect: async () => ({ query: stub.query, release: () => undefined }),
  }),
  queryRows: (text: string, values: readonly unknown[] = []) => stub.rows(text, values),
}));

/* ------------------------------------------------------------------ *\
 * Reading the statements back
 * ------------------------------------------------------------------ */

function callsMatching(pattern: RegExp) {
  return stub.calls.filter((call) => pattern.test(stub.narrow(call.text)));
}

/** Every statement that writes a party row, in the order the transaction issued them. */
function partyInserts() {
  return callsMatching(/^INSERT INTO party /);
}

/** The index of the one statement matching `pattern`; fails loudly when there is not exactly one. */
function onlyIndex(pattern: RegExp): number {
  const indexes = stub.calls
    .map((call, index) => (pattern.test(stub.narrow(call.text)) ? index : -1))
    .filter((index) => index !== -1);
  expect(indexes).toHaveLength(1);
  return indexes[0];
}

const TEMPLATE = "assessment-relationship-basics";

function createInput(over: Partial<CreateInstanceInput> = {}): CreateInstanceInput {
  return {
    templateRecordId: TEMPLATE,
    initiatorName: "Avery",
    counterpartyName: "Rowan",
    email: "rowan@example.test",
    mode: "basic",
    ...over,
  };
}

const INVITE_TOKEN = mintToken();

function invite(over: Partial<NonNullable<typeof stub.state.invite>> = {}) {
  return {
    instance_record_id: "assessment-instance-fresh",
    counterparty_name: "Rowan",
    claimed_at: null,
    expires_at: new Date(Date.now() + 60_000),
    ...over,
  };
}

function claimInput(over: Partial<ClaimInput> = {}): ClaimInput {
  return { token: INVITE_TOKEN, confirm: "Rowan", ...over };
}

/* ------------------------------------------------------------------ *\
 * Create — the Initiator's row
 * ------------------------------------------------------------------ */

beforeEach(() => stub.reset());

describe("createInstanceFromTemplate binds the creator", () => {
  it("writes the session's account on the Initiator's party row, inside the transaction", async () => {
    await createInstanceFromTemplate(createInput({ viewerUserId: "account-avery" }));

    const [insert] = partyInserts();
    expect(insert).toBeDefined();
    expect(stub.narrow(insert.text)).toContain("'initiator'");
    // `user_id` is the last column of the INSERT, so the account is the last bound parameter.
    expect(stub.narrow(insert.text)).toContain("user_id)");
    expect(insert.values[3]).toBe("account-avery");

    const committedAt = onlyIndex(/^COMMIT$/);
    const beganAt = onlyIndex(/^BEGIN$/);
    const insertAt = stub.calls.indexOf(insert);
    expect(beganAt).toBeLessThan(insertAt);
    expect(insertAt).toBeLessThan(committedAt);
  });

  it("does not bind the Counterparty — they are not the person creating the instance", async () => {
    await createInstanceFromTemplate(createInput({ viewerUserId: "account-avery" }));

    expect(partyInserts()).toHaveLength(1);
    expect(stub.narrow(partyInserts()[0].text)).not.toContain("'counterparty'");
    // The invitation names them, and carries no account: the row that would be theirs does not
    // exist until they claim it.
    const [invitation] = callsMatching(/^INSERT INTO instance_invite/);
    expect(invitation.values).not.toContain("account-avery");
  });

  it("leaves user_id NULL for a signed-out create, exactly as #146 shipped it", async () => {
    await createInstanceFromTemplate(createInput());

    const [insert] = partyInserts();
    expect(insert.values[3]).toBeNull();
    expect(stub.narrow(insert.text)).toContain("user_id)");
  });

  it("normalises a blank or padded id — a binding is an account or it is NULL", async () => {
    await createInstanceFromTemplate(createInput({ viewerUserId: "   " }));
    expect(partyInserts()[0].values[3]).toBeNull();

    stub.reset();
    await createInstanceFromTemplate(createInput({ viewerUserId: "  account-avery  " }));
    expect(partyInserts()[0].values[3]).toBe("account-avery");
  });

  it("ignores an identity the caller tried to pass under another name", async () => {
    // The route passes `viewerUserId` and only `viewerUserId`; anything else a caller invents
    // is not a property the store reads. This is the store's half of "no form field is an
    // identity" — a body could carry `userId` and it would land nowhere.
    const crafted = {
      ...createInput(),
      userId: "posted-by-the-browser",
      account: "posted-by-the-browser",
      user: "posted-by-the-browser",
    } as CreateInstanceInput;

    await createInstanceFromTemplate(crafted);

    expect(partyInserts()[0].values[3]).toBeNull();
    for (const call of stub.calls) expect(call.values).not.toContain("posted-by-the-browser");
  });
});

/* ------------------------------------------------------------------ *\
 * Claim — the Counterparty's row
 * ------------------------------------------------------------------ */

describe("claimInvite binds the claimer", () => {
  it("writes the session's account on the Counterparty's party row, once the token is spent", async () => {
    stub.state.invite = invite();

    const result = await claimInvite(claimInput({ viewerUserId: "account-rowan" }));

    expect(result).toMatchObject({ ok: true, instanceRecordId: "assessment-instance-fresh" });
    const [insert] = partyInserts();
    expect(stub.narrow(insert.text)).toContain("'counterparty'");
    expect(stub.narrow(insert.text)).toContain("user_id)");
    expect(insert.values[3]).toBe("account-rowan");

    const insertAt = stub.calls.indexOf(insert);
    expect(insertAt).toBeGreaterThan(onlyIndex(/^BEGIN$/));
    expect(insertAt).toBeLessThan(onlyIndex(/^UPDATE instance_invite /));
    expect(insertAt).toBeLessThan(onlyIndex(/^COMMIT$/));
  });

  it("leaves user_id NULL for a signed-out claim — the link-bound browser is unchanged", async () => {
    stub.state.invite = invite();

    const result = await claimInvite(claimInput());

    expect(result).toMatchObject({ ok: true });
    expect(partyInserts()[0].values[3]).toBeNull();
  });

  it("ignores an identity posted beside the confirmation", async () => {
    stub.state.invite = invite();

    const crafted = {
      ...claimInput(),
      userId: "posted-by-the-browser",
      viewerRole: "counterparty",
    } as ClaimInput;

    await claimInvite(crafted);

    expect(partyInserts()[0].values[3]).toBeNull();
    for (const call of stub.calls) expect(call.values).not.toContain("posted-by-the-browser");
  });
});

/* ------------------------------------------------------------------ *\
 * The refusals — and the binding that survives them
 * ------------------------------------------------------------------ */

describe("a seat already held is not taken twice", () => {
  it("refuses an account that already answers as a party, and writes nothing", async () => {
    stub.state.invite = invite();
    stub.state.seats = [{ role: "initiator", access_token_hash: null, user_id: "account-avery" }];

    const result = await claimInvite(claimInput({ viewerUserId: "account-avery" }));

    expect(result).toMatchObject({ ok: false, code: "already-a-party", role: "initiator" });
    expect(partyInserts()).toHaveLength(0);
    expect(callsMatching(/^UPDATE instance_invite /)).toHaveLength(0);
    expect(callsMatching(/^ROLLBACK$/)).toHaveLength(1);
  });

  it("still refuses the browser that holds the other party's cookie", async () => {
    stub.state.invite = invite();
    stub.state.seats = [
      {
        role: "counterparty",
        access_token_hash: hashToken("a-cookie-this-browser-holds"),
        user_id: null,
      },
    ];

    const result = await claimInvite(
      claimInput({ viewerTokens: ["a-cookie-this-browser-holds"], viewerUserId: "account-other" }),
    );

    expect(result).toMatchObject({ ok: false, code: "already-a-party", role: "counterparty" });
    expect(partyInserts()).toHaveLength(0);
  });

  it("refuses a seat that a second signed-in person cannot take, and never rebinds it", async () => {
    // The invitation is unclaimed while the Counterparty's row already exists — a seeded
    // instance, or a row a previous claim left behind. Inserting under it is the only write
    // this path makes, and it reports a conflict instead of updating the binding.
    stub.state.invite = invite();
    stub.state.seats = [
      { role: "counterparty", access_token_hash: null, user_id: "account-rowan" },
    ];
    stub.state.seatTaken = true;

    const result = await claimInvite(claimInput({ viewerUserId: "account-someone-else" }));

    expect(result).toMatchObject({ ok: false, code: "already-bound" });
    const [insert] = partyInserts();
    expect(stub.narrow(insert.text)).toContain("ON CONFLICT (instance_record_id, role) DO NOTHING");
    expect(stub.narrow(insert.text)).not.toContain("DO UPDATE");
    expect(callsMatching(/^UPDATE instance_invite /)).toHaveLength(0);
  });

  it("cannot be made to write a binding through any UPDATE on party", async () => {
    // The rule the card states as "an existing non-NULL user_id is never overwritten", asserted
    // the way the store keeps it: the binding only ever rides an INSERT of a row that cannot
    // pre-exist. A future edit that reaches for `UPDATE party SET user_id` fails here.
    stub.state.invite = invite();
    await claimInvite(claimInput({ viewerUserId: "account-rowan" }));

    stub.reset();
    await createInstanceFromTemplate(createInput({ viewerUserId: "account-avery" }));

    expect(callsMatching(/UPDATE party/i)).toHaveLength(0);
  });
});
