/**
 * The instance screen's stage sentence (#274), as markup: one derived sentence, no bar.
 *
 * The card's claim is narrow and negative as much as positive — the screen names the stage it
 * is at and **draws no stepper**, no dots, no percentage, and never the word "Aligned" before
 * the report exists. So the cases below pin:
 *
 *   mapping    `relationshipStage()` is a total table over the three statuses, and the flow
 *              stage type cannot be `aligned` at all;
 *   three      each status renders its own sentence with `data-stage`, chosen from
 *              `data/pages/assessment-instance.ts` (E23) and not written in the component;
 *   expired    an invitation past its claim window says so in the stage sentence, because
 *              "waiting for Rowan to accept" is a lie once the link has died;
 *   one        exactly one `data-stage` element, and no stepper markup of any shape;
 *   blind      no number anywhere in the sentence: not "3 of 5 answered", not "2 answers".
 *
 * The rows are hand-built (`lib/db/rows.ts` shapes) for the same reason `tests/flow-screen.ts`
 * builds its own: the screen takes a projection, so the test can drive every status without a
 * database, and the read path's own mapping is `tests/flow-screen.test.ts`'s subject.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssessmentInstanceView } from "@/components/assessment-flow/instance-view";
import { STAGE_LABELS } from "@/content/stages";
import type { Assessment } from "@/content/assessment";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { assessments } from "@/data/assessments";
import type { ItemRow, OpinionRow, PartyRow } from "@/lib/db/rows";
import { projectScreen, type FlowInstanceRows } from "@/lib/flow/screen";
import { FLOW_STAGES, relationshipStage, stageCopyId } from "@/lib/flow/stage";

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the stage test's template fixture is missing");
  return found;
})();

const INSTANCE_ID = "instance-stage-test";

const items: ItemRow[] = template.items.map((item, position) => ({
  record_id: INSTANCE_ID,
  item_id: item.id,
  position,
  prompt: item.prompt,
  scale_kind: "score",
  left_value: item.leftValue,
  right_value: item.rightValue,
}));

/** Every Aspect answered by one party: Feel 3, Wish 4 — the numbers do not matter here. */
function answeredBy(role: "initiator" | "counterparty", feel = 3, wish = 4): OpinionRow[] {
  return items.map((item) => ({
    session_record_id: INSTANCE_ID,
    role,
    item_id: item.item_id,
    feel,
    wish,
    think: null,
    guess: null,
  }));
}

const bothParties: PartyRow[] = [
  { session_record_id: INSTANCE_ID, role: "initiator", name: "Avery" },
  { session_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan" },
];

interface Case {
  readonly parties: PartyRow[];
  readonly opinions: OpinionRow[];
  readonly counts: { initiator: number; counterparty: number };
}

function rowsWith({ parties, opinions, counts }: Case): FlowInstanceRows {
  return {
    record: {
      id: INSTANCE_ID,
      slug: "stage-test",
      record_type: "assessment",
      status: "draft",
      date: new Date("2026-10-30T12:00:00.000Z"),
      title: template.title,
      summary: "answered by Avery and Rowan",
    },
    items,
    options: [],
    instance: {
      record_id: INSTANCE_ID,
      template_record_id: template.id,
      relationship_id: "relationship-test",
      mode: "basic",
      setting: "soft",
    },
    parties,
    opinions,
    answerCounts: counts,
  };
}

/** The three statuses, each a screen: unclaimed, half-answered, and both submitted. */
const invited = rowsWith({
  parties: [bothParties[0]],
  opinions: [],
  counts: { initiator: 0, counterparty: 0 },
});

const halfAnswered = rowsWith({
  parties: bothParties,
  opinions: answeredBy("initiator"),
  counts: { initiator: items.length, counterparty: 0 },
});

const complete = rowsWith({
  parties: bothParties,
  opinions: [...answeredBy("initiator"), ...answeredBy("counterparty", 2, 5)],
  counts: { initiator: items.length, counterparty: items.length },
});

function render({
  rows,
  invite = null,
}: {
  rows: FlowInstanceRows;
  invite?: Parameters<typeof projectScreen>[0]["invite"];
}): string {
  const screen = projectScreen({ rows, template, viewerRole: "initiator", invite });
  return renderToStaticMarkup(
    createElement(AssessmentInstanceView, {
      screen,
      copy: assessmentInstancePageCopy,
    }),
  );
}

const INVITE = {
  email: "rowan@example.com",
  counterpartyName: "Rowan",
  expiresAt: "2026-11-06T12:00:00.000Z",
  state: "unclaimed" as const,
  // #275 — the re-invite's own facts. This fixture is about the stage sentence, so the
  // invitation has never been re-sent; the panel's budget sentence is `invite-expiry.test.ts`.
  resentAt: null,
  resentCount: 0,
  link: "http://localhost:3000/invite/token",
};

describe("relationshipStage", () => {
  it("maps the three statuses onto the first three stages of the ladder", () => {
    expect([
      relationshipStage("awaiting_counterparty"),
      relationshipStage("answering"),
      relationshipStage("complete"),
    ]).toEqual(["invited", "connected", "sharing"]);
    expect(FLOW_STAGES.map((stage) => STAGE_LABELS[stage])).toEqual([
      "Invited",
      "Connected",
      "Sharing",
    ]);
  });

  it("cannot return aligned — the verdict belongs to the report, not to a step", () => {
    // The type says so (`FlowStage` excludes it); this is the runtime half of the same rule.
    expect(FLOW_STAGES).not.toContain("aligned");
    for (const status of ["awaiting_counterparty", "answering", "complete"] as const) {
      expect(relationshipStage(status)).not.toBe("aligned");
    }
  });

  it("picks the expired sentence only for an invitation that has expired", () => {
    expect(stageCopyId("invited", "unclaimed")).toBe("invited");
    expect(stageCopyId("invited", "expired")).toBe("invited-expired");
    // A claimed invitation is Connected's business; an expiry never rewrites a later stage.
    expect(stageCopyId("connected", "expired")).toBe("connected");
    expect(stageCopyId("sharing", null)).toBe("sharing");
  });
});

describe("the rendered stage sentence", () => {
  it("says Invited, and names who is being waited for", () => {
    const html = render({ rows: invited, invite: INVITE });
    expect(html).toContain('data-stage="invited"');
    expect(html).toContain("Invited — waiting for Rowan to accept the invitation.");
  });

  it("says the invitation expired when it has, rather than still waiting", () => {
    const html = render({ rows: invited, invite: { ...INVITE, state: "expired", link: null } });
    expect(html).toContain('data-stage="invited"');
    expect(html).toContain(
      "Invited — the invitation to Rowan has expired, so they cannot accept it.",
    );
    expect(html).not.toContain("waiting for Rowan to accept");
  });

  it("says Connected while only one side has submitted, and names who owes", () => {
    const html = render({ rows: halfAnswered });
    expect(html).toContain('data-stage="connected"');
    expect(html).toContain("Connected — Rowan still to answer.");
  });

  it("says Sharing once both have submitted, and leaves Aligned to the verdict", () => {
    const html = render({ rows: complete });
    expect(html).toContain('data-stage="sharing"');
    expect(html).toContain("Sharing — the report is open to both of you.");
    // This fixture's numbers are not aligned, so the word appears nowhere at all.
    expect(html).not.toContain("Aligned");
  });

  it("draws exactly one stage element, and no stepper of any shape", () => {
    for (const html of [render({ rows: invited, invite: INVITE }), render({ rows: complete })]) {
      expect((html.match(/data-stage=/g) ?? []).length).toBe(1);
      expect(html).not.toMatch(/stepper|step-indicator|usa-step/i);
      expect(html).not.toMatch(/role="progressbar"|aria-current="step"/);
      expect(html).not.toMatch(/>[^<]*\d+\s*%/);
      expect(html).not.toMatch(/<ol[\s>]/);
    }
  });

  it("names nobody's progress: no answered count, no percentage, no partial Gap", () => {
    const html = render({ rows: halfAnswered });
    expect(html).not.toMatch(/answered\s*\d+/i);
    expect(html).not.toMatch(/\d+\s+of\s+\d+/i);
    expect(html).not.toMatch(/\d+\s*%|percent/i);
  });
});
