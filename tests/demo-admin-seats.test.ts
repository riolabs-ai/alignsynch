/**
 * The platform-admin seat proof — the rule, the verdict and the wording, with no database, no HTTP
 * and no environment.
 *
 * The pass this pins is the one that was missing: the seed converged `ADMIN_01`/`ADMIN_02` on the
 * demo branch, wrote `user_profile.role = 'admin'` for both, printed `reconciled` — and every
 * sign-in answered `401 INVALID_EMAIL_OR_PASSWORD`, because a row is a grant and not an account.
 * So the seed now signs each seat in and `scripts/db-seed-admin-proof.mjs` decides what the answer
 * means. Three things are worth a case each:
 *
 *   - **Only `200` is proof.** A refusal (`401`, `403`) fails the run; anything else — a `429` from
 *     the auth service rate-limiting the seed's own traffic, a `5xx` — is inconclusive and must
 *     not make a content seed flaky over a fact it could not establish.
 *   - **A line carries an address and a status, nothing else.** The password never reaches these
 *     functions, so the case hands one in as an extra field and asserts it does not surface.
 *   - **A rotation says what it cost.** The seat answers to this run's credential only from that
 *     moment, and every other copy — the demo branch's Preview scope included — is stale. That
 *     sentence is the whole point of the notice, so it is asserted by its own words.
 */
import { describe, expect, it } from "vitest";

import {
  SEAT_SIGN_IN_PROVED,
  SEAT_SIGN_IN_REFUSED,
  rotationNotice,
  seatProofFailure,
  seatProofLine,
  seatProofOutcome,
  seatProofSummary,
  seatProofVerdict,
} from "../scripts/db-seed-admin-proof.mjs";

const SEAT_ONE = "walt1@alignsynch.com";
const SEAT_TWO = "alignsynch@riolabs.ai";
const SEATS = [SEAT_ONE, SEAT_TWO];

/** The sentinel a caller must never be able to print: not a real password, and obviously not one. */
const SENTINEL = "pw-sentinel-never-printed";

describe("seatProofOutcome", () => {
  it("reads 200 as proof and nothing else as proof", () => {
    expect(SEAT_SIGN_IN_PROVED).toBe(200);
    expect(seatProofOutcome({ email: SEAT_ONE, status: 200 })).toBe("proved");
  });

  it("reads the two refusal statuses — 401 and 403 — as refused", () => {
    expect([...SEAT_SIGN_IN_REFUSED].sort((a, b) => a - b)).toEqual([401, 403]);
    for (const status of [401, 403]) {
      expect(seatProofOutcome({ email: SEAT_ONE, status })).toBe("refused");
    }
  });

  it("treats everything else as inconclusive rather than as a failure", () => {
    // 429 is the measured one: the seed signs five accounts up before it proves a seat, and the
    // auth service starts rate-limiting. That is not evidence about a credential.
    for (const status of [204, 400, 422, 429, 500, 502, 503, 0]) {
      expect(seatProofOutcome({ email: SEAT_ONE, status })).toBe("unknown");
    }
  });
});

describe("seatProofLine", () => {
  it("marks a proved seat with its address and status on one line", () => {
    const line = seatProofLine({ email: SEAT_ONE, status: 200 });
    expect(line).toContain(SEAT_ONE);
    expect(line).toContain("sign-in 200");
    expect(line.trimStart().startsWith("○")).toBe(true);
    expect(line).not.toContain("\n");
  });

  it("says a refused seat does not accept the credential, not that it 'failed'", () => {
    const line = seatProofLine({ email: SEAT_TWO, status: 401 });
    expect(line).toContain(SEAT_TWO);
    expect(line).toContain("401");
    expect(line).toContain("does not accept the credential this seed converged it on");
    expect(line.trimStart().startsWith("!")).toBe(true);
    expect(line).not.toContain("\n");
  });

  it("marks an inconclusive answer as unproven, so a green run cannot borrow it", () => {
    const line = seatProofLine({ email: SEAT_ONE, status: 429 });
    expect(line).toContain("429");
    expect(line).toContain("inconclusive");
    expect(line).toContain("cannot prove the seat");
    expect(line.trimStart().startsWith("?")).toBe(true);
  });
});

describe("seatProofVerdict", () => {
  it("passes when every configured seat signed in", () => {
    const verdict = seatProofVerdict(SEATS.map((email) => ({ email, status: 200 })));
    expect(verdict.ok).toBe(true);
    expect(verdict.refused).toEqual([]);
    expect(verdict.unknown).toEqual([]);
  });

  it("fails on one refusal and names only the seat that was refused", () => {
    const verdict = seatProofVerdict([
      { email: SEAT_ONE, status: 200 },
      { email: SEAT_TWO, status: 401 },
    ]);
    expect(verdict.ok).toBe(false);
    expect(verdict.refused).toHaveLength(1);
    expect(verdict.refused[0].email).toBe(SEAT_TWO);
  });

  it("does not fail on an inconclusive status, and still reports it", () => {
    const verdict = seatProofVerdict([
      { email: SEAT_ONE, status: 200 },
      { email: SEAT_TWO, status: 429 },
    ]);
    expect(verdict.ok).toBe(true);
    expect(verdict.unknown).toHaveLength(1);
    expect(verdict.unknown[0].email).toBe(SEAT_TWO);
  });

  it("is ok with no seats configured — the gate's and CI's state", () => {
    expect(seatProofVerdict([]).ok).toBe(true);
  });
});

describe("seatProofSummary", () => {
  it("prints the count the acceptance asks for", () => {
    const summary = seatProofSummary(SEATS.map((email) => ({ email, status: 200 })));
    expect(summary).toContain("2 of 2 seat(s) sign in");
    expect(summary).not.toContain("\n");
  });

  it("names the refused seat and its status beside the count", () => {
    const summary = seatProofSummary([
      { email: SEAT_ONE, status: 200 },
      { email: SEAT_TWO, status: 401 },
    ]);
    expect(summary).toContain("1 of 2 seat(s) sign in");
    expect(summary).toContain(`${SEAT_TWO} refused (401)`);
    expect(summary).not.toContain(SEAT_ONE);
  });

  it("says a rate-limited seat is unproven, not refused", () => {
    const summary = seatProofSummary([
      { email: SEAT_ONE, status: 200 },
      { email: SEAT_TWO, status: 429 },
    ]);
    // Only a 200 counts as signed in, so an inconclusive seat lowers the count as well as naming itself.
    expect(summary).toContain("1 of 2 seat(s) sign in");
    expect(summary).toContain(`${SEAT_TWO} unproven (429)`);
  });
});

describe("rotationNotice", () => {
  it("says the run's credential is now the only one that answers, and names the other homes", () => {
    const notice = rotationNotice([SEAT_ONE, SEAT_TWO]);
    expect(notice).toContain("2 passwords rotated");
    expect(notice).toContain(SEAT_ONE);
    expect(notice).toContain(SEAT_TWO);
    expect(notice).toContain("401 INVALID_EMAIL_OR_PASSWORD");
    // The two copies that actually went stale on the demo, named so the operator knows where to look.
    expect(notice).toContain("Preview scope");
    expect(notice).toContain(".env.local");
    // The seat is not broken; the copies are out of date. A reader must not go hunting for a bug.
    expect(notice).toContain("the seats themselves are fine");
  });

  it("counts one rotated seat in the singular", () => {
    expect(rotationNotice([SEAT_ONE])).toContain("1 password rotated");
  });
});

describe("seatProofFailure", () => {
  it("names the seat, the status and the two URLs a 401 is about", () => {
    const message = seatProofFailure([
      { email: SEAT_ONE, status: 200 },
      { email: SEAT_TWO, status: 401 },
    ]);
    expect(message).toContain("1 of 2 seat(s) refused");
    expect(message).toContain(`${SEAT_TWO} (401)`);
    expect(message).toContain("NEON_AUTH_BASE_URL");
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("not the same Neon branch");
    expect(message).toContain("Nothing was committed");
  });

  it("explains a 403 as the origin gate rather than as a wrong password", () => {
    const message = seatProofFailure([{ email: SEAT_ONE, status: 403 }]);
    expect(message).toContain("403 INVALID_ORIGIN");
    expect(message).toContain("DEMO_ORIGIN");
  });
});

describe("nothing a proof function prints can be a password", () => {
  it.each([
    ["line", (proof: Record<string, unknown>) => seatProofLine(proof as never)],
    ["summary", (proof: Record<string, unknown>) => seatProofSummary([proof] as never)],
    [
      "verdict",
      (proof: Record<string, unknown>) => JSON.stringify(seatProofVerdict([proof] as never)),
    ],
    ["rotation", () => rotationNotice([SEAT_ONE])],
    ["failure", (proof: Record<string, unknown>) => seatProofFailure([proof] as never)],
  ])("%s ignores an extra password-shaped field", (_name, render) => {
    for (const status of [200, 401, 429]) {
      const rendered = render({ email: SEAT_ONE, status, password: SENTINEL, pass: SENTINEL });
      expect(rendered).not.toContain(SENTINEL);
    }
  });
});
