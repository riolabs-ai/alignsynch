/**
 * A lapsed membership refuses a submit with a **page**, never a 500 (#753).
 *
 * The defect: `POST /assessment/instances/<id>/answers` answered a `lapsed` refusal by asking the
 * `problems` section of `data/pages/assessment-instance.ts` for an item named `lapsed`. That
 * section carries the one-line refusals (`frozen`, `incomplete`, `not-a-party`, `no-such-instance`,
 * …) and no `lapsed` item, so `PageCopy` raised `section "problems" has no item "lapsed"` inside
 * the route handler — a 500 where the sentence written for the state belongs.
 *
 * A lapsed membership is a **state**, not a one-line problem: the answer sheet draws it as the
 * `lapsed` band of `data/pages/assessment-answer.ts` (`This relationship is read-only`, #533 phase
 * 3). So the fix reads that band's heading rather than authoring the same sentence a second time in
 * `problems`, and this file is what keeps the route and that fixture from drifting apart again:
 *
 *   1. **the status** is `409` — the relationship exists and is read-only, which a `404` would
 *      contradict (the code used to fall through the mapping's `else`);
 *   2. **the sentence** is the band's, byte for byte, so a rename in the fixture is a red test and
 *      not a blank heading in production;
 *   3. **the store's reason** — the dated "the initiator's membership ended on …" line — is on the
 *      page too, because the fixture authors no instant and the row does.
 *
 * The store, the session and `next/headers` are stubbed: what is under test is the handler's
 * refusal rendering, not Postgres.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The refusal the store answers once the membership behind the relationship has lapsed. */
const LAPSED_REASON =
  "the initiator's membership ended on 2026-11-01T09:30:00.000Z — the 14-day trial ended and no " +
  "payment followed, so the initiator's membership ended with it. The relationship is read-only " +
  "for both of you: no new answers, no edits, and the invitation no longer works.";

const stub = vi.hoisted(() => ({
  submitAnswers: vi.fn(),
  readInstanceMode: vi.fn(),
}));

vi.mock("@/lib/flow/store", () => ({
  readInstanceMode: stub.readInstanceMode,
  submitAnswers: stub.submitAnswers,
}));
vi.mock("@/lib/auth/session", () => ({ currentUser: async () => null }));
vi.mock("@/lib/auth/config", () => ({ authConfigured: () => false }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { POST } from "@/app/(mainlayout)/assessment/instances/[instanceId]/answers/route";

const INSTANCE_ID = "instance-lapsed-753";

/**
 * The whole Basic sheet, as the form posts it: one score per Opinion kind the mode asks, named
 * `${kind}:${itemId}`. A short sheet would refuse as `incomplete` before the store is called, and
 * the refusal this file is about would never be exercised.
 */
function sheet(): FormData {
  const form = new FormData();
  form.set("feel:aspect-trust", "3");
  form.set("wish:aspect-trust", "4");
  return form;
}

/** The request the live sheet's form makes. */
function submit(): Request {
  return new Request(`http://localhost/assessment/instances/${INSTANCE_ID}/answers`, {
    method: "POST",
    body: sheet(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.readInstanceMode.mockResolvedValue("basic");
  stub.submitAnswers.mockResolvedValue({ ok: false, code: "lapsed", reason: LAPSED_REASON });
});

describe("POST /assessment/instances/[instanceId]/answers — a lapsed membership (#753)", () => {
  it("answers 409 with the read-only band's sentence, not a 500", async () => {
    const response = await POST(submit(), { params: Promise.resolve({ instanceId: INSTANCE_ID }) });
    const html = await response.text();

    // The defect was a thrown `PageCopy` error, which Next turns into a 500 — so the status is the
    // first half of the acceptance, and it is a state conflict rather than "no such instance".
    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).toContain("text/html");

    // The sentence the state was given, read from the fixture whose band draws it.
    expect(html).toContain("This relationship is read-only");
    // The row's own fact: when it ended and why. The fixture authors no instant.
    expect(html).toContain("the initiator's membership ended on 2026-11-01T09:30:00.000Z");
    // The way back, from the same `problems` section the route already reads.
    expect(html).toContain(`href="/assessment/instances/${INSTANCE_ID}"`);

    // A refusal page is never the fixture reader's error text.
    expect(html).not.toContain("PageCopy:");
  });

  it("still writes nothing — the store's refusal, not a partial submit", async () => {
    await POST(submit(), { params: Promise.resolve({ instanceId: INSTANCE_ID }) });

    expect(stub.submitAnswers).toHaveBeenCalledTimes(1);
    const input = stub.submitAnswers.mock.calls[0][0] as {
      instanceRecordId: string;
      answers: ReadonlyMap<string, unknown>;
    };
    expect(input.instanceRecordId).toBe(INSTANCE_ID);
    // The whole sheet reaches the store; the refusal is the store's answer, not a short parse.
    expect(input.answers.get("aspect-trust")).toEqual({ feel: "3", wish: "4" });
  });
});
