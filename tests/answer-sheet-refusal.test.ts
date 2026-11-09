/**
 * Every refusal the answer sheet can answer with is a **sentence and a status**, never a 500 (#752).
 *
 * The defect this pins was two halves of one mistake in `POST …/answers/route.ts`:
 *
 *   - the refusal page reads its words out of the fixture (`problems` in
 *     `data/pages/assessment-instance.ts`), and the fixture carried an item for only five of the
 *     seven codes in `SubmissionRejection` — so a `lapsed` or `voided` refusal threw out of
 *     `itemLabel` and the request died as a 500 with no sentence at all;
 *   - the status was a ternary chain whose fall-through was `404`, so a code it did not name
 *     claimed the relationship was gone. A lapsed relationship **exists**; its sheet is simply not
 *     writable, which is a conflict.
 *
 * Three assertions, in the order the acceptance lists them:
 *
 *   1. **the union is walked** — `SUBMISSION_CODES` is a `Record` over `SubmissionRejection`, so a
 *      code added to the union is a `tsc` error here rather than a silently shorter walk, and each
 *      code has an item in the fixture's `problems` section (the same section the Steps endpoint
 *      refuses through, so `StepRefusal` is walked too);
 *   2. **a lapsed submit is a 4xx HTML page with the fixture's own sentence** — the store is
 *      stubbed at its module boundary (the `tests/contact-http.test.ts` pattern), so this is the
 *      route's contract with no database: the code comes back, the page carries the words;
 *   3. **the status is per code** — the spec table below is the expectation, and a refusal that
 *      answers 404 or 500 for a relationship that exists fails it.
 */
import { describe, expect, it, vi } from "vitest";

import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { answersPath, instancePath } from "@/lib/flow/paths";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import type { StepRefusal } from "@/lib/flow/store";
import type { SubmissionRejection } from "@/lib/flow/state";

/**
 * The store's answer, set per test. Hoisted so `vi.mock`'s factory can reach it — the route reads
 * `readInstanceMode` before the write and `submitAnswers` for it, and nothing else from the module.
 */
const stub = vi.hoisted(() => ({
  refusal: {
    ok: false as const,
    code: "lapsed" as SubmissionRejection,
    reason: "the membership ended on 2026-11-01T00:00:00.000Z",
  },
}));

vi.mock("@/lib/flow/store", () => ({
  readInstanceMode: async () => "basic",
  submitAnswers: async () => stub.refusal,
}));

// No auth env and no session: the route must still answer, and the cookie holds no party token.
vi.mock("@/lib/auth/config", () => ({ authConfigured: () => false }));
vi.mock("@/lib/auth/session", () => ({ currentUser: async () => null }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { POST } from "@/app/(mainlayout)/assessment/instances/[instanceId]/answers/route";

/**
 * The spec: what each refusal code is answered with. A `Record` over the union, so **tsc fails on
 * a union member with no row** — the walk cannot shrink while the store can still return a code,
 * which is exactly the drift that produced the 500.
 */
const EXPECTED_STATUS: Record<SubmissionRejection, number> = {
  "not-a-party": 403,
  "no-such-instance": 404,
  frozen: 409,
  incomplete: 409,
  voided: 409,
  lapsed: 409,
  "payment-method-required": 409,
};

/** The union as a runtime list. `EXPECTED_STATUS` supplies the keys; the values are the statuses. */
const SUBMISSION_CODES = Object.keys(EXPECTED_STATUS) as SubmissionRejection[];

const INSTANCE = "inst-752";

/** A post a party could have made: a Basic sheet, one Aspect, a score for each opinion it asks. */
function sheetRequest(): Request {
  const form = new FormData();
  form.set("feel:aspect-money", "3");
  form.set("wish:aspect-money", "4");
  return new Request(`http://localhost${answersPath(INSTANCE)}`, { method: "POST", body: form });
}

async function submit(): Promise<Response> {
  return POST(sheetRequest(), { params: Promise.resolve({ instanceId: INSTANCE }) });
}

const problems = sectionOf(assessmentInstancePageCopy, "problems");

describe("the refusal copy covers the store's refusal union", () => {
  it("has a sentence for every code `submitAnswers` can return", () => {
    // The union, spelled out. A code added to `SubmissionRejection` breaks `EXPECTED_STATUS` at
    // compile time; this line is what makes a *removal* a deliberate edit too.
    expect([...SUBMISSION_CODES].sort()).toEqual([
      "frozen",
      "incomplete",
      "lapsed",
      "no-such-instance",
      "not-a-party",
      "payment-method-required",
      "voided",
    ]);

    for (const code of SUBMISSION_CODES) {
      // `itemLabel` throws on a missing id — that throw is the 500, so calling it is the assertion.
      expect(() => itemLabel(problems, code)).not.toThrow();
      expect(itemLabel(problems, code).length).toBeGreaterThan(0);
    }
  });

  it("has one for the Steps endpoint's codes too, which read the same section", () => {
    const stepCodes: Record<StepRefusal, true> = {
      "not-a-party": true,
      "no-such-instance": true,
      "no-such-step": true,
      incomplete: true,
      invalid: true,
    };

    for (const code of Object.keys(stepCodes)) {
      expect(() => itemLabel(problems, code)).not.toThrow();
    }
  });

  it("still has the way back to the instance", () => {
    expect(() => itemLabel(problems, "back")).not.toThrow();
  });
});

describe("a refusal is a page, per code", () => {
  it("answers a lapsed submit with 409 and the fixture's sentence, never a 500", async () => {
    stub.refusal = {
      ok: false,
      code: "lapsed",
      reason: "the membership ended on 2026-11-01T00:00:00.000Z",
    };

    const response = await submit();
    const html = await response.text();

    // The sheet is not writable — and the relationship is not gone, so never the old 404.
    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).toContain("text/html");
    // The words are the fixture's, not a string written into the route.
    expect(html).toContain(itemLabel(problems, "lapsed"));
    // …and the store's own reason is printed beneath them, because it names the instant.
    expect(html).toContain("2026-11-01T00:00:00.000Z");
    // The way back to the instance, so the reader is not stranded on a bare refusal.
    expect(html).toContain(`href="${instancePath(INSTANCE)}"`);
  });

  it("answers every code in the union with its own status and its own sentence", async () => {
    for (const code of SUBMISSION_CODES) {
      stub.refusal = { ok: false, code, reason: `refused: ${code}` };

      const response = await submit();
      const html = await response.text();

      expect(response.status, `status for ${code}`).toBe(EXPECTED_STATUS[code]);
      expect(response.status, `${code} must not be a server error`).toBeLessThan(500);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(html, `sentence for ${code}`).toContain(itemLabel(problems, code));
    }
  });
});
