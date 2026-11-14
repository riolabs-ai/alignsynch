/**
 * One flow, two mountings (#979 B, owner decision B) — the shell is the thing that decides *where*
 * the five stages are drawn, and there is exactly one of it.
 *
 * The card's acceptance has two halves that are provable without a browser, and this file proves
 * them:
 *
 *   1. **The same stage is rendered in both mounts.** `mount="page"` (a stage address answering a
 *      GET) and `mount="dialog"` (the intercepted route over `/dashboard/relationships`) are handed
 *      the *same* stage element and it appears verbatim in both responses — one element tree, so the
 *      dialog cannot drift from the page it claims to be.
 *   2. **The page mount asks for nothing a static render cannot give.** It calls no `usePathname`,
 *      which is what keeps `tests/stage-modal.test.tsx`, `tests/flow-ui-parity.test.tsx` and the
 *      server's own GET working; the hook lives in the dialog mounting only.
 *
 * The source rules underneath are the other half of fact 1: five stage routes forward `mount` to
 * `CreateRelationship`, five intercepted routes render those *same* page modules with `mount="dialog"`,
 * and `create-relationship.tsx` no longer imports `StageShell`/`StageColumn`/`StageRail` itself — so
 * there is one shell, and a second one cannot be introduced quietly.
 *
 * Radix's `Portal` is the one primitive stubbed: it mounts on the client, so a static render of the
 * dialog mounting would otherwise be the empty string. Stubbing only the Portal leaves every other
 * primitive — the panel, the overlay, the title — the shipped one.
 *
 * The keyboard walk (Escape → focus back on the trigger, and an advance that is a soft navigation
 * rather than a document load) needs a DOM and lives in `tests/flow-dialog-escape.test.tsx`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RelationshipFlowShell } from "@/components/assessment-flow/relationship-flow-shell";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { RELATIONSHIPS_PATH, TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";

/** The stage address the dialog describes, and the page it was opened over. */
const STAGE_PATH = "/templates/relationship/relationship-basics/create/mode";
let pathname = STAGE_PATH;

const usePathname = vi.fn(() => pathname);
const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useRouter: () => ({ push, refresh: () => undefined }),
}));

vi.mock("@radix-ui/react-dialog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@radix-ui/react-dialog")>();
  return {
    ...actual,
    // A portal is a client mount; a static render has no client. Rendering its children in place is
    // the whole difference, and it is the only one — every other primitive stays real.
    Portal: ({ children }: { children: ReactNode }) => children,
  };
});

const STAGE_BODY = createElement("p", { "data-stage-body": "true" }, "the stage's own body");
const STAGE_BODY_HTML = renderToStaticMarkup(STAGE_BODY);

function shellHtml(mount: "page" | "dialog", stage: 1 | 2 | 3 | 4 | 5 | undefined = 2): string {
  return renderToStaticMarkup(
    <RelationshipFlowShell
      mount={mount}
      stage={stage}
      copy={assessmentCreatePageCopy}
      title="Settings"
      closeLabel="Close"
      closeHref={TEMPLATE_LIBRARY_PATH}
    >
      {STAGE_BODY}
    </RelationshipFlowShell>,
  );
}

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

beforeEach(() => {
  pathname = STAGE_PATH;
  push.mockClear();
  usePathname.mockClear();
});

describe("the flow's shell, in both mountings", () => {
  it("draws the same stage body and the same rail, whichever way it is mounted", () => {
    const page = shellHtml("page");
    const dialog = shellHtml("dialog");

    for (const [name, html] of [
      ["page", page],
      ["dialog", dialog],
    ] as const) {
      // The stage the caller handed in, byte for byte — this is the "same component" claim.
      expect(html, `${name} mounting lost the stage body`).toContain(STAGE_BODY_HTML);
      // The rail is the shell's, so it is drawn the same way on both — five cells, one count.
      expect(html, `${name} mounting lost the rail`).toContain("Stage 2 of 5");
      expect(html, `${name} mounting lost the column`).toContain("max-w-[1126px]");
      // One frame in both: the shipped panel, with the stage already inside it.
      expect(html, `${name} mounting lost the panel`).toContain('data-stage-shell="true"');
    }

    // The only difference is the marker the dialog mounting adds for its own behaviours.
    expect(dialog).toContain('data-flow-mount="dialog"');
    expect(page).not.toContain('data-flow-mount="dialog"');
  });

  it("draws no rail on the refusal screen, which stands on no stage", () => {
    const html = shellHtml("page", undefined);
    expect(html).toContain(STAGE_BODY_HTML);
    expect(html).not.toContain("Stage 1 of 5");
  });

  it("asks no hook of a static render in the page mounting, and one in the dialog's", () => {
    shellHtml("page");
    // The page mounting is what the server renders for a deep link, a refresh and an invitation
    // link. It must not need a Next router that a static render does not have.
    expect(usePathname).not.toHaveBeenCalled();

    shellHtml("dialog");
    expect(usePathname).toHaveBeenCalled();
  });

  it("stops describing the flow once the address is no longer a stage of it", () => {
    pathname = RELATIONSHIPS_PATH;
    expect(shellHtml("dialog")).toBe("");
  });
});

describe("the mounting is declared once, and forwarded", () => {
  const STAGE_ROUTES = [
    "app/(mainlayout)/templates/relationship/[slug]/create/page.tsx",
    "app/(mainlayout)/templates/relationship/[slug]/create/mode/page.tsx",
    "app/(mainlayout)/templates/relationship/[slug]/create/aspects/page.tsx",
    "app/(mainlayout)/templates/relationship/[slug]/create/commit/page.tsx",
    "app/(mainlayout)/templates/relationship/[slug]/create/invite/page.tsx",
  ] as const;

  const INTERCEPTED = [
    "app/(mainlayout)/dashboard/relationships/@flow/(...)templates/relationship/[slug]/create/page.tsx",
    "app/(mainlayout)/dashboard/relationships/@flow/(...)templates/relationship/[slug]/create/mode/page.tsx",
    "app/(mainlayout)/dashboard/relationships/@flow/(...)templates/relationship/[slug]/create/aspects/page.tsx",
    "app/(mainlayout)/dashboard/relationships/@flow/(...)templates/relationship/[slug]/create/commit/page.tsx",
    "app/(mainlayout)/dashboard/relationships/@flow/(...)templates/relationship/[slug]/create/invite/page.tsx",
  ] as const;

  it("defaults every stage route to the page mounting and forwards one it is handed", () => {
    for (const route of STAGE_ROUTES) {
      const file = source(route);
      expect(file, `${route} does not take a mounting`).toContain("mount?: FlowMount");
      expect(file, `${route} defaults to the page mounting`).toContain('mount = "page"');
      expect(file, `${route} does not hand the mounting to the flow`).toContain("mount={mount}");
    }
  });

  it("renders the same stage module from the intercepted route, as a dialog", () => {
    for (const [index, route] of INTERCEPTED.entries()) {
      const file = source(route);
      const target = STAGE_ROUTES[index];
      if (target === undefined) throw new Error(`no stage route for ${route}`);
      // The intercepted route *is* the stage route, mounted differently: same module, one prop.
      // Imported by module specifier, so the extension a Next route file carries is not part of it.
      const module = target.replace(/\.tsx$/, "");
      expect(file, `${route} does not import ${target}`).toContain(`from "@/${module}"`);
      // The dialog mounting is a *value*, not a JSX string literal — `data:check` E23 counts those
      // against the create routes' budget of 0 — so the assertion reads the constant, not a quote.
      expect(file, `${route} does not mount the stage as a dialog`).toContain(
        "mount={FLOW_MOUNT_DIALOG}",
      );
      expect(file, `${route} does not import the mount token`).toContain("FLOW_MOUNT_DIALOG");
    }
  });

  it("leaves exactly one shell: the stages no longer import the frame themselves", () => {
    const flow = source("components/assessment-flow/create-relationship.tsx");
    expect(flow).toContain('from "./relationship-flow-shell"');
    expect(flow).not.toContain('from "./stage-shell"');
    expect(flow).not.toContain('from "./stage-column"');
    expect(flow).not.toContain('from "./stage-rail"');
    // And the rail is drawn by the shell, not by the stage — one count for both mountings.
    expect(flow).not.toContain("<StageRail");
  });
});

describe("advancing inside the dialog is a soft navigation", () => {
  it("posts the stage's own form and follows the answer with the router, never the document", () => {
    const shell = source("components/assessment-flow/relationship-flow-shell.tsx");

    // The form's own submit is caught before the browser can act on it…
    expect(shell).toContain("onSubmitCapture={submit}");
    expect(shell).toContain("event.preventDefault()");
    // …posted with the same body the browser would have sent…
    expect(shell).toContain('"application/x-www-form-urlencoded"');
    expect(shell).toContain('redirect: "follow"');
    // …and read back as an address the router pushes, which is what keeps the page underneath.
    expect(shell).toContain("router.push(`");
    expect(shell).toContain("destination.pathname");
    expect(shell).toContain("destination.search");

    // The one real document navigation left is the off-origin destination, and it is *after* the
    // origin comparison — no on-origin answer can reach it.
    const compare = shell.indexOf("destination.origin !== window.location.origin");
    const assign = shell.indexOf("window.location.assign");
    expect(compare).toBeGreaterThan(-1);
    expect(assign).toBeGreaterThan(compare);
  });

  it("is the trigger that closes the dialog, not a discard prompt the spec does not draw", () => {
    // The dismissal is one function for `Esc`, the X and the overlay, and focus comes before the
    // navigation that unmounts the dialog.
    const origin = source("lib/flow/dialog-origin.ts");
    expect(origin).toContain("export function closeFlowToOrigin");
    expect(origin.indexOf("flowOriginTrigger()?.focus()")).toBeLessThan(
      origin.indexOf("push(path)"),
    );
    expect(source("components/assessment-flow/relationship-flow-shell.tsx")).toContain(
      "closeFlowToOrigin((path) => router.push(path))",
    );
    // A draft is written by the Account stage and a dismissal has never discarded one: no confirm
    // stands between `Esc` and the page the flow was opened from.
    expect(origin).not.toContain("window.confirm");
    expect(origin).not.toMatch(/[Dd]iscard (this |the )?draft/);
  });
});
