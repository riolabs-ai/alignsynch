/**
 * Stage 6, **Align** — the v2 surface (#1122).
 *
 * The issue's acceptance is a claim about a screen a person reaches, so these cases render the
 * real `AssessmentSessionView` over a real `projectScreen()` projection and read the markup:
 *
 *   surface     the completed relationship draws "Where You Agree, and Where You Differ" with the
 *               "Stage 6 · Align" eyebrow, one numbered card per Aspect, and a Feel and a Wish row
 *               on each — the bundle's shape, not the 1.21 Gap table;
 *   re-score    the same numbers read differently under the two tolerances: a 1-step Gap is
 *               "Small Gap · OK" under Soft and "Small Gap · Not OK under Full" under Full, and
 *               the summary counts follow. That is the one thing the toggle changes;
 *   scale       the locked 1–5 cells are all painted (`bg-scale-1…5`), the chosen numbers are
 *               bold and underlined, and the Gap is an outline over the cells between the answers;
 *   no-metric   nothing here is a total, an average or a composite — `docs/specs/ux-report.md`
 *               names the grep as the acceptance, so the test runs the same one;
 *   waiting     before both parties have answered and accepted, the surface draws a **waiting
 *               sentence** and no alignment at all: no counts, no zeroed summary, no bars.
 *
 * No database and no server: the rows are `lib/db/rows.ts` shapes, exactly as
 * `tests/session-stage.test.ts` builds them.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AlignmentView } from "@/components/assessment-flow/alignment-view";
import { AssessmentSessionView } from "@/components/assessment-flow/session-view";
import type { AlignmentSetting, Assessment, PartyRole } from "@/content/assessment";
import { assessmentSessionPageCopy } from "@/data/pages/assessment-instance";
import { assessments } from "@/data/assessments";
import type { ItemRow, OpinionRow, PartyRow } from "@/lib/db/rows";
import { relationshipPath } from "@/lib/flow/paths";
import { projectScreen, type FlowSessionRows } from "@/lib/flow/screen";

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the alignment test's template fixture is missing");
  return found;
})();

const INSTANCE_ID = "session-alignment-view";
const RELATIONSHIP_ID = "relationship-alignment";
const ACCEPTED_AT = new Date("2026-11-08T09:00:00.000Z");
const ASPECTS = template.items.length;
/** The two Aspects the seats disagree on, in template order. */
const STEP_ONE = template.items[0]?.id ?? "";
const STEP_THREE = template.items[1]?.id ?? "";

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
 * One opinion row per Aspect.
 *
 *   Aspect 1   Feel 2 against 3 — a Gap of **1**, the only row the tolerance re-reads
 *   Aspect 2   Feel 2 against 5 — a Gap of **3**, a Gap under either tolerance
 *   the rest   equal answers on both kinds — In Synch
 *   Wish       equal everywhere except Aspect 2, so the Gap above is the widest on the sheet
 */
function opinionsFor(role: PartyRole): OpinionRow[] {
  const feel: Record<number, [number, number]> = {
    0: [2, 3],
    1: [2, 5],
  };
  return template.items.map((item, position) => {
    const pair = feel[position] ?? [4, 4];
    return {
      session_record_id: INSTANCE_ID,
      role,
      item_id: item.id,
      feel: role === "initiator" ? pair[0] : pair[1],
      wish: 4,
      think: null,
      guess: null,
    };
  });
}

function screenWith(
  answered: { initiator: number; counterparty: number },
  setting: AlignmentSetting = "soft",
) {
  const rows: FlowSessionRows = {
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
    session: {
      record_id: INSTANCE_ID,
      template_record_id: template.id,
      relationship_id: RELATIONSHIP_ID,
      mode: "basic",
      setting,
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

const both = { initiator: ASPECTS, counterparty: ASPECTS };
const soft = screenWith(both, "soft");
const full = screenWith(both, "full");

const render = (screen: ReturnType<typeof screenWith>) =>
  renderToStaticMarkup(
    createElement(AssessmentSessionView, { screen, copy: assessmentSessionPageCopy }),
  );

const softHtml = render(soft);
const fullHtml = render(full);

const count = (html: string, needle: string): number => html.split(needle).length - 1;

describe("stage 6 — Where You Agree, and Where You Differ", () => {
  it("is drawn on the completed relationship, one numbered card per Aspect", () => {
    expect(soft.status).toBe("complete");
    expect(softHtml).toContain('data-alignment="true"');
    expect(count(softHtml, "data-alignment-aspect=")).toBe(ASPECTS);
    // The v2 headline and eyebrow are the bundle's copy, not literals in the component.
    expect(softHtml).toContain(">Where You Agree, and Where You Differ<");
    expect(softHtml).toContain(">Stage 6 · Align<");
    // Every Aspect is numbered from 01 in template order.
    for (let position = 1; position <= ASPECTS; position += 1) {
      expect(softHtml).toContain(`>${String(position).padStart(2, "0")}<`);
    }
  });

  it("draws a Feel and a Wish row per Aspect on the locked 1–5 scale", () => {
    expect(count(softHtml, 'data-alignment-row="feel"')).toBe(ASPECTS);
    expect(count(softHtml, 'data-alignment-row="wish"')).toBe(ASPECTS);
    // One marker per party per row, so both answers are attributable on every line.
    expect(count(softHtml, 'data-party-marker="initiator"')).toBe(ASPECTS * 2);
    expect(count(softHtml, 'data-party-marker="counterparty"')).toBe(ASPECTS * 2);
    // The locked cells are painted by name: a dynamic `bg-scale-${n}` would generate no CSS.
    for (const step of [1, 2, 3, 4, 5]) {
      expect(softHtml).toContain(`bg-scale-${step}`);
    }
    // Advanced Mode's prediction rows are not drawn here (#1128 owns that screen).
    expect(softHtml).not.toContain('data-alignment-row="think"');
    expect(softHtml).not.toContain('data-alignment-row="guess"');
  });

  it("draws the Gap as an outline over the cells between the answers", () => {
    const aspect = soft.report?.rows.find((row) => row.itemId === STEP_THREE);
    expect(aspect?.left.opinions.feel).toBe(2);
    expect(aspect?.right.opinions.feel).toBe(5);
    expect(aspect?.gaps.feel).toBe(3);

    // Feel 2 against 5 is a Gap of 3, so the outline spans cells 2..5: 20% in, 80% wide.
    expect(softHtml).toContain('data-alignment-band-gap="3"');
    expect(softHtml).toMatch(/data-alignment-band="gap"[\s\S]{0,600}left:20%;width:80%/);
    // A Gap of 0 outlines the one cell both parties chose, at 20% width.
    expect(softHtml).toMatch(/data-alignment-band="in-synch"[\s\S]{0,600}width:20%/);
  });

  it("re-scores a 1-step Small Gap in place when the tolerance is Full", () => {
    // Soft: one Aspect over the line (the Gap of 3), so ASPECTS-1 align and the 1-step reads OK.
    expect(soft.report?.setting).toBe("soft");
    expect(softHtml).toContain('data-alignment-tolerance="soft"');
    expect(softHtml).toContain(`data-alignment-summary-aligned="${ASPECTS - 1}"`);
    expect(softHtml).toContain(`data-alignment-summary-total="${ASPECTS}"`);
    expect(softHtml).toContain('data-alignment-status="small-gap-ok"');
    expect(softHtml).toContain("Small Gap · OK");
    expect(softHtml).not.toContain("Small Gap · Not OK");

    // Full: the same 1-step Gap keeps its word and its ≈, and takes the Gap's qualifier and
    // colour — one fewer Aspect aligns, and the band is repainted.
    const oneStep = full.report?.rows.find((row) => row.itemId === STEP_ONE);
    expect(oneStep?.left.opinions.feel).toBe(2);
    expect(oneStep?.right.opinions.feel).toBe(3);
    expect(oneStep?.gaps.feel).toBe(1);
    expect(full.report?.setting).toBe("full");
    expect(fullHtml).toContain('data-alignment-tolerance="full"');
    expect(fullHtml).toContain(`data-alignment-summary-aligned="${ASPECTS - 2}"`);
    expect(fullHtml).toContain('data-alignment-status="small-gap-tight"');
    expect(fullHtml).toContain("Small Gap · Not OK under Full");
    expect(fullHtml).toMatch(/data-alignment-band="small-gap-tight"/);
    // The word survives the colour change: "Small Gap" is on the Full render too.
    expect(fullHtml).toContain("Small Gap");
  });

  it("carries its copy from the fixture, and takes one action into the relationship", () => {
    expect(softHtml).toContain(">Alignment Tolerance<");
    expect(softHtml).toContain(">Start the Conversation<");
    expect(softHtml).toContain(">Aspect by Aspect<");
    expect(count(softHtml, "data-alignment-discuss=")).toBe(ASPECTS);
    // The conversation lives on the relationship's own screen, so the action goes there.
    expect(softHtml).toContain(relationshipPath(RELATIONSHIP_ID));
    expect(relationshipPath(RELATIONSHIP_ID)).toBe(`/dashboard/relationships/${RELATIONSHIP_ID}`);
  });

  it("shows no total, average or composite metric", () => {
    // The acceptance `docs/specs/ux-report.md` writes, run against the rendered page.
    expect(softHtml).not.toMatch(/total gap|average gap|overall score|compatibility/i);
    expect(softHtml).not.toContain("data-feel-gap");
  });
});

describe("the waiting state", () => {
  const waiting = screenWith({ initiator: ASPECTS, counterparty: 0 });

  it("never draws an alignment for a sheet that is not finished", () => {
    expect(waiting.status).toBe("answering");
    expect(waiting.report).toBeNull();
    const markup = render(waiting);

    // The page says what it is waiting for, in a sentence, and draws no alignment at all: no
    // zeroed summary, no bar, no chip, no count.
    expect(markup).toContain("Waiting for both answers");
    expect(markup).toContain("Still to answer: Rowan");
    expect(markup).not.toContain('data-alignment="true"');
    expect(markup).not.toContain("data-alignment-summary");
    expect(markup).not.toContain("data-alignment-aspect=");
    expect(markup).not.toContain("data-alignment-band");
    expect(markup).not.toContain("data-alignment-gap");
    expect(markup).not.toMatch(/\d+ of \d+ Aspects Aligned/);
  });

  it("is what the projection says before both seats have accepted", () => {
    // The blind rule is the projection's, not this component's: a party who answered first sees
    // the waiting sentence, never the other party's answers by way of a count.
    expect(waiting.report).toBeNull();
    expect(waiting.viewerAnswered).toBe(ASPECTS);
    expect(waiting.waiting).toEqual(["counterparty"]);
  });
});

describe("the surface in isolation", () => {
  it("draws a waiting sentence, and names the party it is waiting on", () => {
    // Mounted directly — as the page will the moment stage 6 is live before both sheets are in —
    // the band is a sentence rather than an empty one a reader could mistake for a zero.
    const markup = renderToStaticMarkup(
      createElement(AlignmentView, {
        screen: screenWith({ initiator: ASPECTS, counterparty: 0 }),
        copy: assessmentSessionPageCopy,
      }),
    );
    expect(markup).toContain('data-alignment="waiting"');
    expect(markup).toContain('data-alignment-waiting="true"');
    expect(markup).toContain(">Waiting on Rowan<");
    // The surface is still the Align surface — it simply has nothing scored to draw yet.
    expect(markup).toContain(">Where You Agree, and Where You Differ<");
    expect(markup).not.toContain("data-alignment-summary");
    expect(markup).not.toContain("data-alignment-aspect=");
    expect(markup).not.toContain("data-alignment-gap");
  });

  it("draws no zeroed alignment when it is handed no report", () => {
    const markup = renderToStaticMarkup(
      createElement(AlignmentView, {
        screen: screenWith({ initiator: 0, counterparty: 0 }),
        copy: assessmentSessionPageCopy,
      }),
    );
    expect(markup).toContain('data-alignment-waiting="true"');
    expect(markup).not.toContain("data-alignment-band");
    expect(markup).not.toContain("data-alignment-status=");
  });
});
