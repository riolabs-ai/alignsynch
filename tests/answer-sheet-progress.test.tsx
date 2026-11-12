/**
 * The answer screen draws **no progress band at all** (#716, reversed by #825).
 *
 * Rule 4 of `docs/specs/ux-reference-patterns.md` is a rule about every multi-step surface: it
 * shows progress at the top of its block. #716 read that as "the answer sheet mounts the create
 * flow's rail at stage 6"; #825 took `Align` out of the flow — it is the dashboard's surface, not
 * the sixth cell of a create modal — and with it the reason a band was on this screen. A rail here
 * would say `Stage 5 of 5 · Invite` over a screen nobody is inviting anybody from.
 *
 * So the claim is still a count, and it is now zero. For every state the gate can pick — the live
 * form, the sealed sheet, a lapsed membership and the coach band — the rendered markup carries:
 *
 *   zero bands   no `data-progress`, no `data-wizard-rail`, no `<nav>`;
 *   zero others  no `<progress`/`<meter`/`role="progressbar"`, no `<ol>` and no numbered circle;
 *   in words     the relationship's own position is said by `stageCopyId()` (a sentence), which is
 *                what `tests/flow-stages.test.ts` covers on the stage fixture.
 *
 * The route half stays a source fact, because the page needs Postgres to mount: it renders
 * `StageColumn` and centres nothing of its own, so the block's left edge is the one every stage of
 * the journey uses.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnswerSheet } from "@/components/assessment-flow/answer-sheet";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import { assessmentAnswerPageCopy } from "@/data/pages/assessment-answer";
import type { AnswerGate } from "@/lib/flow/answer-gate";
import type { FlowAspect } from "@/lib/flow/screen";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const INSTANCE_ID = "instance-answer-progress-test";

/**
 * The five approved names, in order — the spec's own words (`data/pages/lifecycle.ts`, #825).
 * Read here only so a stale word in the answer fixture would be caught: the sheet does not draw
 * them.
 */
const STAGE_NAMES = ["Details", "Settings", "Aspects", "Account", "Invite"];

/** Two Aspects, unanswered — enough to draw the sheet's bands without inventing answers. */
const ASPECTS: readonly FlowAspect[] = [
  {
    itemId: "aspect-time-together",
    prompt: "Time together",
    leftValue: "Apart",
    rightValue: "Together",
    min: SCORE_MIN,
    max: SCORE_MAX,
    own: null,
  },
  {
    itemId: "aspect-shared-decisions",
    prompt: "Shared decisions",
    leftValue: "Solo",
    rightValue: "Joint",
    min: SCORE_MIN,
    max: SCORE_MAX,
    own: null,
  },
];

/** The four shapes one answer URL can draw (#427 + #533 phase 3). */
const GATES: readonly { readonly name: string; readonly gate: AnswerGate }[] = [
  {
    name: "sheet",
    gate: {
      state: "sheet",
      role: "counterparty",
      action: `/assessment/instances/${INSTANCE_ID}/answers`,
      answered: 0,
      aspects: ASPECTS.length,
    },
  },
  {
    name: "readonly",
    gate: {
      state: "readonly",
      role: "counterparty",
      action: null,
      answered: ASPECTS.length,
      aspects: ASPECTS.length,
    },
  },
  {
    name: "lapsed",
    gate: {
      state: "lapsed",
      role: "initiator",
      action: null,
      answered: 0,
      aspects: ASPECTS.length,
    },
  },
  {
    name: "coach",
    gate: { state: "coach", role: null, action: null, answered: 0, aspects: ASPECTS.length },
  },
];

/** The sheet as a browser receives it. */
function render(gate: AnswerGate): string {
  return renderToStaticMarkup(
    createElement(AnswerSheet, {
      copy: assessmentAnswerPageCopy,
      aspects: ASPECTS,
      gate,
      viewer:
        gate.state === "coach"
          ? { role: "coach", name: "" }
          : { role: gate.role ?? "initiator", name: "Rowan" },
      mode: "basic",
      backHref: `/assessment/instances/${INSTANCE_ID}`,
    }),
  );
}

/** How many times a marked substring occurs — the count the acceptance is about. */
function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

/** The code of a file, without its comments: a docstring describing a pattern is not the pattern. */
function code(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("the answer screen draws no progress band", () => {
  for (const { name, gate } of GATES) {
    it(`draws no progress element on the ${name} shape`, () => {
      const html = render(gate);
      expect(count(html, "data-progress="), `${name}: no progress element`).toBe(0);
      expect(html).not.toContain("data-wizard-rail");
      expect(html).not.toContain("<nav");
      // And no second pattern standing in for it.
      expect(html).not.toContain("<progress");
      expect(html).not.toContain("<meter");
      expect(html).not.toContain('role="progressbar"');
      expect(html).not.toContain("aria-valuenow");
      expect(html).not.toContain("<ol");
      expect(html).not.toContain("rounded-full");
    });
  }

  it("keeps the option rows at their 44px targets", () => {
    // Losing the band must not have bought space out of the control's: every notch is still a
    // 44×44 target (SC 2.5.8's floor is 24; this repo ships 44).
    const html = render(GATES[0].gate);
    expect(count(html, "min-h-[44px] min-w-[44px]")).toBe(ASPECTS.length * 2 * 5);
  });
});

describe("the sheet mounts no rail, and the names stay the fixture's", () => {
  it("references the shared lifecycle section rather than re-typing the names", () => {
    const stages = sectionOf(assessmentAnswerPageCopy, "stages");
    expect(
      stages.items?.filter((item) => /^[1-5]$/.test(item.id)).map((item) => item.label),
    ).toEqual(STAGE_NAMES);
    expect(itemLabel(stages, "count")).toBe("Stage {step} of 5");
    // The rail's words never appear in the component: the view reads ids, the fixture owns copy.
    expect(code("components/assessment-flow/answer-sheet.tsx")).not.toContain('"Ongoing"');
  });

  it("imports no stepper at all", () => {
    const file = code("components/assessment-flow/answer-sheet.tsx");
    expect(file).not.toContain("./stage-rail");
    expect(file).not.toContain("<StageRail");
    expect(file).not.toContain("WizardSteps");
  });
});

describe("the answer page sits in the flow's own column", () => {
  const PAGE = "app/(mainlayout)/assessment/instances/[instanceId]/answer/page.tsx";

  it("renders StageColumn and centres nothing of its own", () => {
    const page = code(PAGE);
    expect(page).toContain('from "@/components/assessment-flow/stage-column"');
    expect(page).toContain("<StageColumn>");
    expect(page).toContain("</StageColumn>");
    expect(page).not.toContain("mx-auto");
    expect(page).not.toContain("max-w-3xl");
  });
});
