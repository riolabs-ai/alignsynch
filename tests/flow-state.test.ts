/**
 * The flow's rules, without a database (#146).
 *
 * Four claims, each one a sentence from the issue:
 *
 *   * the status is derived from counts — `awaiting_counterparty`, `answering`, `complete`,
 *     and a copy with no Aspects is never `complete`;
 *   * before both parties submit, a viewer may read only their own role (`visibleRoles`);
 *   * a submit is refused after the freeze, and a sheet that skips an Aspect or carries a
 *     score outside 1..5 is refused with the schema's own message;
 *   * a token is 43 base64url characters, is stored only as a SHA-256 hash, and an invite
 *     expires seven days after it is minted.
 *
 * The email's degraded path is here too: with no `RESEND_API_KEY`, nothing is sent and the
 * caller is told why — which is the branch that makes the in-app link the working flow.
 */
import { describe, expect, it } from "vitest";
import {
  inviteExpiry,
  INVITE_TTL_MS,
  mintToken,
  hashToken,
  tokenIsWellFormed,
} from "@/lib/flow/tokens";
import {
  answersRemaining,
  instanceStatusOf,
  maySubmit,
  parseSubmission,
  visibleRoles,
  waitingOn,
  type InstanceProgress,
} from "@/lib/flow/state";
import { answersFrom } from "@/lib/flow/answers";
import { invitationMessage, invitationLink, sendInvitation } from "@/lib/flow/email";

const aspects = ["aspect-time-together", "aspect-money"];

function progress(overrides: Partial<InstanceProgress> = {}): InstanceProgress {
  return {
    aspectCount: 2,
    hasCounterparty: true,
    initiatorAnswered: 2,
    counterpartyAnswered: 2,
    ...overrides,
  };
}

describe("the instance's status is derived, never stored", () => {
  it("is awaiting_counterparty until the invite is claimed", () => {
    expect(instanceStatusOf(progress({ hasCounterparty: false, counterpartyAnswered: 0 }))).toBe(
      "awaiting_counterparty",
    );
  });

  it("is answering while either party still owes an Aspect", () => {
    expect(instanceStatusOf(progress({ counterpartyAnswered: 0 }))).toBe("answering");
    expect(instanceStatusOf(progress({ initiatorAnswered: 1 }))).toBe("answering");
  });

  it("is complete only when both parties answered every Aspect", () => {
    expect(instanceStatusOf(progress())).toBe("complete");
    expect(answersRemaining(progress())).toEqual({ initiator: 0, counterparty: 0 });
  });

  it("never calls a copy with no Aspects complete", () => {
    expect(
      instanceStatusOf({
        aspectCount: 0,
        hasCounterparty: true,
        initiatorAnswered: 0,
        counterpartyAnswered: 0,
      }),
    ).toBe("answering");
  });

  it("names who is still to answer", () => {
    expect(waitingOn(progress({ hasCounterparty: false, counterpartyAnswered: 0 }), true)).toEqual([
      "counterparty",
    ]);
    expect(waitingOn(progress({ initiatorAnswered: 0 }), true)).toEqual(["initiator"]);
    expect(waitingOn(progress(), true)).toEqual([]);
  });
});

describe("blind until both submit", () => {
  it("lets a viewer read only their own role before the status is complete", () => {
    expect(visibleRoles("initiator", "answering")).toEqual(["initiator"]);
    expect(visibleRoles("counterparty", "answering")).toEqual(["counterparty"]);
    expect(visibleRoles("counterparty", "awaiting_counterparty")).toEqual(["counterparty"]);
  });

  it("unlocks both roles at complete, and only then", () => {
    expect(visibleRoles("initiator", "complete")).toEqual(["initiator", "counterparty"]);
    expect(visibleRoles("counterparty", "complete")).toEqual(["initiator", "counterparty"]);
  });
});

describe("answers freeze when both parties have submitted", () => {
  it("accepts a submit while the status is not complete", () => {
    expect(maySubmit("answering")).toBe(true);
    expect(maySubmit("awaiting_counterparty")).toBe(true);
  });

  it("refuses a submit at complete", () => {
    expect(maySubmit("complete")).toBe(false);
  });
});

describe("a submission is the whole sheet, validated by the model's own schema", () => {
  it("parses two scores per Aspect", () => {
    const parsed = parseSubmission(
      aspects,
      new Map([
        ["aspect-time-together", { feel: "2", wish: "5" }],
        ["aspect-money", { feel: "4", wish: "4" }],
      ]),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.answers.map((answer) => answer.itemId)).toEqual(aspects);
      expect(parsed.answers[0]?.opinions).toEqual({ feel: 2, wish: 5 });
    }
  });

  it("refuses a sheet that skips an Aspect, naming it", () => {
    const parsed = parseSubmission(aspects, new Map([["aspect-money", { feel: "4", wish: "4" }]]));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.problems.join(" ")).toContain("aspect-time-together");
  });

  it("refuses a score outside 1..5 and an empty field, instead of reading them as 0", () => {
    const outOfRange = parseSubmission(
      aspects,
      new Map([
        ["aspect-time-together", { feel: "7", wish: "3" }],
        ["aspect-money", { feel: "4", wish: "4" }],
      ]),
    );
    expect(outOfRange.ok).toBe(false);

    const empty = parseSubmission(
      aspects,
      new Map([
        ["aspect-time-together", { feel: "", wish: "3" }],
        ["aspect-money", { feel: "4", wish: "4" }],
      ]),
    );
    expect(empty.ok).toBe(false);
  });
});

describe("a form post is read as feel/wish per Aspect", () => {
  it("keys answers by Aspect and refuses an Advanced kind", () => {
    const form = new FormData();
    form.set("feel:aspect-money", "4");
    form.set("wish:aspect-money", "2");
    form.set("think:aspect-money", "1");

    const parsed = answersFrom(form);
    expect(parsed.answers.get("aspect-money")).toEqual({ feel: "4", wish: "2" });
    expect(parsed.problems.join(" ")).toContain("think");
  });
});

describe("tokens", () => {
  it("mints a 43-character base64url token and stores only its hash", () => {
    const token = mintToken();
    expect(token).toHaveLength(43);
    expect(tokenIsWellFormed(token)).toBe(true);
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashToken(token)).toBe(hash);
    expect(hashToken(mintToken())).not.toBe(hash);
  });

  it("rejects a token of the wrong shape before a query is spent on it", () => {
    expect(tokenIsWellFormed("short")).toBe(false);
    expect(tokenIsWellFormed(`${"a".repeat(42)}!`)).toBe(false);
  });

  it("expires an invitation seven days after it is minted", () => {
    const now = new Date("2026-10-30T12:00:00.000Z");
    expect(inviteExpiry(now).getTime() - now.getTime()).toBe(INVITE_TTL_MS);
    expect(inviteExpiry(now).toISOString()).toBe("2026-11-06T12:00:00.000Z");
  });
});

describe("the invitation", () => {
  it("carries exactly one link, filled from the fixture", () => {
    const message = invitationMessage({
      to: "rowan@example.com",
      initiatorName: "Avery",
      counterpartyName: "Rowan",
      templateTitle: "Relationship Basics",
      token: "t".repeat(43),
      base: "http://localhost:3000",
    });
    const links = message.text.match(/http:\/\/localhost:3000\/invite\/\S+/g) ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).toBe(invitationLink("t".repeat(43), "http://localhost:3000"));
    expect(message.subject).toContain("Avery");
    expect(message.subject).toContain("Relationship Basics");
    expect(message.text).toContain("Rowan");
  });

  it("sends nothing and says why when RESEND_API_KEY is absent", async () => {
    const previous = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const outcome = await sendInvitation({
        to: "rowan@example.com",
        subject: "subject",
        text: "text",
        link: "http://localhost:3000/invite/x",
      });
      expect(outcome.sent).toBe(false);
      expect(outcome.reason).toContain("RESEND_API_KEY");
    } finally {
      if (previous !== undefined) process.env.RESEND_API_KEY = previous;
    }
  });
});
