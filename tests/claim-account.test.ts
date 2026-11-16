/**
 * The account a two-field claim binds to (#1115 task 4) — resolved, or created, and never a 500.
 *
 * The counterparty is asked for a name and an address and nothing else, so somebody has to answer
 * "which account is that?" without asking for a password. `resolveClaimAccount()` is that answer,
 * and the five things this file pins are the five ways it can fail a person:
 *
 *   1. **The address already has an account** — answer its id and sign nobody in. The person has
 *      credentials already; this path must not mint a second account for them.
 *   2. **The address has none** — create one through the branch's own `sign-up/email`, the call
 *      `scripts/db-seed.mjs` makes, and hand back the session cookies it set. No password is asked
 *      of anybody, and the one the account is created with is generated here.
 *   3. **The auth server is not configured** (a gate tree, a preview) — no account, and the claim
 *      still binds the seat to the browser. A deployment mistake must not cost an invitation.
 *   4. **The auth server refuses or is unreachable** — same answer, logged. Never a throw: the
 *      claim route would turn it into a 500 on a page whose whole job is to be a sentence.
 *   5. **Nothing usable was posted** — no address, no lookup, no account.
 *
 * Both boundaries are faked: `getPool()` for the auth-schema read and `fetch` for the sign-up, so
 * nothing here touches a branch or a mail address.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  /** Every statement the module issued, so "it did not look" is an assertion. */
  calls: [] as { readonly text: string; readonly values: readonly unknown[] }[],
  /** The auth user the schema holds, by email. */
  users: [] as { readonly id: string; readonly email: string }[],
  /** How the auth server answers the sign-up. */
  signUp: null as null | { status: number; body?: unknown; cookies?: string[] },
  /** Every `fetch` the module issued, with the request it made. */
  fetches: [] as { readonly url: string; readonly body: unknown }[],
}));

vi.mock("@/lib/db/client", () => ({
  getPool: () => ({
    query: async (text: string, values: readonly unknown[] = []) => {
      fake.calls.push({ text, values });
      if (/information_schema\.tables/i.test(text)) {
        return { rows: [{ table_name: "user" }], rowCount: 1 };
      }
      if (/FROM neon_auth\."user"/i.test(text)) {
        const wanted = String(values[0]);
        return { rows: fake.users.filter((user) => user.email === wanted), rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  }),
}));

import { resolveClaimAccount } from "@/lib/auth/claim-account";

beforeEach(() => {
  fake.calls.length = 0;
  fake.users.length = 0;
  fake.signUp = null;
  fake.fetches.length = 0;
  process.env.NEON_AUTH_BASE_URL = "https://auth.example.test/";
  vi.stubGlobal("fetch", async (url: string, init: { body?: unknown } = {}) => {
    fake.fetches.push({
      url,
      body: init.body === undefined ? null : JSON.parse(String(init.body)),
    });
    const answer = fake.signUp ?? { status: 500 };
    const headers = new Headers();
    for (const cookie of answer.cookies ?? []) headers.append("set-cookie", cookie);
    headers.append("content-type", "application/json");
    return new Response(JSON.stringify(answer.body ?? {}), { status: answer.status, headers });
  });
});

describe("resolveClaimAccount", () => {
  it("answers the id an existing account already has, and signs nobody in", async () => {
    fake.users.push({ id: "account-rowan", email: "rowan@example.test" });

    const account = await resolveClaimAccount({ email: "Rowan@Example.test", name: "Rowan" });

    expect(account).toEqual({ userId: "account-rowan", setCookies: [], created: false });
    expect(fake.fetches).toHaveLength(0);
  });

  it("creates the account from the address alone, and hands back the session cookie", async () => {
    fake.signUp = {
      status: 200,
      body: { user: { id: "account-created" }, token: "irrelevant" },
      cookies: ["__Secure-neon-auth.session_token=abc; Path=/; Secure; HttpOnly"],
    };

    const account = await resolveClaimAccount({
      email: "rowan@example.test",
      name: "Rowan",
      origin: "https://app.example.test",
    });

    expect(account.created).toBe(true);
    expect(account.userId).toBe("account-created");
    expect(account.setCookies).toEqual([
      "__Secure-neon-auth.session_token=abc; Path=/; Secure; HttpOnly",
    ]);

    // The branch's own endpoint, so the account is created exactly the way a person's is.
    expect(fake.fetches).toHaveLength(1);
    expect(fake.fetches[0].url).toBe("https://auth.example.test/sign-up/email");
    const body = fake.fetches[0].body as { email: string; name: string; password: string };
    expect(body.email).toBe("rowan@example.test");
    expect(body.name).toBe("Rowan");
    // A generated password: nobody is asked for one, and it is never shown or stored here.
    expect(typeof body.password).toBe("string");
    expect(body.password.length).toBeGreaterThan(20);
  });

  it("finds the account when it appeared between the lookup and the sign-up", async () => {
    // The race the endpoint can lose: another tab created the account a moment ago.
    fake.signUp = { status: 422, body: { code: "USER_ALREADY_EXISTS" } };
    fake.users.push({ id: "account-raced", email: "rowan@example.test" });

    const account = await resolveClaimAccount({ email: "rowan@example.test", name: "Rowan" });

    expect(account).toEqual({ userId: "account-raced", setCookies: [], created: false });
  });

  it("answers no account when the tree has no auth server, and claims still work", async () => {
    delete process.env.NEON_AUTH_BASE_URL;

    const account = await resolveClaimAccount({ email: "rowan@example.test", name: "Rowan" });

    expect(account).toEqual({ userId: null, setCookies: [], created: false });
    expect(fake.fetches).toHaveLength(0);
  });

  it("answers no account rather than throwing when the auth server refuses", async () => {
    fake.signUp = { status: 500, body: { message: "boom" } };

    await expect(
      resolveClaimAccount({ email: "rowan@example.test", name: "Rowan" }),
    ).resolves.toEqual({ userId: null, setCookies: [], created: false });
  });

  it("answers no account rather than throwing when the auth server cannot be reached", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });

    await expect(
      resolveClaimAccount({ email: "rowan@example.test", name: "Rowan" }),
    ).resolves.toEqual({ userId: null, setCookies: [], created: false });
  });

  it("asks the auth schema nothing when no address was posted", async () => {
    const blank = await resolveClaimAccount({ email: "   ", name: "Rowan" });
    const absent = await resolveClaimAccount({ email: null, name: "Rowan" });

    expect(blank.userId).toBeNull();
    expect(absent.userId).toBeNull();
    expect(fake.calls).toHaveLength(0);
    expect(fake.fetches).toHaveLength(0);
  });

  /* ------------------------------------------------------------------ *
   * The resume's reading of the same question (#1115 task 4)
   * ------------------------------------------------------------------ */

  it("answers the account a spent invitation's address already has, signing nobody in", async () => {
    // The resume path: the invitation was spent, the seat is bound to this address, and the person
    // opened their own link again in a new browser. The id is what proves the seat is theirs.
    fake.users.push({ id: "account-rowan", email: "rowan@example.test" });

    const account = await resolveClaimAccount({
      email: "rowan@example.test",
      name: "Rowan",
      allowCreate: false,
    });

    expect(account).toEqual({ userId: "account-rowan", setCookies: [], created: false });
    expect(fake.fetches).toHaveLength(0);
  });

  it("mints nothing for an address with no account when creation is not allowed", async () => {
    // A dead link must never create an account: the resume is a comparison, not a sign-up. The
    // claim is then refused the way it was before — `claimed` — rather than minting a stranger.
    const account = await resolveClaimAccount({
      email: "stranger@example.test",
      name: "Stranger",
      allowCreate: false,
    });

    expect(account).toEqual({ userId: null, setCookies: [], created: false });
    expect(fake.fetches).toHaveLength(0);
  });
});
