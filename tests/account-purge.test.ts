/**
 * The account-deletion sweep, with no database (#278).
 *
 * `docs/specs/account-deletion-spec.md` §7 is the plan; these cases hold the two properties the plan
 * exists for, and they are the two a reader cannot check by reading the file top to bottom:
 *
 *   - **the order**, which is load-bearing in three places (a complete session must not be voided;
 *     the prose rewrite must run while `party.name` still holds the search string; the profile row
 *     goes after everything that joins it);
 *   - **the auth-first rule**, which is a claim about what has *not* happened: when the managed-auth
 *     delete fails, no `public` row may have been touched. That is the one state §2 forbids, and a
 *     unit case is the only place it can be driven without destroying a branch.
 *
 * The live half — rows gone, the survivor's report intact, idempotence — is
 * `tests/account-deletion-live.test.ts`, skipped unless a `DATABASE_URL` names a branch.
 */
import { describe, expect, it } from "vitest";
import type { QueryResultRow } from "pg";

import {
  AuthUserDeleteError,
  buildPurgeSteps,
  emptyPurgeCounts,
  purgeAccount,
  runAccountDeletion,
  type PurgeIdentity,
} from "@/lib/account/purge";
import { orphanProfileProblems } from "../scripts/db-verify.mjs";

/** One seat of one session, held by the account being deleted. */
function identity(roles: readonly string[] = ["initiator"]): PurgeIdentity {
  return {
    userId: "acct-1",
    email: "avery@example.test",
    names: ["Avery Rowan"],
    roles,
  };
}

/** The step keys, in the order the sweep would run them. */
function order(roles: readonly string[] = ["initiator"]): string[] {
  return buildPurgeSteps(identity(roles)).map((step) => step.key);
}

/**
 * A `pg`-shaped client that records every statement.
 *
 * `rowsFor` decides what each statement answers, so a case can say "this query returns one seat"
 * without a database. `rowCount` defaults to the row count, which is what `purgeAccount` adds up.
 */
class RecordingClient {
  readonly statements: { text: string; values: readonly unknown[] }[] = [];
  private readonly failOn: string | null;

  constructor(
    private readonly rowsFor: (text: string) => {
      rows: QueryResultRow[];
      rowCount?: number;
    } = () => ({
      rows: [],
    }),
    failOn: string | null = null,
  ) {
    this.failOn = failOn;
  }

  async query(text: string, values: readonly unknown[] = []) {
    this.statements.push({ text, values });
    if (this.failOn !== null && text.includes(this.failOn)) {
      throw new Error(`refused: ${this.failOn}`);
    }
    const answer = this.rowsFor(text);
    return { rows: answer.rows, rowCount: answer.rowCount ?? answer.rows.length };
  }

  release() {
    // Nothing to release: the fake holds no socket.
  }

  /** The `public` statements, i.e. everything the sweep itself issued. */
  get sweepStatements(): string[] {
    return this.statements.map((statement) => statement.text);
  }
}

describe("the sweep's order", () => {
  it("voids an incomplete session before it anonymises the seat", () => {
    const keys = order();
    expect(keys.indexOf("sessionsVoided")).toBeLessThan(keys.indexOf("partiesAnonymised"));
  });

  it("rewrites the prose before party.name becomes the label", () => {
    const keys = order();
    expect(keys.indexOf("recordSummariesRewritten")).toBeLessThan(
      keys.indexOf("partiesAnonymised"),
    );
    expect(keys.indexOf("sessionNamesRewritten")).toBeLessThan(keys.indexOf("partiesAnonymised"));
  });

  it("deletes the profile after the records it is joined to are archived", () => {
    const keys = order();
    expect(keys.indexOf("recordsArchived")).toBeLessThan(keys.indexOf("profilesDeleted"));
    expect(keys.indexOf("relationshipsDeidentified")).toBeLessThan(keys.indexOf("profilesDeleted"));
  });

  it("keeps the invitations' row decision ahead of the seat's anonymisation", () => {
    const keys = order();
    expect(keys.indexOf("sessionInvitesDeleted")).toBeLessThan(keys.indexOf("partiesAnonymised"));
  });

  it("suppresses the marketing address last, as §7 step 4 ends", () => {
    const keys = order();
    expect(keys.at(-1)).toBe("newsSignupsSuppressed");
  });
});

describe("the session step", () => {
  it("leaves a complete session alone — both accepted_at stamps are part of the guard", () => {
    const [step] = buildPurgeSteps(identity());
    // The rule that makes the survivor's report survive (§2.3): a session is only voided when it is
    // NOT in the set that the product's own derivation calls complete.
    expect(step.sql).toContain("NOT IN (SELECT record_id FROM complete)");
    const acceptanceHinges = step.sql.match(/accepted_at IS NOT NULL/g) ?? [];
    expect(acceptanceHinges).toHaveLength(2);
  });

  it("stamps an actor beside the instant, because the schema's CHECK pairs them", () => {
    const [step] = buildPurgeSteps(identity());
    expect(step.sql).toContain("voided_by = $2");
    expect(step.values(identity())).toEqual(["acct-1", "account-deletion"]);
  });
});

describe("the invitation row decision (§2.6)", () => {
  it("deletes the row when the counterparty leaves, and clears the address when the initiator does", () => {
    const asCounterparty = buildPurgeSteps(identity(["counterparty"])).map((step) => step.key);
    expect(asCounterparty).toContain("sessionInvitesDeleted");
    expect(asCounterparty).not.toContain("sessionInvitesUnaddressed");

    const asInitiator = buildPurgeSteps(identity(["initiator"])).map((step) => step.key);
    expect(asInitiator).toContain("sessionInvitesUnaddressed");
    expect(asInitiator).not.toContain("sessionInvitesDeleted");

    const both = buildPurgeSteps(identity(["initiator", "counterparty"])).map((step) => step.key);
    expect(both).toContain("sessionInvitesDeleted");
    expect(both).toContain("sessionInvitesUnaddressed");
  });

  it("writes no prose rewrite for the label itself", () => {
    const steps = buildPurgeSteps({
      ...identity(),
      names: ["Deleted account"],
    });
    expect(steps.map((step) => step.key)).not.toContain("recordSummariesRewritten");
  });
});

describe("purgeAccount", () => {
  it("opens one transaction, runs every step, and commits", async () => {
    const client = new RecordingClient(() => ({ rows: [], rowCount: 2 }));
    const counts = await purgeAccount(client, identity());
    const texts = client.sweepStatements;
    expect(texts[0]).toBe("BEGIN");
    expect(texts.at(-1)).toBe("COMMIT");
    expect(counts.partiesAnonymised).toBe(2);
  });

  it("rolls the whole sweep back when one statement fails", async () => {
    const client = new RecordingClient(() => ({ rows: [] }), "DELETE FROM user_profile");
    await expect(purgeAccount(client, identity())).rejects.toThrow("refused");
    expect(client.sweepStatements.at(-1)).toBe("ROLLBACK");
    expect(client.sweepStatements).not.toContain("COMMIT");
  });

  it("starts from zeroes, so a run's counts are its own", () => {
    expect(Object.values(emptyPurgeCounts()).every((count) => count === 0)).toBe(true);
  });
});

describe("runAccountDeletion", () => {
  /** The reads the sweep does before it deletes anything: the auth user and the seats. */
  const reads = (text: string) => {
    if (text.includes("information_schema.tables")) return { rows: [{ table_name: "user" }] };
    if (text.includes('FROM neon_auth."user"')) {
      return { rows: [{ id: "acct-1", email: "Avery@Example.test" }] };
    }
    if (text.includes("SELECT name, role FROM party")) {
      return { rows: [{ name: "Avery Rowan", role: "initiator" }] };
    }
    return { rows: [], rowCount: 0 };
  };

  it("records the intent before it deletes the auth user, then begins the scrub", async () => {
    const client = new RecordingClient(reads);
    const before = { at: -1 };
    const outcome = await runAccountDeletion("acct-1", {
      connect: async () => client,
      deleteAuth: async () => {
        before.at = client.statements.length;
      },
    });
    expect(outcome.kind).toBe("deleted");
    // The intent row is the one write that comes before the irreversible call, and it is the
    // record a failed scrub resumes from (§7 step 2b).
    const intentIndex = client.statements.findIndex((statement) =>
      statement.text.startsWith("INSERT INTO account_deletion_job"),
    );
    expect(intentIndex).toBeGreaterThanOrEqual(0);
    expect(intentIndex).toBeLessThan(before.at);
    // The sweep's own transaction starts after it: no `public` row of the person's is scrubbed
    // before the auth user is gone.
    const beginIndex = client.sweepStatements.indexOf("BEGIN");
    expect(beginIndex).toBeGreaterThanOrEqual(before.at);
    expect(beginIndex).toBeGreaterThan(0);
  });

  it("leaves every public row untouched when the auth delete fails (§7 step 3)", async () => {
    const client = new RecordingClient(reads);
    const outcome = await runAccountDeletion("acct-1", {
      connect: async () => client,
      deleteAuth: async () => {
        throw new Error("DELETE …/auth/users/acct-1 answered 500");
      },
    });
    expect(outcome.kind).toBe("auth-failed");
    // Not one BEGIN, not one UPDATE: the failure happened before the scrub existed.
    expect(client.sweepStatements).not.toContain("BEGIN");
    expect(client.sweepStatements.some((text) => text.startsWith("UPDATE"))).toBe(false);
    // The only write of any kind is the intent row's removal: nothing was deleted, so there is
    // nothing to resume.
    const deletes = client.statements.filter((statement) => statement.text.startsWith("DELETE"));
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.text).toContain("DELETE FROM account_deletion_job");
    // And the sweep's tables are untouched.
    expect(client.statements.some((statement) => statement.text.includes("FROM party p"))).toBe(
      false,
    );
  });

  it("leaves the intent row alone when the auth delete answers 404 (a race, not a failure)", async () => {
    const client = new RecordingClient(reads);
    const outcome = await runAccountDeletion("acct-1", {
      connect: async () => client,
      deleteAuth: async () => {
        throw new AuthUserDeleteError("DELETE …/auth/users/acct-1 answered 404", 404);
      },
    });
    expect(outcome.kind).toBe("auth-failed");
    // The row is the other attempt's resume record: deleting it here would strand that attempt's
    // half-finished deletion, which is the bug this table exists to prevent.
    expect(
      client.statements.some((statement) =>
        statement.text.startsWith("DELETE FROM account_deletion_job"),
      ),
    ).toBe(false);
  });

  it("answers unknown-account for an id no auth user carries, and deletes nothing", async () => {
    const client = new RecordingClient((text) => {
      if (text.includes("information_schema.tables")) return { rows: [{ table_name: "user" }] };
      return { rows: [] };
    });
    let deleted = false;
    const outcome = await runAccountDeletion("nobody", {
      connect: async () => client,
      deleteAuth: async () => {
        deleted = true;
      },
    });
    expect(outcome.kind).toBe("unknown-account");
    expect(deleted).toBe(false);
  });

  it("resumes from the recorded identity when the auth user is already gone (T9)", async () => {
    // The state a failed scrub leaves: `neon_auth` has no user, and one unfinished row carries
    // the address and the role the retry cannot re-derive.
    const client = new RecordingClient((text) => {
      if (text.includes("information_schema.tables")) return { rows: [{ table_name: "user" }] };
      if (text.includes('FROM neon_auth."user"')) return { rows: [] };
      if (text.includes("FROM account_deletion_job")) {
        return {
          rows: [
            {
              user_id: "acct-1",
              email: "avery@example.test",
              names: ["Avery Rowan"],
              roles: ["initiator"],
            },
          ],
        };
      }
      return { rows: [], rowCount: 0 };
    });
    let deleteAttempted = false;
    const outcome = await runAccountDeletion("acct-1", {
      connect: async () => client,
      deleteAuth: async () => {
        deleteAttempted = true;
      },
    });

    // The sweep runs, and step 3 is skipped: there is no auth user to delete, and a second DELETE
    // would answer 404 and read as a failure.
    expect(outcome.kind).toBe("deleted");
    expect(deleteAttempted).toBe(false);
    // With the recorded address, so the email-keyed rows §1.1 names are reachable again.
    const signup = client.statements.find((statement) => statement.text.includes("news_signup"));
    expect(signup?.values[0]).toBe("avery@example.test");
    // And the intent row is finished rather than left open — the identity goes with the sweep.
    const finish = client.statements.find((statement) =>
      statement.text.includes("UPDATE account_deletion_job"),
    );
    expect(finish?.text).toContain("finished_at = now()");
    expect(finish?.text).toContain("email = NULL");
  });

  it("answers unknown-account when the recorded row is already finished", async () => {
    const client = new RecordingClient((text) => {
      if (text.includes("information_schema.tables")) return { rows: [{ table_name: "user" }] };
      // `openIntentOf` filters on `finished_at IS NULL`, so a finished row is not returned; the
      // fake returns nothing, which is what that predicate produces.
      return { rows: [] };
    });
    const outcome = await runAccountDeletion("acct-1", {
      connect: async () => client,
      deleteAuth: async () => {},
    });
    expect(outcome.kind).toBe("unknown-account");
    expect(client.statements.some((statement) => statement.text === "BEGIN")).toBe(false);
  });

  it("lowercases the address it reads, so the email-keyed tables match", async () => {
    const client = new RecordingClient(reads);
    const seen: unknown[][] = [];
    await runAccountDeletion("acct-1", {
      connect: async () => client,
      deleteAuth: async () => {},
    });
    for (const statement of client.statements) {
      if (statement.text.includes("news_signup")) seen.push([...statement.values]);
    }
    expect(seen).toHaveLength(1);
    expect(seen[0]?.[0]).toBe("avery@example.test");
  });
});

describe("V27's rule", () => {
  it("names a profile whose account is gone", () => {
    const problems = orphanProfileProblems(["acct-1", "acct-2"], ["acct-1"]);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.code).toBe("V27");
    expect(problems[0]?.message).toContain("acct-2");
  });

  it("stays green when every profile has an account, and can fail", () => {
    expect(orphanProfileProblems(["acct-1"], ["acct-1"])).toEqual([]);
    // Positive control: the same call with the account missing must not stay green.
    expect(orphanProfileProblems(["acct-1"], [])).toHaveLength(1);
  });
});
