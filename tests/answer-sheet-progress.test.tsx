/**
 * The answer screen's progress is the bundle's own bar — and it is not a rail (#716 → #825 → #1128).
 *
 * Three decisions stack here, and this suite is where they are read in order:
 *
 *   #716  a multi-step surface shows progress at the top of its block (`docs/specs/
 *         ux-reference-patterns.md` rule 4).
 *   #825  `Align` left the create flow, so the shared **rail** — six cells, `Stage n of 5` —
 *         came off this screen: it numbered a flow nobody invites anybody from.
 *   #1128 the v2 answer surface is **paged**: one Aspect at a time, with the bundle's own progress
 *         (`Round 1 · Aspect 3 of 5` and a five-segment bar, `assessment.html`). That is rule 4's
 *         progress, not #825's rail, and the two are different claims this suite keeps apart.
 *
 * So: a segmented bar and the position sentence are required; a rail, a `<nav>`, a wizard stepper,
 * a `<progress>`/`<meter>` element and a `role="progressbar"` are still forbidden. The page half
 * stays a source fact — it renders `StageColumn` and centres nothing of its own.
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
import { positionOf } from "@/lib/flow/answer-position";
import type { FlowAspect } from "@/lib/flow/screen";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const INSTANCE_ID = "session-answer-progress-test";

/**
 * The five approved names, in order — the spec's own words (`data/pages/lifecycle.ts`, #825).
 * Read here only so a stale word in the answer fixture would be caught: the sheet does not draw
 * them.
 */
const STAGE_NAMES = ["Details", "Settings", "Aspects", "Account", "Invite"];

/** Five Aspects, none answered — yesterday's two-aspect fixture, at the v2 surface's own count. */
const ASPECTS: readonly FlowAspect[] = Array.from({ length: 5 }, (_, index) => ({
  itemId: `aspect-${index + 1}`,
  prompt: `Aspect ${index + 1}`,
  leftValue: "Apart",
  rightValue: "Together",
  min: SCORE_MIN,
  max: SCORE_MAX,
  own: null,
}));

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
      sheetPath: `/assessment/instances/${INSTANCE_ID}/answer`,
      draftAction: `/assessment/instances/${INSTANCE_ID}/answers/draft`,
      answersAction: `/assessment/instances/${INSTANCE_ID}/answers`,
      otherName: "Avery",
      position: positionOf(ASPECTS, undefined),
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

describe("the answer screen's progress is the bundle's bar", () => {
  it("draws the position sentence and one segment per Aspect on the live sheet", () => {
    const html = render(GATES[0].gate);
    expect(html).toContain("Round 1 · Aspect 1 of 5");
    expect(count(html, "data-qbar=")).toBe(ASPECTS.length);
    expect(html).toContain('data-state="current"');
    expect(html).toContain('data-saved-state="idle"');
  });

  it("never draws the create flow's rail, or a second progress element", () => {
    for (const { name, gate } of GATES) {
      const html = render(gate);
      expect(count(html, "data-progress="), `${name}: no progress element`).toBe(0);
      expect(html).not.toContain("data-wizard-rail");
      expect(html).not.toContain("<nav");
      expect(html).not.toContain("<progress");
      expect(html).not.toContain("<meter");
      expect(html).not.toContain('role="progressbar"');
      expect(html).not.toContain("aria-valuenow");
    }
  });

  it("keeps the option cells at the bundle's own height on the way down", () => {
    // The v2 band is h-14 (56 px) with lg:h-12 (48 px) — both over SC 2.5.8's 24 px floor and the
    // 44 px touch guidance. Losing the old 44 px class must not have shrunk the target.
    const html = render(GATES[0].gate);
    expect(count(html, "h-14")).toBeGreaterThanOrEqual(ASPECTS.length * 2);
    expect(html).toContain("lg:h-12");
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
