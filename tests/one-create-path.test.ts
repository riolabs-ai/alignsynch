/**
 * **One create path, and it is the flow's modal (#913, #957).**
 *
 * The owner's rule is "a new relationship starts the modal". The defect behind it was a second
 * create path: `components/dashboard/relationship-create.tsx` copied the template itself through a
 * server action, and the row it wrote had **no session and no seats** — so the card's
 * `Invite Members` had no pay modal to open (stage 5 reads a session) and `Publish to Counterparty`
 * had no invitation to mint. The screen offered two controls that could never complete.
 *
 * So the claim is not "the band navigates instead of writing" on its own; it is that **no surface
 * can write a relationship row except the flow**, which is where stage 4 writes the session and the
 * staged invitation the later stages read. Four seams, each a different way the defect could come
 * back:
 *
 *   the row          exactly one module in the tree executes `INSERT INTO relationship`. Asserted
 *                    over the source, because the class is "a fourth writer somebody adds later",
 *                    not "this writer is wrong".
 *   the action       the list's create server action is gone by name, so re-mounting the old band
 *                    fails here even if the library function were restored.
 *   the control      the band that remains navigates to the flow's address and carries no form,
 *                    no hidden field and no action — a rendered property, not a comment.
 *   the endpoint     **#957's seam.** A module can reach `POST /assessment/new` without writing a
 *                    relationship itself: it only has to render a form whose `action` is that
 *                    address, and the *route* then writes, publishes and mails. That is exactly what
 *                    `/assessment`'s per-card form did, so the reach is held closed by name: the
 *                    modules that name the endpoint are a fixed set, the only one of them that posts
 *                    it posts a **draft**, and the public catalogue renders no form at all.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

import { TemplateList } from "@/components/assessment-flow/template-list";
import {
  RelationshipStart,
  type RelationshipStartTemplate,
} from "@/components/dashboard/relationship-create";
import { assessmentPageCopy } from "@/data/pages/assessment";
import { dashboardRelationshipsPageCopy } from "@/data/pages/dashboard-relationships";
import { createRelationshipPath } from "@/lib/flow/paths";
import type { TemplateSummary } from "@/lib/flow/store";

const ROOT = join(__dirname, "..");
const SOURCE_DIRS = ["components", "app", "lib"] as const;

/** Every `.ts`/`.tsx` file under a directory, recursively, as repo-relative paths with text. */
function sourceFiles(dir: string): { path: string; text: string }[] {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) return [];
  const found: { path: string; text: string }[] = [];
  for (const entry of readdirSync(absolute)) {
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(relative(ROOT, path)));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      found.push({
        path: relative(ROOT, path).replaceAll("\\", "/"),
        text: readFileSync(path, "utf8"),
      });
    }
  }
  return found;
}

const SOURCES = SOURCE_DIRS.flatMap((dir) => sourceFiles(dir));
const sourceOf = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** The one module allowed to write a relationship row — the create flow's store. */
const FLOW_STORE = "lib/flow/store.ts";

/**
 * The one module allowed to *post* the create endpoint, and it posts a draft.
 *
 * `stage-account.tsx` is stage 4: it carries `<input type="hidden" name="draft" value="1">`, so the
 * endpoint writes the relationship at `draft` and stage 5 decides whether anything goes out
 * (#825). Every other poster is a bypass, whatever it claims.
 */
const STAGE_ACCOUNT = "components/assessment-flow/stage-account.tsx";

/**
 * Every module in the app's own tree that names `POST /assessment/new`, as a closed set.
 *
 * Not "fewer than N" — a named list, so a new module lands here as a decision rather than as a
 * count. `paths.ts` defines the address, the mode route names it in a docstring explaining that its
 * own form no longer posts it, and stage 4 is the one caller. `scripts/` is deliberately outside
 * this set: `flow-e2e.mjs` and `billing-smoke.mjs` are harnesses posting the endpoint directly, and
 * they are covered by the route's own refusal tests, not by a UI invariant.
 */
const ENDPOINT_NAMERS: readonly string[] = [
  "app/(mainlayout)/assessment/new/mode/route.ts",
  STAGE_ACCOUNT,
  "lib/flow/paths.ts",
];

describe("one create path", () => {
  it("is the flow's store: one module in the tree writes a relationship row", () => {
    const writers = SOURCES.filter(({ text }) => /INSERT INTO relationship\b/.test(text)).map(
      ({ path }) => path,
    );
    expect(writers).toEqual([FLOW_STORE]);
  });

  it("leaves no list-side create action to re-mount", () => {
    const callers = SOURCES.filter(({ text }) => text.includes("createRelationshipAction")).map(
      ({ path }) => path,
    );
    expect(callers).toEqual([]);
  });

  it("gives the member library no second create to call", () => {
    const library = sourceOf("lib/member/relationships.ts");
    expect(library).not.toContain("export async function createRelationship");
  });

  /* ------------------------------------------------------------------ #957's seam */

  it("is reached by a named set of modules, not by any page that renders a form", () => {
    const namers = SOURCES.filter(({ text }) => /\bCREATE_INSTANCE_PATH\b/.test(text))
      .map(({ path }) => path)
      .sort();
    expect(namers).toEqual([...ENDPOINT_NAMERS].sort());
  });

  it("posts a draft from the one module that posts it at all", () => {
    const posters = SOURCES.filter(({ text }) => /action=\{CREATE_INSTANCE_PATH\}/.test(text));
    expect(posters.map(({ path }) => path)).toEqual([STAGE_ACCOUNT]);
    // The flag, not just the address: without it the same form publishes and mails (#825).
    expect(posters[0]?.text).toContain('name="draft"');
    expect(posters[0]?.text).toContain('value="1"');
  });
});

describe("the start band", () => {
  const templates: RelationshipStartTemplate[] = [
    { id: "member-config-abc123", slug: "member-config-abc123", title: "Son Basics" },
  ];

  it("opens the flow's own address for the chosen template", () => {
    // The band holds slugs because the flow's URL carries the slug (#794), never the record id.
    expect(createRelationshipPath("member-config-abc123")).toBe(
      "/templates/relationship/member-config-abc123/create",
    );
    const html = renderToStaticMarkup(
      createElement(RelationshipStart, { copy: dashboardRelationshipsPageCopy, templates }),
    );
    expect(html).toContain('data-start-in-flow="true"');
    // Selecting is the only state this band owns; the button is the navigation.
    expect(html).toContain("Start the relationship");
  });

  it("writes nothing: no form, no hidden field, no action", () => {
    const html = renderToStaticMarkup(
      createElement(RelationshipStart, { copy: dashboardRelationshipsPageCopy, templates }),
    );
    expect(html).not.toContain("<form");
    expect(html).not.toContain('type="hidden"');
    expect(html).not.toContain("action=");
  });

  it("sends a member with no templates to write one, not to an empty select", () => {
    const html = renderToStaticMarkup(
      createElement(RelationshipStart, { copy: dashboardRelationshipsPageCopy, templates: [] }),
    );
    expect(html).toContain("No template is published to start from yet.");
    expect(html).toContain('href="/dashboard/templates"');
  });
});

/**
 * The public catalogue — the surface #957 was filed against.
 *
 * `/assessment` listed every published template with its own create form, and that form posted the
 * endpoint with no `draft` flag: one press wrote a **published** relationship, minted an invitation
 * and mailed it, with no plan and no card. The assertions below are the rendered property, so the
 * fix cannot be "the route refuses now" while the form is still drawn — a form that cannot succeed
 * is worse than no form.
 */
describe("the public catalogue", () => {
  const templates: TemplateSummary[] = [
    {
      id: "assessment-relationship-basics",
      slug: "relationship-basics",
      title: "Relationship basics",
      summary: "A starting point.",
      aspectCount: 3,
    },
    {
      id: "assessment-co-founders",
      slug: "co-founders",
      title: "Co-founders",
      summary: "Two people building one thing.",
      aspectCount: 5,
    },
  ];

  const rendered = () =>
    renderToStaticMarkup(createElement(TemplateList, { copy: assessmentPageCopy, templates }));

  it("renders no form and no field that could post a create", () => {
    const html = rendered();
    expect(html).not.toContain("<form");
    expect(html).not.toContain('method="post"');
    expect(html).not.toContain('name="templateRecordId"');
    expect(html).not.toContain('name="initiatorName"');
    expect(html).not.toContain('name="counterpartyName"');
    expect(html).not.toContain('name="mode"');
  });

  it("gives every card the flow's own door, exactly once", () => {
    const html = rendered();
    for (const template of templates) {
      const door = `href="${createRelationshipPath(template.slug)}"`;
      expect(html.split(door).length - 1, `${template.slug} must carry its door once`).toBe(1);
    }
  });

  it("does not spell the door itself: it is the shared card's anchor", () => {
    // The catalogue and the library must not be able to differ again (#957's "doomed if"). The href
    // lives in `template-card.tsx`, the one component both surfaces render, so a surface that wants
    // a different create path has to change the shared card and say so. Comment-proof: the check is
    // on the import and the rendered href, so a docstring may still name the helper.
    const list = sourceOf("components/assessment-flow/template-list.tsx");
    expect(list).not.toMatch(/import\s*\{[^}]*\bcreateRelationshipPath\b/);
    expect(list).not.toContain("href={createRelationshipPath(");
    expect(sourceOf("components/assessment-flow/template-card.tsx")).toContain(
      "href={createRelationshipPath(template.slug)}",
    );
  });
});
