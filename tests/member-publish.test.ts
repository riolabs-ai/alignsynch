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
  publishViewOf,
  PUBLISH_VIEWS,
  republishable,
  statusAfterSave,
  trialAlreadyRunningMessage,
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
    expect(inviteExpiresAt(NOW).toISOString()).toBe("2026-11-11T12:00:00.000Z");
  });
});

/*
 * `publishBasisOf` lived here and was removed by #619.
 *
 * It answered "does this publish start a trial, open a checkout, or need neither?" — the
 * charge-at-creation model. Publishing now bills nothing (the invitation is never blocked on a
 * card), so there is no basis to decide and its seven cases are gone with the trigger. The fee's
 * own arithmetic is pinned in `tests/flow-payment.test.ts`.
 */

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

  it("calls complete and void closed, and leaves lapsed open to a payment", () => {
    // #533 phase 3: `expired` is no longer closed. It has no *person's* edge out, but the system's
    // payment edge exists (`expired → active|published`), so a screen that said "nothing more can
    // happen" about a lapsed relationship would be telling the payer it is over.
    const closed: RelationshipStatus[] = ["complete", "void"];
    for (const status of RELATIONSHIP_STATUSES) {
      expect(isClosed(status), status).toBe(closed.includes(status));
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
    expect(trialAlreadyRunningMessage(endsAt)).toContain("One active trial per account");
  });

  it("names the relationship that holds the trial, when one was read (#533 phase 3)", () => {
    const endsAt = new Date("2026-11-18T12:00:00.000Z");
    const sentence = trialAlreadyRunningMessage(endsAt, {
      relationshipId: "rel-1",
      title: "Avery and Rowan",
    });
    expect(sentence).toContain('relationship "rel-1"');
    expect(sentence).toContain('("Avery and Rowan")');
    expect(sentence).toContain("holds it");
    // No relationship read: the sentence still names the instant, and says whose trial it is not.
    expect(trialAlreadyRunningMessage(endsAt, null)).toContain("a relationship on this account");
  });

  it("lists every code once, and every code is one a refusal can carry", () => {
    expect(new Set(MEMBER_REFUSALS).size).toBe(MEMBER_REFUSALS.length);
    for (const code of MEMBER_REFUSALS) {
      expect(new MemberRefused(code, "x").reason).toBe(code);
    }
  });
});
