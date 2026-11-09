/**
 * The four product screens match the approved v7 artifact (#760).
 *
 * The artifact is the binding reference (`AGENTS.md`, `docs/specs/flow-stages.md`), and this file
 * pins the parts of that match a rendered string can prove — the geometry half is measured over
 * CDP in the PR body, because `pnpm test` has no layout engine:
 *
 *   S1  the desktop panel is capped at `min(100% - 48px, 880px)` and centred, and the sheet below
 *       1024 is untouched;
 *   S2  stages 1–4 draw **one** foot, `[Back][Cancel]` as a left group and the advancing act
 *       flush right, with the advance's label the fixture's (`Continue to Stage 2/3/4`);
 *   S3  Settings draws two peers with **one** radio component — two `fieldset`s, both carrying
 *       their own legend, side by side from `sm` up;
 *   S4  an Aspect row reads `01 · grip · name · opinions · ✎` — the ordinal off the row index,
 *       the edit control an icon with the fixture's name, and no per-row origin chip.
 *
 * Rendered with `renderToStaticMarkup` over the real components and the real fixtures: no
 * database, no server, no session.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CreateRelationship,
  type CreateStage,
} from "@/components/assessment-flow/create-relationship";
import { StageShell } from "@/components/assessment-flow/stage-shell";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { EMPTY_CREATE_DRAFT } from "@/lib/flow/create-draft";
import { TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** Both components reach Next only through `useRouter`; nothing here navigates. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const TEMPLATE = {
  recordId: "template-relationship-basics",
  title: "Relationship Basics",
  summary: "Ten Aspects about how a working relationship feels and where it should go.",
  aspectCount: 3,
};

const ASPECTS = [
  {
    id: "aspect-trust",
    prompt: "How much do you trust each other to raise a problem early?",
    leftValue: "Not enough",
    rightValue: "Too much",
  },
  {
    id: "aspect-money",
    prompt: "How openly do you talk about money?",
    leftValue: "Never",
    rightValue: "Constantly",
  },
  {
    id: "aspect-time",
    prompt: "How do we spend time that is not about the house?",
    leftValue: "None",
    rightValue: "All of it",
  },
];

function stageHtml(stage: CreateStage): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage,
      template: TEMPLATE,
      draft: { ...EMPTY_CREATE_DRAFT, mode: "basic", alignmentSetting: "soft" },
      ...(stage === 3 ? { aspects: ASPECTS } : {}),
      backHref: "/assessment/templates/template-relationship-basics",
      problem: null,
      problemLink: null,
    }),
  );
}

/** The file's code without its comments — prose about a class must never read as the class. */
function code(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("S1 — the desktop panel is capped and centred", () => {
  it("carries the 880px ceiling and the auto margins that centre it, at lg only", () => {
    const html = renderToStaticMarkup(
      <StageShell title="A stage" closeLabel="Close" closeHref={TEMPLATE_LIBRARY_PATH}>
        {null}
      </StageShell>,
    );
    const panel = /data-stage-shell="true"[^>]*/.exec(html)?.[0] ?? "";
    // `inset-6` supplies the 24px gutters, so `max-w` + `mx-auto` *is* `min(100% - 48px, 880px)`.
    expect(panel).toContain("lg:inset-6");
    expect(panel).toContain("lg:max-w-[880px]");
    expect(panel).toContain("lg:mx-auto");
    // The phone sheet is untouched: full-bleed, and no width or cap that could apply there.
    expect(panel).toContain("inset-0");
    expect(panel).not.toMatch(/(?<![\w:-])max-w-/);
  });

  it("caps every stage the same way — the shell is the one place the rule lives", () => {
    // The panel is drawn by `StageShell` alone; a stage that set a width of its own would be a
    // second ceiling, which is the defect the cap exists to prevent.
    for (const path of [
      "components/assessment-flow/stage-shell.tsx",
      "components/assessment-flow/create-relationship.tsx",
      "components/assessment-flow/aspect-list.tsx",
    ]) {
      expect(code(path), `${path} sets no fixed pixel width`).not.toMatch(/(?<![-\w])w-\[\d+px\]/);
    }
  });
});

describe("S2 — one foot on every stage", () => {
  const foot = sectionOf(assessmentCreatePageCopy, "foot");
  const cancel = itemLabel(foot, "cancel");

  for (const stage of [1, 2, 3, 4] as const) {
    it(`stage ${stage} draws the pair on the left and the advance on the right`, () => {
      const html = stageHtml(stage);
      // Exactly one foot: a second would be a second back affordance.
      expect(html.match(/data-stage-foot="true"/g) ?? []).toHaveLength(1);
      // The pair, in that order, both named from the fixture.
      const back = html.indexOf('data-create-back="true"');
      const cancelAt = html.indexOf('data-create-cancel="true"');
      expect(back, "the back link is in the foot").toBeGreaterThan(-1);
      expect(cancelAt, "the cancel link is in the foot").toBeGreaterThan(back);
      expect(html).toContain(`>${cancel}</a>`);
      // The pair sits in the group that leaves; the advance is the control after it.
      const leftGroup = /<div class="order-2[^"]*">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
      expect(leftGroup).toContain('data-create-back="true"');
      expect(leftGroup).toContain('data-create-cancel="true"');
    });
  }

  it("names the advance by the stage it goes to, from the fixture", () => {
    expect(stageHtml(1)).toContain(itemLabel(sectionOf(assessmentCreatePageCopy, "who"), "submit"));
    expect(stageHtml(2)).toContain(
      itemLabel(sectionOf(assessmentCreatePageCopy, "mode"), "submit"),
    );
    expect(stageHtml(3)).toContain(
      itemLabel(sectionOf(assessmentCreatePageCopy, "aspects"), "submit"),
    );
    expect(stageHtml(4)).toContain(
      itemLabel(sectionOf(assessmentCreatePageCopy, "commit"), "submit"),
    );
    // The owner's words, verbatim (#760).
    expect(itemLabel(sectionOf(assessmentCreatePageCopy, "who"), "submit")).toBe(
      "Continue to Stage 2",
    );
    expect(itemLabel(sectionOf(assessmentCreatePageCopy, "mode"), "submit")).toBe(
      "Continue to Stage 3",
    );
    expect(itemLabel(sectionOf(assessmentCreatePageCopy, "aspects"), "submit")).toBe(
      "Continue to Stage 4",
    );
  });

  it("leaves no second back link at the top of a stage", () => {
    for (const stage of [2, 3, 4] as const) {
      const html = stageHtml(stage);
      // One `Back` on the screen: the foot's. The top link the column used to draw is gone.
      expect(html.match(/>Back</g) ?? [], `stage ${stage}`).toHaveLength(1);
    }
  });

  it("dismisses onto the library, because Cancel is not a step backwards", () => {
    for (const stage of [1, 2, 3, 4] as const) {
      const html = stageHtml(stage);
      expect(html).toContain(`href="${TEMPLATE_LIBRARY_PATH}"`);
      expect(html).toContain(`data-stage-close="${TEMPLATE_LIBRARY_PATH}"`);
    }
  });

  it("stacks below 560 and holds one row above it — a structural pair, not an order", () => {
    /* #771 lifted the foot out of `create-relationship.tsx` into `stage-foot.tsx`, because stage 4's
       client walk draws it too. The markup is the same; only the file that owns it moved. */
    const source = code("components/assessment-flow/stage-foot.tsx");
    // Three controls in one row cannot fit at 390: the advance takes its own full-width row on
    // top (`order-1`) and the pair splits the row beneath (`order-2`).
    expect(source).toContain("min-[560px]:flex-row");
    expect(source).toContain("min-[560px]:justify-between");
    expect(source).toContain('className="order-2 flex items-center gap-2 min-[560px]:order-none"');
    expect(source).toContain('className="order-1 flex min-[560px]:order-none min-[560px]:ml-auto"');
    expect(source).toContain("min-[560px]:order-none");
  });
});

describe("S3 — Settings draws two peers with one control", () => {
  const mode = sectionOf(assessmentCreatePageCopy, "mode");

  it("draws two fieldsets, each with its own legend from the fixture", () => {
    const html = stageHtml(2);
    expect(html.match(/data-choice-group="/g) ?? []).toHaveLength(2);
    expect(html).toContain(itemLabel(mode, "mode-label"));
    expect(html).toContain(itemLabel(mode, "setting-label"));
    // The owner's headings, not a clarified version of them (#760).
    expect(itemLabel(mode, "mode-label")).toBe("Opinions Mode");
    expect(itemLabel(mode, "setting-label")).toBe("Alignment Setting");
    expect(mode.heading).toBe("Relationship Settings");
  });

  it("puts them side by side from `sm` and one column below it", () => {
    const html = stageHtml(2);
    expect(html).toContain("grid gap-3 sm:grid-cols-2");
  });

  it("uses one radio component for both — two native groups, one option each", () => {
    const html = stageHtml(2);
    // Two options per group, one radio each, one name per group: the browser's own contract.
    expect(html.match(/name="mode"/g) ?? []).toHaveLength(2);
    expect(html.match(/name="alignmentSetting"/g) ?? []).toHaveLength(2);
    expect(html.match(/type="radio"/g) ?? []).toHaveLength(4);
    // Both groups are the same markup: one bordered cell per option, legend first in the fieldset.
    expect(html.match(/data-choice-group="/g) ?? []).toHaveLength(2);
    expect(html.match(/<legend/g) ?? []).toHaveLength(2);
  });

  it("says what each option does in the fixture's words, and keeps the Setting's thresholds", () => {
    const html = stageHtml(2);
    expect(html).toContain(itemLabel(mode, "mode-basic-help"));
    expect(html).toContain(itemLabel(mode, "mode-advanced-help"));
    expect(html).toContain(itemLabel(mode, "mode-fixed"));
    expect(html).toContain(itemLabel(mode, "setting-help"));
    expect(html).toContain(itemLabel(mode, "setting-note"));
  });
});

describe("S4 — an Aspect row is the artifact's line", () => {
  const aspects = sectionOf(assessmentCreatePageCopy, "aspects");

  it("starts every row with its position, read off the index and never editable", () => {
    const html = stageHtml(3);
    const ordinals = [...html.matchAll(/data-aspect-ordinal="(\d+)"/g)].map((m) => m[1]);
    expect(ordinals).toEqual(["1", "2", "3"]);
    // Drawn zero-padded and as a span: a position, not a field.
    expect(html).toContain(">01<");
    expect(html).toContain(">03<");
    expect(html).not.toMatch(/data-aspect-ordinal="\d+"[^>]*<input/);
  });

  it("carries the grip, the row's own opinions and an edit icon named from the fixture", () => {
    const html = stageHtml(3);
    expect(html.match(/data-aspect-grip="/g) ?? []).toHaveLength(ASPECTS.length);
    // The grip keeps the fixture's accessible name and its drag hint as a title.
    expect(html).toContain(itemLabel(aspects, "drag-hint"));
    for (const aspect of ASPECTS) {
      expect(html).toContain(aspect.prompt);
      expect(html).toContain(aspect.leftValue);
      expect(html).toContain(aspect.rightValue);
    }
    // The edit control is the ✎ with the fixture's word as its name, not a visible word that
    // competes with the row's data (#760).
    expect(html.match(/data-aspect-edit-icon="/g) ?? []).toHaveLength(ASPECTS.length);
    expect(html).toContain(`aria-label="${itemLabel(aspects, "edit")}"`);
    expect(html).toContain("✎");
    expect(html).toContain("⠿");
  });

  it("draws no per-row origin chip", () => {
    const html = stageHtml(3);
    // The template is named once, in the stage body — never five times down the list.
    expect(html.match(/Copied from the template/g) ?? []).toHaveLength(1);
    const source = code("components/assessment-flow/aspect-list.tsx");
    expect(source).not.toMatch(/copied|origin/);
  });

  it("closes an open row only through Save or Cancel, and asks before discarding", () => {
    const source = code("components/assessment-flow/aspect-list.tsx");
    // The open row's form is never re-toggled: opening is one way in, Cancel and Save are the
    // ways out, and Cancel asks when the form holds words the row does not.
    expect(source).toContain("function cancelRow(");
    expect(source).toContain("function isDirty(");
    expect(source).toContain('window.confirm(itemLabel(words, "unsaved"))');
    expect(source).not.toContain("setOpenId(openId === row.id ? null : row.id)");
    // The prompt itself is copy, so the fixture carries it (E23).
    expect(itemLabel(aspects, "unsaved")).toBe("Discard the changes to this Aspect?");
  });
});
