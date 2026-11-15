/**
 * The demo's trusted origins, proved without a Neon key, a network call or a reset (#1086).
 *
 * The defect this file exists for was measured on 2026-11-15 against the live project: the demo
 * branch's trusted-domain list read `[{"domain":"https://demo.alignsynch.com"}]` at 09:41Z, a
 * `demo:reset` ran, and at 09:47Z the same `GET` answered `{"domains":[]}`. Nothing else about the
 * branch moved — the Managed Auth integration still answered `200` with its `created_at` from
 * 2026-10-30 — so the reset hands back a branch whose auth server trusts no site. Every sign-in
 * from the demo URL then answered `403 INVALID_ORIGIN` (`401 INVALID_EMAIL_OR_PASSWORD` before the
 * reset, for the same deliberately-wrong credential), which means no identity — admin seats
 * included — could enter the demo while `/api/version` read `200` and every gate stayed green.
 *
 * So the reset has two jobs beyond resetting, and both are decisions rather than plumbing:
 * re-apply the origin (one `POST`, only when the list does not carry it) and prove that sign-in
 * works (one probe, `401` or the run fails). The rules that have to hold are here:
 *
 *   - **a wildcard or a path can never become a trusted domain**, because the list is a phishing
 *     surface the moment it is wider than one exact origin;
 *   - **the re-apply never removes or rewrites**, so it cannot delete what somebody added;
 *   - **only `401` is a pass**, so a rate-limited probe cannot be reported as a proved origin;
 *   - **`403` fails the run with a sentence that says what to do**, because "the branch came back"
 *     was the check that let this ship.
 *
 * The loopback case is the one that reads like an exception and is really the sharpest: Neon Auth
 * trusts `http://localhost:*` on a branch whose list is empty — measured, it answered `401` for
 * `Origin: http://localhost:3000` and `403` for `https://demo.alignsynch.com` in the same window —
 * so a probe posted from loopback proves nothing about the demo origin, and a nightly job that
 * settled into one would be green forever and enterable never.
 */
import { describe, expect, it } from "vitest";

import {
  AUTH_PROVIDER,
  authDomainsPath,
  DEFAULT_DEMO_ORIGIN,
  domainPlan,
  isLoopbackOrigin,
  ORIGIN_ACCEPTED,
  ORIGIN_REFUSED,
  originRefusal,
  probeFailure,
  probeLine,
  probeOutcome,
  trustedOrigins,
} from "../scripts/demo-auth-domains.mjs";

const demo = DEFAULT_DEMO_ORIGIN;

describe("the origin the reset trusts", () => {
  it("accepts the demo origin", () => {
    expect(originRefusal(demo)).toBeNull();
  });

  it("refuses a wildcard in any position", () => {
    // `https://*.alignsynch.com` parses happily, so the rule cannot be a host comparison.
    for (const candidate of ["*", "https://*", "https://*.alignsynch.com", "https://demo.*"]) {
      const refusal = originRefusal(candidate);
      expect(refusal, candidate).not.toBeNull();
      expect(refusal).toContain("wildcard");
      // And it says why, so nobody "fixes" it by adding an allowlist entry.
      expect(refusal).toContain("phishing");
    }
  });

  it("refuses a path, a query or a fragment — the list holds origins", () => {
    for (const candidate of [
      "https://demo.alignsynch.com/login",
      "https://demo.alignsynch.com/?a=1",
      "https://demo.alignsynch.com/#x",
    ]) {
      expect(originRefusal(candidate), candidate).not.toBeNull();
    }
  });

  it("refuses plain http on a public host, and accepts it on loopback", () => {
    expect(originRefusal("http://demo.alignsynch.com")).toContain("https");
    expect(originRefusal("http://localhost:3000")).toBeNull();
    expect(originRefusal("http://127.0.0.1:3000")).toBeNull();
  });

  it("refuses a form the API would store as something the browser never sends", () => {
    // A trailing slash is the trap: the API stores what it is given, and
    // `Origin: https://demo.alignsynch.com` would then not match the stored `…/`.
    expect(originRefusal("https://demo.alignsynch.com/")).toContain("canonical form");
    expect(originRefusal("HTTPS://demo.alignsynch.com")).toContain("canonical form");
  });

  it("refuses nothing configured, and refuses credentials in the URL", () => {
    expect(originRefusal(undefined)).not.toBeNull();
    expect(originRefusal("   ")).not.toBeNull();
    expect(originRefusal("https://user:pass@demo.alignsynch.com")).not.toBeNull();
    expect(originRefusal("demo.alignsynch.com")).toContain("absolute http(s) origin");
  });

  it("tells loopback apart from the demo origin", () => {
    expect(isLoopbackOrigin("http://localhost:3000")).toBe(true);
    expect(isLoopbackOrigin("http://127.0.0.1:3000")).toBe(true);
    expect(isLoopbackOrigin(demo)).toBe(false);
    expect(isLoopbackOrigin("not a url")).toBe(false);
  });
});

describe("reading the branch's trusted-domain list", () => {
  it("reads the shape the API answers with", () => {
    expect(trustedOrigins({ domains: [{ domain: demo, auth_provider: "better_auth" }] })).toEqual([
      demo,
    ]);
  });

  it("reads nothing out of the empty list — the state a restore leaves", () => {
    // This is the exact body measured after the reset that broke the demo.
    expect(trustedOrigins({ domains: [] })).toEqual([]);
  });

  it("survives a missing or malformed payload without inventing an entry", () => {
    for (const payload of [null, {}, { domains: null }, { domains: "x" }]) {
      expect(trustedOrigins(payload)).toEqual([]);
    }
  });

  it("normalises a stored trailing slash to what a browser sends", () => {
    expect(trustedOrigins({ domains: [{ domain: `${demo}/` }] })).toEqual([demo]);
  });
});

describe("what the reset does about the origin", () => {
  it("adds it when the list is empty", () => {
    const plan = domainPlan({ trusted: [], origin: demo });
    expect(plan.action).toBe("add");
    expect(plan.reason).toContain("the list is empty");
  });

  it("adds it when the list holds some other origin", () => {
    const plan = domainPlan({ trusted: ["https://alignsynch.com"], origin: demo });
    expect(plan.action).toBe("add");
    expect(plan.reason).toContain("https://alignsynch.com");
  });

  it("writes nothing when it is already trusted, however it was stored", () => {
    expect(domainPlan({ trusted: [demo], origin: demo }).action).toBe("present");
    // `trustedOrigins()` normalises a stored trailing slash, so this is the normalised shape a
    // case-different entry arrives in — and a case-different host is the same site.
    expect(domainPlan({ trusted: [demo.toUpperCase()], origin: demo }).action).toBe("present");
    expect(domainPlan({ trusted: [demo], origin: `${demo}/`.slice(0, -1) }).action).toBe("present");
  });

  it("only ever says add or present — never remove, replace or sync", () => {
    const actions = new Set(
      [
        domainPlan({ trusted: [], origin: demo }),
        domainPlan({ trusted: [demo], origin: demo }),
        domainPlan({ trusted: ["https://other.example.com"], origin: demo }),
      ].map((plan) => plan.action),
    );
    // The re-apply cannot delete somebody else's entry or rewrite the list wholesale; anything
    // wider than "add the one origin" is how a repair becomes a widening.
    expect([...actions].sort()).toEqual(["add", "present"]);
  });
});

describe("the sign-in probe", () => {
  const reply = (status: number) => ({ status, origin: demo });

  it("passes only on 401, which is the origin being accepted", () => {
    expect(probeOutcome(reply(ORIGIN_ACCEPTED))).toBe("accepted");
    expect(probeFailure(reply(ORIGIN_ACCEPTED))).toBeNull();
  });

  it("fails on 403 with a named error that says what to do", () => {
    const failure = probeFailure(reply(ORIGIN_REFUSED));
    expect(failure).not.toBeNull();
    expect(failure).toContain("403 INVALID_ORIGIN");
    expect(failure).toContain("does not trust that origin");
    // The reader's next move has to be in the message, and it must not be "retry" or "widen".
    expect(failure).toContain("POST …/branches/<id>/auth/domains");
    expect(failure).toContain(demo);
    expect(failure).toContain("never widen");
  });

  it("does not read a rate-limited or unwell answer as a pass", () => {
    for (const status of [0, 200, 429, 500, 503]) {
      expect(probeOutcome(reply(status)), String(status)).toBe("inconclusive");
      const failure = probeFailure(reply(status));
      expect(failure, String(status)).not.toBeNull();
      expect(failure).toContain("cannot claim");
    }
    // A 429 gets its own remedy, because it is the one that recurs on a run creating accounts.
    expect(probeFailure(reply(429))).toContain("rate-limiting");
  });

  it("names the auth service having no config behind its integration", () => {
    // The second mode this branch has actually been in (#214's closing comment): `GET …/auth`
    // reports the integration while every auth endpoint answers "Project config not found".
    const failure = probeFailure(reply(404));
    expect(failure).toContain("no configuration behind its integration");
    expect(failure).toContain("project_config");
    expect(failure).toContain("jwks");
  });

  it("prints the status and the origin, and never a credential", () => {
    const lines = [probeLine(reply(401)), probeLine(reply(403)), probeLine(reply(429))];
    expect(lines[0]).toContain("401");
    expect(lines[0]).toContain("the origin is trusted");
    expect(lines[1]).toContain("403");
    expect(lines[1]).toContain("trusts no such site");
    expect(lines[2]).toContain("429");
    expect(lines[2]).toContain("cannot prove");
    for (const line of lines) {
      // No function here accepts a password, so the guarantee is structural; this is the belt.
      expect(line).not.toMatch(/password\s*[:=]/i);
      expect(line).not.toContain("not-a-credential");
    }
  });
});

describe("the API route", () => {
  it("addresses this branch's own domain list", () => {
    expect(authDomainsPath("fragrant-glade-99460966", "br-wispy-frog-b43188n8")).toBe(
      "/projects/fragrant-glade-99460966/branches/br-wispy-frog-b43188n8/auth/domains",
    );
  });

  it("names the provider the demo branch runs", () => {
    expect(AUTH_PROVIDER).toBe("better_auth");
  });
});
