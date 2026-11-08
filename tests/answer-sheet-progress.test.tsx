/**
 * One progress pattern on the answer screen, and it is the cell rail (#716, C2 of #714).
 *
 * Rule 4 of `docs/specs/ux-reference-patterns.md` is a rule about *every* multi-step surface: it
 * shows progress at the top of its block — the bar for uniform quiz items, the cell rail for
 * distinct form stages, **never both and never numbered circles**. `/answer` drew neither, which
 * is the gap this card closes: the sheet is the counterparty's half of the journey the create and
 * sent stages already draw, so it mounts the same rail at stage 6 (`Align`).
 *
 * The claim is a count, not an adjective. For every state the gate can pick — the live form, the
 * sealed sheet, a lapsed membership and the coach band — the rendered markup carries:
 *
 *   exactly one  element marked `data-progress`, and it is the cell rail;
 *   six cells    one per approved stage name, the current one carrying `aria-current="step"`, and
 *                the position said in words underneath ("Stage 6 of 6");
 *   zero others  no `<progress`/`<meter`/`role="progressbar"`, no `<ol>` and no numbered circle —
 *                the three things rule 4 forbids beside it.
 *
 * The route half is a source fact, because the page needs Postgres to mount: it renders
 * `StageColumn` and centres nothing of its own, so the block's left edge is the one every stage of
 * the journey uses. `tests/stage-shell.test.tsx` pins the same column for the create screens.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnswerSheet } from "@/components/assessment-flow/answer-sheet";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import { assessmentAnswerPageCopy } from "@/data/pages/assessment-answer";
import { lifecycleStageSection } from "@/data/pages/lifecycle";
import type { AnswerGate } from "@/lib/flow/answer-gate";
import type { FlowAspect } from "@/lib/flow/screen";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const INSTANCE_ID = "instance-answer-progress-test";

/** The six approved names, in order — the spec's own words (`data/pages/lifecycle.ts`). */
const STAGE_NAMES = ["Details", "Settings", "Aspects", "Invite", "Connect", "Align"];

/** The stage answering belongs to: the sixth, `Align`. */
const ANSWER_STAGE = 6;

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

describe("the answer screen shows exactly one progress pattern", () => {
  for (const { name, gate } of GATES) {
    it(`draws one progress element on the ${name} shape, and it is the rail`, () => {
      const html = render(gate);
      expect(count(html, "data-progress="), `${name}: one progress element`).toBe(1);
      expect(count(html, 'data-progress="cell-rail"')).toBe(1);
    });

    it(`draws no progress bar and no numbered list on the ${name} shape`, () => {
      const html = render(gate);
      // The three forms rule 4 forbids beside the rail: the 8px bar, a `<progress>`/`<meter>`
      // element, and the numbered `<ol>` of circles the rail carried before this card.
      expect(html).not.toContain("<progress");
      expect(html).not.toContain("<meter");
      expect(html).not.toContain('role="progressbar"');
      expect(html).not.toContain("aria-valuenow");
      expect(html).not.toContain("<ol");
      expect(html).not.toContain("rounded-full");
    });
  }

  it("marks stage 6 of 6 as current, and says the position in words", () => {
    const html = render(GATES[0].gate);
    const start = html.indexOf("<nav");
    expect(start, "the rail is rendered").toBeGreaterThan(-1);
    const rail = html.slice(start, html.indexOf("</nav>", start));

    expect(rail).toContain('aria-label="Relationship lifecycle"');
    expect(rail).toContain(`data-wizard-rail="${ANSWER_STAGE}"`);
    // Six cells, one per stage, and exactly one of them current.
    expect(count(rail, "data-step-cell=")).toBe(STAGE_NAMES.length);
    expect(count(rail, 'aria-current="step"')).toBe(1);
    expect(count(rail, 'data-step-state="current"')).toBe(1);
    expect(count(rail, 'data-step-state="done"')).toBe(STAGE_NAMES.length - 1);
    for (const stage of STAGE_NAMES) expect(rail).toContain(stage);
    // Readable in words at 390, where the cells are too narrow to carry a numeral anyway.
    expect(html).toContain(`Stage ${ANSWER_STAGE} of ${STAGE_NAMES.length}`);
  });

  it("keeps the option rows at their 44px targets", () => {
    // The rail must not have bought its space out of the control's: every notch is still a
    // 44×44 target (SC 2.5.8's floor is 24; this repo ships 44).
    const html = render(GATES[0].gate);
    expect(count(html, "min-h-[44px] min-w-[44px]")).toBe(ASPECTS.length * 2 * 5);
  });
});

describe("the stage names are the fixture's, not a seventh word", () => {
  it("references the shared lifecycle section rather than re-typing the six names", () => {
    const stages = sectionOf(assessmentAnswerPageCopy, "stages");
    expect(stages).toStrictEqual(lifecycleStageSection);
    expect(
      stages.items?.filter((item) => /^[1-6]$/.test(item.id)).map((item) => item.label),
    ).toEqual(STAGE_NAMES);
    expect(itemLabel(stages, "count")).toBe("Stage {step} of 6");
    // The rail's words never appear in the component: the view reads ids, the fixture owns copy.
    expect(code("components/assessment-flow/answer-sheet.tsx")).not.toContain('"Ongoing"');
  });

  it("mounts the shipped rail rather than a second stepper", () => {
    const file = code("components/assessment-flow/answer-sheet.tsx");
    expect(file).toContain('from "./stage-rail"');
    expect(file).toContain("<StageRail copy={copy} current={ANSWER_STAGE} />");
    // One mount per state, and no second rail of its own.
    expect(count(file, "<StageRail")).toBe(2);
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
