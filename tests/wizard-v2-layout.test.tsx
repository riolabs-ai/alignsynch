/**
 * The v2 wizard's rail, gauge, progress line and stage frame — what they draw, and what they refuse
 * to draw (#1123).
 *
 * These four components are presentational: every word is a prop, and the only facts they own are
 * geometry and state. That makes a rendered-string test the right instrument for once — there is no
 * interaction to drive, so the assertion is about which element exists and which attribute it
 * carries:
 *
 *   - the gauge draws **five** segments and no sixth, and the states follow `step` rather than a
 *     second list that could disagree with it;
 *   - the rail draws **five cells and one preview**, and the preview is *not* a cell — a sixth row
 *     that took a `data-step-cell` would be a sixth stage, which `docs/specs/flow-stages.md` says
 *     does not exist;
 *   - only a reached stage is an `<a href>`: a link to a screen the person cannot finish is a trap
 *     in markup that no screenshot shows;
 *   - the stage frame's title is the focus target `StageTitleFocus` names, so it must keep its id,
 *     its `tabindex="-1"` and be an `<h2>`.
 *
 * The fixture is local and literal on purpose. These components take resolved strings, so a test
 * that imported a page fixture would be testing the fixture; what has to be true here is that the
 * string handed in is the string rendered.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FlowStageCard } from "@/components/assessment-flow/flow-stage-card";
import { StageGauge } from "@/components/assessment-flow/stage-gauge";
import { WizardProgress } from "@/components/assessment-flow/wizard-progress";
import { WizardRail, type WizardRailStep } from "@/components/assessment-flow/wizard-rail";

/** The strings a stage-3 screen hands these components, resolved. */
const FIXTURE = {
  count: "Stage 3 of 5",
  name: "Aspects",
  alignNote: "Stage 6 Align starts when Elena joins",
  railLabel: "Setup progress",
  alignPreviewLabel: "Align",
  alignPreviewNote: "Starts when Elena joins",
  summaryHeading: "Your Relationship",
  summary: [
    { label: "With", value: "Elena Marsh" },
    { label: "Type", value: "Performance review" },
  ],
  eyebrow: "Stage 3",
  title: "Aspects",
  purpose: "Choose what this relationship is judged on.",
  childText: "Aspect list goes here",
} as const;

/** Steps 1–2 reached (and linked), 3 current, 4–5 later — the shape of a stage-3 screen. */
const STEPS: readonly WizardRailStep[] = [
  { step: 1, label: "Details", state: "done", statusLabel: "Done", href: "/create/1" },
  { step: 2, label: "Settings", state: "done", statusLabel: "Done", href: "/create/2" },
  { step: 3, label: "Aspects", state: "current", statusLabel: "In Progress" },
  { step: 4, label: "Account", state: "later", statusLabel: "Later" },
  { step: 5, label: "Invite", state: "later", statusLabel: "Later" },
];

/** Every `(segment, state)` pair the gauge rendered, in document order. */
function gaugeSegments(html: string): [string, string][] {
  return [...html.matchAll(/data-gauge-segment="(\d+)"\s+data-gauge-state="([^"]+)"/g)].map(
    (match) => [match[1] as string, match[2] as string],
  );
}

/** Every `(bar, state)` pair the progress line rendered, in document order. */
function progressBars(html: string): [string, string][] {
  return [...html.matchAll(/data-progress-bar="(\d+)"\s+data-progress-state="([^"]+)"/g)].map(
    (match) => [match[1] as string, match[2] as string],
  );
}

const occurrences = (html: string, needle: string): number => html.split(needle).length - 1;

describe("the v2 wizard rail, gauge and stage frame", () => {
  it("draws five gauge segments at step 3: two done, the current one, two later", () => {
    const html = renderToStaticMarkup(
      createElement(StageGauge, {
        step: 3,
        count: FIXTURE.count,
        name: FIXTURE.name,
        alignNote: FIXTURE.alignNote,
      }),
    );

    expect(occurrences(html, "data-gauge-segment=")).toBe(5);
    expect(gaugeSegments(html)).toEqual([
      ["1", "done"],
      ["2", "done"],
      ["3", "current"],
      ["4", "later"],
      ["5", "later"],
    ]);
    expect(html).toContain('data-stage-gauge="3"');
  });

  it("carries the count, the name and the Align note in the image's accessible name", () => {
    const html = renderToStaticMarkup(
      createElement(StageGauge, {
        step: 3,
        count: FIXTURE.count,
        name: FIXTURE.name,
        alignNote: FIXTURE.alignNote,
      }),
    );

    expect(html).toContain('role="img"');
    const label = /<svg[^>]*aria-label="([^"]*)"/.exec(html)?.[1] ?? "";
    expect(label).toContain(FIXTURE.count);
    expect(label).toContain(FIXTURE.name);
    expect(label).toContain(FIXTURE.alignNote);
    // The dashed outer arc is the one arc that never changes state.
    expect(html).toContain('stroke-dasharray="4 6"');
  });

  it("draws five step cells and exactly one Align preview, and the preview is not a cell", () => {
    const html = renderToStaticMarkup(
      createElement(WizardRail, {
        label: FIXTURE.railLabel,
        steps: STEPS,
        count: FIXTURE.count,
        name: FIXTURE.name,
        alignNote: FIXTURE.alignNote,
        alignPreviewLabel: FIXTURE.alignPreviewLabel,
        alignPreviewNote: FIXTURE.alignPreviewNote,
        summaryHeading: FIXTURE.summaryHeading,
        summary: FIXTURE.summary,
      }),
    );

    expect(occurrences(html, "data-step-cell=")).toBe(5);
    expect(occurrences(html, "data-align-preview=")).toBe(1);

    const preview = /<li[^>]*data-align-preview="true"[\s\S]*?<\/li>/.exec(html)?.[0] ?? "";
    expect(preview).toContain(FIXTURE.alignPreviewLabel);
    expect(preview).not.toContain("data-step-cell");
    // The sixth row is drawn, and it is not a step: five cells is the whole band.
    expect(html).toContain(FIXTURE.alignPreviewNote);
  });

  it("links only the reached steps and marks the current one with aria-current", () => {
    const html = renderToStaticMarkup(
      createElement(WizardRail, {
        label: FIXTURE.railLabel,
        steps: STEPS,
        count: FIXTURE.count,
        name: FIXTURE.name,
        alignNote: FIXTURE.alignNote,
        alignPreviewLabel: FIXTURE.alignPreviewLabel,
        alignPreviewNote: FIXTURE.alignPreviewNote,
        summaryHeading: FIXTURE.summaryHeading,
        summary: FIXTURE.summary,
      }),
    );

    // steps 1 and 2 are `done` and carry hrefs; 3–5 carry none, so they render as spans.
    expect(occurrences(html, "<a href=")).toBe(2);
    expect(html).toContain('href="/create/1"');
    expect(html).toContain('href="/create/2"');
    expect(occurrences(html, 'aria-current="step"')).toBe(1);
    expect(html).toMatch(/data-step-cell="3" data-step-state="current" aria-current="step"/);
  });

  it("renders every step label and the relationship summary", () => {
    const html = renderToStaticMarkup(
      createElement(WizardRail, {
        label: FIXTURE.railLabel,
        steps: STEPS,
        count: FIXTURE.count,
        name: FIXTURE.name,
        alignNote: FIXTURE.alignNote,
        alignPreviewLabel: FIXTURE.alignPreviewLabel,
        alignPreviewNote: FIXTURE.alignPreviewNote,
        summaryHeading: FIXTURE.summaryHeading,
        summary: FIXTURE.summary,
      }),
    );

    for (const step of STEPS) expect(html).toContain(`>${step.label}<`);
    for (const step of STEPS) expect(html).toContain(`data-step-status="${step.step}"`);
    expect(html).toContain(`aria-label="${FIXTURE.railLabel}"`);
    expect(html).toContain(FIXTURE.summaryHeading);
    for (const row of FIXTURE.summary) {
      expect(html).toContain(`>${row.label}<`);
      expect(html).toContain(`>${row.value}<`);
    }
  });

  it("draws the narrow progress line at step 2: one done, the current bar, three later", () => {
    const html = renderToStaticMarkup(
      createElement(WizardProgress, {
        step: 2,
        count: FIXTURE.count,
        name: FIXTURE.name,
        alignNote: FIXTURE.alignNote,
      }),
    );

    expect(occurrences(html, "data-progress-bar=")).toBe(5);
    expect(progressBars(html)).toEqual([
      ["1", "done"],
      ["2", "current"],
      ["3", "later"],
      ["4", "later"],
      ["5", "later"],
    ]);
    expect(html).toContain('data-wizard-progress="true"');
    expect(html).toContain(FIXTURE.count);
    expect(html).toContain(FIXTURE.name);
  });

  it("frames a stage with its eyebrow, a focusable title, its purpose and its children", () => {
    // React 19's types make `children` part of the props type, so it is built as an object rather
    // than passed as `createElement`'s third argument (which that overload now refuses).
    const props = {
      stage: 3,
      eyebrow: FIXTURE.eyebrow,
      title: FIXTURE.title,
      purpose: FIXTURE.purpose,
      children: createElement("p", null, FIXTURE.childText),
    };
    const html = renderToStaticMarkup(createElement(FlowStageCard, props));

    expect(occurrences(html, "data-stage-card=")).toBe(1);
    expect(html).toContain('data-stage-card="3"');
    expect(html).toContain(FIXTURE.eyebrow);
    expect(html).toContain(FIXTURE.purpose);
    expect(html).toContain(FIXTURE.childText);
    // The focus target `StageTitleFocus` names: an h2 with the default id and tabindex="-1".
    expect(html).toContain('<h2 id="stage-3-title" tabindex="-1"');
    expect(html).toContain(FIXTURE.title);
    // No icon passed, so no icon slot is drawn.
    expect(html).not.toContain("aria-hidden");
  });

  it("takes the caller's title id and draws no glyph slot without one", () => {
    const props = {
      stage: 4,
      eyebrow: FIXTURE.eyebrow,
      title: FIXTURE.title,
      purpose: FIXTURE.purpose,
      titleId: "account-title",
      children: createElement("span", null, FIXTURE.childText),
    };
    const html = renderToStaticMarkup(createElement(FlowStageCard, props));

    expect(html).toContain('id="account-title"');
    expect(html).not.toContain('id="stage-4-title"');
  });
});
