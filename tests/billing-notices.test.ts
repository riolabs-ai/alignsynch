/**
 * The two mails #1055 wires, in their own words (#1055, templates #6 and #7 of #548), and the two
 * the lapse notice became when it was split by seat (#1139, templates #12 and #13).
 *
 * `tests/billing-webhook-events.test.ts` proves *that* the receiver calls these senders. This file
 * proves *what they send*: the addresses they choose, which template each seat receives, the date
 * they quote, and what they do when there is nobody to write to. The templates themselves are
 * asserted against `content/email-bodies` in `tests/email-templates.test.ts`; here they are driven
 * end to end through the band and the one transport (`sendMail`), with the connection and the
 * transport injected — so a case can read the exact text the member would receive without a mailbox
 * or a database.
 *
 * The rows are a scripted connection, the same shape `tests/relationship-enforcement.test.ts` uses:
 * the fake answers the statements this module sends and records what it was asked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PLANS_PATH,
  sendMembershipLapsedNotices,
  sendTrialEndingNotice,
} from "@/lib/billing/notices";
import type { Sql } from "@/lib/relationship/enforcement";

type Row = Record<string, unknown>;

interface Handler {
  readonly match: RegExp;
  readonly rows?: readonly Row[];
}

interface SentMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

function fakeSql(handlers: readonly Handler[]): {
  readonly sql: Sql;
  readonly calls: { text: string; values: readonly unknown[] | undefined }[];
} {
  const calls: { text: string; values: readonly unknown[] | undefined }[] = [];
  const sql: Sql = {
    async query<R = Row>(text: string, values?: readonly unknown[]) {
      calls.push({ text, values });
      const handler = handlers.find((candidate) => candidate.match.test(text));
      return { rows: (handler?.rows ?? []) as readonly R[] };
    },
  };
  return { sql, calls };
}

/** A transport that records each message and answers with the status it was told to. */
function captureTransport(status = 200) {
  const sent: SentMessage[] = [];
  const impl = (async (_url: string, init: RequestInit = {}) => {
    // `sendMail` sends `to` as a one-entry array (the provider's own shape); the cases below read
    // the address, not the envelope.
    const body = JSON.parse(String(init.body)) as Omit<SentMessage, "to"> & { to: string[] };
    sent.push({ to: body.to[0] ?? "", subject: body.subject, text: body.text });
    return new Response("{}", { status });
  }) as unknown as typeof fetch;
  return { impl, sent };
}

/** A relationship that just lapsed, with both seats' stored addresses. */
function lapsedRow(over: Row = {}): Row {
  return {
    id: "rel-1",
    title: "Q4 leadership alignment",
    expired_at: new Date("2026-11-14T09:30:00.000Z"),
    // What `lapseIfDue()` writes: a refused renewal. The trial's own reason is the other case, and
    // it is the only one that carries the free week (#1139).
    lapse_reason: "payment-failed",
    initiator_name: "Avery",
    initiator_email: "avery@example.test",
    counterparty_name: "Blake",
    counterparty_email: "blake@example.test",
    ...over,
  };
}

const LAPSED_SEATS = /MAX\(iv\.initiator_email\)/;
const AUTH_PRESENT = /to_regclass/;
const AUTH_SEAT = /FROM neon_auth\."user" u/;
const STORED_SEAT = /iv\.initiator_email IS NOT NULL/;

/**
 * The vocabulary the Counterparty must never read (#1121, #1138, #1139).
 *
 * Whole words, because `trial` in a sentence about the rule is not a leak. The same list
 * `tests/counterparty-no-leak.test.ts` sweeps every Counterparty-recipient template with; asserted
 * here as well because this file drives the sender, and a template can be clean while the *choice*
 * of template for a seat is not.
 */
const COUNTERPARTY_MONEY =
  /\b(price|pricing|plan|plans|trial|trials|card|cards|extension|extensions)\b/i;

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_fixture");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendMembershipLapsedNotices", () => {
  it("writes to both seats, each in its own words (#1139)", async () => {
    const { sql } = fakeSql([{ match: LAPSED_SEATS, rows: [lapsedRow()] }]);
    const { impl, sent } = captureTransport();

    const results = await sendMembershipLapsedNotices({
      relationshipIds: ["rel-1"],
      sql,
      fetchImpl: impl,
      base: "https://alignsynch.com",
    });

    expect(results).toEqual([
      { kind: "membership-lapsed", outcome: "sent", recipients: 2, relationshipId: "rel-1" },
    ]);
    expect(sent).toHaveLength(2);
    // A lapse stops both seats — so both are addressed, each under their own name and in their own
    // vocabulary: the account that owns the plan, and the person who was invited to it.
    expect(sent.map((message) => message.to).sort()).toEqual([
      "avery@example.test",
      "blake@example.test",
    ]);

    const initiator = sent.find((message) => message.to === "avery@example.test");
    const counterparty = sent.find((message) => message.to === "blake@example.test");

    // The money did not arrive: the Initiator is told to resume it, and is **not** offered the free
    // week — that week is the trial's own pause, and offering it here would be the false offer
    // `lib/relationship/pause.ts` refuses to draw.
    expect(initiator?.subject).toBe("Your relationship is read-only");
    expect(initiator?.text).toContain("Hi Avery");
    expect(initiator?.text).not.toContain("7-day extension");

    // The Counterparty reads one neutral sentence: no cause, no plan, no price, no card.
    expect(counterparty?.subject).toBe("Align is paused for now");
    expect(counterparty?.text).toContain("Hi Blake");
    expect(counterparty?.text).not.toMatch(COUNTERPARTY_MONEY);

    for (const message of sent) {
      expect(message.text).toContain("Q4 leadership alignment");
      // The date is `relationship.expired_at`, printed as its own calendar day — never "today".
      expect(message.text).toContain("2026-11-14");
      expect(message.text).toContain("https://alignsynch.com/dashboard/relationships/rel-1");
    }
  });

  it("gives the Initiator the pause, the free week and the plan when the trial ran out", async () => {
    const { sql } = fakeSql([
      { match: LAPSED_SEATS, rows: [lapsedRow({ lapse_reason: "trial-ended" })] },
    ]);
    const { impl, sent } = captureTransport();

    await sendMembershipLapsedNotices({
      relationshipIds: ["rel-1"],
      sql,
      fetchImpl: impl,
      base: "https://alignsynch.com",
    });

    const initiator = sent.find((message) => message.to === "avery@example.test");
    expect(initiator?.subject).toBe("Your trial ended — Align is paused");
    expect(initiator?.text).toContain("7-day extension");
    expect(initiator?.text).toContain(`https://alignsynch.com${PLANS_PATH}`);

    // The Counterparty's mail does not change with the reason: the pause is the whole of what they
    // are told, whatever ended the membership.
    const counterparty = sent.find((message) => message.to === "blake@example.test");
    expect(counterparty?.subject).toBe("Align is paused for now");
    expect(counterparty?.text).not.toMatch(COUNTERPARTY_MONEY);
  });

  it("reads an unrecorded reason as the trial's, exactly as the screen does", async () => {
    const { sql } = fakeSql([{ match: LAPSED_SEATS, rows: [lapsedRow({ lapse_reason: null })] }]);
    const { impl, sent } = captureTransport();

    await sendMembershipLapsedNotices({
      relationshipIds: ["rel-1"],
      sql,
      fetchImpl: impl,
      base: "https://alignsynch.com",
    });

    // `isTrialPauseReason()` is the screen's own predicate: an unknown or absent reason is the pause
    // that loses nothing, and the mail must not be the one place that guesses differently.
    expect(sent.find((message) => message.to === "avery@example.test")?.subject).toBe(
      "Your trial ended — Align is paused",
    );
  });

  it("asks for the rows it was handed, and only those", async () => {
    const { sql, calls } = fakeSql([{ match: LAPSED_SEATS, rows: [] }]);
    const { impl } = captureTransport();

    await sendMembershipLapsedNotices({
      relationshipIds: ["rel-1", "rel-2"],
      sql,
      fetchImpl: impl,
    });

    expect(calls[0].values).toEqual([["rel-1", "rel-2"]]);
  });

  it("sends nothing when the event moved no relationship", async () => {
    const { sql, calls } = fakeSql([{ match: LAPSED_SEATS, rows: [lapsedRow()] }]);
    const { impl, sent } = captureTransport();

    const results = await sendMembershipLapsedNotices({
      relationshipIds: [],
      sql,
      fetchImpl: impl,
    });

    expect(results).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("addresses the one seat that holds an address, and counts what it addressed", async () => {
    const { sql } = fakeSql([
      { match: LAPSED_SEATS, rows: [lapsedRow({ counterparty_email: null })] },
    ]);
    const { impl, sent } = captureTransport();

    const results = await sendMembershipLapsedNotices({
      relationshipIds: ["rel-1"],
      sql,
      fetchImpl: impl,
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("avery@example.test");
    // A seat with no stored address is counted, never invented: `Hi there` is the name a row
    // without one prints, and the outcome still says how many mailboxes it reached.
    expect(results[0]).toMatchObject({ outcome: "sent", recipients: 1 });
  });

  it("reports no-address when neither seat holds one, and does not send", async () => {
    const { sql } = fakeSql([
      {
        match: LAPSED_SEATS,
        rows: [lapsedRow({ initiator_email: null, counterparty_email: null })],
      },
    ]);
    const { impl, sent } = captureTransport();

    const results = await sendMembershipLapsedNotices({
      relationshipIds: ["rel-1"],
      sql,
      fetchImpl: impl,
    });

    expect(results).toEqual([
      { kind: "membership-lapsed", outcome: "no-address", recipients: 0, relationshipId: "rel-1" },
    ]);
    expect(sent).toHaveLength(0);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("neither seat on relationship rel-1 holds an address"),
    );
  });

  it("reports no-recipient when the row cannot be dated, instead of mailing a guess", async () => {
    const { sql } = fakeSql([{ match: LAPSED_SEATS, rows: [lapsedRow({ expired_at: null })] }]);
    const { impl, sent } = captureTransport();

    const results = await sendMembershipLapsedNotices({
      relationshipIds: ["rel-1"],
      sql,
      fetchImpl: impl,
    });

    expect(results[0]).toMatchObject({ outcome: "no-recipient", recipients: 0 });
    expect(sent).toHaveLength(0);
  });

  it("reports the provider's refusal as failed, not as sent", async () => {
    const { sql } = fakeSql([{ match: LAPSED_SEATS, rows: [lapsedRow()] }]);
    const { impl, sent } = captureTransport(429);

    const results = await sendMembershipLapsedNotices({
      relationshipIds: ["rel-1"],
      sql,
      fetchImpl: impl,
    });

    expect(sent).toHaveLength(2);
    expect(results[0].outcome).toBe("failed");
  });

  it("reports unset — attempted nothing — on a deployment with no mailer", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { sql } = fakeSql([{ match: LAPSED_SEATS, rows: [lapsedRow()] }]);
    const { impl, sent } = captureTransport();

    const results = await sendMembershipLapsedNotices({
      relationshipIds: ["rel-1"],
      sql,
      fetchImpl: impl,
    });

    expect(sent).toHaveLength(0);
    expect(results[0].outcome).toBe("unset");
  });
});

describe("sendTrialEndingNotice", () => {
  const TRIAL_ENDS_AT = new Date("2026-11-24T18:00:00.000Z");

  it("writes to the account's own address and quotes the payload's trial_end", async () => {
    const { sql } = fakeSql([
      { match: AUTH_PRESENT, rows: [{ present: true }] },
      { match: AUTH_SEAT, rows: [{ email: "avery@example.test", name: "Avery" }] },
    ]);
    const { impl, sent } = captureTransport();

    const result = await sendTrialEndingNotice({
      userId: "auth-1",
      trialEndsAt: TRIAL_ENDS_AT,
      sql,
      fetchImpl: impl,
      base: "https://alignsynch.com/",
    });

    expect(result).toEqual({
      kind: "trial-ending",
      outcome: "sent",
      recipients: 1,
      relationshipId: null,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("avery@example.test");
    expect(sent[0].subject).toBe("Your trial ends in 2 days");
    // The real instant, from the event — not `current_period_end`, and not "in three days".
    expect(sent[0].text).toContain("2026-11-24");
    expect(sent[0].text).toContain("Hi Avery");
    // One address, and it is the plans surface — a trailing slash on the origin is not doubled.
    expect(sent[0].text).toContain(`https://alignsynch.com${PLANS_PATH}`);
    expect(sent[0].text).not.toContain("//pricing");
  });

  it("falls back to the address the relationship already stores when the auth schema is absent", async () => {
    const { sql, calls } = fakeSql([
      // A scratch branch: `neon_auth` does not exist, so the probe answers false and the SELECT is
      // never attempted — the stored invite address is the fallback.
      { match: AUTH_PRESENT, rows: [{ present: false }] },
      { match: STORED_SEAT, rows: [{ email: "avery@example.test", name: "Avery" }] },
    ]);
    const { impl, sent } = captureTransport();

    const result = await sendTrialEndingNotice({
      userId: "auth-1",
      trialEndsAt: TRIAL_ENDS_AT,
      sql,
      fetchImpl: impl,
      base: "https://alignsynch.com",
    });

    expect(calls.some((call) => AUTH_SEAT.test(call.text))).toBe(false);
    expect(result.outcome).toBe("sent");
    expect(sent[0].to).toBe("avery@example.test");
  });

  it("reports no-address when the account holds none anywhere, and sends nothing", async () => {
    const { sql } = fakeSql([
      { match: AUTH_PRESENT, rows: [{ present: true }] },
      { match: AUTH_SEAT, rows: [] },
      { match: STORED_SEAT, rows: [] },
    ]);
    const { impl, sent } = captureTransport();

    const result = await sendTrialEndingNotice({
      userId: "auth-1",
      trialEndsAt: TRIAL_ENDS_AT,
      sql,
      fetchImpl: impl,
    });

    expect(result).toEqual({
      kind: "trial-ending",
      outcome: "no-address",
      recipients: 0,
      relationshipId: null,
    });
    expect(sent).toHaveLength(0);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("the trial has no in-app banner"),
    );
  });
});
