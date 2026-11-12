/**
 * The admin console's shared column (#717, C3 of the #714 wave) — one container, not eighteen.
 *
 * (Twenty pages since #892 added the documentation hub and one document; the count in the first case
 * is the floor on the walk, and every other case derives the list.)
 *
 * The issue asked for the admin pages to adopt **one** container, and measured it the wrong way
 * round: `grep mx-auto 'app/(mainlayout)/admin' --include=page.tsx` returned 0 because the page
 * files are thin — they gate, read and hand the result to a view component — while the *view*
 * components drew a centred column each. Six `components/v1/admin-*.tsx` spelled
 * `mx-auto max-w-4xl|5xl|6xl p-4 sm:p-8`, `components/console/gap-analysis.tsx` spelled
 * `container mx-auto max-w-5xl`, and `components/admin/platform-health.tsx` spelled
 * `container mx-auto max-w-7xl`. Eight columns, four widths, and not one of them the app's own.
 *
 * So the rule this file pins is structural, because a screenshot cannot see an absent class and
 * none of these screens mounts without a database:
 *
 *   1. **Every admin page renders `StageColumn`** — the one container the rest of the app already
 *      uses (`components/console/overview.tsx`, the dashboard, the profile, the flow). The list is
 *      derived from the directory, so a nineteenth admin page inherits the rule instead of the
 *      exemption.
 *   2. **Nothing under the admin views centres a column of its own** — no `mx-auto` beside the
 *      shared column, and no `container mx-auto` reintroducing one at the view root.
 *   3. **`StageColumn` itself is one max width and no centring**, which is what makes (2) a
 *      measurable rule rather than a preference.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StageColumn } from "@/components/assessment-flow/stage-column";

const ADMIN_ROOT = "app/(mainlayout)/admin";

/** Every `page.tsx` under the admin subtree, derived — never a list to keep in step by hand. */
function adminPages(dir = ADMIN_ROOT): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...adminPages(path));
    else if (entry.name === "page.tsx") found.push(path);
  }
  return found.sort();
}

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** The file's code without its comments: a docstring that *describes* a centred column is prose. */
function code(path: string): string {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** The modules the admin pages render that used to draw a column of their own. */
function adminViews(dir = "components"): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === "ui") continue;
      found.push(...adminViews(path));
    } else if (entry.name.endsWith(".tsx") && isAdminView(path)) found.push(path);
  }
  return found.sort();
}

/**
 * The admin console's own modules: `components/admin/**`, `components/console/**` and the six
 * `components/v1/admin-*.tsx` screens the console was moved out of the prototype with (#478).
 * Scoped on purpose — `components/ui/**` is primitives and `components/v1/**` otherwise is the
 * retired prototype, which has its own shell.
 */
function isAdminView(path: string): boolean {
  return (
    path.startsWith("components/admin/") ||
    path.startsWith("components/console/") ||
    /^components\/v1\/admin-[^/]+\.tsx$/.test(path)
  );
}

describe("the admin console's shared column", () => {
  it("exists — twenty-one pages today, and every one of them is a page module", () => {
    // Eighteen from #717's wave, plus the documentation hub and one document (#892), plus the brand
    // and audience profile (#906). The count is a floor on the walk, not a list: the two cases below
    // derive the pages and hold each one to the rule, so a twenty-second page inherits it.
    const pages = adminPages();
    expect(pages.length).toBe(21);
  });

  it("is what every admin page renders inside", () => {
    for (const path of adminPages()) {
      const file = code(path);
      expect(file, `${path} imports the shared column`).toContain("stage-column");
      expect(file, `${path} renders the shared column`).toContain("<StageColumn>");
      expect(file, `${path} closes the shared column`).toContain("</StageColumn>");
    }
  });

  it("leaves no admin page centring a column of its own", () => {
    for (const path of adminPages()) {
      expect(code(path), `${path} must not centre its column`).not.toContain("mx-auto");
    }
  });

  it("leaves no admin view drawing a second column beside it", () => {
    const views = adminViews();
    // The census: the folder that carries the rule is not silently empty.
    expect(views.length).toBeGreaterThan(10);
    for (const path of views) {
      const file = code(path);
      expect(file, `${path} must not centre a column of its own`).not.toContain("mx-auto");
      // Tailwind's `container` utility is the other way a view spelled its own page width.
      expect(file, `${path} must not reintroduce a container`).not.toMatch(
        /className="container\b/,
      );
    }
  });
});

describe("the column itself", () => {
  it("is one max width with the left edge where main put it — never centred", () => {
    const html = renderToStaticMarkup(createElement(StageColumn, null, "band"));
    expect(html).toContain("max-w-[1126px]");
    expect(html).toContain("w-full");
    expect(html).not.toContain("mx-auto");
  });
});
