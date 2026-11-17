/**
 * The Counterparty's two answers that are not "yes": the fields they type (step 2's carrier) and the
 * decline they may send instead (step 1's quiet control) — #1125.
 *
 * Four claims, each one a test:
 *
 *   1. **The carrier is a cookie, keyed by the token's hash, and it trusts nothing.** The name and the
 *      address typed on step 2 have to survive one navigation to step 3 without a query string
 *      (which would put an email address in the URL bar, the history and the `Referer`). So this
 *      module round-trips them, refuses anything that is not that exact shape, and names its cookie
 *      after `hashToken(token)` rather than the token.
 *   2. **A decline is a revocation with an actor.** `declineInvite()` writes `revoked_at` and
 *      `revoked_by = 'counterparty'` in one statement, and `inviteStateOf()` reads the actor back out,
 *      so the Initiator's screen can say "declined" rather than "withdrawn". No `declined_at` column
 *      exists and none is added: a second way to say "dead" is a second read path.
 *   3. **The decline writes nothing else.** No party, no session, no trial, no seat: the store region
 *      is pinned by source, the way `tests/claim-two-fields.test.ts` pins the claim's.
 *   4. **Both routes are POSTs.** A GET that declined would let any mail scanner, link preview or
 *      prefetch end somebody's invitation before they read it — the same reason the claim is a POST.
 *
 * What this file does **not** do is drive `declineInvite()` against Postgres: there is no database in
 * the gate. Claim 2's behaviour-only half (`inviteStateOf`) is a pure function and is driven directly;
 * the SQL half is pinned by source and by the constraint `invite_revoked_by_comes_with_instant`,
 * which refuses a marker without an instant.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeJoinDetails,
  encodeJoinDetails,
  JOIN_DETAILS_COOKIE_MAX_AGE,
  JOIN_DETAILS_COOKIE_PREFIX,
  JOIN_DETAIL_PROBLEMS,
  joinDetailProblem,
  joinDetailProblemOf,
  joinDetailsCookieName,
} from "@/lib/flow/join-details";
import { COUNTERPARTY_DECLINED_BY, inviteStateOf } from "@/lib/flow/invite-state";

const REPO = join(import.meta.dirname, "..");

function source(relative: string): string {
  return readFileSync(join(REPO, relative), "utf8");
}

/** A file's code without its comments, so a docstring cannot read as an implementation. */
function code(relative: string): string {
  return source(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("the step-2 carrier", () => {
  it("round-trips the two fields, trimmed and lower-cased", () => {
    const encoded = encodeJoinDetails({ name: "  Rowan ", email: " Rowan@Example.Test " });
    expect(decodeJoinDetails(encoded)).toEqual({ name: "Rowan", email: "rowan@example.test" });
  });

  it("is a base64url value, so it is legal in a cookie header and in a URL", () => {
    const encoded = encodeJoinDetails({ name: "Rowan", email: "rowan@example.test" });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns null for anything that is not its own shape", () => {
    // An absent cookie, an empty one, a hand-edited one, a value from a previous version, and the
    // two shapes a hostile edit would try: extra keys, and a missing one.
    expect(decodeJoinDetails(undefined)).toBeNull();
    expect(decodeJoinDetails("")).toBeNull();
    expect(decodeJoinDetails("not-json")).toBeNull();
    expect(decodeJoinDetails(Buffer.from("{}").toString("base64url"))).toBeNull();
    expect(
      decodeJoinDetails(Buffer.from(JSON.stringify({ name: "R", email: "a@b.c", plan: "x" })).toString("base64url")),
    ).toBeNull();
    expect(decodeJoinDetails(Buffer.from(JSON.stringify({ name: "  ", email: "a@b.c" })).toString("base64url"))).toBeNull();
  });

  it("names its cookie after the token's hash, never after the token", () => {
    const hash = "b3f1".repeat(11);
    const name = joinDetailsCookieName(hash);
    expect(name.startsWith(JOIN_DETAILS_COOKIE_PREFIX)).toBe(true);
    expect(name).toContain(hash);
    // The page calls it with `hashToken(token)`, which is a hex digest and not a token.
    expect(code("app/(mainlayout)/invite/[token]/page.tsx")).toContain(
      "joinDetailsCookieName(hashToken(token))",
    );
    expect(code("app/(mainlayout)/invite/[token]/join/route.ts")).toContain(
      "joinDetailsCookieName(hashToken(token))",
    );
  });

  it("lives for half an hour — one sitting, not a day", () => {
    expect(JOIN_DETAILS_COOKIE_MAX_AGE).toBe(1800);
    expect(JOIN_DETAILS_COOKIE_MAX_AGE).toBeLessThan(24 * 60 * 60);
  });

  it("names two problems, because they are two sentences", () => {
    expect(JOIN_DETAIL_PROBLEMS).toEqual(["incomplete", "email"]);
    expect(joinDetailProblem("", "rowan@example.test")).toBe("incomplete");
    expect(joinDetailProblem("Rowan", "")).toBe("incomplete");
    expect(joinDetailProblem(undefined, undefined)).toBe("incomplete");
    expect(joinDetailProblem("Rowan", "rowan@example")).toBe("email");
    expect(joinDetailProblem("Rowan", "rowan@example.test")).toBeNull();
    // A `?join=` value that is not one of the two is ignored, not rendered.
    expect(joinDetailProblemOf("email")).toBe("email");
    expect(joinDetailProblemOf("nonsense")).toBeUndefined();
    expect(joinDetailProblemOf(undefined)).toBeUndefined();
  });
});

describe("a decline is a withdrawal with an actor", () => {
  const EXPIRES_AT = new Date("2026-12-01T00:00:00.000Z");
  const NOW = new Date("2026-11-16T00:00:00.000Z");

  it("reads back as `declined`, not `revoked`, when the Counterparty acted", () => {
    expect(inviteStateOf({ claimed: false, expiresAt: EXPIRES_AT, declined: true }, NOW)).toBe(
      "declined",
    );
    // The same row without the marker is an operator's withdrawal.
    expect(inviteStateOf({ claimed: false, expiresAt: EXPIRES_AT }, NOW)).toBe("unclaimed");
  });

  it("sits behind `claimed`: a seat that exists cannot be declined away", () => {
    expect(
      inviteStateOf({ claimed: true, expiresAt: EXPIRES_AT, declined: true }, NOW),
    ).toBe("claimed");
  });

  it("outranks `expired`: the person's answer is the fact worth naming", () => {
    // A decline in the last second of the window, read a week later.
    expect(
      inviteStateOf(
        { claimed: false, expiresAt: EXPIRES_AT, declined: true },
        new Date("2026-12-08T00:00:00.000Z"),
      ),
    ).toBe("declined");
  });

  it("writes the instant and the marker together, and nothing else", () => {
    const store = source("lib/flow/store.ts");
    const start = store.indexOf("export async function declineInvite(");
    const end = store.indexOf("* End a session", start) === -1 ? store.indexOf("\n}\n", start) : start;
    const region = store.slice(start, end === -1 ? undefined : end + 3);

    // One write, both columns: the instant makes the link dead, the marker makes the reason readable.
    expect(region).toMatch(/UPDATE session_invite SET revoked_at = \$2, revoked_by = \$3/);
    expect(region).toContain("COUNTERPARTY_DECLINED_BY");
    // The transaction takes the claim's own lock, so a decline and a claim cannot both win.
    expect(region).toContain("FOR UPDATE");
    // And it never creates what it declines: no party, no session, no invitation row, no trial.
    expect(region).not.toMatch(/INSERT INTO (party|assessment_instance|session_record|subscription)/);
    expect(region).not.toMatch(/grantAcceptanceTrial|trial_ends_at/i);
    // Every refusal rolls back rather than leaving a half-written row.
    expect(region.match(/ROLLBACK/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("marks the actor with a word, so an operator's account id cannot be mistaken for it", () => {
    expect(COUNTERPARTY_DECLINED_BY).toBe("counterparty");
    // The read path compares the column to that constant and nothing else.
    expect(source("lib/flow/store.ts")).toContain(
      "declined: invite.revoked_by === COUNTERPARTY_DECLINED_BY",
    );
  });
});

describe("the join's two write routes are POSTs", () => {
  for (const route of [
    "app/(mainlayout)/invite/[token]/join/route.ts",
    "app/(mainlayout)/invite/[token]/decline/route.ts",
  ]) {
    it(`${route.split("/").slice(-2, -1)[0]} exports POST and no GET`, () => {
      const text = code(route);
      expect(text).toMatch(/export async function POST\(/);
      // A GET here would let a mail scanner, a link preview or a prefetch end or advance somebody's
      // invitation before they had read it.
      expect(text).not.toMatch(/export (async )?function GET\b/);
      expect(text).not.toMatch(/export const (revalidate|dynamic)\b.*GET/);
    });
  }

  it("step 2's carrier writes nothing durable and never claims", () => {
    const join = code("app/(mainlayout)/invite/[token]/join/route.ts");
    expect(join).toContain("joinDetailProblem(");
    expect(join).toContain("cookies()");
    expect(join).toContain("jar.set(");
    expect(join).not.toContain("claimInvite(");
    expect(join).not.toContain("declineInvite(");
    // No database import at all: this route parks two strings in a cookie.
    expect(join).not.toContain("@/lib/flow/store");
  });

  it("the decline route declines, then sends the reader to the invitation's own screen", () => {
    const decline = code("app/(mainlayout)/invite/[token]/decline/route.ts");
    expect(decline).toContain("declineInvite(");
    // A refusal names its code; a success carries no flag, because the band reads the row.
    expect(decline).toContain('back.searchParams.set("claim", result.code)');
    expect(decline).not.toContain("declined=1");
    expect(decline).not.toContain("?declined");
  });
});
