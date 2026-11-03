/**
 * The contact form's decision and its send, with the database and the provider replaced by fakes.
 *
 * This is the card's behavioural half (owner, 2026-11-02). The claims it proves are all *orders*
 * and *outcomes*, which a source read cannot:
 *
 *   - a real message is **stored before it is mailed**, and the row exists when the mailer fails;
 *   - a mailer that fails (or is not configured) answers `received`, never `sent` — the message
 *     is kept, so the page may say it was received;
 *   - a store that fails answers `failed`, mails nothing, and never pretends otherwise;
 *   - a filled honeypot or a submit too fast for a person answers `sent` **and writes nothing**,
 *     which is what makes the trap invisible: the bot gets the same page a person does;
 *   - the rate limit refuses a client over budget without storing or sending;
 *   - the message the mailer receives is addressed to the brand's internal mailbox with
 *     `Reply-To` set to the sender's own address.
 *
 * `app/api/contact/route.ts` adds only the HTTP parts — reading the form and the 303 — and the
 * rendered end-to-end proof is `docs`' paste in the PR; everything that could lose a message is
 * here, where it can be driven without a database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { brand } from "@/data/brand";
import { clientIpOf, ipHashOf } from "@/lib/contact/ip";
import { contactBody, contactSubject, sendContactMessage } from "@/lib/contact/mail";
import { submitContactMessage, type ContactDeps } from "@/lib/contact/submit";
import type { MailOutcome } from "@/lib/flow/email";
import {
  CONTACT_MIN_FILL_MS,
  CONTACT_RATE_MAX,
  contactStateOf,
  looksLikeSpam,
  parseContactSubmission,
} from "@/lib/contact/validation";

const STARTED_AT = 1_700_000_000_000;
const LATER = STARTED_AT + CONTACT_MIN_FILL_MS + 5_000;

/** The three fields as a browser posts them, with the hidden plumbing a person never touches. */
const fields = {
  name: "Ada Lovelace",
  email: "ada@example.test",
  message: "I would like to ask about the two-person assessment.",
  website: "",
  startedAt: String(STARTED_AT),
};

/** A recording set of dependencies: the call order is the assertion for store-before-mail. */
function harness(options: { outcome?: MailOutcome } & Partial<ContactDeps> = {}) {
  const { outcome = "sent", ...overrides } = options;
  const calls: string[] = [];
  const stored: unknown[] = [];
  const deps: ContactDeps = {
    now: LATER,
    ipHash: "0123456789abcdef0123456789abcdef",
    userAgent: "vitest",
    countRecent: async () => ({ client: 0, address: 0 }),
    store: async (input) => {
      calls.push("store");
      stored.push(input);
      return "row-1";
    },
    mail: async () => {
      calls.push("mail");
      return outcome;
    },
    record: async (_id, recorded) => {
      calls.push(`record:${recorded}`);
    },
    ...overrides,
  };
  return { deps, calls, stored };
}

describe("a submission is stored before it is mailed", () => {
  it("stores, then mails, then records the send", async () => {
    const { deps, calls, stored } = harness();

    const state = await submitContactMessage(fields, deps);

    expect(state).toBe("sent");
    expect(calls).toEqual(["store", "mail", "record:sent"]);
    expect(stored).toEqual([
      {
        name: "Ada Lovelace",
        email: "ada@example.test",
        message: "I would like to ask about the two-person assessment.",
        ipHash: deps.ipHash,
        userAgent: "vitest",
      },
    ]);
  });

  it("answers `received`, not `sent`, when the provider refuses — and keeps the row", async () => {
    const { deps, calls, stored } = harness({ outcome: "failed" });

    const state = await submitContactMessage(fields, deps);

    expect(state).toBe("received");
    expect(stored).toHaveLength(1);
    expect(calls).toEqual(["store", "mail", "record:failed"]);
  });

  it("answers `received` when no mailer is configured at all", async () => {
    const { deps, stored } = harness({ outcome: "unset" });

    expect(await submitContactMessage(fields, deps)).toBe("received");
    expect(stored).toHaveLength(1);
  });

  it("answers `failed` and mails nothing when the store throws", async () => {
    const { deps, calls } = harness({
      store: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    });

    expect(await submitContactMessage(fields, deps)).toBe("failed");
    expect(calls).toEqual([]);
  });

  it("still answers `sent` when only the outcome update fails", async () => {
    const { deps } = harness({
      record: async () => {
        throw new Error("update failed");
      },
    });

    expect(await submitContactMessage(fields, deps)).toBe("sent");
  });
});

describe("spam is handled without telling the bot", () => {
  it("answers `sent` and writes nothing when the honeypot is filled", async () => {
    const { deps, calls, stored } = harness();

    const state = await submitContactMessage({ ...fields, website: "https://spam.example" }, deps);

    expect(state).toBe("sent");
    expect(calls).toEqual([]);
    expect(stored).toEqual([]);
  });

  it("answers `sent` and writes nothing when the submit beats a human", async () => {
    const { deps, calls } = harness();

    const state = await submitContactMessage(
      { ...fields, startedAt: String(LATER - (CONTACT_MIN_FILL_MS - 1)) },
      deps,
    );

    expect(state).toBe("sent");
    expect(calls).toEqual([]);
  });

  it("answers `sent` and writes nothing when the timestamp is missing or forged", async () => {
    for (const startedAt of ["", "not-a-number", String(LATER + 60_000)]) {
      const { deps, calls } = harness();
      expect(await submitContactMessage({ ...fields, startedAt }, deps)).toBe("sent");
      expect(calls).toEqual([]);
    }
  });

  it("refuses a client over the rate limit without storing or sending", async () => {
    const { deps, calls } = harness({
      countRecent: async () => ({ client: CONTACT_RATE_MAX, address: 0 }),
    });

    expect(await submitContactMessage(fields, deps)).toBe("throttled");
    expect(calls).toEqual([]);
  });

  /**
   * The second bucket, and the reason it exists: an address is cheaper for a spammer to hold than
   * a machine. Five machines posting the same reply address is one sender, and a limit that only
   * counted the client would let that run forever.
   */
  it("refuses an address over the rate limit from a client that has not spent its budget", async () => {
    const { deps, calls, stored } = harness({
      countRecent: async () => ({ client: 0, address: CONTACT_RATE_MAX }),
    });

    expect(await submitContactMessage(fields, deps)).toBe("throttled");
    expect(calls).toEqual([]);
    expect(stored).toEqual([]);
  });

  it("counts both buckets, and counts the address it was given", async () => {
    const seen: Array<{ hash: string; email: string; now: Date }> = [];
    const { deps } = harness({
      countRecent: async (hash, email, now) => {
        seen.push({ hash, email, now });
        return { client: 0, address: 0 };
      },
    });

    await submitContactMessage(fields, deps);
    expect(seen[0]).toEqual({ hash: deps.ipHash, email: "ada@example.test", now: new Date(LATER) });
  });
});

describe("the fields", () => {
  it("refuses a missing name, an address that cannot be replied to, and an empty message", async () => {
    const cases: ReadonlyArray<readonly [string, typeof fields]> = [
      ["name", { ...fields, name: "   " }],
      ["email", { ...fields, email: "not-an-address" }],
      ["message", { ...fields, message: "" }],
    ];
    for (const [reason, submitted] of cases) {
      const { deps, calls } = harness();
      expect(await submitContactMessage(submitted, deps)).toBe("invalid");
      expect(calls).toEqual([]);
      expect(parseContactSubmission(submitted)).toEqual({ ok: false, reason });
    }
  });

  it("trims the three fields it keeps", () => {
    expect(
      parseContactSubmission({ name: "  Ada ", email: " ada@example.test ", message: " hi " }),
    ).toEqual({
      ok: true,
      value: { name: "Ada", email: "ada@example.test", message: "hi" },
    });
  });

  it("reads only the states the page can render", () => {
    expect(contactStateOf("sent")).toBe("sent");
    expect(contactStateOf(undefined)).toBeUndefined();
    expect(contactStateOf("Message Sent!")).toBeUndefined();
    expect(looksLikeSpam({ startedAt: fields.startedAt, now: LATER })).toBe(false);
  });
});

describe("the mailer", () => {
  const message = {
    name: "Ada Lovelace",
    email: "ada@example.test",
    message: "I would like to ask about the two-person assessment.",
    receivedAt: new Date(LATER),
  };

  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-key";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    vi.restoreAllMocks();
  });

  /** A capture transport: what the provider would have received, and the status it answers. */
  function capture(status: number) {
    const seen: { url: string; payload: Record<string, unknown> }[] = [];
    const impl = (async (url: string | URL, init?: RequestInit) => {
      seen.push({ url: String(url), payload: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ id: "mail-1" }), { status });
    }) as unknown as typeof fetch;
    return { seen, impl };
  }

  it("sends to the brand's internal mailbox with Reply-To set to the sender", async () => {
    const { seen, impl } = capture(200);

    expect(await sendContactMessage(message, impl)).toBe("sent");

    expect(seen).toHaveLength(1);
    expect(seen[0].payload.to).toEqual([brand.supportEmail]);
    expect(seen[0].payload.reply_to).toBe("ada@example.test");
    expect(seen[0].payload.subject).toBe(contactSubject(message));
    expect(String(seen[0].payload.text)).toContain(contactBody(message));
    // The AlignSynch build mails the alias on its own verified domain, not the private inbox.
    if (brand.domain === "alignsynch.com") {
      expect(seen[0].payload.to).toEqual(["support@alignsynch.com"]);
    }
    // The private Gmail destination is never the recipient and never in the message.
    expect(JSON.stringify(seen[0].payload)).not.toContain("gmail.com");
  });

  it("calls a non-2xx a failure, without throwing", async () => {
    const { impl } = capture(500);
    expect(await sendContactMessage(message, impl)).toBe("failed");
  });

  it("calls an unreachable provider a failure, without throwing", async () => {
    const impl = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await sendContactMessage(message, impl)).toBe("failed");
  });

  it("says `unset`, and does not call the provider, when no key is configured", async () => {
    delete process.env.RESEND_API_KEY;
    const { seen, impl } = capture(200);

    expect(await sendContactMessage(message, impl)).toBe("unset");
    expect(seen).toHaveLength(0);
  });
});

describe("the client bucket", () => {
  it("hashes the address instead of storing it", () => {
    const hash = ipHashOf("203.0.113.9");
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).not.toContain("203.0.113.9");
    expect(ipHashOf("203.0.113.9")).toBe(hash);
    expect(ipHashOf("203.0.113.9", "salt")).not.toBe(hash);
  });

  it("reads the first forwarded hop, then the real-ip header", () => {
    expect(clientIpOf(new Headers({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" }))).toBe(
      "198.51.100.7",
    );
    expect(clientIpOf(new Headers({ "x-real-ip": "198.51.100.8" }))).toBe("198.51.100.8");
    expect(clientIpOf(new Headers())).toBe("");
  });
});
