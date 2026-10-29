/**
 * The slot surfaces — the half of the join `data:check` cannot see.
 *
 * `E28` proves that every `promotions[].slot` names a shelf position that renders the
 * promoted quiz. It proves nothing about whether a **page renders that shelf**:
 * `explore-page/popular[1]` passed every check while its only rendering component had
 * no importers at all, so the campaign advertised numbers on no screen (P3b, and the
 * reason a campaign is "the one failure mode a promotion has").
 *
 * This case closes that gap against the import graph the app already has, for every
 * slot group in `slotShelves`:
 *
 *   1. some module under `components/` or `app/` renders the shelf (its name appears as
 *      a string literal there — how `shelfCards()` and `quizzesFor()` are called);
 *   2. that module is reachable from a `page.tsx` under `app/` — not dead code;
 *   3. every page that renders it is request-time (`export const dynamic =
 *      "force-dynamic"`). A static page evaluates the campaign window at **build**
 *      time, so a reachable-but-static surface would ship the catalog numbers for the
 *      whole window, or freeze the campaign numbers of a build made inside it (D9).
 *
 * It is a structural test, not a render test: the assertion is "the shelf a slot names
 * is on a page", which is exactly what was false, and it needs no browser. A refactor
 * that passes a shelf name through a variable instead of a literal will fail here —
 * that is the intended cost, because the name would otherwise stop being traceable from
 * the slot table that gives it meaning.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";

import { slotShelves, type QuizShelf } from "../../data/quiz-catalogue";

const ROOT = process.cwd();
/** Where a shelf may be rendered: the two trees that become the app. */
const RENDER_ROOTS = ["components", "app"] as const;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) files.push(full);
  }
  return files;
}

/** `@/x` -> `<root>/x`; `./x` and `../x` -> relative to the importing file; else null. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return join(ROOT, specifier.slice(2));
  if (specifier.startsWith(".")) return join(dirname(fromFile), specifier);
  return null;
}

function asModule(base: string): string | undefined {
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not this candidate
    }
  }
  return undefined;
}

const IMPORT = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+["']([^"']+)["']/g;

/** file -> files it imports (in-repo only). */
function importEdges(files: readonly string[]): Map<string, string[]> {
  const edges = new Map<string, string[]>();
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const targets: string[] = [];
    for (const match of source.matchAll(IMPORT)) {
      const base = resolveSpecifier(file, match[1]);
      if (base === null) continue;
      const target = asModule(base);
      if (target !== undefined) targets.push(target);
    }
    edges.set(file, targets);
  }
  return edges;
}

/** Every page module under `app/` — the only entry points a visitor can reach. */
function pageModules(files: readonly string[]): string[] {
  return files.filter((file) => {
    const name = relative(join(ROOT, "app"), file);
    return name === "page.tsx" || name.endsWith("/page.tsx") || name.endsWith("\\page.tsx");
  });
}

const SOURCES = RENDER_ROOTS.flatMap((root) => walk(join(ROOT, root)));
const EDGES = importEdges(SOURCES);
const PAGES = pageModules(SOURCES);

/**
 * The modules that render one shelf: its name is passed to one of the two shelf
 * readers. A prose mention (a docstring naming a shelf) is not a renderer — the first
 * version of this case accepted one and reported the mounted page as covered.
 */
function renderersOf(shelf: QuizShelf): string[] {
  const callSite = new RegExp(`\\b(?:shelfCards|quizzesFor)\\(\\s*["'\`]${shelf}["'\`]`);
  return SOURCES.filter((file) => callSite.test(readFileSync(file, "utf8")));
}

/** Pages that reach `target` through imports (reverse BFS, pages as sinks). */
function pagesRendering(target: string): string[] {
  const importers = new Map<string, string[]>();
  for (const [file, targets] of EDGES) {
    for (const to of targets) {
      const list = importers.get(to) ?? [];
      list.push(file);
      importers.set(to, list);
    }
  }
  const seen = new Set<string>([target]);
  const queue = [target];
  const pages: string[] = [];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (PAGES.includes(file)) pages.push(file);
    for (const importer of importers.get(file) ?? []) {
      if (seen.has(importer)) continue;
      seen.add(importer);
      queue.push(importer);
    }
  }
  return pages;
}

const DYNAMIC = /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/;

describe("every slot group a campaign can name has a live, request-time surface", () => {
  it("finds the pages it needs to judge", () => {
    assert.ok(PAGES.length > 20, `expected the app's pages, found ${PAGES.length}`);
    // The two routes that carry the two authored slots are part of that set.
    const routes = PAGES.map((file) => relative(join(ROOT, "app"), file).replaceAll("\\", "/"));
    assert.ok(routes.includes("(mainlayout)/explore/page.tsx"), routes.join(", "));
    assert.ok(routes.includes("(mainlayout)/explore/featured/page.tsx"), routes.join(", "));
  });

  for (const [group, shelf] of Object.entries(slotShelves) as Array<[string, QuizShelf]>) {
    it(`"${group}" is rendered by "${shelf}" on a page that is reachable and request-time`, () => {
      const renderers = renderersOf(shelf);
      assert.ok(
        renderers.length > 0,
        `no module under components/ or app/ renders shelf "${shelf}"`,
      );

      const surfaces = [...new Set(renderers.flatMap((file) => pagesRendering(file)))];
      assert.ok(
        surfaces.length > 0,
        `shelf "${shelf}" (slot group "${group}") is rendered only by unreachable modules: ${renderers
          .map((file) => relative(ROOT, file))
          .join(", ")}`,
      );

      for (const page of surfaces) {
        const where = relative(ROOT, page);
        assert.match(
          readFileSync(page, "utf8"),
          DYNAMIC,
          `${where} renders "${shelf}" (slot group "${group}") but is not request-time — ` +
            "a static render evaluates the campaign window at build time (D9)",
        );
      }
    });
  }
});
