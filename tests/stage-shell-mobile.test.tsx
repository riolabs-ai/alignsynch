/**
 * The create flow's modal shell at a phone width (#713, S6 of the v1.8.0 flow programme).
 *
 * The card walked every stage at **390×844** and asked two things of the shell rather than of a
 * screen: nothing overflows sideways, and the actions row is still reachable at **390×500** —
 * the honest height once an on-screen keyboard takes the bottom half of the display. The walk
 * recorded its numbers in `docs/qa-modal-mobile/measurements.json`; this file is what stops them
 * going back.
 *
 * Both halves are asserted the way the rest of the shell's tests are — there is no layout engine
 * in `pnpm test`, and a rendered string cannot say "this box is 44px wider than the viewport":
 *
 *   1. **Rendered.** The panel is full-bleed `inset-0` with one scrolling child (`min-h-0`,
 *      `overflow-auto`), and its 24px inset, radius and border only arrive at `lg`. The scroll
 *      container is the property that keeps a long stage (Aspects, Invite) scrolling *inside* the
 *      panel instead of growing it past the viewport — the horizontal-overflow class of bug the
 *      acceptance names.
 *   2. **Structural.** No class string in the files that draw the panel may carry a **fixed**
 *      width wider than 390 that applies below the `sm` breakpoint. A `max-w-` is not a width and
 *      is allowed (`StageColumn`'s `max-w-[1126px]` is the flow's own column); an ungated
 *      `w-[560px]` on any of them is a 390-page that scrolls sideways, and no typecheck, lint,
 *      snapshot or build can see it.
 *   3. **The close control's box.** It used to be `absolute right-2 top-2`, and at 390 the sheet
 *      has no inset while the column pads by 16px — so the 44px control sat on the rail's sixth
 *      cell and covered 35×35px of it (measured, `closeOverlap` in the measurements file). It now
 *      takes a band of its own below 1024 and returns to the panel's corner above it, which is
 *      why the assertion is "absolute only under `lg`" and not "absolute".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { StageShell } from "@/components/assessment-flow/stage-shell";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { EMPTY_CREATE_DRAFT } from "@/lib/flow/create-draft";
import { TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";

/**
 * The shell's only Next dependency is `useRouter`; nothing here navigates. Same stub, same reason,
 * as `tests/stage-modal.test.tsx`.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

/** The width the card measures at — an iPhone-class sheet, and the narrowest we ship to. */
const PHONE = 390;

/**
 * Every file whose class strings decide the panel's box: the panel, the column the stage renders
 * in, the rail above it and the cell band the rail is drawn with. A width added to any of them is
 * a width the sheet inherits.
 */
const SHELL_FILES = [
  "components/assessment-flow/stage-shell.tsx",
  "components/assessment-flow/stage-column.tsx",
  "components/assessment-flow/stage-rail.tsx",
  "components/assessment-flow/wizard-steps.tsx",
] as const;

/** A Tailwind breakpoint variant: a class carrying one does not apply at 390. */
const BREAKPOINTS = ["sm", "md", "lg", "xl", "2xl"];

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/**
 * The file's code without its comments. The fix's docstring *describes* the old `absolute right-2
 * top-2` and quotes a `w-[…]`; prose about a class must never read as the class, which is the same
 * rule `tests/stage-shell.test.tsx` applies to the columns' `mx-auto`.
 */
function code(path: string): string {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** Every string literal in a file — where a `className` lives, whether bare or inside `cn()`. */
function literals(text: string): string[] {
  return [...text.matchAll(/(["'`])([^"'`]*)\1/g)].map((match) => match[2] ?? "");
}

/**
 * A class token's width in CSS pixels, or `null` when it is not a fixed width.
 *
 * `max-w-*` is deliberately absent: a maximum never makes a box wider than its container, and the
 * column's `max-w-[1126px]` is the flow's approved geometry. `w-full`, `w-auto` and percentages
 * resolve against the parent and cannot overflow it.
 */
function fixedWidthPx(token: string): number | null {
  const match = /^(?:-?[a-z0-9-]+:)*(min-)?w-(.+)$/.exec(token);
  if (match === null) return null;
  const value = match[2] ?? "";

  const arbitrary = /^\[(.+)\]$/.exec(value);
  if (arbitrary !== null) {
    const inner = arbitrary[1] ?? "";
    const px = /^(\d+(?:\.\d+)?)px$/.exec(inner);
    if (px !== null) return Number(px[1]);
    const rem = /^(\d+(?:\.\d+)?)rem$/.exec(inner);
    if (rem !== null) return Number(rem[1]) * 16;
    // `%`, `vw`, `ch`, `fr` — relative to something, so never a fixed width.
    return null;
  }

  // The numeric scale: `w-4` is 1rem, so 4px a step. `w-px`, `w-full`, `w-auto` are not fixed.
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value) * 4;
  return null;
}

/** The classes that only apply from a breakpoint up — and are therefore harmless at 390. */
function appliesBelowSm(token: string): boolean {
  const variants = token.split(":").slice(0, -1);
  return !variants.some((variant) => BREAKPOINTS.includes(variant));
}

/** Every fixed width in a file that a 390px viewport would meet. */
function fixedWidthsIn(path: string): { token: string; px: number }[] {
  const found: { token: string; px: number }[] = [];
  for (const literal of literals(code(path))) {
    for (const token of literal.split(/\s+/)) {
      if (token === "" || !appliesBelowSm(token)) continue;
      const px = fixedWidthPx(token);
      if (px !== null) found.push({ token, px });
    }
  }
  return found;
}

function shellHtml(): string {
  return renderToStaticMarkup(
    <StageShell title="A stage" closeLabel="Close" closeHref={TEMPLATE_LIBRARY_PATH}>
      <p data-stage-body="true">the stage</p>
    </StageShell>,
  );
}

/** The close control's own opening tag, out of the rendered panel. */
function closeTag(html: string): string {
  return /<button[^>]*aria-label="Close"[^>]*>/.exec(html)?.[0] ?? "";
}

describe("the modal shell at 390", () => {
  it("is full-bleed, and takes no fixed width of its own", () => {
    const panel = /data-stage-shell="true"[^>]*/.exec(shellHtml())?.[0] ?? "";
    expect(panel).toContain("fixed");
    expect(panel).toContain("inset-0");
    // The 24px inset, radius and border are the ≥1024 presentation, and only that.
    expect(panel).toContain("lg:inset-6");
    // No other inset: `inset-0` is the sheet, `lg:inset-6` the dialog, and nothing sits between.
    expect(panel).not.toMatch(/(?<![\w:-])inset-(?!0(?![.\w]))/);
    // A panel that cannot overflow its own box: the stage scrolls inside it.
    expect(panel).toContain("overflow-hidden");
  });

  it("carries one scroll container, so a long stage scrolls inside the panel", () => {
    const html = shellHtml();
    expect(html).toContain("min-h-0 flex-1 overflow-auto");
    // The measured case: Aspects is 824px of content in an 844px panel, Invite 1268px — both
    // scroll vertically, neither widens the document (measurements.json, `scroller`).
    expect(html).toContain("overscroll-contain");
    expect(html).toContain('data-stage-body="true"');
  });

  it("sets no fixed width that a 390px viewport would overflow, in any file that draws it", () => {
    const offenders = SHELL_FILES.flatMap((path) =>
      fixedWidthsIn(path).map((hit) => ({ ...hit, path })),
    ).filter((hit) => hit.px > PHONE);
    expect(
      offenders,
      `these classes are wider than ${PHONE}px below the sm breakpoint: ${JSON.stringify(offenders)}`,
    ).toEqual([]);
  });

  it("reads the files it claims to check", () => {
    // A scanner that found nothing would pass the rule above for the wrong reason: the column's
    // measured 1126px is a `max-w-`, so the scan must see the token and refuse to call it a width.
    const column = code("components/assessment-flow/stage-column.tsx");
    expect(column).toContain("max-w-[1126px]");
    expect(fixedWidthPx("max-w-[1126px]")).toBeNull();
    // The close's own 44px box is a real class string, so the scan reads rendered classes and not
    // just this file's synthetic input.
    expect(fixedWidthsIn("components/assessment-flow/stage-shell.tsx")).toContainEqual({
      token: "w-11",
      px: 44,
    });
    // And a positive control, so the matcher is not silently dead.
    expect(fixedWidthPx("w-[560px]")).toBe(560);
    expect(fixedWidthPx("sm:w-[560px]")).toBe(560);
    expect(appliesBelowSm("sm:w-[560px]")).toBe(false);
    expect(appliesBelowSm("w-[560px]")).toBe(true);
  });
});

describe("the close control at 390", () => {
  it("holds a band of its own below 1024 and only floats in the corner above it", () => {
    const html = shellHtml();
    const close = closeTag(html);
    expect(close).not.toBe("");
    // The regression this pins: `absolute right-2 top-2` at 390 covered 35×35px of the rail's
    // sixth cell. Absolute placement is now a ≥1024 rule.
    expect(close).toContain("lg:absolute");
    expect(close).not.toMatch(/(?<![\w:-])absolute(?![\w-])/);
  });

  it("keeps its 44px thumb target and its name from the fixture", () => {
    const close = closeTag(shellHtml());
    expect(close).toContain("h-11 w-11");
    expect(close).toContain('aria-label="Close"');
    // The band that holds it in flow collapses at 1024, so the desktop panel is unchanged.
    expect(shellHtml()).toContain("lg:h-0");
  });
});

/**
 * #745 — the 44px floor inside `[data-stage-shell]` at 390.
 *
 * The measured defect was a bare `text-sm` Back link: 17px tall, at the top of stages 2–4, while
 * stage 1 kept its Back in the form's action row. One `StageFoot` on all four stages fixed both
 * facts — the pair that dismisses is one group beside the advancing act, and every control in it is
 * `h-11`.
 *
 * `pnpm test` has no layout engine, so these assertions are the classes that *are* the height
 * (`h-11` is 44px in this app's scale). The resolved pixels were measured over CDP in #761 and
 * again for v1.11.0's release page; this file is what stops the class being deleted.
 */
describe("the 44px control floor at 390 (#745)", () => {
  const TEMPLATE = {
    slug: "relationship-basics",
    recordId: "template-relationship-basics",
    title: "Relationship Basics",
    summary: "Five Aspects of a relationship, each answered from how it feels to how it should.",
    aspectCount: 2,
  };

  function stageHtml(stage: 1 | 2 | 3 | 4): string {
    return renderToStaticMarkup(
      createElement(CreateRelationship, {
        copy: assessmentCreatePageCopy,
        stage,
        template: TEMPLATE,
        ...(stage === 3 ? { aspects: [] } : {}),
        draft: EMPTY_CREATE_DRAFT,
        backHref: "/templates/relationship/template-relationship-basics",
        problem: null,
        problemLink: null,
      }),
    );
  }

  /** Every opening `<a>`/`<button>` tag with the given marker — asserted to be exactly one. */
  function control(html: string, marker: string): string {
    const tags = [...html.matchAll(/<(?:a|button)\b[^>]*>/g)].map((match) => match[0]);
    const found = tags.filter((tag) => tag.includes(marker));
    expect(found, `${marker} is drawn exactly once`).toHaveLength(1);
    return found[0] ?? "";
  }

  it("draws one foot on every stage, and every control in it is 44px tall", () => {
    for (const stage of [1, 2, 3, 4] as const) {
      const html = stageHtml(stage);
      expect(html.split('data-stage-foot="true"').length - 1, `stage ${stage} draws one foot`).toBe(
        1,
      );
      expect(control(html, 'data-create-back="true"'), `stage ${stage} Back`).toContain("h-11");
      expect(control(html, 'data-create-cancel="true"'), `stage ${stage} Cancel`).toContain("h-11");
      // The advancing act: full width below 560 (its own row under the thumb), its label's own
      // width above it — the artifact never stretches the primary.
      const foot = html.slice(html.indexOf('data-stage-foot="true"'));
      const advance = [...foot.matchAll(/<(?:a|button)\b[^>]*>/g)]
        .map((match) => match[0])
        .filter((tag) => tag.includes("h-11") && !tag.includes("data-create-back"))
        .filter((tag) => !tag.includes("data-create-cancel"));
      expect(advance.length, `stage ${stage} draws one advancing act`).toBeGreaterThan(0);
      const primary = advance[advance.length - 1] ?? "";
      expect(primary, `stage ${stage}'s advancing act is 44px`).toContain("h-11");
      expect(primary).toContain("w-full");
      expect(primary).toContain("min-[560px]:w-auto");
    }
  });

  it("leaves one back affordance per screen, and it is the foot's", () => {
    for (const stage of [1, 2, 3, 4] as const) {
      const html = stageHtml(stage);
      const backHref = "/templates/relationship/template-relationship-basics";
      // The link this replaced was a second route to the same address, drawn above the rail at
      // 17px. One address, one link.
      expect(html.split(`href="${backHref}"`).length - 1, `stage ${stage} links back once`).toBe(1);
      expect(html.indexOf('data-create-back="true"')).toBeGreaterThan(
        html.indexOf('data-stage-foot="true"'),
      );
    }
  });

  it("gives the in-card text links the same floor as the foot", () => {
    // Two survive outside the foot — the refusal screen's Back and stage 4's "add a method" pivot —
    // and both measured 17px as bare anchors. The marker is the link colour: in this file it only
    // appears on those, so every tag carrying it must also carry the 44px box.
    const file = code("components/assessment-flow/create-relationship.tsx");
    const links = [...file.matchAll(/<Link\b[\s\S]*?>/g)].map((match) => match[0]);
    // The refusal band's link is inline inside a sentence, not a control: a 44px box on it would
    // break the line it belongs to, so the floor is about targets and this one is prose.
    const textLinks = links.filter(
      (tag) => tag.includes("text-action") && !tag.includes("data-create-problem-link"),
    );
    expect(textLinks.length, "the file still draws its in-card links").toBeGreaterThan(0);
    for (const tag of textLinks) {
      expect(tag, `44px on: ${tag.replace(/\s+/g, " ").slice(0, 90)}`).toContain("h-11");
    }
  });
});
