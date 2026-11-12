/**
 * Stage 6, **Align** — the Alignment, Aspect by Aspect (#692, named by #735).
 *
 * The issue's acceptance is a claim about a surface a person reaches, so the cases below render the
 * real `AssessmentInstanceView` over a real `projectScreen()` projection and read the markup:
 *
 *   reach      the completed relationship draws the Alignment band, and the band links to the
 *              report the app already has (`reportPath()`), so the per-Gap tables are one click
 *              from the relationship rather than a second, orphaned route;
 *   sheets     both parties' own answers are drawn, per party and per Opinion kind — the value
 *              each seat gave, not a summary of them;
 *   difference every Gap the Aspect has prints **the two Opinions it subtracts** beside the number;
 *   verdict    the per-Aspect word and the relationship's count come from `gapMeetsSetting()` and
 *              `instanceAlignment()`'s single `unmet` list, so they cannot disagree;
 *   no-metric  nothing on the band is a total, an average or a composite — `docs/specs/ux-report.md`
 *              names the grep as the acceptance, so the test runs the same one;
 *   blind      before both seats accept there is no band at all: not an empty one, not a hidden one.
 *
 * No database and no server: the rows are `lib/db/rows.ts` shapes, exactly as
 * `tests/instance-stage.test.ts` builds them.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssessmentInstanceView } from "@/components/assessment-flow/instance-view";
import type { Assessment, PartyRole } from "@/content/assessment";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { assessments } from "@/data/assessments";
import type { ItemRow, OpinionRow, PartyRow } from "@/lib/db/rows";
import { reportPath } from "@/lib/flow/paths";
import { projectScreen, type FlowInstanceRows } from "@/lib/flow/screen";

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the alignment test's template fixture is missing");
  return found;
})();

const INSTANCE_ID = "instance-alignment-view";
const ACCEPTED_AT = new Date("2026-11-08T09:00:00.000Z");
const ASPECTS = template.items.length;
/** The Aspect the two seats disagree on: Feel 2 against Feel 5 is a Gap of 3. */
const TIME = template.items[0]?.id ?? "";

const items: ItemRow[] = template.items.map((item, position) => ({
  record_id: INSTANCE_ID,
  item_id: item.id,
  position,
  prompt: item.prompt,
  scale_kind: "score",
  left_value: item.leftValue,
  right_value: item.rightValue,
}));

const parties: PartyRow[] = [
  { session_record_id: INSTANCE_ID, role: "initiator", name: "Avery", accepted_at: ACCEPTED_AT },
  { session_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan", accepted_at: ACCEPTED_AT },
];

/**
 * One opinion row per Aspect. Only the `feel` score moves: the Initiator says 2 on the first
 * Aspect and 4 on the rest, the Counterparty says 5 then 4, so exactly one Gap of 3 exists and
 * every other Gap on every Aspect is 0.
 */
function opinionsFor(role: PartyRole): OpinionRow[] {
  return template.items.map((item, position) => ({
    session_record_id: INSTANCE_ID,
    role,
    item_id: item.id,
    feel: role === "initiator" ? (position === 0 ? 2 : 4) : position === 0 ? 5 : 4,
    wish: 4,
    think: null,
    guess: null,
  }));
}

function screenWith(answered: { initiator: number; counterparty: number }) {
  const rows: FlowInstanceRows = {
    record: {
      id: INSTANCE_ID,
      slug: "relationship-basics-alignment",
      record_type: "assessment",
      status: "draft",
      date: new Date("2026-11-08T09:00:00.000Z"),
      title: template.title,
      summary: "answered by Avery and Rowan",
    },
    items,
    options: [],
    instance: {
      record_id: INSTANCE_ID,
      template_record_id: template.id,
      relationship_id: "relationship-alignment",
      mode: "basic",
      setting: "soft",
    },
    parties,
    opinions: [
      ...(answered.initiator === 0 ? [] : opinionsFor("initiator")),
      ...(answered.counterparty === 0 ? [] : opinionsFor("counterparty")),
    ],
    answerCounts: answered,
  };
  return projectScreen({ rows, template, viewerRole: "initiator", invite: null });
}

const complete = screenWith({ initiator: ASPECTS, counterparty: ASPECTS });
const html = renderToStaticMarkup(
  createElement(AssessmentInstanceView, {
    screen: complete,
    copy: assessmentInstancePageCopy,
  }),
);

const count = (needle: string): number => html.split(needle).length - 1;

describe("stage 6 — the Alignment, Aspect by Aspect", () => {
  it("is drawn on the completed relationship, one row per Aspect", () => {
    expect(complete.status).toBe("complete");
    expect(html).toContain('data-alignment="true"');
    expect(count("data-alignment-aspect=")).toBe(ASPECTS);
    // The heading is the fixture's, not a literal in the component.
    expect(html).toContain(">Alignment<");
  });

  it("draws both parties' own answers, per party and per Opinion kind", () => {
    expect(count('data-alignment-sheet="initiator"')).toBe(ASPECTS);
    expect(count('data-alignment-sheet="counterparty"')).toBe(ASPECTS);
    // The two seats' values are theirs: Avery's Feel 2 and Rowan's Feel 5 are both on the page,
    // and the sheets carry the party they belong to rather than a position in a grid.
    expect(html).toContain('data-alignment-sheet-party="Avery"');
    expect(html).toContain('data-alignment-sheet-party="Rowan"');
    expect(html).toContain('data-alignment-opinion="feel" data-alignment-value="2"');
    expect(html).toContain('data-alignment-opinion="feel" data-alignment-value="5"');
    // A Basic instance asks two Opinions, so the sheet carries two and never a prediction kind.
    expect(html).not.toContain('data-alignment-opinion="think"');
  });

  it("states the difference per Aspect, with the two Opinions behind it", () => {
    const row = complete.report?.rows.find((entry) => entry.itemId === TIME);
    expect(row?.left.opinions.feel).toBe(2);
    expect(row?.right.opinions.feel).toBe(5);
    expect(row?.gaps.feel).toBe(3);
    expect(row?.gaps.wish).toBe(0);

    // The row names the Gap, prints the pair it subtracts, and then the number.
    expect(html).toContain('data-alignment-gap-kind="feel"');
    expect(html).toContain('data-alignment-side="feel"');
    expect(html).toContain('data-alignment-gap="3"');
    // A 0 prints the glossary's word beside the number rather than replacing it.
    expect(html).toContain('data-alignment-gap="0"');
    expect(html).toContain("In Synch");
    // The four basic kinds, one row each, on every Aspect.
    expect(html).toContain('data-alignment-gaps="4"');
  });

  it("derives the verdict from the one unmet list, per Aspect and for the relationship", () => {
    const measured = ASPECTS * 4;
    // Two Gaps on the one Aspect are over Soft's tolerance of 1: Feel 2 against Feel 5 is a Gap
    // of 3, and the Initiator Gap compares a Feel 2 with a Wish 4 — the glossary's own pairs, not
    // what a reader would guess they are.
    expect(complete.report?.verdict.aligned).toBe(false);
    expect(complete.report?.verdict.unmet).toHaveLength(2);
    expect(html).toContain('data-alignment-verdict="unmet"');
    expect(html).toContain(`data-alignment-unmet-gaps="2"`);
    expect(html).toContain(`data-alignment-measured-gaps="${measured}"`);
    // One Aspect over the line, the rest inside it — the chip is a derived word, not a score.
    expect(count('data-alignment-aspect-verdict="unmet"')).toBe(1);
    expect(count('data-alignment-aspect-verdict="aligned"')).toBe(ASPECTS - 1);
    expect(html).toContain('data-alignment-unmet="2"');
    expect(html).toContain(">Aligned<");
  });

  it("links to the report the app already has", () => {
    expect(html).toContain('data-alignment-report="true"');
    expect(html).toContain(`href="${reportPath(INSTANCE_ID)}"`);
    expect(reportPath(INSTANCE_ID)).toBe(`/assessment/instances/${INSTANCE_ID}/report`);
  });

  it("shows no total, average or composite metric", () => {
    // The acceptance `docs/specs/ux-report.md` writes, run against the rendered page: the
    // artifact's "Total Gap" foot is deliberately not built.
    expect(html).not.toMatch(/total gap|average gap|overall score|compatibility/i);
    // Nor the v1 report's own row attributes — this is the flow's surface, not a second copy.
    expect(html).not.toContain("data-feel-gap");
  });

  it("draws nothing before both seats have accepted", () => {
    const blind = screenWith({ initiator: ASPECTS, counterparty: ASPECTS });
    expect(blind.report).not.toBeNull();
    const answering = screenWith({ initiator: ASPECTS, counterparty: 0 });
    expect(answering.status).toBe("answering");
    expect(answering.report).toBeNull();
    const markup = renderToStaticMarkup(
      createElement(AssessmentInstanceView, {
        screen: answering,
        copy: assessmentInstancePageCopy,
      }),
    );
    expect(markup).not.toContain("data-alignment=");
    expect(markup).not.toContain("data-alignment-gap");
  });
});
