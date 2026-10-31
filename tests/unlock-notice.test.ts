/**
 * The unlock notice, without a database and without a mail provider (#258).
 *
 * Three claims, and each one is a `MUST NOT` from the issue:
 *
 *   * it goes to the **other** party — `otherRoleOf()` is total over the two roles, so neither
 *     submission direction can mail the person who just submitted;
 *   * the body carries the instance's name and one link, and **no** answer, score, Gap value or
 *     invitation token — the assertion is that it contains no digit at all, which is what a score
 *     and a Gap value are, and no `/invite/` path, which is where a token could hide;
 *   * a send that cannot happen is an outcome, never a throw: `unset` (no mailer configured),
 *     `failed` (attempted and refused / unreachable), `no-address` (the seat has none).
 *
 * The store is a stub because the gate is database-free (`docs/GATE.md`): `readUnlockFacts` is
 * replaced with the two seats this file needs, and what remains under test is everything the
 * route actually composes — the recipient choice, the words, and the transport's degraded paths.
 * The live-rows proof (`SELECT … FROM party`, the transition, the single capture on a second
 * submit) is `pnpm flow:e2e`'s and the card's own stubbed-transport run, not this file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  facts: undefined as unknown,
  reads: 0,
}));

vi.mock("@/lib/flow/store", () => ({
  readUnlockFacts: async () => {
    stub.reads += 1;
    return stub.facts;
  },
}));

import { unlockNoticeMessage, otherRoleOf, sendUnlockNotice } from "@/lib/flow/unlock-notice";

/* ------------------------------------------------------------------ *\
 * Fixtures
 * ------------------------------------------------------------------ */

const INSTANCE = "11111111-2222-4333-8444-555555555555";
const TOKEN_SHAPED = "t".repeat(43);
const BASE = "http://localhost:3000";

/** The two seats of one complete instance, as `readUnlockFacts()` returns them. */
function facts(over: { initiatorEmail?: string | null; counterpartyEmail?: string | null } = {}) {
  return {
    instanceRecordId: INSTANCE,
    title: "Relationship Basics",
    initiator: {
      role: "initiator" as const,
      name: "Avery",
      email: over.initiatorEmail === undefined ? "avery@example.test" : over.initiatorEmail,
    },
    counterparty: {
      role: "counterparty" as const,
      name: "Rowan",
      email: over.counterpartyEmail === undefined ? "rowan@example.test" : over.counterpartyEmail,
    },
  };
}

interface Captured {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly from: string;
}

/** A stubbed transport that captures what the flow would have posted. */
function capture(response: () => Response = () => new Response(null, { status: 200 })) {
  const calls: Captured[] = [];
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      from: string;
      to: string[];
      subject: string;
      text: string;
    };
    calls.push({ to: body.to[0] ?? "", subject: body.subject, text: body.text, from: body.from });
    return response();
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const previousKey = process.env.RESEND_API_KEY;

function withKey(): void {
  process.env.RESEND_API_KEY = "re_test_key";
}

beforeEach(() => {
  stub.facts = facts();
  stub.reads = 0;
  withKey();
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = previousKey;
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ *\
 * Who is told
 * ------------------------------------------------------------------ */

describe("the notice goes to the other party", () => {
  it("mails the Counterparty when the Initiator submits last", async () => {
    const { calls, fetchImpl } = capture();

    const outcome = await sendUnlockNotice({
      instanceRecordId: INSTANCE,
      submittedBy: "initiator",
      base: BASE,
      fetchImpl,
    });

    expect(outcome).toBe("sent");
    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe("rowan@example.test");
  });

  it("mails the Initiator when the Counterparty submits last", async () => {
    const { calls, fetchImpl } = capture();

    await sendUnlockNotice({
      instanceRecordId: INSTANCE,
      submittedBy: "counterparty",
      base: BASE,
      fetchImpl,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe("avery@example.test");
  });

  it("never resolves to the submitter for either role", () => {
    expect(otherRoleOf("initiator")).toBe("counterparty");
    expect(otherRoleOf("counterparty")).toBe("initiator");
  });
});

/* ------------------------------------------------------------------ *\
 * The words
 * ------------------------------------------------------------------ */

describe("the message names the instance and carries nothing else", () => {
  it("names the reader, the party who answered, and the instance", async () => {
    const { calls, fetchImpl } = capture();

    await sendUnlockNotice({
      instanceRecordId: INSTANCE,
      submittedBy: "counterparty",
      base: BASE,
      fetchImpl,
    });

    expect(calls[0].subject).toBe("Rowan has answered Relationship Basics");
    expect(calls[0].text).toContain("Hi Avery,");
    expect(calls[0].text).toContain("Rowan has answered their side of Relationship Basics");
  });

  it("links to the instance and nowhere else", async () => {
    const { calls, fetchImpl } = capture();

    await sendUnlockNotice({
      instanceRecordId: INSTANCE,
      submittedBy: "initiator",
      base: BASE,
      fetchImpl,
    });

    const links = calls[0].text.match(/https?:\/\/\S+/g) ?? [];
    expect(links).toEqual([`${BASE}/assessment/instances/${INSTANCE}`]);
  });

  it("carries no score, no Gap value, no digit and no invitation token", async () => {
    const message = unlockNoticeMessage({
      to: "rowan@example.test",
      recipientName: "Rowan",
      otherName: "Avery",
      templateTitle: "Relationship Basics",
      instanceRecordId: INSTANCE,
      base: BASE,
    });

    // A score is an integer in 1..5 and a Gap value is an integer; "no score, no Gap value" is
    // therefore strongest as "no digit at all in the words", which also catches a leaked
    // "3 of 5 answered". The one place a digit may appear is the link, which is the instance's
    // own id — so the link is cut out and the rest of the body is asserted digit-free.
    expect(message.subject).not.toMatch(/\d/);
    expect(message.text).toContain(message.link);
    expect(message.text.replace(message.link, "")).not.toMatch(/\d/);
    // The invitation token is a 43-character base64url path segment; there is no such path here.
    expect(message.text).not.toContain("/invite/");
    expect(message.text).not.toContain(TOKEN_SHAPED);
    expect(message.link).toBe(`${BASE}/assessment/instances/${INSTANCE}`);
  });
});

/* ------------------------------------------------------------------ *\
 * The degraded paths
 * ------------------------------------------------------------------ */

describe("a send that cannot happen is an outcome, never a throw", () => {
  it("sends nothing and logs the key's name — not the reader's — when no mailer is configured", async () => {
    delete process.env.RESEND_API_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { calls, fetchImpl } = capture();

    const outcome = await sendUnlockNotice({
      instanceRecordId: INSTANCE,
      submittedBy: "initiator",
      base: BASE,
      fetchImpl,
    });

    expect(outcome).toBe("unset");
    expect(calls).toHaveLength(0);
    const line = warn.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(line).toContain("[unlock]");
    expect(line).toContain("RESEND_API_KEY");
    // The operator's line, never the reader's: no recipient, no link, no token.
    expect(line).not.toContain("rowan@example.test");
    expect(line).not.toContain("/assessment/instances/");
  });

  it("reports `failed` when the transport throws, and the code is all it logs", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // What `fetch` actually throws when nothing is listening: a TypeError whose `cause` carries
    // the socket error. The line must name `ECONNREFUSED`, not `TypeError` — an operator can act
    // on the first and not on the second.
    const throwing = (async () => {
      throw new TypeError("fetch failed", {
        cause: Object.assign(new Error("refused"), { code: "ECONNREFUSED" }),
      });
    }) as unknown as typeof fetch;

    const outcome = await sendUnlockNotice({
      instanceRecordId: INSTANCE,
      submittedBy: "initiator",
      base: BASE,
      fetchImpl: throwing,
    });

    expect(outcome).toBe("failed");
    const line = error.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(line).toContain("ECONNREFUSED");
    expect(line).toContain("[unlock]");
    expect(line).not.toContain("rowan@example.test");
    expect(line).not.toContain("/assessment/instances/");
    expect(line).not.toContain(TOKEN_SHAPED);
  });

  it("reports `failed` when the provider refuses the message", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { fetchImpl } = capture(() => new Response("nope", { status: 429 }));

    const outcome = await sendUnlockNotice({
      instanceRecordId: INSTANCE,
      submittedBy: "initiator",
      base: BASE,
      fetchImpl,
    });

    expect(outcome).toBe("failed");
    const line = error.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(line).toContain("HTTP 429");
  });

  it("sends nothing when the seat to tell holds no address", async () => {
    stub.facts = facts({ initiatorEmail: null });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { calls, fetchImpl } = capture();

    const outcome = await sendUnlockNotice({
      instanceRecordId: INSTANCE,
      submittedBy: "counterparty",
      base: BASE,
      fetchImpl,
    });

    expect(outcome).toBe("no-address");
    expect(calls).toHaveLength(0);
    const line = warn.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(line).toContain("[unlock]");
    expect(line).toContain("initiator");
    expect(line).not.toContain("@");
  });

  it("sends nothing when the instance cannot be read back", async () => {
    stub.facts = undefined;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { calls, fetchImpl } = capture();

    const outcome = await sendUnlockNotice({
      instanceRecordId: INSTANCE,
      submittedBy: "initiator",
      base: BASE,
      fetchImpl,
    });

    expect(outcome).toBe("no-such-instance");
    expect(calls).toHaveLength(0);
    expect(error).toHaveBeenCalled();
  });

  it("one call is one attempt: no retry after a refusal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { calls, fetchImpl } = capture(() => new Response("nope", { status: 500 }));

    await sendUnlockNotice({
      instanceRecordId: INSTANCE,
      submittedBy: "initiator",
      base: BASE,
      fetchImpl,
    });

    expect(calls).toHaveLength(1);
    expect(stub.reads).toBe(1);
  });
});
