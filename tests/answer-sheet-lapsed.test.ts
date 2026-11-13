import { describe, expect, it } from "vitest";
import { answerGateOf } from "@/lib/flow/answer-gate";
import type { Membership } from "@/lib/relationship/membership";

/**
 * A lapsed trial closes the Gap, not the pairing (#848).
 *
 * The owner's decision: the pricing page's Free card is the **7-day trial** card, so there is no
 * durable free tier — seven days from the send, then a method on file or the Gap stays shut. That
 * only holds up if the seven days ending does not also end the two people's session: until this
 * change the answer sheet went read-only on a lapse, so a counterparty who opened the link on day
 * eight could not answer at all.
 *
 * These cases pin the narrow version — the sheet stays a sheet, and every other reason to take the
 * form away still takes it away.
 */

const LAPSED: Membership = {
  state: "lapsed",
  reason: "trial-ended",
  endedAt: new Date("2026-11-19T06:53:18.504Z"),
  writable: false,
};

function gate(overrides: Partial<Parameters<typeof answerGateOf>[0]> = {}) {
  return answerGateOf({
    instanceRecordId: "c8832c24-5196-4ebe-aaa6-2e89a9e04720",
    status: "answering",
    viewerRole: "counterparty",
    viewerAccepted: false,
    aspects: [
      { aspectId: "aspect-time-together", own: 2 },
      { aspectId: "aspect-money", own: null },
    ],
    membership: LAPSED,
    ...overrides,
  } as Parameters<typeof answerGateOf>[0]);
}

describe("the answer sheet on a lapsed relationship", () => {
  it("still asks: the form is drawn, with the action that writes it", () => {
    const sheet = gate();
    expect(sheet.state).toBe("sheet");
    expect(sheet.action).toBe("/assessment/instances/c8832c24-5196-4ebe-aaa6-2e89a9e04720/answers");
    expect(sheet.role).toBe("counterparty");
  });

  it("counts what this viewer has already answered, so the sheet is not blank", () => {
    expect(gate().answered).toBe(1);
    expect(gate().aspects).toBe(2);
  });

  it("is a sheet for the Initiator too, not only the invited party", () => {
    expect(gate({ viewerRole: "initiator" }).state).toBe("sheet");
  });

  it("and for a session with no membership reading at all — the shape a fixture renders", () => {
    expect(gate({ membership: undefined }).state).toBe("sheet");
  });

  it("still takes the form away once this viewer has accepted — the freeze is the view's own rule", () => {
    const frozen = gate({ viewerAccepted: true });
    expect(frozen.state).toBe("readonly");
    expect(frozen.action).toBeNull();
  });

  it("and still draws the coach's band for a coach, lapse or no lapse", () => {
    expect(gate({ viewerRole: "coach" }).state).toBe("coach");
  });
});
