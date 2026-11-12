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
 * suite (`tests/assessments-list.test.ts`) keeps asserting that they reach the DOM — unchanged, which
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
import { assessmentsPageCopy } from "@/data/pages/assessments";
import type { LibraryTemplate } from "@/lib/flow/template-library";
import type { RelationshipCard } from "@/lib/db/assessments";
import { instancePath } from "@/lib/flow/paths";
import { CARD_ABSENT, type MemberCard, relationshipCard, sessionLabelOf } from "@/lib/member/card";
import { catalogueCard, mineCard } from "@/lib/member/shelf";

const VIEW = "components/dashboard/assessments-list.tsx";

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
      expect(view, `assessments-list.tsx formats ${what}`).not.toMatch(pattern);
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
      expect(view, `assessments-list.tsx still reads row.${field}`).not.toContain(field);
    }
  });

  it("builds every card through the one projection", () => {
    expect(view).toContain("relationshipCard(");
  });

  it("draws no tile grid of its own — the figures are the card's one meta line (#795 F4)", () => {
    // The artifact approved option A: the four metric tiles are one line. A `<dl>` grid, a tile
    // component or a two-column stat block coming back is that decision being undone in the
    // component instead of in the projection.
    const forbidden: ReadonlyArray<readonly [string, RegExp]> = [
      ["a metric tile grid", /grid grid-cols-2\b/],
      ["a definition-list figure block", /<dl\b/],
      ["a local tile component", /function\s+MetricTile\b/],
    ];
    for (const [what, pattern] of forbidden) {
      expect(view, `assessments-list.tsx grew ${what}`).not.toMatch(pattern);
    }
    expect(view).toContain("model.meta.map(");
  });

  it("imports the card chrome instead of restating it", () => {
    // The frame, the cover slot, the title and the facts line are declared once (#795); a copy of
    // any of those literals in either shelf is the second look this change exists to remove.
    for (const surface of [VIEW, "components/dashboard/template-shelf.tsx"]) {
      const code = codeOf(surface);
      for (const constant of ["CARD_FRAME", "CARD_COVER", "CARD_TITLE", "CARD_META"]) {
        expect(code, `${surface} restates ${constant}`).not.toMatch(
          new RegExp(`const ${constant}\\b`),
        );
      }
      expect(code, `${surface} does not import the card chrome`).toContain("@/lib/member/card");
    }
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
      relationshipCard(assessmentsPageCopy, rowOf()),
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
  it("prints the ratio, the alignment and the Aspect count as one meta line", () => {
    const meta = relationshipCard(assessmentsPageCopy, rowOf()).meta;

    expect(meta).toEqual(["1 of 1 Sessions", "Avg alignment 1.4", "5 Aspects"]);
  });

  it("never prints a percentage — the ratio already states the proportion", () => {
    // The tiles drew `1 of 1` and `100%`; the artifact's one line keeps one way of saying a count.
    const meta = relationshipCard(
      assessmentsPageCopy,
      rowOf({ sessionsOpened: 3, sessionsCompleted: 2 }),
    ).meta;
    expect(meta[0]).toBe("2 of 3 Sessions");
    for (const segment of meta) expect(segment).not.toContain("%");
  });

  it("says `No scored session yet` where the alignment has no figure, never `0`", () => {
    // One session open, none complete: the counts are facts, the Gap is not.
    const meta = relationshipCard(
      assessmentsPageCopy,
      rowOf({ sessionsCompleted: 0, alignment: null }),
    ).meta;

    expect(meta).toEqual(["0 of 1 Sessions", "No scored session yet", "5 Aspects"]);
    expect(meta.join(" ")).not.toContain("0.0");
  });

  it("prints `—` for a relationship with no session open, instead of dividing by zero", () => {
    const meta = relationshipCard(
      assessmentsPageCopy,
      rowOf({ sessionsOpened: 0, sessionsCompleted: 0, alignment: null }),
    ).meta;

    expect(meta[0]).toBe(`${CARD_ABSENT} Sessions`);
    expect(meta.join(" ")).not.toContain("NaN");
  });
});

describe("relationshipCard — what else the card says", () => {
  it("makes the row's handles and addresses the projection's", () => {
    const card = relationshipCard(assessmentsPageCopy, rowOf());
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
    const initiator = relationshipCard(assessmentsPageCopy, rowOf()).relationship.party;
    const counterparty = relationshipCard(
      assessmentsPageCopy,
      rowOf({ viewerRole: "counterparty", initiatorName: "Avery", counterpartyName: "Rowan" }),
    ).relationship.party;
    const coach = relationshipCard(
      assessmentsPageCopy,
      rowOf({ viewerRole: "coach", initiatorName: "Avery", counterpartyName: "Rowan" }),
    ).relationship.party;

    expect(initiator).toBe("With · Rowan");
    expect(counterparty).toBe("With · Avery");
    expect(coach).toBe("With · Avery → Rowan");
  });

  it("says `Not claimed yet` for a relationship whose other seat does not exist", () => {
    const card = relationshipCard(
      assessmentsPageCopy,
      rowOf({ counterpartyName: null, viewerRole: "initiator", stage: "invited" }),
    );
    expect(card.relationship.party).toBe("With · Not claimed yet");
  });

  it("carries the state sentence, and the marker only on an unread complete row", () => {
    expect(relationshipCard(assessmentsPageCopy, rowOf()).relationship.sentence).toBe(
      "You have both accepted — the Gap is open",
    );
    expect(relationshipCard(assessmentsPageCopy, rowOf()).relationship.marker).toBeNull();

    const unseen = relationshipCard(assessmentsPageCopy, rowOf({ unlock: "unseen" })).relationship;
    expect(unseen.marker).toBe("Complete since you last looked — open it to read the Gap");

    const awaiting = relationshipCard(
      assessmentsPageCopy,
      rowOf({ state: "awaiting-other", stage: "connected", sessionsCompleted: 0 }),
    ).relationship;
    expect(awaiting.sentence).toBe("Waiting for Rowan to answer.");
    expect(awaiting.marker).toBeNull();
  });

  it("draws what was paid for the Initiator, `—` when nothing was, and nothing for other seats", () => {
    const paid = relationshipCard(
      assessmentsPageCopy,
      rowOf({ paid: { plan: "household", purchasedAt: "2026-10-20T12:00:00.000Z" } }),
    ).relationship.paid;
    expect(paid).toEqual({ label: "Paid", statement: "household · bought Oct 20, 2026" });

    const nothing = relationshipCard(
      assessmentsPageCopy,
      rowOf({ paid: { plan: null, purchasedAt: null } }),
    ).relationship.paid;
    expect(nothing).toEqual({ label: "Paid", statement: null });

    // The read hands `paid: null` to every non-Initiator: the block is absent, not blanked.
    expect(relationshipCard(assessmentsPageCopy, rowOf({ paid: null })).relationship.paid).toBe(
      null,
    );
  });

  it("states the last session as a pure function of the instant, with no clock", () => {
    const card = relationshipCard(assessmentsPageCopy, rowOf());
    expect(card.relationship.lastSession).toBe(
      `Last session ${sessionLabelOf("2026-10-28T18:30:00.000Z")}`,
    );
    expect(card.relationship.lastSession).not.toContain("Invalid");
  });

  it("carries the mode, and the invitation only when the read handed one", () => {
    expect(relationshipCard(assessmentsPageCopy, rowOf()).relationship.invite).toBeNull();

    const invited = relationshipCard(assessmentsPageCopy, rowOf({ inviteState: "claimed" }))
      .relationship.invite;
    expect(invited).toEqual({ state: "claimed", label: "Accepted" });
  });
});
