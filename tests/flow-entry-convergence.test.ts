/**
 * #979 B — **36 entry points, one flow, two mountings** (card `t_ce4796c3`).
 *
 * The inventory (`t_344f5fff`, 39 stills, the comment on #979) found 36 controls that reach
 * sign-in, sign-up, purchase or a relationship: `21 full page · 7 wizard route · 6 in-flow stage ·
 * 2 external`. This file holds the half of the convergence that can be proven without a browser:
 *
 *   **a wizard-route entry opens in place.** Every control whose destination is a *stage of the
 *   flow* is now a `FlowEntryLink` — a soft navigation that remembers the page and the control it
 *   was pressed on — and every in-product segment that carries one declares the intercepted route
 *   that draws the stage in the dialog over it. Seven of seven converted.
 *
 *   **nothing else moved.** A marketing entry, a nav item, an auth page and a catalogue page's
 *   destination are not stages, so they keep navigating: seven of the twenty-one full-page rows and
 *   two of the in-product ones stay navigations on purpose, and the table in the PR body says which
 *   and why. The check here is the property, not the table: **no bare anchor and no `router.push`
 *   into a stage address is left anywhere a person can press it.**
 *
 * The browser half — the dialog opens, stage 1 completes, the address is the stage's, `Esc` returns
 * focus to the trigger — is `docs/qa/979-flow-entries/` and is measured, not asserted here.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TemplateCard, type CatalogueCardCopy } from "@/components/assessment-flow/template-card";
import { createRelationshipPath } from "@/lib/flow/paths";

const ROOT = join(__dirname, "..");
const source = (path: string) => readFileSync(join(ROOT, path), "utf8");
const exists = (path: string) => existsSync(join(ROOT, path));

/** Every `.ts`/`.tsx` file under a directory, recursively, as repo-relative paths with text. */
function sourceFiles(dir: string): { path: string; text: string }[] {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) return [];
  const found: { path: string; text: string }[] = [];
  for (const entry of readdirSync(absolute)) {
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(relative(ROOT, path)));
    else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      found.push({
        path: relative(ROOT, path).replaceAll("\\", "/"),
        text: readFileSync(path, "utf8"),
      });
    }
  }
  return found;
}

const SOURCES = ["app", "components", "lib"].flatMap(sourceFiles);

/**
 * The five stages, as the dialog mounts them: the segment each one lives in, and the module whose
 * own route renders it. A mounting that built its own stage would fail the "same module" assertion.
 */
const STAGES = [
  ["", "Details"],
  ["mode", "Settings"],
  ["aspects", "Aspects"],
  ["commit", "Account"],
  ["invite", "Invite"],
] as const;

/**
 * The four in-product segments that carry a create door. `dashboard/relationships` is the parent
 * card's (`t_c99072cc`); the other three are this card's — and they are exactly the surfaces whose
 * doors point at a stage address.
 */
const HOSTS = [
  "app/(mainlayout)/dashboard/relationships",
  "app/(mainlayout)/assessment",
  "app/(mainlayout)/templates/relationship",
  "app/(mainlayout)/dashboard/templates",
] as const;

const slotPath = (host: string, suffix: string) =>
  `${host}/@flow/(...)templates/relationship/[slug]/create${suffix === "" ? "" : `/${suffix}`}/page.tsx`;

const stageModule = (suffix: string) =>
  `app/(mainlayout)/templates/relationship/[slug]/create${suffix === "" ? "" : `/${suffix}`}`;

describe("every in-product segment draws the flow's dialog over itself", () => {
  it("declares the slot and a layout that renders it, on all four segments", () => {
    for (const host of HOSTS) {
      const layout = source(`${host}/layout.tsx`);
      // The slot is a sibling of the page, not a wrapper with chrome of its own.
      expect(layout, `${host} does not render its flow slot`).toContain("{flow}");
      expect(layout, `${host} does not render the page`).toContain("{children}");
      expect(layout, `${host} draws chrome a page did not ask for`).not.toContain("<main");
      // ...and the closed state draws nothing at all.
      expect(
        source(`${host}/@flow/default.tsx`),
        `${host}'s closed slot draws something`,
      ).toContain("return null");
    }
  });

  it("intercepts all five stages, each as the stage's own module, mounted as a dialog", () => {
    for (const host of HOSTS) {
      for (const [suffix] of STAGES) {
        const file = slotPath(host, suffix);
        expect(exists(file), `${file} does not exist`).toBe(true);
        const text = source(file);
        // The *same* module a deep link, a refresh and an invitation link land on: one stage
        // component, two mountings — the property the parent card's shell is built on.
        expect(text, `${file} re-implements a stage`).toContain(
          `from "@/${stageModule(suffix)}/page"`,
        );
        expect(text, `${file} does not mount the stage as a dialog`).toContain(
          "mount={FLOW_MOUNT_DIALOG}",
        );
        // The mount token is a value, never JSX copy: E23 counts literals on these routes.
        expect(text, `${file} spells the mount as a string`).not.toContain('mount="dialog"');
      }
    }
  });

  it("declares no slot anywhere a stage is already the screen", () => {
    // A slot on the product shell would intercept one stage navigating to the next (stage 3's
    // "Continue" is a link) and draw a modal over the flow itself. The four hosts are the set.
    const slots = readdirSync(join(ROOT, "app/(mainlayout)"), { recursive: true })
      .map((entry) => String(entry))
      .filter((entry) => entry.split("/").includes("@flow"))
      .map((entry) => `app/(mainlayout)/${entry.split("/@flow")[0]}`);
    expect([...new Set(slots)].sort()).toEqual([...HOSTS].sort());
  });
});

describe("the in-product doors are the soft navigation, and only they are", () => {
  it("gives every wizard-route entry a FlowEntryLink carrying the flow's own address", () => {
    const doorFiles = SOURCES.filter(({ text }) => text.includes("href={createRelationshipPath("));
    expect(doorFiles.map(({ path }) => path).sort()).toEqual([
      "components/assessment-flow/template-card.tsx",
      "components/assessment-flow/template-detail.tsx",
    ]);
    for (const { path, text } of doorFiles) {
      expect(text, `${path} draws the door on a bare anchor`).not.toMatch(
        /<a\b[^>]*createRelationshipPath/,
      );
      expect(text, `${path} does not use the shared door`).toContain("<FlowEntryLink");
    }
  });

  it("leaves no bare anchor or router.push into a stage address anywhere in the tree", () => {
    // The acceptance's grep, as a check rather than a memory: a plain `<a>` is a document load, so
    // it would render the stage as a page and the shelf would be gone — the drift this card closes.
    const bareAnchors = SOURCES.filter(({ text }) =>
      /<a\b[^>]*createRelationshipPath/.test(text),
    ).map(({ path }) => path);
    expect(bareAnchors).toEqual([]);

    const pushes = SOURCES.filter(({ text }) =>
      /router\.push\(\s*createRelationshipPath/.test(text),
    ).map(({ path }) => path);
    // The one allowed imperative navigation is the chooser band on `/dashboard/relationships`,
    // which is a button (not an anchor), remembers its origin, and opens the same dialog.
    expect(pushes).toEqual(["components/dashboard/relationship-create.tsx"]);
    expect(source(pushes[0] ?? "")).toContain("rememberFlowOrigin(");
    expect(source(pushes[0] ?? "")).toContain('data-start-in-flow="true"');
  });

  it("keeps the template a door was pressed on: the door is a mounting, not a parser", () => {
    // `FlowEntryLink` takes an href it is given and adds nothing to it. A stage, a `?instance=`
    // key and a `?problem=` refusal all travel in the address the caller already built.
    const link = source("components/assessment-flow/flow-entry-link.tsx");
    expect(link).not.toContain("URLSearchParams");
    expect(link).not.toContain("searchParams");
    expect(link).not.toMatch(/href=\{[^}]*createRelationshipPath/);
    // And it remembers the page it was pressed on, which is what closing returns to.
    expect(link).toContain("rememberFlowOrigin(window.location.pathname");
  });
});

describe("the marketing surfaces keep navigating", () => {
  it("uses no flow door under (marketing), and still sends a visitor to /register", () => {
    const marketing = sourceFiles("app/(marketing)");
    expect(marketing.length).toBeGreaterThan(5);
    for (const { path, text } of marketing) {
      expect(text, `${path} mounts the app's dialog on a crawlable page`).not.toContain(
        "FlowEntryLink",
      );
    }
    // The catalogue's own door is still resolved per viewer by `lib/start-path.ts` (a member goes
    // into the flow, a visitor to `/register?next=`), untouched by this card.
    expect(source("app/(marketing)/relationship-types/page.tsx")).toContain("startViewer(");
    expect(source("lib/start-path.ts")).toContain("registerPathFor(flow)");
  });

  it("mounts the door in no shared chrome: no nav item and no footer link converts", () => {
    const chrome = ["components/layout/header.tsx", "components/layout/footer.tsx"];
    for (const path of chrome) {
      if (!exists(path)) continue;
      expect(source(path), `${path} carries the flow's door`).not.toContain("FlowEntryLink");
    }
  });

  it("is imported by the in-product card modules, and by nothing else", () => {
    const importers = SOURCES.filter(({ text }) => text.includes("flow-entry-link"))
      .map(({ path }) => path)
      .sort();
    expect(importers).toEqual([
      "components/assessment-flow/template-card.tsx",
      "components/assessment-flow/template-detail.tsx",
      "components/dashboard/relationship-cards.tsx",
      "components/dashboard/template-shelf.tsx",
    ]);
  });
});

describe("the door that is drawn", () => {
  const copy: CatalogueCardCopy = {
    viewDetails: "View details",
    unnamedType: "No type",
    rolesOf: () => "A / B",
    aspectsOf: (count) => `${count} Aspects`,
    priceLabel: "Included in",
    priceOf: (plan, cents) => `${plan} · ${cents}`,
    useTemplate: "Create Relationship",
    seeExample: "See example",
  };

  it("renders the flow's address as a link marked as the door", () => {
    // The rendered property, not the source: a card whose door is not this anchor would leave the
    // dialog unreachable however the file reads.
    const html = renderToStaticMarkup(
      createElement(TemplateCard, {
        copy,
        template: {
          id: "assessment-relationship-basics",
          slug: "relationship-basics",
          title: "Relationship basics",
          summary: "A starting point.",
          aspectCount: 3,
        },
      }),
    );
    expect(html).toContain(`href="${createRelationshipPath("relationship-basics")}"`);
    expect(html).toContain('data-flow-entry="true"');
    /*
     * The door is **named by the address it goes to**, so the shell's fallback can find the same
     * control again after the dismissal's pop re-renders the page and replaces this node.
     *
     * Measured in the browser (card `t_ce4796c3`): the remembered anchor is detached by the time
     * the shell hands focus back — the pop re-renders the page underneath and React does not keep
     * the element — so without this name `Esc` closed the dialog and left focus on `<body>` on five
     * of six doors. The fallback `rememberFlowOrigin` is handed is built from exactly this value.
     */
    expect(html).toContain(`data-flow-entry-id="${createRelationshipPath("relationship-basics")}"`);
  });
});
