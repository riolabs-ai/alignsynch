/**
 * The footer's news signup, driven the way the browser drives it.
 *
 * Three things this file proves, and why each is a test rather than a review note:
 *
 *   **one row, one send.** A first submit writes the lower-cased address once and sends exactly
 *   one message from the configured sender to that address. A second submit of the same address
 *   is `ON CONFLICT DO NOTHING`: `psql` still counts one row, the route answers `duplicate`, and
 *   **no second message goes out** — a confirmation per submit is a spam loop with a friendly
 *   face.
 *
 *   **failure is a state, not a crash.** The row is written before the mail is sent, so a refused
 *   provider is `stored-send-failed` with a 2xx: the person *is* subscribed and is told so. A
 *   storage failure is `storage-failed` with a 503 and claims nothing — never a success for a
 *   write that did not happen.
 *
 *   **nothing is written for a bad address.** The refusal happens before the insert, so the
 *   "zero rows" claim is a property of the code rather than of a rollback.
 *
 * The pool is stubbed the way the repo's other database tests stub it (`vi.mock("@/lib/db/client")`
 * — see `tests/flow-resend.test.ts`), and the mailer is the app's own `sendMail()` with `fetch`
 * replaced, so the assertion is about the request the transport would make: `from`, `to`,
 * `subject`, `text`. No address is invented and no real send is attempted.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({ query: vi.fn(), queryRows: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  getPool: () => ({ query: stub.query }),
  queryRows: (...args: unknown[]) => stub.queryRows(...args),
  databaseConfigured: () => true,
}));

import { GET, POST } from "@/app/api/news/subscribe/route";
import { brand } from "@/data/brand";
import { shellPageCopy } from "@/data/pages/shell";
import { NEWS_SIGNUP_ITEM_IDS } from "@/components/layout/news-signup";
import { CONTACT_RATE_MAX } from "@/lib/forms/guard";
import { mintFillToken, readFillInstant } from "@/lib/forms/token";
import { newsConfirmationMessage } from "@/lib/news/message";
import {
  newsSignupRefusal,
  newsSignupStateOf,
  normalizeEmail,
  sourcePathOf,
} from "@/lib/news/signup";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const ADDRESS = "Avery.Person@Example.com";
const NORMALISED = "avery.person@example.com";
const SOURCE = "/pricing";
const SENDER = "news@rsm.alignsynch.com";

/** A form post the way the footer makes it. */
function request(
  fields: Record<string, string>,
  accept = "application/json",
  ip?: string,
): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const headers: Record<string, string> = { accept };
  // A proxy-supplied address is what gives the request a client bucket; without one the guard
  // has no identity to count (a direct connection — a local server, a script — looks like this).
  if (ip !== undefined) headers["x-forwarded-for"] = ip;
  return new Request("http://localhost/api/news/subscribe", {
    method: "POST",
    body: form,
    headers,
  });
}

/** The `fetch` the transport is handed: one recorded request, and the status a provider returns. */
function transport(status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(status === 200 ? '{"id":"msg_stub"}' : "{}", { status });
  });
  return { calls, impl };
}

/** What the route stored, as the two values that matter: the address and the page path. */
function insertArgs(call: number): { email: string; source: string; createdAt: string } {
  const [, values] = insertCalls()[call] as [string, string[]];
  return { email: values[0], source: values[1], createdAt: values[2] };
}

/** The writes that created a subscription — as opposed to the guard's attempt rows. */
function insertCalls(): unknown[][] {
  return stub.query.mock.calls.filter((call) =>
    String(call[0]).includes("INSERT INTO news_signup"),
  );
}

/** The guard's own writes: one row per submission the window counted. */
function attemptCalls(): unknown[][] {
  return stub.query.mock.calls.filter((call) =>
    String(call[0]).includes("INSERT INTO form_guard_attempt"),
  );
}

const previousKey = process.env.RESEND_API_KEY;
const previousFrom = process.env.RESEND_FROM;
const previousSecret = process.env.FORM_GUARD_SECRET;

beforeEach(() => {
  stub.query.mockReset();
  stub.queryRows.mockReset();
  // The window answers "nothing yet" unless a case says otherwise, and the subscription write
  // is the only SQL the route's own flow cares about.
  stub.queryRows.mockResolvedValue([{ client: 0, address: 0 }]);
  stub.query.mockImplementation(async (sql: string) =>
    String(sql).includes("INSERT INTO news_signup")
      ? { rowCount: 1, rows: [{ email: NORMALISED }] }
      : { rowCount: 1, rows: [] },
  );
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM = SENDER;
  // A fixed signing secret, so a token minted here verifies in the route.
  process.env.FORM_GUARD_SECRET = "test-form-guard-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (previousKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = previousKey;
  if (previousFrom === undefined) delete process.env.RESEND_FROM;
  else process.env.RESEND_FROM = previousFrom;
  if (previousSecret === undefined) delete process.env.FORM_GUARD_SECRET;
  else process.env.FORM_GUARD_SECRET = previousSecret;
});

describe("the address rules", () => {
  it("normalises to one form: trimmed and lower-cased", () => {
    expect(normalizeEmail(`  ${ADDRESS} `)).toBe(NORMALISED);
  });

  it("refuses an empty field and a malformed address, and accepts a deliverable one", () => {
    expect(newsSignupRefusal("")).toBe("empty");
    expect(newsSignupRefusal("   ")).toBe("empty");
    expect(newsSignupRefusal("avery@")).toBe("invalid");
    expect(newsSignupRefusal("avery.example.com")).toBe("invalid");
    expect(newsSignupRefusal(ADDRESS)).toBeUndefined();
  });

  it("keeps only a root-relative path, so the fallback page cannot link off-site", () => {
    expect(sourcePathOf("/pricing")).toBe("/pricing");
    expect(sourcePathOf("/support/articles/how?utm=1#top")).toBe("/support/articles/how");
    expect(sourcePathOf("//evil.example/steal")).toBe("/");
    expect(sourcePathOf("https://evil.example")).toBe("/");
    expect(sourcePathOf("pricing")).toBe("/");
    expect(sourcePathOf(undefined)).toBe("/");
  });

  it("treats an unknown wire value as the state that claims nothing", () => {
    expect(newsSignupStateOf("subscribed")).toBe("subscribed");
    expect(newsSignupStateOf("sold-your-data")).toBe("storage-failed");
    expect(newsSignupStateOf(undefined)).toBe("storage-failed");
  });
});

describe("POST /api/news/subscribe", () => {
  it("stores the lower-cased address once and sends exactly one confirmation", async () => {
    const { calls, impl } = transport();
    vi.stubGlobal("fetch", impl);

    const response = await POST(request({ email: ADDRESS, source: SOURCE }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "subscribed" });

    // One row, keyed by the normalised address, carrying the page it came from.
    expect(insertCalls()).toHaveLength(1);
    const [sql] = insertCalls()[0] as [string];
    expect(sql).toContain("INSERT INTO news_signup");
    // #507 — the conflict clause clears an unsubscribe mark and writes nothing otherwise, so the
    // ordinary duplicate path still answers `duplicate` (the next case) and a person who
    // unsubscribed and came back is subscribed again.
    expect(sql).toContain("ON CONFLICT (email) DO UPDATE");
    expect(sql).toContain("SET unsubscribed_at = NULL");
    expect(sql).toContain("WHERE news_signup.unsubscribed_at IS NOT NULL");
    expect(insertArgs(0)).toMatchObject({ email: NORMALISED, source: SOURCE });

    // One send, to that address, from the configured sender, through the app's endpoint.
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      from: SENDER,
      to: [NORMALISED],
      subject: itemLabel(sectionOf(shellPageCopy, "footer-news"), "confirm-subject").replace(
        "{brand}",
        brand.name,
      ),
    });
  });

  it("is idempotent: the same address again is one row and no second message", async () => {
    const { calls, impl } = transport();
    vi.stubGlobal("fetch", impl);

    // The second insert hits the primary key and writes nothing.
    let inserts = 0;
    stub.query.mockImplementation(async (sql: string) => {
      if (!String(sql).includes("INSERT INTO news_signup")) return { rowCount: 1, rows: [] };
      inserts += 1;
      return inserts === 1
        ? { rowCount: 1, rows: [{ email: NORMALISED }] }
        : { rowCount: 0, rows: [] };
    });

    await POST(request({ email: ADDRESS, source: SOURCE }));
    expect(calls).toHaveLength(1);

    const second = await POST(request({ email: ADDRESS.toLowerCase(), source: SOURCE }));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ state: "duplicate" });
    expect(insertCalls()).toHaveLength(2);
    // Two submits, one confirmation: the second is a no-op, not a second email.
    expect(calls).toHaveLength(1);
  });

  it("writes nothing and sends nothing for an address that is not deliverable-shaped", async () => {
    const { calls, impl } = transport();
    vi.stubGlobal("fetch", impl);

    const response = await POST(request({ email: " avery@ ", source: SOURCE }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ state: "invalid" });
    expect(stub.query).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("claims nothing when the database does not answer", async () => {
    const { calls, impl } = transport();
    vi.stubGlobal("fetch", impl);
    stub.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes("INSERT INTO news_signup")) {
        throw Object.assign(new Error("down"), { code: "57P01" });
      }
      return { rowCount: 1, rows: [] };
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(request({ email: ADDRESS, source: SOURCE }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ state: "storage-failed" });
    // The row is not there, so no confirmation may be sent and none is.
    expect(calls).toHaveLength(0);
  });

  it("leaves the person subscribed when the send is refused, and says so", async () => {
    const { calls, impl } = transport(429);
    vi.stubGlobal("fetch", impl);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(request({ email: ADDRESS, source: SOURCE }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "stored-send-failed" });
    // The write happened; one send was attempted and refused.
    expect(insertCalls()).toHaveLength(1);
    expect(calls).toHaveLength(1);
    const lines = error.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(lines).toContain("[news]");
    expect(lines).toContain("HTTP 429");
    // A log line is copied and kept; the address is not in it.
    expect(lines).not.toContain(NORMALISED);
  });

  it("answers a browser form post with the fixture's sentence, not JSON", async () => {
    const { impl } = transport();
    vi.stubGlobal("fetch", impl);

    const response = await POST(
      request({ email: ADDRESS, source: SOURCE }, "text/html,application/xhtml+xml"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type") ?? "").toContain("text/html");
    const html = await response.text();
    expect(html).toContain(itemLabel(sectionOf(shellPageCopy, "footer-news"), "subscribed"));
    expect(html).toContain(`href="${SOURCE}"`);
  });

  it("never puts an address in a log line", async () => {
    const { impl } = transport(500);
    vi.stubGlobal("fetch", impl);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await POST(request({ email: ADDRESS, source: SOURCE }));

    const lines = [...error.mock.calls, ...warn.mock.calls]
      .map((call) => call.join(" "))
      .join("\n");
    expect(lines).not.toContain(NORMALISED);
    expect(lines).not.toContain(ADDRESS);
  });
});

describe("the guard on the news signup (#615)", () => {
  it("answers a honeypotted submit exactly like a clean one, and writes no row", async () => {
    const { calls, impl } = transport();
    vi.stubGlobal("fetch", impl);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const clean = await POST(request({ email: ADDRESS, source: SOURCE }));
    const body = await clean.json();

    const honeypotted = await POST(
      request({ email: "someone.else@example.test", source: SOURCE, website: "spam.example" }),
    );
    // Same status, same body: the endpoint is not an oracle for which rule was tripped.
    expect(honeypotted.status).toBe(clean.status);
    expect(await honeypotted.json()).toEqual(body);

    // One subscription (the clean one), one counted attempt, one send — the bot wrote nothing.
    expect(insertCalls()).toHaveLength(1);
    expect(attemptCalls()).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it("drops a forged or too-fast signed instant without writing or sending", async () => {
    const { calls, impl } = transport();
    vi.stubGlobal("fetch", impl);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const forged = await POST(
      request({ email: ADDRESS, source: SOURCE, fillToken: "1700000000000.deadbeef" }),
    );
    expect(forged.status).toBe(200);
    expect(await forged.json()).toEqual({ state: "subscribed" });

    const tooFast = await POST(
      request({ email: ADDRESS, source: SOURCE, fillToken: mintFillToken(Date.now()) ?? "" }),
    );
    expect(tooFast.status).toBe(200);
    expect(await tooFast.json()).toEqual({ state: "subscribed" });

    expect(insertCalls()).toHaveLength(0);
    expect(attemptCalls()).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it("accepts a submission whose signed instant is old enough to be a person's", async () => {
    const { calls, impl } = transport();
    vi.stubGlobal("fetch", impl);
    const token = mintFillToken(Date.now() - 5_000) ?? "";
    // The token really is signed by this tree's secret, not merely shaped like one.
    expect(readFillInstant(token)).toBeGreaterThan(0);

    const response = await POST(request({ email: ADDRESS, source: SOURCE, fillToken: token }));
    expect(await response.json()).toEqual({ state: "subscribed" });
    expect(insertCalls()).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it("mints a token on GET that this same route verifies", async () => {
    const body = (await GET().json()) as { token: unknown };
    expect(typeof body.token).toBe("string");
    expect(readFillInstant(body.token)).toBeGreaterThan(0);
  });

  it("writes at most the budget when one client submits six times inside the window", async () => {
    const { impl } = transport();
    vi.stubGlobal("fetch", impl);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    /**
     * The window, as the store behaves: the count is read *before* this request's own attempt is
     * recorded, so the sixth submit sees five.
     */
    let attempts = 0;
    stub.queryRows.mockImplementation(async () => [{ client: attempts, address: 0 }]);
    stub.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes("INSERT INTO form_guard_attempt")) {
        attempts += 1;
        return { rowCount: 1, rows: [] };
      }
      if (String(sql).includes("INSERT INTO news_signup")) {
        return { rowCount: 1, rows: [{ email: NORMALISED }] };
      }
      return { rowCount: 1, rows: [] };
    });

    for (let index = 0; index < 6; index += 1) {
      await POST(
        request(
          { email: `person${index}@example.test`, source: SOURCE },
          "application/json",
          "203.0.113.9",
        ),
      );
    }

    // Five rows, not six: the sixth was counted and dropped, and every one of the six was counted.
    expect(insertCalls()).toHaveLength(CONTACT_RATE_MAX);
    expect(attemptCalls()).toHaveLength(6);
  });
});

describe("the fixture and the form", () => {
  it("carries every id the form and the confirmation read", () => {
    const band = sectionOf(shellPageCopy, "footer-news");
    const ids = (band.items ?? []).map((item) => item.id);
    for (const id of NEWS_SIGNUP_ITEM_IDS) expect(ids).toContain(id);
  });

  it("builds the confirmation from the fixture, filled with the brand and the address", () => {
    const message = newsConfirmationMessage(NORMALISED);
    expect(message.to).toBe(NORMALISED);
    expect(message.text).toContain(NORMALISED);
    expect(message.text).not.toContain("{brand}");
    expect(message.text).not.toContain("{support}");
    // The two facts a subscription note owes: what it is, and how to stop it.
    expect(message.text.toLowerCase()).toContain("stop");
  });

  it("claims no cadence and no money in the footer's own words", () => {
    const band = sectionOf(shellPageCopy, "footer-news");
    const words = [band.heading ?? "", band.body ?? "", ...(band.items ?? []).map((i) => i.label)]
      .join("\n")
      .toLowerCase();
    for (const banned of ["$", "earn", "revenue", "trusted by", "testimonial"]) {
      expect(words).not.toContain(banned);
    }
    expect(words).toContain("no schedule");
  });
});
