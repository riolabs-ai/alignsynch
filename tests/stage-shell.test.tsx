/**
 * The onboarding flow's shared shell (#687) — one column, one rail.
 *
 * The card's acceptance is a rule about *every* stage, not a fact about one screen: the six
 * stages render inside one left-justified container at a max width, and the rail above them names
 * the same six stages with `aria-current="step"` on exactly one. So this file checks the rule
 * twice over:
 *
 *   1. **Rendered.** The create step — the one stage that exists today — draws the six names, the
 *      "Stage 1 of 6" line and one current entry, and its markup carries no `mx-auto`.
 *   2. **Structural.** The three flow screens the issue names as the defect
 *      (`create-relationship.tsx:146`, `accept-session.tsx:151`, `counterparty-wizard.tsx:79`) each
 *      render `StageColumn` and none of them centres a column of its own. Two of the three have no
 *      component test of their own (they need a live database to mount), and a screenshot cannot
 *      see an absent class — the source is where the rule is legible for all three.
 *
 * `StageColumn` itself is asserted for the same two properties: a max width, and no `mx-auto` —
 * the left edge is `main`'s padding and nothing else.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { lifecycleStageSection } from "@/data/pages/lifecycle";
import { EMPTY_CREATE_DRAFT } from "@/lib/flow/create-draft";
import { itemLabel } from "@/lib/page-copy";

/**
 * #709 — every stage now renders inside `StageShell`, whose only Next dependency is `useRouter`.
 * No render here navigates: the stub keeps a render a render.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

/** The six names the binding spec fixes, in order (`docs/specs/flow-stages.md`, #735). */
const STAGE_NAMES = ["Details", "Settings", "Aspects", "Invite", "Connect", "Align"];

/** The three flow screens #687 names as centred, with the line each one centred on. */
const FLOW_SCREENS = [
  "components/assessment-flow/create-relationship.tsx",
  "components/assessment-flow/accept-session.tsx",
  "components/assessment-flow/counterparty-wizard.tsx",
];

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/**
 * The file's code, without its comments. The columns were named `mx-auto` in prose for years, so a
 * docstring that *describes* the defect must not read as one — the rule is about what renders.
 */
function code(path: string): string {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function createStepHtml(): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: 1,
      template: {
        recordId: "template-relationship-basics",
        title: "Relationship Basics",
        summary: "Ten Aspects about how a working relationship feels and where it should go.",
        aspectCount: 2,
      },
      draft: EMPTY_CREATE_DRAFT,
      backHref: "/templates/relationship/template-relationship-basics",
      problem: null,
      problemLink: null,
    }),
  );
}

describe("the stage rail", () => {
  it("names the six stages, authored once and referenced by the fixture", () => {
    expect(lifecycleStageSection.id).toBe("stages");
    expect(
      lifecycleStageSection.items
        ?.filter((item) => /^[1-6]$/.test(item.id))
        .map((item) => item.label),
    ).toEqual(STAGE_NAMES);
  });

  it("draws all six names on the stage that mounts it", () => {
    const html = createStepHtml();
    // Scoped to the rail itself: "Details" also appears in the form's own headings, so a check
    // against the whole document would pass on a rail that drew nothing.
    const start = html.indexOf("<nav");
    const rail = html.slice(start, html.indexOf("</nav>", start));
    expect(rail).toContain('aria-label="Relationship lifecycle"');
    // One cell per stage (#716): the rail is the measured cell band, so the count is cells and
    // not list items — and there is no numbered list to count with.
    expect(rail.split("data-step-cell=").length - 1).toBe(6);
    expect(rail).not.toContain("<ol");
    for (const name of STAGE_NAMES) expect(rail).toContain(name);
  });

  it("marks exactly one entry as the current step", () => {
    const html = createStepHtml();
    expect(html.split('aria-current="step"')).toHaveLength(2);
    expect(html.split('data-step-state="current"')).toHaveLength(2);
    expect(html).toContain('data-wizard-rail="1"');
    expect(html).toContain("Stage 1 of 6");
    expect(html).toContain('data-step-state="upcoming"');
  });

  it("draws the current stage from the caller's fact, not from a guess", () => {
    // The count line is the fixture's, filled by the rail — so a screen that says it is on stage
    // 1 prints "Stage 1 of 6", and nothing in the component hardcodes a number.
    expect(itemLabel(lifecycleStageSection, "count")).toBe("Stage {step} of 6");
    expect(createStepHtml()).not.toContain("{step}");
  });
});

describe("the stage column", () => {
  it("is one max width with the left edge where main put it — never centred", () => {
    const html = renderToStaticMarkup(createElement(StageColumn, null, "band"));
    expect(html).toContain("max-w-[1126px]");
    expect(html).toContain("w-full");
    expect(html).not.toContain("mx-auto");
    expect(html).not.toContain("margin-inline");
  });

  it("is what every flow screen renders inside", () => {
    for (const path of FLOW_SCREENS) {
      const file = code(path);
      expect(file, `${path} imports the shared column`).toContain('from "./stage-column"');
      expect(file, `${path} renders the shared column`).toContain("<StageColumn>");
      expect(file, `${path} closes the shared column`).toContain("</StageColumn>");
    }
  });

  it("leaves no stage centring a column of its own", () => {
    for (const path of FLOW_SCREENS) {
      expect(code(path), `${path} must not centre its column`).not.toContain("mx-auto");
    }
  });
});
