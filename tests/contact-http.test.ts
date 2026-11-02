/**
 * `POST /api/contact`, at the HTTP edge — the half `tests/contact-route.test.ts` cannot see.
 *
 * That file proves the *decision* (order, outcomes) against fakes with no request. This one proves
 * the two things the card writes as commands:
 *
 *   - a submission answers **303** back to `/help?contact=…`, and the row is inserted before the
 *     message is handed to the mailer;
 *   - a submit over either throttle bucket answers **429** with a `retry-after`, and **writes
 *     nothing** — no insert, no send, no outcome update. A refusal that still stored would be a
 *     rate limit that costs the database a row per attempt, which is the attack.
 *
 * The store and the mailer are stubbed at their module boundary (`vi.mock`), so this file asserts
 * the request the route would make without a database and without a provider — the same split
 * `tests/news-signup.test.ts` uses for the footer's signup.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  countRecent: vi.fn(),
  insert: vi.fn(),
  record: vi.fn(),
  mail: vi.fn(),
}));

vi.mock("@/lib/contact/store", () => ({
  countRecentContactMessages: stub.countRecent,
  storeContactMessage: stub.insert,
  recordMailOutcome: stub.record,
}));

vi.mock("@/lib/contact/mail", () => ({ sendContactMessage: stub.mail }));

import { POST } from "@/app/api/contact/route";

/**
 * A submit a person could have made: the hidden `startedAt` is older than the minimum fill time,
 * so the spam rule passes and the request reaches the store.
 */
function request(overrides: Record<string, string> = {}): Request {
  const fields: Record<string, string> = {
    name: "Ada Lovelace",
    email: "ada@example.test",
    message: "I would like to ask about the two-person assessment.",
    website: "",
    startedAt: String(Date.now() - 5_000),
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new Request("http://localhost/api/contact", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": "203.0.113.9" },
  });
}

beforeEach(() => {
  stub.countRecent.mockResolvedValue({ client: 0, address: 0 });
  stub.insert.mockResolvedValue("row-1");
  stub.record.mockResolvedValue(undefined);
  stub.mail.mockResolvedValue("sent");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("a submission is answered, not streamed", () => {
  it("answers 303 to /help?contact=sent and stores before it mails", async () => {
    const response = await POST(request());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/help?contact=sent");
    // Stored, then mailed — the order is the claim, so the ids are compared, not just called.
    expect(stub.insert).toHaveBeenCalledTimes(1);
    expect(stub.mail).toHaveBeenCalledTimes(1);
    expect(stub.insert.mock.invocationCallOrder[0]).toBeLessThan(
      stub.mail.mock.invocationCallOrder[0],
    );
    expect(stub.record).toHaveBeenCalledWith("row-1", "sent");
  });

  it("answers `received` and keeps the row when the provider refuses", async () => {
    stub.mail.mockResolvedValue("failed");

    const response = await POST(request());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/help?contact=received");
    expect(stub.insert).toHaveBeenCalledTimes(1);
  });

  it("answers nothing back to a bot: the honeypot gets the success page and writes no row", async () => {
    const response = await POST(request({ website: "https://spam.example" }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/help?contact=sent");
    expect(stub.countRecent).not.toHaveBeenCalled();
    expect(stub.insert).not.toHaveBeenCalled();
    expect(stub.mail).not.toHaveBeenCalled();
  });
});

describe("the throttle is a 429 and costs the database nothing", () => {
  for (const [bucket, counts] of [
    ["client", { client: 5, address: 0 }],
    ["address", { client: 0, address: 5 }],
  ] as const) {
    it(`refuses a ${bucket} over budget without inserting, mailing or recording`, async () => {
      stub.countRecent.mockResolvedValue(counts);

      const response = await POST(request());

      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("600");
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(await response.text()).toContain("Too many messages");
      expect(stub.insert).not.toHaveBeenCalled();
      expect(stub.mail).not.toHaveBeenCalled();
      expect(stub.record).not.toHaveBeenCalled();
    });
  }

  it("counts both buckets against the address the sender typed", async () => {
    stub.countRecent.mockResolvedValue({ client: 0, address: 0 });

    await POST(request());

    expect(stub.countRecent).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f]{32}$/),
      "ada@example.test",
      expect.any(Date),
    );
  });
});
