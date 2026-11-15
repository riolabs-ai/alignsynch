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
 *                   be both parties (`party_session_user_key`).
 *
 * **The client is a stub, on purpose.** The gate is database-free (`docs/operations/gate.md`), so the
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
    /**
     * `record.author_user_id` of that template (#console 5/5): `null` is a built-in, an id is
     * the account that wrote it. Mutable so the refusal case can make it somebody else's.
     */
    templateAuthorId: string | null;
    /** The invitation the claim locks, or `undefined` for an unknown token. */
    invite:
      | {
          readonly session_record_id: string;
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
     * The billing gate's three reads (#289, #505): how many active instances the account already
     * holds, how many relationships it has started, and whether any grant is running. `0`, `0` and
     * "no grant" is "nothing open, nothing bought", which is what every pre-#289 case in this file
     * is — and the live subscription read is answered `null` (no row), i.e. the Free plan.
     */
    activeInstances: number;
    activeRelationships: number;
  } = {
    templatePresent: true,
    templateAuthorId: null,
    invite: undefined,
    seats: [],
    seatTaken: false,
    activeInstances: 0,
    activeRelationships: 0,
  };

  /** One SQL statement, whitespace collapsed so a stub case reads as one line. */
  const narrow = (text: string) => text.replace(/\s+/g, " ").trim();

  function reset(): void {
    calls.length = 0;
    state.templatePresent = true;
    state.templateAuthorId = null;
    state.invite = undefined;
    state.seats = [];
    state.seatTaken = false;
    state.activeInstances = 0;
    state.activeRelationships = 0;
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
                // A built-in: `0011_console_columns.sql` leaves the author NULL, and the
                // create's author check (#console 5/5) reads NULL as "the platform's, copyable
                // by anybody". A row fixture without the column would read as somebody else's.
                author_user_id: state.templateAuthorId,
                aspects: 3,
                is_instance: false,
              },
            ]
          : [],
        rowCount: 1,
      };
    }
    if (sql.startsWith("SELECT id, version, payload FROM template_version")) {
      // #502b — a create copies the **version** the relationship is bound to, not the template's
      // working `item` rows. The payload is a `zAssessment` object, so the stub owes a real one.
      return {
        rows: [
          {
            id: "template-version-assessment-relationship-basics-v1",
            version: 1,
            payload: {
              id: "assessment-relationship-basics",
              slug: "relationship-basics",
              type: "assessment",
              status: "published",
              date: "2026-10-24T09:00:00.000Z",
              title: "Relationship Basics",
              summary: "Three Aspects two people answer.",
              items: ["One", "Two", "Three"].map((word) => ({
                id: `aspect-${word.toLowerCase()}`,
                prompt: `Aspect ${word}`,
                scale: { kind: "score", min: 1, max: 5 },
                leftValue: "Low",
                rightValue: "High",
              })),
            },
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.startsWith("INSERT INTO party")) {
      return state.seatTaken ? { rows: [], rowCount: 0 } : wrote;
    }
    if (sql.startsWith("SELECT session_record_id, counterparty_name, claimed_at, expires_at")) {
      return { rows: state.invite === undefined ? [] : [state.invite], rowCount: 1 };
    }
    // #533 phase 3 — the claim asks which relationship the invitation's session belongs to before
    // it binds the seat. These cases are about the binding, not the membership, so the answer is
    // "no relationship named": the lapse check is skipped and the claim is unchanged.
    if (sql.startsWith("SELECT relationship_id FROM session")) {
      return { rows: [{ relationship_id: null }], rowCount: 1 };
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
      sql.startsWith("INSERT INTO relationship") ||
      sql.startsWith("INSERT INTO session") ||
      sql.startsWith("INSERT INTO session_invite") ||
      sql.startsWith("UPDATE session_invite")
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
    // #835 — the publish trial, written by `grantPublishTrial()`. Asked before the read below
    // because this statement's `WHERE NOT EXISTS` also selects `FROM billing_subscription`, and
    // a write must not be answered as a read. One row: the fixture grants the trial.
    if (sql.startsWith("INSERT INTO billing_subscription")) {
      return [{ provider_subscription_id: `trial:${String(values[0])}` }] as T[];
    }
    // No subscription row: the account is on the Free plan.
    if (sql.includes("FROM billing_subscription")) return [] as T[];
    if (sql.includes("FROM party vp") && sql.includes("JOIN session ai")) {
      return [{ n: state.activeInstances }] as T[];
    }
    // #505 — the plan's own count, and the grants that could raise the tier. No grant here: this
    // fixture is about identity binding, and an empty grant list is the Free plan's own answer.
    if (sql.includes("FROM relationship r") && sql.includes("count(*)::int AS n")) {
      return [{ n: state.activeRelationships }] as T[];
    }
    if (sql.includes("FROM plan_grant")) return [] as T[];
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
    session_record_id: "assessment-instance-fresh",
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
    const [invitation] = callsMatching(/^INSERT INTO session_invite/);
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

  it("refuses a template another account wrote, and writes nothing (#console 5/5)", async () => {
    stub.state.templateAuthorId = "account-rowan";

    await expect(
      createInstanceFromTemplate(createInput({ viewerUserId: "account-avery" })),
    ).rejects.toMatchObject({ code: "template-not-yours" });

    // Refused inside the transaction, before anything was written: no record, no party, no
    // invitation, and the transaction rolled back rather than committed.
    expect(callsMatching(/^INSERT INTO/)).toHaveLength(0);
    const statements = stub.calls.map((call) => stub.narrow(call.text));
    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
  });

  it("allows the account that wrote the template to copy it", async () => {
    stub.state.templateAuthorId = "account-avery";

    await createInstanceFromTemplate(createInput({ viewerUserId: "account-avery" }));

    expect(partyInserts()).toHaveLength(1);
    expect(partyInserts()[0].values[3]).toBe("account-avery");
  });

  it("refuses a signed-out caller copying an authored template", async () => {
    stub.state.templateAuthorId = "account-avery";

    await expect(createInstanceFromTemplate(createInput())).rejects.toMatchObject({
      code: "template-not-yours",
    });
  });
});

/* ------------------------------------------------------------------ *\
 * Create — the Setting the form chose (#427)
 * ------------------------------------------------------------------ */

describe("createInstanceFromTemplate writes the Setting the form chose", () => {
  /** The one `session` INSERT, with whitespace collapsed so the column list reads as a line. */
  function sessionInsert() {
    const [insert] = callsMatching(/^INSERT INTO session \(record_id, template_record_id/);
    expect(insert).toBeDefined();
    return insert;
  }

  it("writes `full` on the session row when the form chose Full", async () => {
    await createInstanceFromTemplate(createInput({ alignmentSetting: "full" }));

    // The settings are the fourth bound parameter: record_id, template_record_id, mode, setting.
    expect(sessionInsert().values[3]).toBe("full");
  });

  it("writes `soft` when the form was not given a Setting at all", async () => {
    // The five-field post the endpoint has always accepted: the schema's documented default
    // (`0008_alignment_setting.sql`), never a refusal.
    await createInstanceFromTemplate(createInput());

    expect(sessionInsert().values[3]).toBe("soft");
  });

  it("refuses a Setting the model does not name, before the transaction opens", async () => {
    await expect(
      createInstanceFromTemplate(createInput({ alignmentSetting: "bogus" })),
    ).rejects.toMatchObject({ code: "invalid-input" });

    // Not "wrote nothing and rolled back": the parse happens before `getPool()`, so the stub
    // client is never asked for a statement and no transaction exists to roll back.
    expect(stub.calls).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *\
 * Create — the publish trial (#835)
 * ------------------------------------------------------------------ */

/**
 * A create that publishes opens the trial, on **both** publish paths.
 *
 * The draft path has granted it since #840 (`sendDraftInvitation`). The pre-#825 one-form create
 * publishes inside its own transaction and granted nothing — so the row it committed read
 * `lapsed` on the next membership read and the counterparty's claim was refused. #835 makes the
 * two paths agree: whichever write moves a relationship to `published` opens the week.
 */
describe("a create that publishes opens the trial", () => {
  function trialInserts() {
    return callsMatching(/^INSERT INTO billing_subscription/);
  }

  it("grants it for the account that published, after the relationship is committed", async () => {
    await createInstanceFromTemplate(createInput({ viewerUserId: "account-avery" }));

    const [grant] = trialInserts();
    expect(grant).toBeDefined();
    // After COMMIT, not inside the transaction: a trial that described a rolled-back relationship
    // would be a paid week for nothing.
    expect(onlyIndex(/^INSERT INTO billing_subscription/)).toBeGreaterThan(onlyIndex(/^COMMIT$/));
    expect(grant.values[0]).toBe("account-avery");
    // The entry paid tier — `PUBLISH_TRIAL_PLAN_ID`, the one whose entitlement plays both modes.
    expect(grant.values[1]).toBe("basic");
  });

  it("writes none for a draft — the send is what publishes, and it grants there", async () => {
    await createInstanceFromTemplate(createInput({ viewerUserId: "account-avery", draft: true }));

    expect(trialInserts()).toHaveLength(0);
  });

  it("writes none for a signed-out create — there is no account to hold a trial", async () => {
    await createInstanceFromTemplate(createInput({ viewerUserId: null }));

    expect(trialInserts()).toHaveLength(0);
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
    expect(insertAt).toBeLessThan(onlyIndex(/^UPDATE session_invite /));
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
    expect(callsMatching(/^UPDATE session_invite /)).toHaveLength(0);
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
    expect(stub.narrow(insert.text)).toContain("ON CONFLICT (session_record_id, role) DO NOTHING");
    expect(stub.narrow(insert.text)).not.toContain("DO UPDATE");
    expect(callsMatching(/^UPDATE session_invite /)).toHaveLength(0);
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

/* ------------------------------------------------------------------ *\
 * Create — stage 3's list (#689)
 * ------------------------------------------------------------------ */

/**
 * Stage 3 edits the Aspects the relationship will ask (#689), and — since #699 — may add or remove
 * one. So the create makes one decision and the store records it:
 *
 *   - **a copy** (reworded only): the version's ids *and order*, carrying the person's words.
 *     `aspects_authored_at` stays NULL and `db:verify` V4 compares it to the pinned version.
 *   - **the creator's own list** (an Aspect added, removed or reordered): every row as they left
 *     it, an id minted for each row they added, and `aspects_authored_at` set — which is what tells
 *     V4 to validate the copy's structure instead of an equality that was never true.
 *
 * The cases below read the arrays the `INSERT … SELECT unnest()` is handed (id, position, prompt,
 * left, right) and the session INSERT's sixth parameter.
 */
describe("createInstanceFromTemplate writes stage 3's list", () => {
  /** The item INSERT's bound arrays, in the order the statement names them. */
  async function itemCopy(over: Partial<CreateInstanceInput>) {
    stub.reset();
    await createInstanceFromTemplate(createInput(over));
    const [insert] = callsMatching(/^INSERT INTO item/);
    expect(insert).toBeDefined();
    return {
      ids: insert.values[1] as readonly string[],
      positions: insert.values[2] as readonly number[],
      prompts: insert.values[3] as readonly string[],
      lefts: insert.values[4] as readonly string[],
      rights: insert.values[5] as readonly string[],
      /** `session.aspects_authored_at` — the sixth parameter of the session INSERT (#699). */
      authoredAt: (() => {
        const [session] = callsMatching(/^INSERT INTO session \(record_id, template_record_id/);
        expect(session).toBeDefined();
        return session.values[5];
      })(),
    };
  }

  it("copies the version's Aspects verbatim when the post carries no list", async () => {
    const copy = await itemCopy({});
    expect(copy.ids).toEqual(["aspect-one", "aspect-two", "aspect-three"]);
    expect(copy.positions).toEqual([0, 1, 2]);
    expect(copy.prompts).toEqual(["Aspect One", "Aspect Two", "Aspect Three"]);
    expect(copy.lefts).toEqual(["Low", "Low", "Low"]);
    expect(copy.rights).toEqual(["High", "High", "High"]);
    // No instant: this copy is the version's, and V4 compares it to the pin.
    expect(copy.authoredAt).toBeNull();
  });

  it("writes the words the person reworded, keeping the version's ids and order", async () => {
    // The draft holds the **whole list** — stage 3 posts the list the person is looking at, not a
    // patch — so a reworded copy arrives as all three rows with one changed.
    const copy = await itemCopy({
      aspects: [
        { id: "aspect-one", prompt: "Aspect One", leftValue: "Low", rightValue: "High" },
        {
          id: "aspect-two",
          prompt: "Do we say it early?",
          leftValue: "Rarely",
          rightValue: "Always",
        },
        { id: "aspect-three", prompt: "Aspect Three", leftValue: "Low", rightValue: "High" },
      ],
    });
    expect(copy.ids).toEqual(["aspect-one", "aspect-two", "aspect-three"]);
    expect(copy.prompts).toEqual(["Aspect One", "Do we say it early?", "Aspect Three"]);
    expect(copy.lefts).toEqual(["Low", "Rarely", "Low"]);
    expect(copy.rights).toEqual(["High", "Always", "High"]);
    // Rewording is not authorship: the copy is still the version's list.
    expect(copy.authoredAt).toBeNull();
  });

  it("stores a row the person added, in their order, with a minted id and the instant (#699)", async () => {
    const copy = await itemCopy({
      aspects: [
        { id: "aspect-one", prompt: "Aspect One", leftValue: "Low", rightValue: "High" },
        { id: "new-1", prompt: "Do we say thank you?", leftValue: "Never", rightValue: "Daily" },
        { id: "aspect-two", prompt: "Aspect Two", leftValue: "Low", rightValue: "High" },
        { id: "aspect-three", prompt: "Aspect Three", leftValue: "Low", rightValue: "High" },
      ],
    });

    expect(copy.ids).toHaveLength(4);
    expect(copy.ids[0]).toBe("aspect-one");
    expect(copy.ids[2]).toBe("aspect-two");
    expect(copy.ids[3]).toBe("aspect-three");
    // The added row's id is a record id — never the browser's `new-1` placeholder.
    expect(copy.ids[1]).toMatch(/^aspect-[0-9a-f-]{36}$/);
    expect(copy.positions).toEqual([0, 1, 2, 3]);
    expect(copy.prompts[1]).toBe("Do we say thank you?");
    expect(copy.authoredAt).not.toBeNull();
  });

  it("keeps a removed Aspect removed, and records the copy as authored (#699)", async () => {
    const copy = await itemCopy({
      aspects: [
        { id: "aspect-one", prompt: "Aspect One", leftValue: "Low", rightValue: "High" },
        { id: "aspect-three", prompt: "Aspect Three", leftValue: "Low", rightValue: "High" },
      ],
    });

    // The old reduction wrote the version's three rows back, silently undoing the removal.
    expect(copy.ids).toEqual(["aspect-one", "aspect-three"]);
    expect(copy.authoredAt).not.toBeNull();
  });

  it("keeps a dragged list in the order it was dragged into (#699)", async () => {
    const copy = await itemCopy({
      aspects: [
        { id: "aspect-three", prompt: "Aspect Three", leftValue: "Low", rightValue: "High" },
        { id: "aspect-one", prompt: "Aspect One", leftValue: "Low", rightValue: "High" },
        { id: "aspect-two", prompt: "Aspect Two", leftValue: "Low", rightValue: "High" },
      ],
    });

    expect(copy.ids).toEqual(["aspect-three", "aspect-one", "aspect-two"]);
    expect(copy.authoredAt).not.toBeNull();
  });

  it("falls back to the version's words for a blank value, never writing an empty prompt", async () => {
    const copy = await itemCopy({
      aspects: [{ id: "aspect-one", prompt: "   ", leftValue: "", rightValue: "" }],
    });
    expect(copy.prompts[0]).toBe("Aspect One");
    expect(copy.lefts[0]).toBe("Low");
    expect(copy.rights[0]).toBe("High");
  });

  it("refuses an emptied list before the transaction opens — a relationship asks at least one", async () => {
    stub.reset();
    await expect(createInstanceFromTemplate(createInput({ aspects: [] }))).rejects.toMatchObject({
      code: "aspects-none",
    });

    // Not "wrote nothing and rolled back": the refusal is before `getPool()`.
    expect(stub.calls).toHaveLength(0);
  });

  it("refuses a blank row the person added — nothing can stand in for its question", async () => {
    stub.reset();
    await expect(
      createInstanceFromTemplate(
        createInput({
          aspects: [
            { id: "aspect-one", prompt: "Aspect One", leftValue: "Low", rightValue: "High" },
            { id: "new-1", prompt: "   ", leftValue: "Never", rightValue: "Daily" },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: "invalid-input" });

    // The check needs the version in hand, so it runs inside the transaction — and the transaction
    // is rolled back rather than committed.
    expect(callsMatching(/^COMMIT$/)).toHaveLength(0);
    expect(callsMatching(/^INSERT INTO item/)).toHaveLength(0);
  });
});
