/**
 * The Google round trip's mechanics (#351 follow-up), pinned against the headers Neon actually sends.
 *
 * The defect this card closes was invisible to every check in the tree: a real Google sign-in
 * completed at Neon, came back to `/dashboard?neon_auth_session_verifier=…`, and answered `307 →
 * /login` with no cookie, because nothing exchanged the verifier — and because the one cookie the
 * exchange needs (`__Secure-neon-auth.session_challenge`) had been minted on **Neon's** origin by
 * #350's browser-side start, where no code of ours could read it.
 *
 * So these tests are about two things and no more:
 *
 *   1. **the wire shapes** — the `Set-Cookie` lines below are copied from measured
 *      `POST {NEON_AUTH_BASE_URL}/sign-in/social` and `GET …/get-session` answers on the branch this
 *      build is linked to, including the `HttpOnly; Secure; SameSite=None; Partitioned` attributes
 *      and the legacy `session_challange` spelling Neon still sends beside the canonical one. A
 *      parser that cannot read the real header is the whole bug;
 *   2. **the two refusals Neon actually gives** — `400 SESSION_CHALLENGE_COOKIE_NOT_FOUND` (no
 *      challenge) and `400 VERIFICATION_NOT_FOUND` (a challenge that does not match its verifier) —
 *      so the exchange's failure path is tested against what the server says, not what we hope.
 *
 * `exchangeVerifier` and `startGoogleHandshake` are driven with a stubbed `fetch`, so no test opens a
 * connection: `AGENTS.md` makes that a contract of the gate, not a preference.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  appOriginOf,
  challengeCookieHeader,
  challengeFromSetCookies,
  clearFlowCookieHeader,
  decodeFlowCookie,
  encodeFlowCookie,
  flowCookieAgeSeconds,
  flowCookieHeader,
  GOOGLE_FINISH_PATH,
  GOOGLE_FLOW_COOKIE,
  GOOGLE_FLOW_TTL_SECONDS,
  isRelayableSessionCookie,
  NEON_CHALLENGE_COOKIE,
  relayedSessionCookie,
  setCookiesOf,
  VERIFIER_PARAM,
} from "@/lib/auth/google-flow";
import { exchangeVerifier, startGoogleHandshake } from "@/lib/auth/google-flow-neon";
import { absoluteUrlFor } from "@/lib/auth/paths";

/** The challenge header exactly as Neon answered on 2026-11-01 (canonical spelling first). */
const MEASURED_CHALLENGE_SET_COOKIES = [
  "__Secure-neon-auth.session_challenge=4844a007f6483068b220f009016b7197d044cfeadfe817275033dfb4219bbb3e.7nabud6072oBBRBy6YFiYrI0MKsa22bQNOwVLL9XXCc%3D; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=None; Partitioned",
  "__Secure-neon-auth.session_challange=4844a007f6483068b220f009016b7197d044cfeadfe817275033dfb4219bbb3e.7nabud6072oBBRBy6YFiYrI0MKsa22bQNOwVLL9XXCc%3D; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=None; Partitioned",
];

describe("setCookiesOf / challengeFromSetCookies — the header Neon really sends", () => {
  it("reads several Set-Cookie headers without folding them on a comma", () => {
    const headers = new Headers();
    headers.append("set-cookie", "a=1; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT");
    headers.append("set-cookie", "b=2; Path=/");
    // `get("set-cookie")` folds both into one line; `getSetCookie()` keeps two. The parser depends
    // on the second, and an `Expires` date carries the comma that folding would split on.
    expect(setCookiesOf(headers)).toHaveLength(2);
  });

  it("takes the canonical challenge when Neon sends both spellings", () => {
    expect(challengeFromSetCookies(MEASURED_CHALLENGE_SET_COOKIES)).toBe(
      "4844a007f6483068b220f009016b7197d044cfeadfe817275033dfb4219bbb3e.7nabud6072oBBRBy6YFiYrI0MKsa22bQNOwVLL9XXCc%3D",
    );
  });

  it("falls back to the legacy misspelling when it is the only one present", () => {
    expect(challengeFromSetCookies([MEASURED_CHALLENGE_SET_COOKIES[1]])).toContain(
      "4844a007f6483068b220f009016b7197d044cfeadfe817275033dfb4219bbb3e.",
    );
  });

  it("carries the URL-encoded signature through untouched", () => {
    const value = challengeFromSetCookies(MEASURED_CHALLENGE_SET_COOKIES);
    expect(value).toContain("%3D");
    expect(value?.endsWith("=")).toBe(false);
  });

  it("answers null when the response carries no challenge at all", () => {
    expect(challengeFromSetCookies(["__Secure-neon-auth.session_token=abc; Path=/"])).toBeNull();
    expect(challengeFromSetCookies([])).toBeNull();
  });
});

describe("the flow cookie — our own carrier for the challenge", () => {
  const state = {
    challenge: "4844a007f6483068b220f009016b7197d044cfeadfe817275033dfb4219bbb3e.sig%3D",
    next: "/dashboard",
    iat: 1_700_000_000,
  };

  it("round-trips the challenge, the destination and the issued-at second", () => {
    expect(decodeFlowCookie(encodeFlowCookie(state))).toEqual(state);
  });

  it("reports the cookie's age as the seconds between the start and the callback", () => {
    expect(flowCookieAgeSeconds(1_700_000_000, 1_700_000_600)).toBe(600);
    // A clock ahead of the minting host cannot produce a negative age.
    expect(flowCookieAgeSeconds(1_700_000_600, 1_700_000_000)).toBe(0);
    // Whole seconds only — a fractional second is not a log line's business.
    expect(flowCookieAgeSeconds(1_700_000_000, 1_700_000_000)).toBe(0);
  });

  it("is a legal cookie value: no ; , or space", () => {
    const encoded = encodeFlowCookie(state);
    expect(encoded).not.toMatch(/[;, ]/);
  });

  it("refuses a destination that leaves the site", () => {
    for (const next of ["https://evil.example/x", "//evil.example/x", "javascript:alert(1)"]) {
      expect(decodeFlowCookie(encodeFlowCookie({ challenge: "c", next, iat: 0 }))).toBeNull();
    }
  });

  it("refuses anything that is not a flow this module wrote", () => {
    expect(decodeFlowCookie(undefined)).toBeNull();
    expect(decodeFlowCookie("")).toBeNull();
    expect(decodeFlowCookie("not-json")).toBeNull();
    expect(decodeFlowCookie(encodeURIComponent(JSON.stringify({ next: "/dashboard" })))).toBeNull();
    expect(
      decodeFlowCookie(encodeURIComponent(JSON.stringify({ challenge: "", next: "/x" }))),
    ).toBeNull();
    expect(
      decodeFlowCookie(encodeURIComponent(JSON.stringify({ challenge: "c", next: "" }))),
    ).toBeNull();
    // Without an issued-at second there is no age to report, so it is not a flow this build wrote.
    expect(
      decodeFlowCookie(encodeURIComponent(JSON.stringify({ challenge: "c", next: "/x" }))),
    ).toBeNull();
    expect(
      decodeFlowCookie(
        encodeURIComponent(JSON.stringify({ challenge: "c", next: "/x", iat: "soon" })),
      ),
    ).toBeNull();
  });

  it("sets the attributes the card claims, and Secure only where it can be stored", () => {
    const secure = flowCookieHeader(state, { secure: true });
    expect(secure).toContain(`${GOOGLE_FLOW_COOKIE}=`);
    expect(secure).toContain("Path=/");
    expect(secure).toContain(`Max-Age=${GOOGLE_FLOW_TTL_SECONDS}`);
    expect(secure).toContain("HttpOnly");
    expect(secure).toContain("SameSite=Lax");
    expect(secure).toContain("Secure");

    expect(flowCookieHeader(state, { secure: false })).not.toContain("Secure");
  });

  it("clears itself with Max-Age=0 rather than by dropping the header", () => {
    expect(clearFlowCookieHeader({ secure: true })).toContain(`${GOOGLE_FLOW_COOKIE}=;`);
    expect(clearFlowCookieHeader({ secure: true })).toContain("Max-Age=0");
  });
});

describe("relayedSessionCookie — Neon's value, our origin", () => {
  /** What `get-session` answers beside the session: a signed cookie with Neon's attributes. */
  const MEASURED_SESSION_SET_COOKIE =
    "__Secure-neon-auth.session_token=v1.signature%3D; Path=/; HttpOnly; Secure; SameSite=Lax";

  it("keeps the value byte-identical — a re-encoded token is an invalid signature", () => {
    const relayed = relayedSessionCookie(MEASURED_SESSION_SET_COOKIE, { secure: true });
    expect(relayed.split(";")[0]).toBe("__Secure-neon-auth.session_token=v1.signature%3D");
  });

  it("drops Domain, Partitioned and Neon's Path, and re-addresses Path=/ and SameSite", () => {
    const relayed = relayedSessionCookie(
      "__Secure-neon-auth.session_token=abc; Domain=.neon.tech; Path=/neondb/auth; Partitioned; SameSite=None",
      { secure: true },
    );
    const attributes = relayed
      .split(";")
      .slice(1)
      .map((attribute) => attribute.trim());
    expect(attributes).toContain("Path=/");
    expect(attributes).toContain("SameSite=Lax");
    expect(relayed).not.toContain("Domain");
    expect(relayed).not.toContain("Partitioned");
    expect(relayed).not.toContain("/neondb/auth");
    expect(attributes).not.toContain("SameSite=None");
  });

  it("keeps Secure always — a `__Secure-` cookie without it is discarded by the browser", () => {
    const attributesOf = (secure: boolean) =>
      relayedSessionCookie(MEASURED_SESSION_SET_COOKIE, { secure })
        .split(";")
        .slice(1)
        .map((attribute) => attribute.trim());
    expect(attributesOf(true)).toContain("Secure");
    // The name is `__Secure-neon-auth.session_token`, so the attribute is not optional even when
    // this request arrived over `http` — Chrome treats `http://localhost` as a secure context and
    // stores it, which is where the card's local proof runs.
    expect(attributesOf(false)).toContain("Secure");
  });

  it("keeps HttpOnly — the session cookie is not readable from the page", () => {
    expect(relayedSessionCookie(MEASURED_SESSION_SET_COOKIE, { secure: true })).toContain(
      "HttpOnly",
    );
  });

  it("relays only cookies of ours to relay", () => {
    expect(isRelayableSessionCookie(MEASURED_SESSION_SET_COOKIE)).toBe(true);
    expect(isRelayableSessionCookie("__Secure-neon-auth.local.session_data=jwt; Path=/")).toBe(
      true,
    );
    // The challenge pair was consumed by the exchange and belongs to Neon's origin.
    for (const challenge of MEASURED_CHALLENGE_SET_COOKIES) {
      expect(isRelayableSessionCookie(challenge)).toBe(false);
    }
    expect(isRelayableSessionCookie("better-auth.state=abc; Path=/")).toBe(false);
    expect(isRelayableSessionCookie("no-pair-here")).toBe(false);
  });

  it("puts the challenge back under the name Neon reads, not ours", () => {
    expect(challengeCookieHeader("abc.sig%3D")).toBe(`${NEON_CHALLENGE_COOKIE}=abc.sig%3D`);
  });
});

describe("appOriginOf — the origin both halves of the flow agree on", () => {
  it("prefers the forwarded pair a deployment sets", () => {
    const headers = new Headers({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "alignsynch.com",
      host: "internal:3000",
    });
    expect(appOriginOf(headers)).toEqual({ origin: "https://alignsynch.com", secure: true });
  });

  it("falls back to Host for a direct connection, and http is not secure", () => {
    expect(appOriginOf(new Headers({ host: "localhost:3000" }))).toEqual({
      origin: "http://localhost:3000",
      secure: false,
    });
  });

  it("takes the first value of a chain", () => {
    const headers = new Headers({
      "x-forwarded-proto": "https,http",
      "x-forwarded-host": "alignsynch.com,internal",
    });
    expect(appOriginOf(headers)?.origin).toBe("https://alignsynch.com");
  });

  it("answers null rather than building an origin out of nothing", () => {
    expect(appOriginOf(new Headers())).toBeNull();
  });
});

describe("the callback URL Neon is given", () => {
  it("is our finish route on this origin, with no query for Neon to nest inside", () => {
    const callback = new URL(absoluteUrlFor("https://alignsynch.com", GOOGLE_FINISH_PATH));
    expect(callback.pathname).toBe("/api/auth/google/finish");
    expect(callback.search).toBe("");
    expect(callback.origin).toBe("https://alignsynch.com");
  });

  it("keeps the verifier Neon appends in the query, never the path", () => {
    const callback = new URL(absoluteUrlFor("https://alignsynch.com", GOOGLE_FINISH_PATH));
    callback.searchParams.set(VERIFIER_PARAM, "G830bdeHEtpF7v5r");
    expect(callback.pathname).toBe("/api/auth/google/finish");
    expect(callback.searchParams.get(VERIFIER_PARAM)).toBe("G830bdeHEtpF7v5r");
  });
});

/* ------------------------------------------------------------------ *
 * The two calls, against a stubbed fetch
 * ------------------------------------------------------------------ */

describe("startGoogleHandshake", () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.NEON_AUTH_BASE_URL;

  beforeEach(() => {
    process.env.NEON_AUTH_BASE_URL = "https://auth.example.test/neondb/auth";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.NEON_AUTH_BASE_URL = originalBaseUrl;
    vi.restoreAllMocks();
  });

  /** A response double: whatever status and `Set-Cookie` list the case needs. */
  function respond(status: number, body: unknown, setCookies: readonly string[] = []): Response {
    const headers = new Headers({ "content-type": "application/json" });
    for (const setCookie of setCookies) headers.append("set-cookie", setCookie);
    return new Response(JSON.stringify(body), { status, headers });
  }

  it("answers with Neon's init page and the challenge it minted", async () => {
    const init = "https://auth.example.test/neondb/auth/sign-in/social/init?token=abc";
    globalThis.fetch = vi.fn(async () =>
      respond(200, { url: init, redirect: false }, MEASURED_CHALLENGE_SET_COOKIES),
    ) as unknown as typeof fetch;

    const started = await startGoogleHandshake({
      origin: "https://alignsynch.com",
      callbackUrl: "https://alignsynch.com/api/auth/google/finish",
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.url).toBe(init);
    expect(started.challenge).toBe(challengeFromSetCookies(MEASURED_CHALLENGE_SET_COOKIES));
  });

  it("sends the origin, the callback and disableRedirect — the three things the call needs", async () => {
    const spy = vi.fn(async (_url: unknown, _init?: RequestInit) =>
      respond(200, { url: "https://auth.example.test/init" }, MEASURED_CHALLENGE_SET_COOKIES),
    );
    globalThis.fetch = spy as unknown as typeof fetch;

    await startGoogleHandshake({
      origin: "https://alignsynch.com",
      callbackUrl: "https://alignsynch.com/api/auth/google/finish",
    });

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://auth.example.test/neondb/auth/sign-in/social");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).origin).toBe("https://alignsynch.com");
    expect(JSON.parse(String(init.body))).toEqual({
      provider: "google",
      callbackURL: "https://alignsynch.com/api/auth/google/finish",
      disableRedirect: true,
    });
  });

  it("refuses a 200 that carries no challenge — the exchange could never succeed", async () => {
    globalThis.fetch = vi.fn(async () =>
      respond(200, { url: "https://auth.example.test/init" }),
    ) as unknown as typeof fetch;

    const started = await startGoogleHandshake({
      origin: "https://alignsynch.com",
      callbackUrl: "https://alignsynch.com/api/auth/google/finish",
    });
    expect(started).toEqual({ ok: false, failure: "unknown" });
  });

  it("classifies an untrusted callbackURL as the address policy, not a transport fault", async () => {
    globalThis.fetch = vi.fn(async () =>
      respond(403, { error: "Invalid callbackURL", code: "INVALID_CALLBACKURL" }),
    ) as unknown as typeof fetch;

    const started = await startGoogleHandshake({
      origin: "https://evil.example",
      callbackUrl: "https://evil.example/api/auth/google/finish",
    });
    expect(started).toEqual({ ok: false, failure: "origin" });
  });

  it("classifies a call that never arrived as network", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const started = await startGoogleHandshake({
      origin: "https://alignsynch.com",
      callbackUrl: "https://alignsynch.com/api/auth/google/finish",
    });
    expect(started).toEqual({ ok: false, failure: "network" });
  });

  it("refuses to start when this deployment has no auth URL", async () => {
    delete process.env.NEON_AUTH_BASE_URL;
    const started = await startGoogleHandshake({
      origin: "https://alignsynch.com",
      callbackUrl: "https://alignsynch.com/api/auth/google/finish",
    });
    expect(started).toEqual({ ok: false, failure: "unknown" });
  });
});

describe("exchangeVerifier", () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.NEON_AUTH_BASE_URL;

  beforeEach(() => {
    process.env.NEON_AUTH_BASE_URL = "https://auth.example.test/neondb/auth";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.NEON_AUTH_BASE_URL = originalBaseUrl;
    vi.restoreAllMocks();
  });

  function respond(status: number, body: unknown, setCookies: readonly string[] = []): Response {
    const headers = new Headers({ "content-type": "application/json" });
    for (const setCookie of setCookies) headers.append("set-cookie", setCookie);
    return new Response(JSON.stringify(body), { status, headers });
  }

  it("spends the verifier with the challenge under Neon's own cookie name", async () => {
    const spy = vi.fn(async (_url: unknown, _init?: RequestInit) =>
      respond(200, { session: { token: "t" }, user: { id: "u" } }, [
        "__Secure-neon-auth.session_token=v1.sig; Path=/; HttpOnly; Secure; SameSite=Lax",
        ...MEASURED_CHALLENGE_SET_COOKIES,
      ]),
    );
    globalThis.fetch = spy as unknown as typeof fetch;

    const exchanged = await exchangeVerifier({
      origin: "https://alignsynch.com",
      challenge: "challenge.value%3D",
      verifier: "G830bdeHEtpF7v5r",
    });

    const [url, init] = spy.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe(
      "https://auth.example.test/neondb/auth/get-session?neon_auth_session_verifier=G830bdeHEtpF7v5r",
    );
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).cookie).toBe(
      `${NEON_CHALLENGE_COOKIE}=challenge.value%3D`,
    );

    expect(exchanged.ok).toBe(true);
    if (!exchanged.ok) return;
    // The session, and not the challenge pair the exchange consumed.
    expect(exchanged.setCookies).toEqual([
      "__Secure-neon-auth.session_token=v1.sig; Path=/; HttpOnly; Secure; SameSite=Lax",
    ]);
  });

  it("refuses when Neon answers SESSION_CHALLENGE_COOKIE_NOT_FOUND", async () => {
    globalThis.fetch = vi.fn(async () =>
      respond(400, {
        error: "Session challenge cookie not found",
        code: "SESSION_CHALLENGE_COOKIE_NOT_FOUND",
      }),
    ) as unknown as typeof fetch;

    const exchanged = await exchangeVerifier({
      origin: "https://alignsynch.com",
      challenge: "c",
      verifier: "v",
    });
    expect(exchanged).toMatchObject({
      ok: false,
      status: 400,
      code: "SESSION_CHALLENGE_COOKIE_NOT_FOUND",
    });
  });

  it("refuses when the verifier does not match the challenge", async () => {
    globalThis.fetch = vi.fn(async () =>
      respond(400, { error: "Verification not found", code: "VERIFICATION_NOT_FOUND" }),
    ) as unknown as typeof fetch;

    const exchanged = await exchangeVerifier({
      origin: "https://alignsynch.com",
      challenge: "c",
      verifier: "bogus",
    });
    expect(exchanged).toMatchObject({ ok: false, status: 400 });
  });

  it("refuses a 200 that sets no session cookie — that is a sign-in that lands signed out", async () => {
    globalThis.fetch = vi.fn(async () =>
      respond(200, { session: null, user: null }, MEASURED_CHALLENGE_SET_COOKIES),
    ) as unknown as typeof fetch;

    const exchanged = await exchangeVerifier({
      origin: "https://alignsynch.com",
      challenge: "c",
      verifier: "v",
    });
    expect(exchanged).toMatchObject({ ok: false });
  });

  it("classifies a dropped connection as network", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const exchanged = await exchangeVerifier({
      origin: "https://alignsynch.com",
      challenge: "c",
      verifier: "v",
    });
    expect(exchanged).toEqual({ ok: false, failure: "network" });
  });
});
