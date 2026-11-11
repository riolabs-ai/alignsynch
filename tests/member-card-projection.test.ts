/**
 * One card projection, and the figures it owns (#795 F2).
 *
 * The defect this pins down: `components/assessment-flow/my-instances.tsx` assembled its own
 * figures — `N of M`, a percentage, `toFixed(1)` — inside the render. A number that is *derived*
 * is invisible to `E22` (which fires on a rendered literal) and to `E23` (which counts copy), so
 * the arithmetic sat in JSX while every check stayed green. Two consequences follow, and both are
 * asserted here rather than described:
 *
 *   1. **The card's figures are the projection's.** `lib/member/card.ts` is the one place a
 *      member card is built — the way `lib/member/shelf.ts` builds a template card — and both
 *      shelves print what it hands them. So the component must name no metric field and hold no
 *      arithmetic: a `toFixed`, a `Math.round`, a division of the two session counts or a
 *      percentage template coming back is the regression, and it fails here before it reaches a
 *      screen.
 *   2. **One type serves both shelves.** A template card and a relationship card are both
 *      `MemberCard`; a second projection type is how the two drifted apart in the first place.
 *
 * The behavioural half drives the projection directly, which is what the component no longer can:
 * the strings it would have computed are asserted on the builder, and the rendered page's own
 * suite (`tests/my-instances.test.ts`) keeps asserting that they reach the DOM — unchanged, which
 * is the proof that moving the formatting changed no sentence a reader sees.
 *
 * **The guard's scope is this surface.** `components/v1/admin-relationship-detail.tsx` still builds
 * a `N of M` string in JSX; it is a different shelf with a different projection to build, and this
 * test deliberately does not claim it. Widening the scan to a second file without moving its
 * figures first would only make the suite red for a reason nobody is fixing here.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { dashboardTemplatesPageCopy } from "@/data/pages/dashboard-templates";
import { myInstancesPageCopy } from "@/data/pages/assessment-instances";
import type { LibraryTemplate } from "@/lib/flow/template-library";
import type { RelationshipCard } from "@/lib/db/assessments";
import { instancePath } from "@/lib/flow/paths";
import { CARD_ABSENT, type MemberCard, relationshipCard, sessionLabelOf } from "@/lib/member/card";
import { catalogueCard, mineCard } from "@/lib/member/shelf";

const VIEW = "components/assessment-flow/my-instances.tsx";

/**
 * Source with the comments stripped: this module explains the rule it must obey.
 *
 * The line-comment pass skips a `//` that follows a `:` so a URL in a string keeps its tail — a
 * regex that ate everything after `https://` would hide a regression planted on the same line.
 */
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/gm, "$1");
}

/**
 * A row as the read produces it: every figure derived, none authored.
 *
 * The default is a complete, scored, single-session relationship seen by its Initiator — the case
 * whose four figures a reader can check by hand (1 of 1, 100%, a mean Gap of 1.4, 5 Aspects).
 */
function rowOf(overrides: Partial<RelationshipCard> = {}): RelationshipCard {
  return {
    relationshipId: "relationship-assessment-instance-avery-rowan",
    instanceRecordId: "assessment-instance-avery-rowan",
    slug: "avery-rowan",
    name: "Relationship Basics",
    templateTitle: "Relationship Basics",
    mode: "basic",
    viewerRole: "initiator",
    initiatorName: "Avery",
    counterpartyName: "Rowan",
    stage: "sharing",
    state: "complete",
    unlock: "seen",
    inviteState: null,
    aspectCount: 5,
    sessionsOpened: 1,
    sessionsCompleted: 1,
    alignment: 1.4,
    paid: null,
    lastSessionAt: "2026-10-28T18:30:00.000Z",
    ...overrides,
  };
}

/** A catalogue row, for the other half of the one-type proof. */
const templateRow: LibraryTemplate = {
  id: "assessment-business-staff-manager",
  slug: "staff-manager",
  title: "Staff & Manager",
  summary: "A manager and the person who reports to them.",
  status: "published",
  createdAt: "2026-10-29T12:00:00.000Z",
  aspectCount: 5,
  instanceCount: 2,
  authorship: "built-in",
};

describe("the card's figures are formatted by the projection, not by JSX", () => {
  const view = codeOf(VIEW);

  it("holds no arithmetic, no unit and no rounding of its own", () => {
    const forbidden: ReadonlyArray<readonly [string, RegExp]> = [
      ["a toFixed call", /\.toFixed\(/],
      ["a Math.round/floor/ceil call", /Math\.(round|floor|ceil)\(/],
      ["a division of the session counts", /sessionsCompleted\s*\//],
      ["an `N of M` template", /\$\{[^}`]*\}\s+of\s+\$\{/],
      ["a percentage template", /\}\s*%\s*`/],
      ["a percentage in JSX", /\}\s*%\s*</],
      ["a locale-formatted number", /\.toLocaleString\(/],
      ["a precision-formatted number", /\.toPrecision\(|Intl\.NumberFormat/],
    ];
    for (const [what, pattern] of forbidden) {
      expect(view, `my-instances.tsx formats ${what}`).not.toMatch(pattern);
    }
  });

  it("names none of the row's figures — it prints what the projection handed it", () => {
    for (const field of [
      "sessionsOpened",
      "sessionsCompleted",
      "alignment",
      "aspectCount",
      "inviteState",
      "lastSessionAt",
    ]) {
      expect(view, `my-instances.tsx still reads row.${field}`).not.toContain(field);
    }
  });

  it("builds every card through the one projection", () => {
    expect(view).toContain("relationshipCard(");
  });
});

describe("there is one card projection type", () => {
  it("declares it once, in lib/member/card.ts", () => {
    const shelf = codeOf("lib/member/shelf.ts");
    expect(shelf).not.toMatch(/export interface \w*ShelfCard\b/);
    expect(shelf).toContain("@/lib/member/card");
  });

  it("is the type both shelves' cards satisfy", () => {
    // The assignment is the assertion: if a relationship card and a template card were different
    // projections, one of these three would not be a `MemberCard` and this file would not compile.
    const cards: readonly MemberCard[] = [
      relationshipCard(myInstancesPageCopy, rowOf()),
      catalogueCard(dashboardTemplatesPageCopy, templateRow),
      mineCard(dashboardTemplatesPageCopy, {
        id: "record-mine",
        slug: "our-family-check-in",
        title: "Our Family Check-in",
        summary: "What we want to ask each other every month.",
        status: "published",
        aspectCount: 4,
        relationshipCount: 2,
      }),
    ];
    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.relationship === null)).toEqual([false, true, true]);
  });
});

describe("relationshipCard — the figures", () => {
  it("prints the ratio, the proportion, the mean Gap and the Aspect count", () => {
    const facts = relationshipCard(myInstancesPageCopy, rowOf()).relationship.facts;

    expect(facts).toEqual([
      { label: "Sessions", value: "1 of 1", hint: "completed of opened" },
      { label: "Completion", value: "100%", hint: null },
      { label: "Avg alignment", value: "1.4", hint: "mean Gap" },
      { label: "Aspects", value: "5", hint: null },
    ]);
  });

  it("prints `—` for an unscored session and never `0`, while keeping the counts", () => {
    // One session open, none complete: the counts are facts, the Gap is not.
    const facts = relationshipCard(
      myInstancesPageCopy,
      rowOf({ sessionsCompleted: 0, alignment: null }),
    ).relationship.facts;

    expect(facts[0]).toEqual({ label: "Sessions", value: "0 of 1", hint: "completed of opened" });
    expect(facts[1]).toEqual({ label: "Completion", value: "0%", hint: null });
    expect(facts[2]).toEqual({
      label: "Avg alignment",
      value: CARD_ABSENT,
      hint: "No scored session yet",
    });
  });

  it("prints `—` for a relationship with no session open, instead of dividing by zero", () => {
    const facts = relationshipCard(
      myInstancesPageCopy,
      rowOf({ sessionsOpened: 0, sessionsCompleted: 0, alignment: null }),
    ).relationship.facts;

    expect(facts[0]).toEqual({ label: "Sessions", value: CARD_ABSENT, hint: "none opened" });
    expect(facts[1]).toEqual({ label: "Completion", value: CARD_ABSENT, hint: null });
    expect(facts[1].value).not.toContain("NaN");
    expect(facts[1].value).not.toContain("%");
  });

  it("rounds a completion to whole percent rather than printing a repeating decimal", () => {
    // Two of three sessions is 66.66…%, which is a proportion, not a claim to two decimals.
    const facts = relationshipCard(
      myInstancesPageCopy,
      rowOf({ sessionsOpened: 3, sessionsCompleted: 2 }),
    ).relationship.facts;
    expect(facts[1].value).toBe("67%");
  });
});

describe("relationshipCard — what else the card says", () => {
  it("makes the row's handles and addresses the projection's", () => {
    const card = relationshipCard(myInstancesPageCopy, rowOf());
    expect(card.id).toBe("assessment-instance-avery-rowan");
    expect(card.detail).toEqual({
      href: instancePath("assessment-instance-avery-rowan"),
      label: "View",
    });
    expect(card.create).toBeNull();
    expect(card.relationship.stage).toBe("sharing");
    expect(card.relationship.stageLabel).toBe("Sharing");
    expect(card.relationship.state).toBe("complete");
  });

  it("names the other party from the seat the read resolved, never the reader", () => {
    const initiator = relationshipCard(myInstancesPageCopy, rowOf()).relationship.party;
    const counterparty = relationshipCard(
      myInstancesPageCopy,
      rowOf({ viewerRole: "counterparty", initiatorName: "Avery", counterpartyName: "Rowan" }),
    ).relationship.party;
    const coach = relationshipCard(
      myInstancesPageCopy,
      rowOf({ viewerRole: "coach", initiatorName: "Avery", counterpartyName: "Rowan" }),
    ).relationship.party;

    expect(initiator).toBe("With · Rowan");
    expect(counterparty).toBe("With · Avery");
    expect(coach).toBe("With · Avery → Rowan");
  });

  it("says `Not claimed yet` for a relationship whose other seat does not exist", () => {
    const card = relationshipCard(
      myInstancesPageCopy,
      rowOf({ counterpartyName: null, viewerRole: "initiator", stage: "invited" }),
    );
    expect(card.relationship.party).toBe("With · Not claimed yet");
  });

  it("carries the state sentence, and the marker only on an unread complete row", () => {
    expect(relationshipCard(myInstancesPageCopy, rowOf()).relationship.sentence).toBe(
      "You have both accepted — the Gap is open",
    );
    expect(relationshipCard(myInstancesPageCopy, rowOf()).relationship.marker).toBeNull();

    const unseen = relationshipCard(myInstancesPageCopy, rowOf({ unlock: "unseen" })).relationship;
    expect(unseen.marker).toBe("Complete since you last looked — open it to read the Gap");

    const awaiting = relationshipCard(
      myInstancesPageCopy,
      rowOf({ state: "awaiting-other", stage: "connected", sessionsCompleted: 0 }),
    ).relationship;
    expect(awaiting.sentence).toBe("Waiting for Rowan to answer.");
    expect(awaiting.marker).toBeNull();
  });

  it("draws what was paid for the Initiator, `—` when nothing was, and nothing for other seats", () => {
    const paid = relationshipCard(
      myInstancesPageCopy,
      rowOf({ paid: { plan: "household", purchasedAt: "2026-10-20T12:00:00.000Z" } }),
    ).relationship.paid;
    expect(paid).toEqual({ label: "Paid", statement: "household · bought Oct 20, 2026" });

    const nothing = relationshipCard(
      myInstancesPageCopy,
      rowOf({ paid: { plan: null, purchasedAt: null } }),
    ).relationship.paid;
    expect(nothing).toEqual({ label: "Paid", statement: null });

    // The read hands `paid: null` to every non-Initiator: the block is absent, not blanked.
    expect(relationshipCard(myInstancesPageCopy, rowOf({ paid: null })).relationship.paid).toBe(
      null,
    );
  });

  it("states the last session as a pure function of the instant, with no clock", () => {
    const card = relationshipCard(myInstancesPageCopy, rowOf());
    expect(card.relationship.lastSession).toBe(
      `Last session ${sessionLabelOf("2026-10-28T18:30:00.000Z")}`,
    );
    expect(card.relationship.lastSession).not.toContain("Invalid");
  });

  it("carries the mode, and the invitation only when the read handed one", () => {
    expect(relationshipCard(myInstancesPageCopy, rowOf()).relationship.invite).toBeNull();

    const invited = relationshipCard(myInstancesPageCopy, rowOf({ inviteState: "claimed" }))
      .relationship.invite;
    expect(invited).toEqual({ state: "claimed", label: "Accepted" });
  });
});
