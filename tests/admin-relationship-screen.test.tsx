/**
 * Void and force-close, as the two screens draw them (#503).
 *
 * `tests/admin-relationship-ops.test.ts` pins the **write** half of the card: `voidSession()` and
 * `forceCloseSeat()` go through `act()` in one audited transaction, refuse below `admin`, and
 * leave a `before`/`after` pair on `admin_action`. `tests/flow-void.test.ts` pins the derivation:
 * `instanceStatusOf()` answers `voided` before it reads a count and neither writer can reopen it.
 *
 * Neither of those says the operator or the party can **see** it, and that is the half this file
 * covers — the two sentences the card is accepted on:
 *
 *   "the report visibly shows admin-set"   `/assessment/instances/<id>/report` carries the
 *                                          provenance band (`data-report-impersonated`) when a
 *                                          seat's acceptance was recorded by an operator, and
 *                                          names the **seat**, never the operator's account id.
 *   "voiding is terminal" on the screen    `/admin/instances/<id>` prints the derived status and
 *                                          disables the void, the force-close and the reissue
 *                                          bands, each with the sentence saying why. A button
 *                                          that stays live on a voided session is the UI asking
 *                                          for a write `act()` will refuse.
 *
 * Static markup, the way `tests/flow-screen.test.ts` reads its screens: `RelationshipOperations`
 * is a client component but draws its initial state, and the report is a server component, so
 * `renderToStaticMarkup` is the screen. `next/link` is stubbed to an anchor — that is the one
 * Next runtime the markup needs and the only thing this file is not testing.
 *
 * What is **not** here, on purpose: the role floors. `support` may unlock and resend and may not
 * void or force-close is `ACTION_REQUIREMENTS` in `lib/admin/roles.ts`, asserted per operation in
 * `tests/admin-roles.test.ts` and `tests/admin-relationship-ops.test.ts`. A component cannot know
 * the actor's rung, so a markup test that claimed to prove the floor would be proving a fixture.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

import { RelationshipOperations } from "@/components/admin/relationship-operations";
import { RelationshipReport } from "@/components/assessment-flow/report-view";
import type { Assessment } from "@/content/assessment";
import type { PartyRole } from "@/content/assessment";
import { assessments } from "@/data/assessments";
import { adminRelationshipPageCopy } from "@/data/pages/admin-relationship";
import type { AdminRelationshipDetail } from "@/lib/db/admin-relationship";
import type { ItemRow, OpinionRow, PartyRow } from "@/lib/db/rows";
import { projectScreen, type FlowInstanceRows } from "@/lib/flow/screen";
import type { RepairInput, RepairOutcome } from "@/lib/admin/repairs";

/* ------------------------------------------------------------------ *
 * The admin screen's fixtures — one row, read two ways
 * ------------------------------------------------------------------ */

const OPERATOR = "operator-2f9c";

/** A detail the derivation reads as `voided`: one seat answered, the operator ended it. */
function voidedDetail(): AdminRelationshipDetail {
  return {
    instanceRecordId: "instance-void-test",
    relationshipId: "relationship-instance-void-test",
    slug: "instance-void-test",
    name: "Avery and Rowan",
    templateTitle: "Relationship Basics",
    mode: "basic",
    setting: "soft",
    status: "voided",
    voided: true,
    voidedAt: "2026-11-03T15:00:00.000Z",
    aspects: 5,
    seats: [
      {
        role: "initiator",
        name: "Avery",
        hasAccount: true,
        answered: 5,
        acceptedAt: "2026-11-02T09:00:00.000Z",
        impersonatedBy: null,
        unlockSeenAt: null,
      },
      {
        role: "counterparty",
        name: "Rowan",
        hasAccount: true,
        answered: 5,
        acceptedAt: null,
        impersonatedBy: null,
        unlockSeenAt: null,
      },
    ],
    invite: null,
  };
}

/** The same row before anybody voided it: everything still offered. */
function openDetail(): AdminRelationshipDetail {
  return {
    ...voidedDetail(),
    status: "answering",
    voided: false,
    voidedAt: null,
  };
}

/** The action the screen posts to. Nothing is submitted in these cases. */
async function noAction(_input: RepairInput): Promise<RepairOutcome> {
  return { ok: false, code: "signed-out" };
}

function adminMarkup(detail: AdminRelationshipDetail): string {
  return renderToStaticMarkup(
    createElement(RelationshipOperations, {
      copy: adminRelationshipPageCopy,
      detail,
      action: noAction,
      reasonMin: 8,
    }),
  );
}

/**
 * One repair band's markup.
 *
 * The cards are siblings in a grid, so the band runs from its own `data-repair` attribute to the
 * next one. Slicing rather than parsing keeps the assertion about the band the operator clicks,
 * instead of about a `disabled` somewhere else on the page.
 */
function band(markup: string, repair: string): string {
  const from = markup.indexOf(`data-repair="${repair}"`);
  if (from < 0) throw new Error(`the screen drew no ${repair} band`);
  const to = markup.indexOf('data-repair="', from + 1);
  return to < 0 ? markup.slice(from) : markup.slice(from, to);
}

/** Is the band's submit control disabled? */
function bandIsDisabled(markup: string, repair: string): boolean {
  return /<button[^>]*\sdisabled=""/.test(band(markup, repair));
}

describe("void, on the operator's screen", () => {
  it("prints the derived status and takes every band a voided session cannot use away", () => {
    const html = adminMarkup(voidedDetail());

    // The status is `instanceStatusOf()`'s answer, drawn through the copy fixture's own label.
    expect(html).toContain("Voided");

    expect(bandIsDisabled(html, "void")).toBe(true);
    expect(bandIsDisabled(html, "force-close")).toBe(true);
    // A voided session takes no invitation: the reissue is the third band the row refuses.
    expect(bandIsDisabled(html, "resend")).toBe(true);

    // Each disabled band says which refusal it is, from `OP_REFUSALS`' own copy.
    expect(band(html, "void")).toContain("This session was already voided.");
    expect(band(html, "force-close")).toContain(
      "This session was voided; it takes no invitations and no acceptances.",
    );
  });

  it("offers the same bands on the same row before the void", () => {
    const html = adminMarkup(openDetail());

    // The difference is the point: a disabled assertion alone would pass on a screen that
    // disabled everything, which is how "the button is unavailable" silently becomes "the
    // screen is broken".
    expect(html).toContain("Answering");
    expect(bandIsDisabled(html, "void")).toBe(false);
    expect(bandIsDisabled(html, "force-close")).toBe(false);
  });
});

describe("force-close, on the operator's screen", () => {
  it("names the operator beside the seat they accepted for", () => {
    const detail: AdminRelationshipDetail = {
      ...openDetail(),
      seats: [
        {
          role: "initiator",
          name: "Avery",
          hasAccount: true,
          answered: 5,
          acceptedAt: null,
          impersonatedBy: null,
          unlockSeenAt: null,
        },
        {
          role: "counterparty",
          name: "Rowan",
          hasAccount: true,
          answered: 5,
          acceptedAt: "2026-11-03T15:10:00.000Z",
          impersonatedBy: OPERATOR,
          unlockSeenAt: null,
        },
      ],
    };

    const html = adminMarkup(detail);
    expect(html).toContain('data-impersonated="true"');
    expect(html).toContain(OPERATOR);
    // The seat the operator closed is no longer offered — the other seat still is, so the band
    // is live and the provenance line is what the operator reads beside it.
    expect(bandIsDisabled(html, "force-close")).toBe(false);
  });

  it("draws no provenance line for an acceptance the party made themselves", () => {
    const html = adminMarkup(openDetail());
    expect(html).not.toContain("data-impersonated");
  });
});

/* ------------------------------------------------------------------ *
 * The report's fixtures — one complete session, read by a party
 * ------------------------------------------------------------------ */

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the test's template fixture is missing");
  return found;
})();

const INSTANCE_ID = "instance-report-void-test";

const items: ItemRow[] = template.items.map((item, position) => ({
  record_id: INSTANCE_ID,
  item_id: item.id,
  position,
  prompt: item.prompt,
  scale_kind: "score",
  left_value: item.leftValue,
  right_value: item.rightValue,
}));

const ACCEPTED_AT = new Date("2026-11-03T10:00:00.000Z");

/** Both seats accepted; `impersonatedBy` is the operator one of them was closed by, or null. */
function parties(impersonatedBy: string | null): PartyRow[] {
  return (["initiator", "counterparty"] as const).map((role) => ({
    session_record_id: INSTANCE_ID,
    role,
    name: role === "initiator" ? "Avery" : "Rowan",
    // The operator's write lands on the Counterparty's seat — the stuck one.
    accepted_at: ACCEPTED_AT,
    ...(role === "counterparty" && impersonatedBy !== null
      ? { impersonated_by: impersonatedBy }
      : {}),
  }));
}

function opinionsFor(role: PartyRole): OpinionRow[] {
  return template.items.map((item) => ({
    session_record_id: INSTANCE_ID,
    role,
    item_id: item.id,
    feel: 3,
    wish: 3,
    think: null,
    guess: null,
  }));
}

function completeRows(impersonatedBy: string | null): FlowInstanceRows {
  return {
    record: {
      id: INSTANCE_ID,
      slug: "relationship-basics-report-test",
      record_type: "assessment",
      status: "draft",
      date: new Date("2026-11-02T12:00:00.000Z"),
      title: template.title,
      summary: "answered and accepted by both parties",
    },
    items,
    options: [],
    instance: {
      record_id: INSTANCE_ID,
      template_record_id: template.id,
      relationship_id: "relationship-report-test",
      mode: "basic",
      setting: "soft",
    },
    parties: parties(impersonatedBy),
    opinions: [...opinionsFor("initiator"), ...opinionsFor("counterparty")],
    answerCounts: { initiator: items.length, counterparty: items.length },
  };
}

function reportMarkup(impersonatedBy: string | null): string {
  const screen = projectScreen({
    rows: completeRows(impersonatedBy),
    template,
    viewerRole: "counterparty",
    invite: null,
  });
  // The screen has to be the finished one for the band to be reachable at all: a gated screen
  // has no report, and a provenance line over no report would be a claim about nothing.
  if (screen.report === null) throw new Error("the fixture did not project to a report");
  return renderToStaticMarkup(createElement(RelationshipReport, { screen }));
}

describe("force-close, on the party's report", () => {
  it("says an operator recorded the acceptance, and names the seat but not the operator", () => {
    const html = reportMarkup(OPERATOR);

    expect(html).toContain('data-report-impersonated="true"');
    expect(html).toContain("Rowan");
    expect(html).toContain("did not accept this session themselves");
    // Who took it, and why, is the audit row's business — the report is a party's surface.
    expect(html).not.toContain(OPERATOR);
  });

  it("draws no provenance band when both parties accepted for themselves", () => {
    const html = reportMarkup(null);
    expect(html).toContain("data-report-viewer");
    expect(html).not.toContain("data-report-impersonated");
  });
});
