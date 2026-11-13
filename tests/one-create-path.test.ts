/**
 * **One create path, and it is the flow's modal (#913).**
 *
 * The owner's rule is "a new relationship starts the modal". The defect behind it was a second
 * create path: `components/dashboard/relationship-create.tsx` copied the template itself through a
 * server action, and the row it wrote had **no session and no seats** — so the card's
 * `Invite Members` had no pay modal to open (stage 5 reads a session) and `Publish to Counterparty`
 * had no invitation to mint. The screen offered two controls that could never complete.
 *
 * So the claim is not "the band navigates instead of writing" on its own; it is that **no surface
 * can write a relationship row except the flow**, which is where stage 4 writes the session and the
 * staged invitation the later stages read. Three seams, each a different way the defect could come
 * back:
 *
 *   the row          exactly one module in the tree executes `INSERT INTO relationship`. Asserted
 *                    over the source, because the class is "a fourth writer somebody adds later",
 *                    not "this writer is wrong".
 *   the action       the list's create server action is gone by name, so re-mounting the old band
 *                    fails here even if the library function were restored.
 *   the control      the band that remains navigates to the flow's address and carries no form,
 *                    no hidden field and no action — a rendered property, not a comment.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

import {
  RelationshipStart,
  type RelationshipStartTemplate,
} from "@/components/dashboard/relationship-create";
import { dashboardRelationshipsPageCopy } from "@/data/pages/dashboard-relationships";
import { createRelationshipPath } from "@/lib/flow/paths";

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

/** The one module allowed to write a relationship row — the create flow's store. */
const FLOW_STORE = "lib/flow/store.ts";

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
    const library = readFileSync(join(ROOT, "lib/member/relationships.ts"), "utf8");
    expect(library).not.toContain("export async function createRelationship");
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
