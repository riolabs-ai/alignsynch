/**
 * The broadcast's rules, its audience, and the one send (#507, epic #500) — driven with no database
 * and no provider.
 *
 * Four things are pinned here, and each answers one of the card's acceptance lines without needing a
 * running deployment:
 *
 *   the floor       `broadcast.send` is `admin`, and `support` is refused **by `act()`** inside the
 *                   transaction — the same `ActRefused("role-too-low")` a member gets from any other
 *                   action. The fake connection is the one `tests/admin-act.test.ts` uses, so the
 *                   refusal is a statement-order assertion rather than a claim about a button.
 *   one function    the dry run and the send both call `broadcastAudience()`. The preview goes
 *                   through the pool and the send through `act()`'s transaction, so the test drives
 *                   both and asserts the two numbers are one.
 *   consent         the audience SQL carries the three marks (`unsubscribed_at`, `bounced_at`,
 *                   `complained_at`), the segment and the cooldown window; deleting one predicate
 *                   from `lib/db/news-signups.ts` turns this file red by *name*.
 *   no address      the audit row's `after` carries the hash and the count and no address, and a
 *                   refusal writes no `broadcast_send` row at all.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bodyDigest,
  BroadcastRefused,
  broadcastFailureOf,
  composeOf,
  previewBroadcast,
  sendBroadcast,
} from "@/lib/admin/broadcast";
import { BROADCAST_COOLDOWN_HOURS, BROADCAST_MAX_RECIPIENTS } from "@/lib/admin/broadcast-rules";
import { act, ActRefused, type ActRequest, type ActSql, transactionRunner } from "@/lib/admin/act";
import { ACTION_REQUIREMENTS, can, requirementFor } from "@/lib/admin/roles";
import { broadcastAudience } from "@/lib/db/news-signups";
import { mailKeyMode, mailKeyModeRefusal, mailKeyModeSends } from "@/lib/email/key-mode";

/* ------------------------------------------------------------------ *
 * The pool, as a mutable fake
 * ------------------------------------------------------------------ */

/**
 * The dry run goes through `getPool()`, so the pool is the one thing this file mocks.
 *
 * `vi.hoisted` because a `vi.mock` factory runs before the module graph initialises and cannot close
 * over an ordinary `const`. The fake answers the breadth of `broadcastAudience()`'s two statements
 * and nothing else — which is all `dryRunAudience()` ever asks it for.
 */
const pool = vi.hoisted(() => ({ emails: [] as string[], consented: 0, ready: 0, held: 0 }));

vi.mock("@/lib/db/client", () => ({
  getPool: () => ({
    query: async (text: string) => {
      if (/SELECT c\.email/i.test(text)) return { rows: pool.emails.map((email) => ({ email })) };
      return { rows: [{ consented: pool.consented, ready: pool.ready, held: pool.held }] };
    },
  }),
  queryRows: async () => [],
  DatabaseUnavailableError: class DatabaseUnavailableError extends Error {},
}));

/* ------------------------------------------------------------------ *
 * The fake transaction
 * ------------------------------------------------------------------ */

/**
 * One connection that behaves like a transaction, with the broadcast's two reads answered.
 *
 * `audience` is what the read returns; `role` is what `act()` reads. The statement log is the
 * assertion surface: a refusal must leave no `INSERT INTO broadcast_send` behind, and a test-key
 * refusal must leave the log **empty**.
 */
class FakeConnection {
  readonly statements: { readonly text: string; readonly values: readonly unknown[] }[] = [];
  readonly committed: string[] = [];
  role: string | null = "admin";
  audience = {
    consented: 3,
    ready: 3,
    held: 0,
    emails: ["a@example.test", "b@example.test", "c@example.test"],
  };
  private pending: string[] = [];

  async query<R>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ readonly rows: readonly R[] }> {
    this.statements.push({ text, values });
    const head = text.trimStart();
    const upper = head.toUpperCase();

    if (upper === "BEGIN" || upper === "COMMIT") {
      if (upper === "COMMIT") {
        this.committed.push(...this.pending);
        this.pending = [];
      }
      return { rows: [] };
    }
    if (upper === "ROLLBACK") {
      this.pending = [];
      return { rows: [] };
    }
    if (/^SELECT role/i.test(head)) {
      return { rows: (this.role === null ? [] : [{ role: this.role }]) as unknown as readonly R[] };
    }
    if (/^INSERT INTO admin_action/i.test(head)) {
      this.pending.push("admin_action");
      return { rows: [{ id: "audit-1" }] as unknown as readonly R[] };
    }
    // The audience's two statements share the consent CTE; the addresses one selects `c.email`.
    if (/^WITH consented/i.test(head)) {
      if (/SELECT c\.email/i.test(head)) {
        return {
          rows: this.audience.emails.map((email) => ({ email })) as unknown as readonly R[],
        };
      }
      return {
        rows: [
          {
            consented: this.audience.consented,
            ready: this.audience.ready,
            held: this.audience.held,
          },
        ] as unknown as readonly R[],
      };
    }
    if (/^INSERT INTO broadcast_send/i.test(head)) this.pending.push("broadcast_send");
    if (/^INSERT INTO broadcast_recipient/i.test(head)) this.pending.push("broadcast_recipient");
    return { rows: [] };
  }

  release(): void {}

  /** Every statement head, so an order assertion reads as the order. */
  get order(): string[] {
    return this.statements.map(({ text }) => {
      const head = text.trimStart();
      if (/^SELECT role/i.test(head)) return "SELECT role";
      if (/^INSERT INTO admin_action/i.test(head)) return "INSERT INTO admin_action";
      if (/^WITH consented/i.test(head)) return "audience";
      return head.split(/\s+/).slice(0, 3).join(" ");
    });
  }

  /** The audit row's `after` JSON, as `act()` sent it. */
  get auditAfter(): string {
    const insert = this.statements.find(({ text }) =>
      /^INSERT INTO admin_action/i.test(text.trim()),
    );
    return String(insert?.values[7] ?? "null");
  }
}

/** The runner `sendBroadcast` gets: one fake connection per call, like the pool. */
function runnerOver(connection: FakeConnection) {
  return transactionRunner(async () => connection);
}

const NOW = new Date("2026-11-03T12:00:00.000Z");

const COMPOSE = {
  subject: "A note from the team",
  body: "The thing we promised is live.",
  segmentKind: "all",
  segmentSince: "",
  reason: "Announce the one-off notice",
};

/** A transport that accepts everything: `sendMail` reads only `ok` and `status`. */
const accepted = async () => ({ ok: true, status: 200 }) as Response;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------ *
 * The floor
 * ------------------------------------------------------------------ */

describe("broadcast.send's floor", () => {
  it("is admin, and support is below it", () => {
    expect(requirementFor("broadcast.send")).toBe("admin");
    expect(ACTION_REQUIREMENTS["broadcast.send"]).toBe("admin");
    expect(can("support", "broadcast.send")).toBe(false);
    expect(can("member", "broadcast.send")).toBe(false);
    expect(can("admin", "broadcast.send")).toBe(true);
    expect(can("owner", "broadcast.send")).toBe(true);
  });

  it("is refused by act() inside the transaction, before any send row is written", async () => {
    const connection = new FakeConnection();
    connection.role = "support";

    const error = await sendBroadcast(
      { ...COMPOSE, actorUserId: "support-1" },
      {
        env: { RESEND_API_KEY: "re_live_key" },
        runner: runnerOver(connection),
        now: NOW,
        fetchImpl: accepted,
      },
    ).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ActRefused);
    expect(broadcastFailureOf(error)).toBe("role-too-low");
    expect((error as ActRefused).message).toContain("broadcast.send needs admin");

    // The refusal is act()'s, and nothing was written: no send row, no recipient row, no audit row.
    expect(connection.order).not.toContain("INSERT broadcast_send");
    expect(connection.order).not.toContain("INSERT admin_action");
    expect(connection.committed).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Compose
 * ------------------------------------------------------------------ */

describe("composeOf", () => {
  it("resolves the two segments", () => {
    expect(composeOf({ ...COMPOSE, segmentKind: "all" }).segment).toEqual({
      kind: "all",
      since: null,
    });
    const since = composeOf({ ...COMPOSE, segmentKind: "since", segmentSince: "2026-10-01" });
    expect(since.segment.kind).toBe("since");
    expect(since.segment.since?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("refuses an empty subject, an empty body, a third segment and an unreadable date", () => {
    for (const [input, code] of [
      [{ ...COMPOSE, subject: "   " }, "empty-subject"],
      [{ ...COMPOSE, body: "" }, "empty-body"],
      [{ ...COMPOSE, segmentKind: "some" }, "invalid-segment"],
      [{ ...COMPOSE, segmentKind: "since", segmentSince: "not-a-date" }, "invalid-date"],
    ] as const) {
      const error = (() => {
        try {
          composeOf(input);
        } catch (thrown) {
          return thrown;
        }
      })();
      expect(error, `${code} was not refused`).toBeInstanceOf(BroadcastRefused);
      expect(broadcastFailureOf(error)).toBe(code);
    }
  });
});

describe("bodyDigest", () => {
  it("is a stable 64-character hex of the subject and the body", () => {
    const digest = bodyDigest(COMPOSE);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(bodyDigest({ ...COMPOSE })).toBe(digest);
    expect(bodyDigest({ ...COMPOSE, body: `${COMPOSE.body}.` })).not.toBe(digest);
    // The subject and the body cannot be re-split: a newline in one is not a boundary.
    expect(bodyDigest({ subject: "a\n", body: "b" })).not.toBe(
      bodyDigest({ subject: "a", body: "b" }),
    );
  });
});

/* ------------------------------------------------------------------ *
 * The mail key's mode
 * ------------------------------------------------------------------ */

describe("mailKeyMode", () => {
  it("is unset with no key, and refuses", () => {
    expect(mailKeyMode({})).toBe("unset");
    expect(mailKeyModeSends("unset")).toBe(false);
    expect(mailKeyModeRefusal("unset")).toBe("no-mail-key");
  });

  it("is test for a test marker or a declaration, and refuses", () => {
    expect(mailKeyMode({ RESEND_API_KEY: "re_test_key" })).toBe("test");
    expect(mailKeyMode({ RESEND_API_KEY: "sk_test_abc" })).toBe("test");
    expect(mailKeyMode({ RESEND_API_KEY: "re_live", RESEND_KEY_MODE: "test" })).toBe("test");
    expect(mailKeyModeSends("test")).toBe(false);
    expect(mailKeyModeRefusal("test")).toBe("test-key");
  });

  it("is captured when the endpoint is overridden, and it may send", () => {
    expect(
      mailKeyMode({ RESEND_API_KEY: "re_live", RESEND_ENDPOINT: "http://127.0.0.1:9/capture" }),
    ).toBe("captured");
    expect(mailKeyModeSends("captured")).toBe(true);
    expect(mailKeyModeRefusal("captured")).toBeUndefined();
  });

  it("is live for a real key on Resend's own endpoint", () => {
    expect(mailKeyMode({ RESEND_API_KEY: "re_live_key" })).toBe("live");
    expect(
      mailKeyMode({
        RESEND_API_KEY: "re_live_key",
        RESEND_ENDPOINT: "https://api.resend.com/emails",
      }),
    ).toBe("live");
    // A trailing slash is a URL spelling, not a different destination.
    expect(
      mailKeyMode({
        RESEND_API_KEY: "re_live_key",
        RESEND_ENDPOINT: "https://api.resend.com/emails/",
      }),
    ).toBe("live");
  });
});

/* ------------------------------------------------------------------ *
 * The audience — consent in the query
 * ------------------------------------------------------------------ */

describe("broadcastAudience", () => {
  it("applies the three consent marks, the segment and the cooldown in one statement", async () => {
    const connection = new FakeConnection();
    await broadcastAudience(connection as unknown as ActSql, {
      segment: { kind: "all", since: null },
      cap: BROADCAST_MAX_RECIPIENTS,
      cooldownHours: BROADCAST_COOLDOWN_HOURS,
      now: NOW,
    });

    const sql = connection.statements.map(({ text }) => text).join("\n");
    for (const predicate of [
      "unsubscribed_at IS NULL",
      "bounced_at IS NULL",
      "complained_at IS NULL",
      "created_at >= $1::timestamptz",
      "created_at > $2::timestamptz",
      "LIMIT $3::int",
    ]) {
      expect(sql, `the audience predicate is missing "${predicate}"`).toContain(predicate);
    }

    // The window is the cooldown, measured back from the instant the caller passed.
    const values = (connection.statements.at(-1)?.values ?? []) as unknown[];
    expect(values[1]).toEqual(new Date(NOW.getTime() - BROADCAST_COOLDOWN_HOURS * 60 * 60 * 1000));
    expect(values[2]).toBe(BROADCAST_MAX_RECIPIENTS);
  });

  it("reports the counts and the cap as one answer", async () => {
    const connection = new FakeConnection();
    connection.audience = { consented: 5, ready: 3, held: 2, emails: ["a", "b", "c"] };
    const audience = await broadcastAudience(connection as unknown as ActSql, {
      segment: { kind: "all", since: null },
      cap: 2,
      cooldownHours: BROADCAST_COOLDOWN_HOURS,
      now: NOW,
    });
    expect(audience.consented).toBe(5);
    expect(audience.heldByCooldown).toBe(2);
    expect(audience.ready).toBe(3);
    expect(audience.overCap).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * The dry run and the send — one count
 * ------------------------------------------------------------------ */

describe("the dry run and the send agree", () => {
  it("counts the same addresses the send records", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_live_key");

    // The pool answers the dry run; the transaction answers the send. Same predicate, same result.
    pool.emails = ["a@example.test", "b@example.test"];
    pool.consented = 4;
    pool.ready = 2;
    pool.held = 2;

    const connection = new FakeConnection();
    connection.audience = {
      consented: 4,
      ready: 2,
      held: 2,
      emails: ["a@example.test", "b@example.test"],
    };

    const preview = await previewBroadcast(COMPOSE, { now: NOW });
    const sent = await sendBroadcast(
      { ...COMPOSE, actorUserId: "admin-1" },
      { now: NOW, runner: runnerOver(connection), env: process.env, fetchImpl: accepted },
    );

    expect(preview.count).toBe(2);
    expect(preview.consented).toBe(4);
    expect(preview.heldByCooldown).toBe(2);
    expect(sent.recipientCount).toBe(preview.count);
    expect(sent.sent).toBe(preview.count);
    expect(sent.failed).toBe(0);
    expect(sent.bodyHash).toBe(preview.bodyHash);
  });

  it("records the audit row with the hash and the count, and no address", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_live_key");
    const connection = new FakeConnection();
    const sent = await sendBroadcast(
      { ...COMPOSE, actorUserId: "admin-1" },
      { now: NOW, runner: runnerOver(connection), env: process.env, fetchImpl: accepted },
    );

    const after = connection.auditAfter;
    expect(after).toContain(sent.bodyHash);
    expect(after).toContain('"recipientCount":3');
    expect(after).toContain('"segment":"all"');
    for (const email of connection.audience.emails) {
      expect(after, "an address reached the audit row").not.toContain(email);
    }

    // One send row, one recipient statement, and the audit row last — inside the transaction.
    expect(connection.order).toEqual([
      "BEGIN",
      "SELECT role",
      "audience",
      "audience",
      "INSERT INTO broadcast_send",
      "INSERT INTO broadcast_recipient",
      "INSERT INTO admin_action",
      "COMMIT",
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * The refusals
 * ------------------------------------------------------------------ */

describe("the refusals", () => {
  it("refuses a test key before opening a transaction", async () => {
    const connection = new FakeConnection();
    const error = await sendBroadcast(
      { ...COMPOSE, actorUserId: "admin-1" },
      { env: { RESEND_API_KEY: "re_test_key" }, runner: runnerOver(connection), now: NOW },
    ).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(BroadcastRefused);
    expect(broadcastFailureOf(error)).toBe("test-key");
    expect(connection.statements).toEqual([]);
  });

  it("refuses a missing key the same way", async () => {
    const connection = new FakeConnection();
    const error = await sendBroadcast(
      { ...COMPOSE, actorUserId: "admin-1" },
      { env: {}, runner: runnerOver(connection), now: NOW },
    ).catch((thrown: unknown) => thrown);
    expect(broadcastFailureOf(error)).toBe("no-mail-key");
    expect(connection.statements).toEqual([]);
  });

  it("refuses when every consented address is inside the cooldown window", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_live_key");
    const connection = new FakeConnection();
    connection.audience = { consented: 6, ready: 0, held: 6, emails: [] };

    const error = await sendBroadcast(
      { ...COMPOSE, actorUserId: "admin-1" },
      { now: NOW, runner: runnerOver(connection), env: process.env, fetchImpl: accepted },
    ).catch((thrown: unknown) => thrown);

    expect(broadcastFailureOf(error)).toBe("cooldown");
    expect((error as Error).message).toContain("24 hours");
    // Nothing was recorded: the refusal is inside the transaction, so it rolled back.
    expect(connection.order).not.toContain("INSERT broadcast_send");
    expect(connection.committed).toEqual([]);
  });

  it("refuses over the cap rather than sending a prefix of the segment", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_live_key");
    const connection = new FakeConnection();
    connection.audience = {
      consented: BROADCAST_MAX_RECIPIENTS + 1,
      ready: BROADCAST_MAX_RECIPIENTS + 1,
      held: 0,
      emails: ["a@example.test"],
    };

    const error = await sendBroadcast(
      { ...COMPOSE, actorUserId: "admin-1" },
      { now: NOW, runner: runnerOver(connection), env: process.env, fetchImpl: accepted },
    ).catch((thrown: unknown) => thrown);

    expect(broadcastFailureOf(error)).toBe("over-cap");
    expect(connection.order).not.toContain("INSERT broadcast_send");
  });

  it("refuses a segment that matches nobody", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_live_key");
    const connection = new FakeConnection();
    connection.audience = { consented: 0, ready: 0, held: 0, emails: [] };

    const error = await sendBroadcast(
      { ...COMPOSE, actorUserId: "admin-1" },
      { now: NOW, runner: runnerOver(connection), env: process.env },
    ).catch((thrown: unknown) => thrown);
    expect(broadcastFailureOf(error)).toBe("no-recipients");
  });
});

/* ------------------------------------------------------------------ *
 * The write path is act()'s
 * ------------------------------------------------------------------ */

describe("the write path is act()'s", () => {
  it("is the only audited write this feature has", async () => {
    const connection = new FakeConnection();
    const request: ActRequest<{ readonly recipientCount: number }> = {
      actorUserId: "admin-1",
      action: "broadcast.send",
      target: { table: "broadcast_send", id: "11111111-1111-1111-1111-111111111111" },
      reason: "A reason long enough to audit",
      mutate: async () => ({ before: null, after: { recipientCount: 0 } }),
    };
    const result = await act(request, runnerOver(connection));
    expect(result.actionId).toBe("audit-1");
    expect(connection.order).toEqual([
      "BEGIN",
      "SELECT role",
      "INSERT INTO admin_action",
      "COMMIT",
    ]);
  });
});
