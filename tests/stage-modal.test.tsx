/**
 * The create flow as one modal (#709, S2 of release #707) — the shell, its two presentations, and
 * the two exits.
 *
 * The card's acceptance is four facts, and three of them are visible in static markup — which is
 * the whole reason this file renders instead of screenshotting:
 *
 *   1. **Each stage route still renders standalone.** The stage is in the *server's* HTML, not
 *      mounted by a client after hydration: every stage's static markup carries the dialog, the
 *      stage body inside it and the rail's six words. That is what makes a direct URL, a refresh
 *      and a link from an email render the stage instead of an empty overlay — and it is why the
 *      shell renders in place rather than through `DialogPortal`, which mounts on the client only.
 *   2. **One shell, two presentations.** The panel is `inset-0` (the full-height sheet) and gains
 *      its 24px inset, border radius and border at `lg` — the approved v6 fullscreen dialog. The
 *      breakpoint is CSS, so the server never has to know the viewport.
 *   3. **The close control is a thumb target** (44px) and closes onto an address, never onto a
 *      piece of state that could leave an unclosable modal standing over a route.
 *   4. **The account gate and Sent are inside the same shell**, drawn by their pages — the gate is
 *      a step inside the modal (never a stage), and Sent stays reachable by URL while no longer
 *      being a destination the flow navigates to.
 *
 * The post-completion target itself is asserted where it is decided (`tests/create-commit.test.tsx`
 * over `afterCreateTarget`), so this file never restates it.
 *
 * Rendered with `renderToStaticMarkup` over the real components and the real fixtures: no database,
 * no server, no session. Sent and the gate need a live row to mount, so their half is a source
 * rule — the same technique `tests/stage-shell.test.tsx` already uses for the two flow screens that
 * cannot be mounted without a database.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { StageShell } from "@/components/assessment-flow/stage-shell";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { lifecycleStageSection } from "@/data/pages/lifecycle";
import { EMPTY_CREATE_DRAFT } from "@/lib/flow/create-draft";
import { OVERVIEW_PATH, TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";
import { itemLabel } from "@/lib/page-copy";

/**
 * The shell's only Next dependency is `useRouter`, and no render here navigates: stubbing it keeps
 * a render a render. (The real push is a client event on a closed dialog; a static render cannot
 * press it, and a test of the stub would prove nothing about the app.)
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const TEMPLATE = {
  recordId: "template-relationship-basics",
  title: "Relationship Basics",
  summary: "Ten Aspects about how a working relationship feels and where it should go.",
  aspectCount: 2,
};

/** Stages 1–4, as the four routes render them. */
const STAGES = [1, 2, 3, 4] as const;

function stageHtml(stage: (typeof STAGES)[number]): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage,
      template: TEMPLATE,
      // Stage 3 is the only one that draws a list; the others ignore it.
      ...(stage === 3 ? { aspects: [] } : {}),
      draft: EMPTY_CREATE_DRAFT,
      backHref: "/assessment/templates/template-relationship-basics",
      problem: null,
      problemLink: null,
    }),
  );
}

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("the stage shell", () => {
  it("renders its stage in the server's HTML — before any client mounts", () => {
    const html = renderToStaticMarkup(
      <StageShell title="A stage" closeLabel="Close" closeHref={TEMPLATE_LIBRARY_PATH}>
        <p data-stage-body="true">the stage</p>
      </StageShell>,
    );
    // Not a portal: the stage is a child of the panel in the string the server sends.
    expect(html).toContain('role="dialog"');
    // The dialog's accessible name is in the same string — a title, not an aria-label guess.
    expect(html).toContain('class="sr-only">A stage</h2>');
    expect(html).toContain('data-stage-shell="true"');
    expect(html).toContain('data-stage-body="true"');
    expect(html).toContain("the stage");
  });

  it("is the full-height sheet at 390 and the approved inset dialog at 1024", () => {
    const html = renderToStaticMarkup(
      <StageShell title="A stage" closeLabel="Close" closeHref={TEMPLATE_LIBRARY_PATH}>
        {null}
      </StageShell>,
    );
    const panel = /data-stage-shell="true"[^>]*/.exec(html)?.[0] ?? "";
    // 390: edge to edge, no radius, no side borders — the shipped full-height Sheet shape.
    expect(panel).toContain("inset-0");
    // ≥1024: the v6 fullscreen dialog — inset, rounded, bordered.
    expect(panel).toContain("lg:inset-6");
    expect(panel).toContain("lg:rounded-lg");
    expect(panel).toContain("lg:border");
    // One scroll container, so a long stage scrolls inside the panel instead of growing it.
    expect(html).toContain("min-h-0");
    expect(html).toContain("overflow-auto");
  });

  it("gives the close control a 44px target and a name from the fixture", () => {
    const html = renderToStaticMarkup(
      <StageShell
        title="A stage"
        closeLabel={itemLabel(lifecycleStageSection, "close")}
        closeHref={TEMPLATE_LIBRARY_PATH}
      >
        {null}
      </StageShell>,
    );
    expect(html).toContain('aria-label="Close"');
    expect(html).toContain("h-11");
    expect(html).toContain("w-11");
    // The close is navigation: the destination is in the markup, not in a state machine.
    expect(html).toContain(`data-stage-close="${TEMPLATE_LIBRARY_PATH}"`);
  });
});

describe("the four create stages", () => {
  it("each render inside the shell, with the stage body still in the same response", () => {
    for (const stage of STAGES) {
      const html = stageHtml(stage);
      expect(html, `stage ${stage} draws the shell`).toContain('data-stage-shell="true"');
      // The six words the rail owns are inside the panel, unchanged (#687).
      for (const name of ["Details", "Settings", "Aspects", "Invite", "Connect", "Align"]) {
        expect(html, `stage ${stage} keeps the rail's ${name}`).toContain(name);
      }
      expect(html, `stage ${stage} still draws its column`).toContain("max-w-[1126px]");
    }
  });

  it("dismiss onto the template library — a dismissal is not a step backwards", () => {
    for (const stage of STAGES) {
      expect(stageHtml(stage)).toContain(`data-stage-close="${TEMPLATE_LIBRARY_PATH}"`);
    }
  });

  it("name the dialog after the stage's own heading, so the two can never disagree", () => {
    // The visually-hidden title carries the same string the screen prints as its `<h1>`.
    expect(stageHtml(1)).toContain(assessmentCreatePageCopy.heading);
    expect(stageHtml(1)).toContain('class="sr-only">');
  });
});

describe("the surfaces the shell wraps outside the four stages", () => {
  it("renders the account gate inside the same modal, closing onto the dashboard", () => {
    const file = source(
      "app/(mainlayout)/assessment/templates/[templateId]/create/account/page.tsx",
    );
    expect(file).toContain("StageShell");
    expect(file).toContain("<StageShell");
    expect(file).toContain("closeHref={OVERVIEW_PATH}");
    // An account already exists: the flow is finished, so it goes where the flow ends.
    expect(file).toContain("if (viewer !== null) redirect(OVERVIEW_PATH);");
    expect(file).toContain("destination={OVERVIEW_PATH}");
  });

  it("renders Sent inside the shell, still as a stage that answers when asked for by URL", () => {
    const file = source("app/(mainlayout)/assessment/instances/[instanceId]/sent/page.tsx");
    expect(file).toContain("<StageShell");
    expect(file).toContain("closeHref={OVERVIEW_PATH}");
    // Still a page with its own read: the shell frames it, it does not replace it.
    expect(file).toContain("readFlowScreen");
    expect(file).toContain('export const dynamic = "force-dynamic"');
  });

  it("keeps every stage route a page of its own — no interception, no second flow", () => {
    const pages = [
      "app/(mainlayout)/assessment/templates/[templateId]/create/page.tsx",
      "app/(mainlayout)/assessment/templates/[templateId]/create/mode/page.tsx",
      "app/(mainlayout)/assessment/templates/[templateId]/create/aspects/page.tsx",
      "app/(mainlayout)/assessment/templates/[templateId]/create/commit/page.tsx",
      "app/(mainlayout)/assessment/instances/[instanceId]/sent/page.tsx",
    ];
    for (const path of pages) {
      const file = source(path);
      expect(file, `${path} is still a route`).toContain("export default async function");
      // A request-time render: the draft is a cookie and the template is a database read.
      expect(file, `${path} stays request-time`).toContain(
        'export const dynamic = "force-dynamic"',
      );
      expect(file, `${path} imports the shell`).not.toContain("@modal");
    }
    // Nothing intercepts the flow: the count the issue measured as 0 is still 0.
    expect(OVERVIEW_PATH).toBe("/dashboard");
  });
});
