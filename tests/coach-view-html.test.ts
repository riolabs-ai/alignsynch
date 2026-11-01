/**
 * Renders a coach's unfinished view to a file so the acceptance can paste the literal HTML
 * ("no gap, no count"). The component is the real `AssessmentInstanceView`, rendered with
 * `react-dom/server` the way the page would — this test exists so the coach boundary has one
 * reproducible HTML artifact, not a hand-written snippet.
 *
 * Output path: `$COACH_HTML_OUT` (default `/tmp/coach-view.html`).
 */
import { writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import { AssessmentInstanceView } from "@/components/assessment-flow/instance-view";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { assessments } from "@/data/assessments";
import type { Assessment, PartyRole } from "@/content/assessment";
import type { ItemRow, OpinionRow, PartyRow } from "@/lib/db/rows";
import { projectScreen, type FlowInstanceRows } from "@/lib/flow/screen";

const template = assessments.find((e) => e.id === "assessment-relationship-basics") as Assessment;
const INSTANCE_ID = "instance-coach-html";

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
  { session_record_id: INSTANCE_ID, role: "initiator", name: "Avery" },
  { session_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan" },
];

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

const invite = {
  email: "rowan@example.com",
  counterpartyName: "Rowan",
  expiresAt: "2026-11-06T12:00:00.000Z",
  state: "claimed" as const,
  resentAt: null,
  resentCount: 0,
  link: null,
};

describe("the coach's rendered view", () => {
  it("writes the unfinished coach view (blind — no gap, no answer control)", () => {
    // Only the Initiator has answered: the coach must see the blind state.
    const screen = projectScreen({
      rows: {
        record: {
          id: INSTANCE_ID,
          slug: "relationship-basics-coach",
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
          relationship_id: "relationship-coach-html",
          mode: "basic",
          setting: "soft",
        },
        parties,
        opinions: opinionsFor("initiator"),
        answerCounts: { initiator: items.length, counterparty: 0 },
      } satisfies FlowInstanceRows,
      template,
      viewerRole: "coach",
      invite,
    });

    const markup = renderToStaticMarkup(
      createElement(AssessmentInstanceView, { screen, copy: assessmentInstancePageCopy }),
    );
    const stripped = markup.replace(/<script\b[\s\S]*?<\/script>/gi, "");
    writeFileSync(process.env.COACH_HTML_OUT ?? "/tmp/coach-view.html", stripped);
  });
});
