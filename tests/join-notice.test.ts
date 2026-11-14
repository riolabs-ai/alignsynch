/**
 * The join notice (#548 template #4), without a database and without a mail provider.
 *
 * Three claims:
 *
 *   * it goes to the **Initiator** — the person who published and then had nothing to do until the
 *     other seat existed — and never to the person who just claimed, who is already looking at the
 *     instance. The read is `readUnlockFacts()` (stubbed here), which selects no `opinion` row;
 *   * the body names the joiner, the template and one link, and carries **no** score, no Gap value
 *     and no invitation token;
 *   * a send that cannot happen is an outcome, never a throw: `no-such-instance` (the rows cannot be
 *     read back), `no-address` (a signed-out create stored no Initiator address), `unset` (no
 *     mailer), `failed` (attempted and refused).
 *
 * The store is a stub because the gate is database-free (`docs/operations/gate.md`). The live claim that
 * triggers this notice is the card's demo-branch run, not this file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brand } from "@/data/brand";

const stub = vi.hoisted(() => ({ facts: undefined as unknown, reads: 0 }));

vi.mock("@/lib/flow/store", () => ({
  readUnlockFacts: async () => {
    stub.reads += 1;
    return stub.facts;
  },
}));

import { sendJoinNotice } from "@/lib/flow/join-notice";

const INSTANCE = "11111111-2222-4333-8444-555555555555";
const BASE = "http://localhost:3000";

function facts(over: { initiatorEmail?: string | null } = {}) {
  return {
    instanceRecordId: INSTANCE,
    title: "Relationship Basics",
    initiator: {
      role: "initiator" as const,
      name: "Avery",
      email: over.initiatorEmail === undefined ? "avery@example.test" : over.initiatorEmail,
    },
    counterparty: { role: "counterparty" as const, name: "Rowan", email: "rowan@example.test" },
  };
}

interface Captured {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

function capture(response: () => Response = () => new Response(null, { status: 200 })) {
  const calls: Captured[] = [];
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      to: string[];
      subject: string;
      text: string;
      html?: string;
    };
    calls.push({
      to: body.to[0] ?? "",
      subject: body.subject,
      text: body.text,
      html: body.html ?? "",
    });
    return response();
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const previousKey = process.env.RESEND_API_KEY;

beforeEach(() => {
  stub.facts = facts();
  stub.reads = 0;
  process.env.RESEND_API_KEY = "re_test_key";
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = previousKey;
  vi.restoreAllMocks();
});

describe("the notice goes to the Initiator", () => {
  it("mails the Initiator's recorded address, not the claimer's", async () => {
    const { calls, fetchImpl } = capture();
    const outcome = await sendJoinNotice({ instanceRecordId: INSTANCE, base: BASE, fetchImpl });

    expect(outcome).toBe("sent");
    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe("avery@example.test");
    expect(calls[0].subject).toBe("Rowan joined — your assessment can start");
  });

  it("composes both parts: the html is the band's derivation of the text", async () => {
    const { calls, fetchImpl } = capture();
    await sendJoinNotice({ instanceRecordId: INSTANCE, base: BASE, fetchImpl });

    expect(calls[0].html).toContain("<!doctype html>");
    expect(calls[0].html).toContain("Rowan claimed the invitation to Relationship Basics");
    // The plain text does not carry markup; the html does.
    expect(calls[0].text).not.toMatch(/<[a-z/!]/i);
    expect(calls[0].html).toContain("max-width:560px");
  });

  it("links to the instance, carries no token and no digit beyond the id in the link", async () => {
    const { calls, fetchImpl } = capture();
    await sendJoinNotice({ instanceRecordId: INSTANCE, base: BASE, fetchImpl });

    const text = calls[0].text.replace(`${BASE}/assessment/instances/${INSTANCE}`, "");
    expect(text).not.toContain("/invite/");
    expect(text).not.toMatch(/\d/);
    expect(calls[0].text.match(/https?:\/\/localhost:3000\/assessment\/instances\/\S+/g)).toEqual([
      `${BASE}/assessment/instances/${INSTANCE}`,
    ]);
    // The footer's site line is the band's; nothing else that looks like a URL is in the body.
    expect(
      calls[0].text.match(/https?:\/\/\S+/g)?.filter((href) => !href.startsWith(BASE)),
    ).toEqual([`https://${brand.domain}`]);
  });

  it("carries no unsubscribe line", async () => {
    const { calls, fetchImpl } = capture();
    await sendJoinNotice({ instanceRecordId: INSTANCE, base: BASE, fetchImpl });
    expect(calls[0].text).not.toContain("Unsubscribe");
    expect(calls[0].html).not.toContain("Unsubscribe");
  });
});

describe("a send that cannot happen is an outcome, never a throw", () => {
  it("answers no-address when the create was signed out, and names no address", async () => {
    stub.facts = facts({ initiatorEmail: null });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { calls, fetchImpl } = capture();

    const outcome = await sendJoinNotice({ instanceRecordId: INSTANCE, base: BASE, fetchImpl });

    expect(outcome).toBe("no-address");
    expect(calls).toHaveLength(0);
    const line = warn.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(line).toContain("[joined]");
    expect(line).toContain("initiator");
    expect(line).not.toContain("@");
  });

  it("answers no-such-instance when the rows cannot be read back", async () => {
    stub.facts = undefined;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { calls, fetchImpl } = capture();

    const outcome = await sendJoinNotice({ instanceRecordId: INSTANCE, base: BASE, fetchImpl });

    expect(outcome).toBe("no-such-instance");
    expect(calls).toHaveLength(0);
    expect(error).toHaveBeenCalled();
  });

  it("answers unset with no mailer, and the line names the variable, not the reader", async () => {
    delete process.env.RESEND_API_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { calls, fetchImpl } = capture();

    const outcome = await sendJoinNotice({ instanceRecordId: INSTANCE, base: BASE, fetchImpl });

    expect(outcome).toBe("unset");
    expect(calls).toHaveLength(0);
    const line = warn.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(line).toContain("[joined]");
    expect(line).toContain("RESEND_API_KEY");
    expect(line).not.toContain("avery@example.test");
  });

  it("answers failed on a refusal, and one call is one attempt", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { calls, fetchImpl } = capture(() => new Response("nope", { status: 429 }));

    const outcome = await sendJoinNotice({ instanceRecordId: INSTANCE, base: BASE, fetchImpl });

    expect(outcome).toBe("failed");
    expect(calls).toHaveLength(1);
    expect(stub.reads).toBe(1);
  });
});
