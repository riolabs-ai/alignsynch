/**
 * `lib/member/publish-basis.ts` (#533 phase 2), driven at a fixed instant — no clock, no database.
 *
 * The write path is one transaction per action and therefore a bad place to discover a rule is
 * wrong, so every question the screens ask is answered here over values: the status, the
 * subscription, the invitation row and one instant. This suite pins those answers, including the
 * boundaries the product words hang on — the trial's last instant, the invitation's last instant,
 * and the one combination #533 says must be stated plainly (a trial running with no live link).
 */
import { describe, expect, it } from "vitest";

import {
  aspectsEditable,
  inviteExpiresAt,
  isClosed,
  MEMBER_REFUSALS,
  MEMBER_INVITE_TTL_MS,
  MEMBER_TRIAL_DAYS,
  MemberRefused,
  publishable,
  publishBasisOf,
  publishViewOf,
  PUBLISH_VIEWS,
  republishable,
  statusAfterSave,
  trialAlreadyRunningMessage,
  trialEndsAt,
  trialRunningWithoutLiveInvite,
} from "@/lib/member/publish-basis";
import { RELATIONSHIP_STATUSES, type RelationshipStatus } from "@/lib/relationship/status";

/** One instant, used by every case: noon on 4 November 2026. */
const NOW = new Date("2026-11-04T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("the two windows #533 names", () => {
  it("gives a trial fourteen days and an invitation seven", () => {
    expect(MEMBER_TRIAL_DAYS).toBe(14);
    expect(MEMBER_INVITE_TTL_MS).toBe(7 * DAY);
    expect(trialEndsAt(NOW).toISOString()).toBe("2026-11-18T12:00:00.000Z");
    expect(inviteExpiresAt(NOW).toISOString()).toBe("2026-11-11T12:00:00.000Z");
  });
});

describe("publishBasisOf", () => {
  it("starts a trial when the account holds no subscription at all", () => {
    // `null` is the trial arm and not the checkout arm: a member's first relationship is what the
    // trial is for, so a first publish must not be met with a paywall.
    expect(publishBasisOf(null, NOW)).toEqual({
      kind: "trial",
      endsAt: new Date("2026-11-18T12:00:00.000Z"),
    });
  });

  it("refuses while a trial is running, and names its last instant", () => {
    // The refusal is what #533's acceptance pastes, so the value carries the instant rather than a
    // boolean: a screen that says "a trial is already running" without saying until when is a
    // dead end for the member reading it.
    const decision = publishBasisOf(
      { status: "trialing", currentPeriodEnd: "2026-11-18T12:00:00.000Z" },
      NOW,
    );
    expect(decision.kind).toBe("trial-running");
    expect(decision.kind === "trial-running" && decision.endsAt.toISOString()).toBe(
      "2026-11-18T12:00:00.000Z",
    );
  });

  it("treats the trial's own last instant as already over", () => {
    // `current_period_end` is outside the window, not the end of it — the same boundary
    // `trialStateOf` draws (phase 1), which is why one instant decides both.
    expect(
      publishBasisOf({ status: "trialing", currentPeriodEnd: NOW.toISOString() }, NOW).kind,
    ).toBe("checkout");
  });

  it("asks for a checkout once a trial lapsed, and says which reason", () => {
    expect(
      publishBasisOf({ status: "trialing", currentPeriodEnd: "2026-11-01T12:00:00.000Z" }, NOW),
    ).toEqual({ kind: "checkout", because: "trial-expired" });
  });

  it("needs nothing when the account already pays — no second charge, no second trial", () => {
    // The case the card's sentence leaves implicit and the one a paying member hits on their
    // second relationship.
    for (const status of ["active", "past_due"] as const) {
      expect(
        publishBasisOf({ status, currentPeriodEnd: "2026-12-04T12:00:00.000Z" }, NOW),
        status,
      ).toEqual({ kind: "paid" });
    }
  });

  it("asks for a checkout for a row that entitles nothing", () => {
    for (const status of ["canceled", "incomplete"] as const) {
      expect(
        publishBasisOf({ status, currentPeriodEnd: "2026-12-04T12:00:00.000Z" }, NOW),
        status,
      ).toEqual({ kind: "checkout", because: "no-subscription" });
    }
  });

  it("accepts the instant as a Date as well as an ISO string", () => {
    // The reads return a `Date` from `pg` and a string from JSON, and both reach this function.
    const fromDate = publishBasisOf(
      { status: "trialing", currentPeriodEnd: new Date("2026-11-18T12:00:00.000Z") },
      NOW,
    );
    const fromString = publishBasisOf(
      { status: "trialing", currentPeriodEnd: "2026-11-18T12:00:00.000Z" },
      NOW,
    );
    expect(fromDate).toEqual(fromString);
  });
});

describe("Aspects", () => {
  it("are editable in the two states before the invitation goes out", () => {
    expect(aspectsEditable("draft")).toBe(true);
    expect(aspectsEditable("pending")).toBe(true);
  });

  it("are fixed in every other state — including after publish", () => {
    // After publish the pair was invited on those words; rewriting them would change what somebody
    // else agreed to. The terminal three are not a form either.
    for (const status of RELATIONSHIP_STATUSES.filter(
      (value) => value !== "draft" && value !== "pending",
    )) {
      expect(aspectsEditable(status), status).toBe(false);
    }
  });

  it("save into pending from draft, and stay pending when already there", () => {
    expect(statusAfterSave("draft")).toBe("pending");
    expect(statusAfterSave("pending")).toBe("pending");
    expect(statusAfterSave("published")).toBeNull();
  });
});

describe("publishable and isClosed", () => {
  it("offers publish from exactly the two editable states", () => {
    expect(publishable("draft")).toBe(true);
    expect(publishable("pending")).toBe(true);
    expect(publishable("published")).toBe(false);
    expect(publishable("active")).toBe(false);
  });

  it("calls the three statuses with no way out closed, and active open", () => {
    const open: RelationshipStatus[] = ["draft", "pending", "published", "active"];
    for (const status of RELATIONSHIP_STATUSES) {
      expect(isClosed(status), status).toBe(!open.includes(status));
    }
  });
});

describe("publishViewOf", () => {
  const invite = (over: Partial<{ expiresAt: Date; claimed: boolean; revoked: boolean }> = {}) => ({
    expiresAt: new Date(NOW.getTime() + DAY),
    claimed: false,
    ...over,
  });

  it("reports not-published for the two editable states, whatever an invite says", () => {
    for (const status of ["draft", "pending"] as const) {
      expect(publishViewOf({ status, invite: null, now: NOW }), status).toBe("not-published");
      expect(publishViewOf({ status, invite: invite(), now: NOW }), status).toBe("not-published");
    }
  });

  it("distinguishes a live link from a lapsed one", () => {
    expect(publishViewOf({ status: "published", invite: invite(), now: NOW })).toBe("invite-live");
    expect(
      publishViewOf({
        status: "published",
        invite: invite({ expiresAt: new Date(NOW.getTime() - 1) }),
        now: NOW,
      }),
    ).toBe("invite-expired");
  });

  it("reports a claimed seat as claimed, not as live", () => {
    expect(
      publishViewOf({ status: "published", invite: invite({ claimed: true }), now: NOW }),
    ).toBe("invite-claimed");
  });

  it("reports a revoked link as revoked", () => {
    expect(
      publishViewOf({ status: "published", invite: invite({ revoked: true }), now: NOW }),
    ).toBe("invite-revoked");
  });

  it("says invite-missing rather than guessing when a published row has no invitation", () => {
    expect(publishViewOf({ status: "published", invite: null, now: NOW })).toBe("invite-missing");
  });

  it("draws no link state once the pair is past the invitation", () => {
    // `active` and the terminal three: the invitation's question has been answered or abandoned.
    for (const status of ["active", "complete", "void", "expired"] as const) {
      expect(publishViewOf({ status, invite: invite(), now: NOW }), status).toBe("invite-claimed");
    }
  });

  it("has six views and returns one of them for every status", () => {
    expect(PUBLISH_VIEWS).toHaveLength(6);
    for (const status of RELATIONSHIP_STATUSES) {
      expect(PUBLISH_VIEWS).toContain(publishViewOf({ status, invite: invite(), now: NOW }));
    }
  });
});

describe("republishable", () => {
  it("is offered for exactly the two dead-link states", () => {
    expect(republishable("invite-expired")).toBe(true);
    expect(republishable("invite-revoked")).toBe(true);
  });

  it("is not offered for a live link, a claimed seat, or a missing row", () => {
    // `invite-missing` is drift: a published relationship with no invitation row is a repair, not
    // a click that papers over it.
    expect(republishable("invite-live")).toBe(false);
    expect(republishable("invite-claimed")).toBe(false);
    expect(republishable("invite-missing")).toBe(false);
    expect(republishable("not-published")).toBe(false);
  });
});

describe("trialRunningWithoutLiveInvite", () => {
  it("is true exactly when the member is paying and the link does not work", () => {
    expect(trialRunningWithoutLiveInvite("active", "invite-expired")).toBe(true);
    expect(trialRunningWithoutLiveInvite("active", "invite-missing")).toBe(true);
    expect(trialRunningWithoutLiveInvite("active", "invite-revoked")).toBe(true);
  });

  it("is false for a live link, an unstarted trial, and a lapsed one", () => {
    expect(trialRunningWithoutLiveInvite("active", "invite-live")).toBe(false);
    expect(trialRunningWithoutLiveInvite("none", "invite-expired")).toBe(false);
    expect(trialRunningWithoutLiveInvite("expired", "invite-expired")).toBe(false);
  });
});

describe("MemberRefused", () => {
  it("carries the code the screen maps and the sentence the server wrote", () => {
    const refused = new MemberRefused("not-yours", "relationship r was started by another account");
    expect(refused).toBeInstanceOf(Error);
    expect(refused.reason).toBe("not-yours");
    expect(refused.message).toContain("another account");
  });

  it("names the trial's last instant in the trial-already-running sentence", () => {
    const endsAt = new Date("2026-11-18T12:00:00.000Z");
    expect(trialAlreadyRunningMessage(endsAt)).toContain("2026-11-18T12:00:00.000Z");
    expect(trialAlreadyRunningMessage(endsAt)).toContain("one active trial per account");
  });

  it("lists every code once, and every code is one a refusal can carry", () => {
    expect(new Set(MEMBER_REFUSALS).size).toBe(MEMBER_REFUSALS.length);
    for (const code of MEMBER_REFUSALS) {
      expect(new MemberRefused(code, "x").reason).toBe(code);
    }
  });
});
