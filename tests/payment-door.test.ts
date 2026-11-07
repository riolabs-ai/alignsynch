/**
 * The payment door's two vocabularies, and the fact that one of them is on screen (#t_e9212bf9).
 *
 * The mockup run measured the defect this file exists to prevent: `lib/flow/payment.ts` names a
 * refusal `method-required` while the action answers `payment-method-required`, so a fixture keyed
 * on the pure word renders **the raw code** for a refusal a member is supposed to read. Nothing in
 * `tsc`, `lint`, `data:check` or `build` sees it — both vocabularies are strings.
 *
 * Three claims:
 *
 *   the mapping      every code `actions.ts` can answer either translates to a `PAYMENT_REFUSALS`
 *                    word or is a declared passthrough. The action's codes are read out of its own
 *                    source, so a code added later without a sentence fails here rather than in
 *                    front of a member.
 *   the sentences    both member fixtures carry a row for **every** pure word, and for every
 *                    passthrough code — a missing row is a raw token on screen.
 *   the door         `paymentDoorOf()` is `canComplete` exactly when the obligation is sealed and
 *                    nothing is in the way, and it states `charge_due_at` rather than re-deriving a
 *                    date from a clock.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { dashboardRelationshipsPageCopy } from "@/data/pages/dashboard-relationships";
import { PAYMENT_REFUSALS, type PaymentRefusal } from "@/lib/flow/payment";
import { MEMBER_REFUSALS } from "@/lib/member/publish-basis";
import {
  PAYMENT_PASSTHROUGH_CODES,
  PAYMENT_REFUSAL_OF_CODE,
  paymentDoorOf,
  paymentRefusalOf,
} from "@/lib/member/payment-door";

const ACTIONS = "app/(mainlayout)/dashboard/relationships/actions.ts";

/** Every code a payment action can answer: the translated five plus the declared passthroughs. */
function paymentCodes(): string[] {
  return [...Object.keys(PAYMENT_REFUSAL_OF_CODE), ...PAYMENT_PASSTHROUGH_CODES].sort();
}

function sentenceIds(copy: {
  sections?: readonly { id: string; items?: readonly { id: string }[] }[];
}): string[] {
  const section = (copy.sections ?? []).find((entry) => entry.id === "payment-refusals");
  expect(section, "the payment-refusals section").toBeDefined();
  return (section?.items ?? []).map((item) => item.id);
}

describe("the refusal vocabulary", () => {
  it("names codes the actions actually answer (the negative control for the next case)", () => {
    // The source is the authority, and there are two halves of it: the action enumerates some codes
    // itself (`payment-method-required`) while the rest arrive as `MemberRefused.reason` from the
    // library. A code mapped here that neither names is a sentence nobody reads.
    const actions = readFileSync(join(process.cwd(), ACTIONS), "utf8");
    const payment = readFileSync(join(process.cwd(), "lib/member/payment.ts"), "utf8");
    expect(actions).toContain("payment-method-required");
    expect(actions).toContain("charge-declined");
    for (const code of Object.keys(PAYMENT_REFUSAL_OF_CODE)) {
      expect(
        actions.includes(code) || payment.includes(code),
        `${code} is mapped but nothing answers it`,
      ).toBe(true);
    }
  });

  it("maps only onto the pure vocabulary, and every code is a member refusal", () => {
    const pure = new Set<string>(PAYMENT_REFUSALS);
    const member = new Set<string>(MEMBER_REFUSALS);
    for (const word of Object.values(PAYMENT_REFUSAL_OF_CODE)) {
      expect(pure.has(word), `${word} is not a PAYMENT_REFUSALS member`).toBe(true);
    }
    for (const code of paymentCodes()) {
      expect(member.has(code), `${code} is not a MemberRefusal`).toBe(true);
    }
  });

  it("carries a sentence for every code, on both member surfaces", () => {
    // The id the band looks up is the **pure** word when the code translates, and the code itself
    // when it does not (`refusalSentenceOf`). A missing row is a raw token in front of a member.
    for (const copy of [dashboardRelationshipsPageCopy, dashboardRelationshipDetailPageCopy]) {
      const ids = sentenceIds(copy as Parameters<typeof sentenceIds>[0]);
      for (const code of paymentCodes()) {
        const id = paymentRefusalOf(code) ?? code;
        expect(ids, `a screen keyed on "${id}" has no sentence`).toContain(id);
      }
    }
  });

  it("gives already-charged a sentence even though no action code reaches it", () => {
    // `completeRelationship()` answers a second completion with an idempotent `{ ok: true }`, so the
    // word never arrives from a code; the fixture keeps it because the band draws a paid
    // relationship. Unrendered *by accident* is the failure this asserts against.
    const word: PaymentRefusal = "already-charged";
    expect(PAYMENT_REFUSALS).toContain(word);
    expect(
      sentenceIds(dashboardRelationshipDetailPageCopy as Parameters<typeof sentenceIds>[0]),
    ).toContain(word);
  });

  it("translates a refusal, and leaves a non-payment code alone", () => {
    expect(paymentRefusalOf("payment-method-required")).toBe("method-required");
    expect(paymentRefusalOf("not-ready-to-complete")).toBe("not-ready");
    expect(paymentRefusalOf("payment-expired")).toBe("expired");
    expect(paymentRefusalOf("charge-declined")).toBe("charge-declined");
    expect(paymentRefusalOf("not-the-payer")).toBe("not-the-payer");
    expect(paymentRefusalOf("signed-out")).toBeNull();
    expect(paymentRefusalOf("not-a-code")).toBeNull();
  });
});

describe("the door's view model", () => {
  const NOW = new Date("2026-11-10T12:00:00.000Z");
  const SEALED_AT = "2026-11-01T12:00:00.000Z";

  it("is sealed, unpaid and methodless → not completable, and it says method-required", () => {
    const door = paymentDoorOf({
      facts: { sealedAt: SEALED_AT },
      sealed: true,
      amountCents: 895,
      now: NOW,
    });
    expect(door.refusal).toBe("method-required");
    expect(door.canComplete).toBe(false);
    expect(door.chargeDueAt).toBeNull();
    expect(door.phase).toBe("none");
  });

  it("states the stored charge_due_at, not a date derived from a clock", () => {
    const door = paymentDoorOf({
      facts: {
        sealedAt: SEALED_AT,
        methodCapturedAt: "2026-11-03T09:30:00.000Z",
        chargeDueAt: "2026-11-10T09:30:00.000Z",
      },
      sealed: true,
      amountCents: 895,
      now: NOW,
    });
    expect(door.chargeDueAt).toBe("2026-11-10T09:30:00.000Z");
    expect(door.canComplete).toBe(true);
    expect(door.refusal).toBeNull();
    expect(door.phase).toBe("method-on-file");
  });

  it("falls back to capture + 7 days when the row carries no stored instant", () => {
    const door = paymentDoorOf({
      facts: { sealedAt: SEALED_AT, methodCapturedAt: "2026-11-03T09:30:00.000Z" },
      sealed: true,
      amountCents: 895,
      now: NOW,
    });
    expect(door.chargeDueAt).toBe("2026-11-10T09:30:00.000Z");
  });

  it("is not completable before the seal, whatever the method says", () => {
    const door = paymentDoorOf({
      facts: { methodCapturedAt: "2026-11-03T09:30:00.000Z" },
      sealed: false,
      amountCents: 895,
      now: NOW,
    });
    expect(door.refusal).toBe("not-ready");
    expect(door.canComplete).toBe(false);
  });

  it("is terminal once the fee landed, and keeps the instant it landed", () => {
    const door = paymentDoorOf({
      facts: {
        sealedAt: SEALED_AT,
        methodCapturedAt: "2026-11-03T09:30:00.000Z",
        chargedAt: "2026-11-09T12:00:00.000Z",
      },
      sealed: true,
      amountCents: 895,
      now: NOW,
    });
    expect(door.phase).toBe("charged");
    expect(door.chargedAt).toBe("2026-11-09T12:00:00.000Z");
    expect(door.canComplete).toBe(false);
    expect(door.refusal).toBe("already-charged");
  });

  it("is not completable once the window closed", () => {
    const door = paymentDoorOf({
      facts: { sealedAt: SEALED_AT, expiredAt: "2026-11-15T12:00:00.000Z" },
      sealed: true,
      amountCents: 895,
      now: NOW,
    });
    expect(door.phase).toBe("expired");
    expect(door.refusal).toBe("expired");
    expect(door.canComplete).toBe(false);
  });
});
