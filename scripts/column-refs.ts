/**
 * column-refs — the left edge, measured instead of reviewed (#858).
 *
 * `data/surface-columns.ts` says which width each `app/(mainlayout)/` page draws in. This module
 * holds that registry against the tree, in both directions, and checks the two facts the registry
 * cannot see by itself:
 *
 *   1. **A `column` page really is one.** The page module renders `StageColumn`; the modules it
 *      imports directly do not re-centre the body with `mx-auto` or a bare `container` class.
 *   2. **A `wide`/`bleed` row is a decision.** It carries a reason, and `bleed` carries a `back`
 *      that resolves to another registered route — the way out of a surface that took the shell's
 *      chrome with it.
 *
 * ## Why centring is detected as `mx-auto` / `container` and not `max-w-*`
 *
 * The defect #858 removed is **centring**, not width: `container mx-auto max-w-4xl` puts the left
 * edge wherever the viewport says, so three pages had three left edges and a fourth moved at `md`.
 * A bare `max-w-*` is a *measure* — `max-w-2xl` on a subtitle, `max-w-md` on an empty state's
 * sentence — and banning it would mean either a thousand-line allowance list or a rule nobody can
 * keep. `w-full max-w-[1126px]` is the column itself, and it is not a finding: what makes the
 * column the column is that its left edge does not move. Both spellings of the actual defect are
 * caught, `mx-auto` alone and `container` (which centres itself at every breakpoint).
 *
 * ## What "the modules it imports directly" means
 *
 * One level: the page's own file plus every module it names in an import. That is where a
 * page-level shell lives — `instance-view.tsx`, `invite-view.tsx`, `report-view.tsx` were each
 * imported by exactly one page and each drew its own container. A component reached two levels
 * down is a component's own decision about its own box (`components/ui/**` primitives, whose
 * dialogs centre by design), not a page's column.
 *
 * The leftovers are named one at a time in `CENTRING_ALLOWANCES`: an **exact string in an exact
 * file**, never a whole file, and an allowance no walked source uses is itself a finding — the
 * shape `scripts/brand-word.ts` already proves. The check cannot be widened in place by adding a
 * file, and it cannot rot silently when the string moves.
 *
 * ## `--check` is the only mode
 *
 * `node scripts/column-refs.ts --check` — no build, no compile step, no `.datacheck` round trip.
 * It prints every registered route with its mode, then the census, then any problem by file and
 * line. Exit 0 green, 1 with the findings. `pnpm columns:check` is the same command, and
 * `scripts/verify.sh` runs it in **every lane** — the registry is a fixture, the check is a
 * script, the pages are code, and those three paths classify into three different lanes.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { SurfaceColumn, SurfaceColumnMode } from "../data/surface-columns";

/** A file as the check sees it: repo-relative POSIX path plus its source. */
export interface SourceFile {
  path: string;
  source: string;
}

/** The route group the rule is about. A page outside it is not this check's business. */
export const ROUTE_GROUP = "app/(mainlayout)";

/** One finding, with the file and line a reader can open. */
export interface Problem {
  file: string;
  line?: number;
  message: string;
}

/**
 * The page modules under the route group, in any order. Pure: the caller supplies the files, so
 * the cases hold a six-line fixture instead of a checkout.
 */
export function pagesOf(files: readonly SourceFile[]): SourceFile[] {
  return files.filter((file) => routeOfPageFile(file.path) !== null);
}

/**
 * `app/(mainlayout)/dashboard/page.tsx` → `/dashboard`. The root of the group would be `/`.
 *
 * Bracket segments are kept verbatim (`[id]`, `[instanceId]`): the registry spells a dynamic
 * route the way the directory does, so the two cannot disagree about a parameter's name.
 */
export function routeOfPageFile(path: string): string | null {
  const prefix = `${ROUTE_GROUP}/`;
  if (!path.startsWith(prefix) || !path.endsWith("/page.tsx")) return null;
  const route = path.slice(prefix.length, -"/page.tsx".length);
  return route === "" ? "/" : `/${route}`;
}

/**
 * The registry half: every page has a row, every row has a page, `wide`/`bleed` carry a reason,
 * `bleed` carries a `back` that is itself a registered route.
 *
 * Returned as problems rather than thrown, because the CLI prints all of them at once — a card
 * that adds a page usually gets two findings (its own missing row and the stale one it copied).
 */
export function registryProblems(
  pageFiles: readonly { route: string; file: string }[],
  rows: readonly SurfaceColumn[],
): Problem[] {
  const problems: Problem[] = [];
  const registryFile = "data/surface-columns.ts";
  const registered = new Set<string>();
  const knownRoutes = new Set(pageFiles.map((page) => page.route));

  for (const row of rows) {
    if (registered.has(row.path)) {
      problems.push({
        file: registryFile,
        message: `two rows for ${row.path} — one surface has one width`,
      });
    }
    registered.add(row.path);

    if (row.mode === "wide" || row.mode === "bleed") {
      if ((row.reason ?? "").trim() === "") {
        problems.push({
          file: registryFile,
          message: `${row.path} is ${row.mode} with no reason — an exception nobody argued for is a page somebody forgot`,
        });
      }
    } else if (row.reason !== undefined) {
      problems.push({
        file: registryFile,
        message: `${row.path} is column but carries a reason — reach for wide or bleed instead of excusing the column`,
      });
    }

    if (row.mode === "bleed") {
      const back = row.back;
      if (back === undefined || back.trim() === "") {
        problems.push({
          file: registryFile,
          message: `${row.path} is bleed with no back — a surface that takes the shell's chrome owes the way out`,
        });
      } else if (!knownRoutes.has(back)) {
        problems.push({
          file: registryFile,
          message: `${row.path} backs onto ${back}, which no page under ${ROUTE_GROUP} owns — the way out points at a 404`,
        });
      }
    } else if (row.back !== undefined) {
      problems.push({
        file: registryFile,
        message: `${row.path} is ${row.mode} but names a back — only bleed surfaces lose the shell's chrome`,
      });
    }
  }

  for (const page of pageFiles) {
    if (!registered.has(page.route)) {
      problems.push({
        file: page.file,
        message: `${page.route} has no row — every page under ${ROUTE_GROUP} is column, wide or bleed, and a missing row is how a page joins the wrong one`,
      });
    }
  }
  for (const row of rows) {
    if (!knownRoutes.has(row.path)) {
      problems.push({
        file: registryFile,
        message: `${row.path} is registered but no page under ${ROUTE_GROUP} owns it — a stale row is a decision about nothing`,
      });
    }
  }

  return problems;
}

/**
 * Every `mx-auto` and every bare `container` class token, with a 1-based line.
 *
 * A comment is a finding on purpose: #717's own note in `stage-column.tsx` spells
 * `mx-auto max-w-*` in prose, and a check that skips comments would also skip the next page's
 * copy-pasted docstring explaining why it centres. The allowance list is how a deliberate one is
 * declared.
 */
export function centringHits(source: string): { line: number; token: string; text: string }[] {
  const hits: { line: number; token: string; text: string }[] = [];
  /**
   * A comment is prose, and this change is full of it: the column's docstring spells
   * `mx-auto max-w-*` to name what it forbids, and `audit-log.tsx` says "a scroll container draws
   * no scrollbar". A check that read its own documentation as a violation would teach the next
   * writer to stop documenting. Block comments are blanked first — keeping their newlines, so the
   * line numbers stay honest — and a `//` line is dropped below.
   */
  const code = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ""));
  const lines = code.split("\n");
  const CENTRED = /\bmx-auto\b/;
  /** `container` as a class of its own — not `containerRef`, not `containerWidth`. */
  const CONTAINER = /(?:^|[\s"'`])container(?=[\s"'`])/;
  const LINE_COMMENT = /^\s*\/\//;

  lines.forEach((text, index) => {
    if (LINE_COMMENT.test(text)) return;
    if (CENTRED.test(text)) hits.push({ line: index + 1, token: "mx-auto", text: text.trim() });
    else if (CONTAINER.test(text))
      hits.push({ line: index + 1, token: "container", text: text.trim() });
  });
  return hits;
}

/**
 * The specifiers a module imports — `@/…` and relative only, which is everything a page in this
 * tree uses to reach a component. External packages (`react`, `lucide-react`) and type-only
 * imports are dropped: neither can carry a page's box, and `import type` is erased anyway.
 */
export function importedModules(source: string): string[] {
  const specifiers: string[] = [];
  const IMPORT = /^\s*import\s+(?!type\s)(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/gm;
  let match = IMPORT.exec(source);
  while (match !== null) {
    const specifier = match[1];
    if (specifier !== undefined && (specifier.startsWith("@/") || specifier.startsWith("."))) {
      specifiers.push(specifier);
    }
    match = IMPORT.exec(source);
  }
  return specifiers;
}

/**
 * Where a specifier lands, given the importing file's path — `@/` is the repo root, `./x` is
 * relative to the importer. `exists` decides the extension and index fallbacks, so this stays a
 * pure function the cases can drive with a hand-written file set.
 */
export function resolveImport(
  fromFile: string,
  specifier: string,
  exists: (path: string) => boolean,
): string | null {
  const base = specifier.startsWith("@/")
    ? specifier.slice(2)
    : posix.normalize(posix.join(posix.dirname(fromFile), specifier));
  for (const suffix of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    if (exists(`${base}${suffix}`)) return `${base}${suffix}`;
  }
  return null;
}

/**
 * An exact string in an exact file, with the sentence that justifies it. Never a whole file:
 * `stage-shell.tsx` may centre its dialog and may not centre its page.
 */
export interface CentringAllowance {
  file: string;
  /** The exact trimmed line the source carries. A moved string makes the allowance unused. */
  text: string;
  why: string;
}

export const CENTRING_ALLOWANCES: readonly CentringAllowance[] = [
  {
    file: "components/assessment-flow/stage-shell.tsx",
    text: '"lg:inset-6 lg:mx-auto lg:max-w-[880px] lg:rounded-lg lg:border",',
    why: "The v7 stage dialog is capped at 880px and centred on purpose (#760) — a dialog is a sheet, not a page column.",
  },
];

/**
 * Does this page's left edge come from `StageColumn` — its own markup, or a component it imports?
 *
 * The second half is what keeps the check from demanding a second wrapper: `StageShell`, the
 * admin views #717 moved, and the member views (`settings-view`, `my-instances`, `overview`) each
 * render the column themselves, and a page that mounted another one would nest two boxes.
 */
export function rendersColumn(
  pageSource: string,
  directImports: readonly string[],
  files: ReadonlyMap<string, SourceFile>,
): boolean {
  if (pageSource.includes("<StageColumn")) return true;
  return directImports.some((path) => files.get(path)?.source.includes("<StageColumn") ?? false);
}

/**
 * Is a `"<path>"` literal spelled within `depth` imports of this page?
 *
 * A `bleed` row's `back` is a claim about a control, and the control is written as a path in the
 * chrome. Two hops covers the shipped shapes (page → view → header) while staying a bounded walk:
 * a full transitive walk would reach the whole app from any page and prove nothing.
 */
export function reachesLiteral(
  fromPath: string,
  literal: string,
  files: ReadonlyMap<string, SourceFile>,
  depth = 2,
): boolean {
  const needle = `"${literal}"`;
  let frontier = [fromPath];
  const seen = new Set(frontier);
  const exists = (path: string) => files.has(path);

  for (let hop = 0; hop <= depth; hop += 1) {
    const next: string[] = [];
    for (const path of frontier) {
      const source = files.get(path)?.source;
      if (source === undefined) continue;
      if (source.includes(needle)) return true;
      for (const specifier of importedModules(source)) {
        const target = resolveImport(path, specifier, exists);
        if (target !== null && !seen.has(target)) {
          seen.add(target);
          next.push(target);
        }
      }
    }
    frontier = next;
  }
  return false;
}

/** The result of a whole run, so the CLI and the cases print the same numbers. */
export interface ColumnReport {
  problems: Problem[];
  routes: { path: string; mode: SurfaceColumnMode }[];
  census: {
    pages: number;
    column: number;
    wide: number;
    bleed: number;
    scanned: number;
    allowances: number;
  };
}

/**
 * The whole check over an in-memory tree. Files outside the walk are simply not read, so a case
 * can hand in three files and get the same judgement the gate makes over three hundred.
 */
export function checkColumns(input: {
  files: readonly SourceFile[];
  rows: readonly SurfaceColumn[];
}): ColumnReport {
  const byPath = new Map(input.files.map((file) => [file.path, file]));
  const exists = (path: string) => byPath.has(path);
  const pages = pagesOf(input.files);
  const routes = pages
    .map((page) => routeOfPageFile(page.path) ?? "")
    .sort()
    .map((path) => {
      const row = input.rows.find((candidate) => candidate.path === path);
      return { path, mode: row?.mode ?? ("column" as SurfaceColumnMode) };
    });

  const problems = registryProblems(
    pages.map((page) => ({ route: routeOfPageFile(page.path) ?? "", file: page.path })),
    input.rows,
  );

  const usedAllowances = new Set<string>();
  const scanned = new Set<string>();

  for (const page of pages) {
    const route = routeOfPageFile(page.path) ?? "";
    const row = input.rows.find((candidate) => candidate.path === route);
    if (row === undefined) continue;

    /**
     * The page and, in `column` mode, the modules it imports directly. A `wide`/`bleed` row is the
     * registered exception for its own view — that is what the row is — so its imports are left
     * alone; only the page module itself is held to "does not centre". `components/ui/**` is
     * skipped because a primitive's geometry is not a page's column (a dialog centres itself).
     */
    const owned = new Set<string>([page.path]);
    const directImports = importedModules(page.source)
      .map((specifier) => resolveImport(page.path, specifier, exists))
      .filter((path): path is string => path !== null);
    if (row.mode === "column") {
      for (const path of directImports) {
        if (!path.startsWith("components/ui/")) owned.add(path);
      }
    }

    for (const path of owned) {
      const file = byPath.get(path);
      if (file === undefined) continue;
      scanned.add(path);
      for (const hit of centringHits(file.source)) {
        const allowance = CENTRING_ALLOWANCES.find(
          (candidate) => candidate.file === path && candidate.text.trim() === hit.text,
        );
        if (allowance !== undefined) {
          usedAllowances.add(`${path}::${allowance.text.trim()}`);
          continue;
        }
        problems.push({
          file: path,
          line: hit.line,
          message: `${hit.token} re-centres ${route} — the column owns the left edge; drop it and let the page's StageColumn place the body`,
        });
      }
    }

    /**
     * The left edge is owned when the page renders the column, or when a component it renders
     * does. The second form is derived, not listed: `StageShell` and the admin views #717 already
     * moved render `StageColumn` themselves, and demanding a second wrapper in the page would be
     * the fork this card forbids. A page two imports away from the column still fails, which is
     * the case that matters — a new page that draws no column at all.
     */
    if (row.mode === "column" && !rendersColumn(page.source, directImports, byPath)) {
      problems.push({
        file: page.path,
        message: `${route} is registered column but nothing it renders draws StageColumn — the column exists for every dashboard page, and a new surface joins it`,
      });
    }
    /**
     * A `bleed` surface owes the way back **in its own chrome**, and the way back is a path a
     * module under it must spell. Two hops, because the control often lives one level below the
     * page: `/quiz/[id]/play` renders `QuizPlay`, which renders `QuizHeader`, and it is the header
     * that carries `Back to Explore` (`back: "/explore"`). Checking the literal is what keeps the
     * registry's `back` from describing a control nobody built.
     */
    if (row.mode === "bleed" && row.back !== undefined) {
      if (!reachesLiteral(page.path, row.back, byPath)) {
        problems.push({
          file: page.path,
          message: `${route} is bleed but no module within two imports of the page spells "${row.back}" — the way back is a control, not a sentence in the registry`,
        });
      }
    }
  }

  for (const allowance of CENTRING_ALLOWANCES) {
    /**
     * Only a file this run actually walked can make an allowance stale. A six-line fixture never
     * reaches `stage-shell.tsx`, and reporting it as "unused" there would make every small case
     * fail for a reason that has nothing to do with what it asserts.
     */
    if (!scanned.has(allowance.file)) continue;
    if (!usedAllowances.has(`${allowance.file}::${allowance.text.trim()}`)) {
      problems.push({
        file: allowance.file,
        message: `stale allowance — no walked source carries "${allowance.text.trim()}" (${allowance.why}); delete the row rather than letting the check's escape hatch drift`,
      });
    }
  }

  const counts: Record<SurfaceColumnMode, number> = { column: 0, wide: 0, bleed: 0 };
  for (const route of routes) counts[route.mode] += 1;

  return {
    problems,
    routes,
    census: {
      pages: routes.length,
      column: counts.column ?? 0,
      wide: counts.wide ?? 0,
      bleed: counts.bleed ?? 0,
      scanned: scanned.size,
      allowances: usedAllowances.size,
    },
  };
}

// ── the CLI ─────────────────────────────────────────────────────────────────────────────────────

/** Every `.tsx`/`.ts` file under a directory, repo-relative. */
function walk(directory: string, repoRoot: string): SourceFile[] {
  const files: SourceFile[] = [];
  const visit = (absolute: string) => {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const next = join(absolute, entry.name);
      if (entry.isDirectory()) visit(next);
      else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
        files.push({
          path: posix.join(...next.slice(repoRoot.length + 1).split(/[\\/]/)),
          source: readFileSync(next, "utf8"),
        });
      }
    }
  };
  visit(directory);
  return files;
}

async function main(): Promise<number> {
  const repoRoot = process.cwd();
  const registryPath = resolve(repoRoot, "data/surface-columns.ts");
  if (!existsSync(registryPath)) {
    console.error("column-refs: data/surface-columns.ts is missing — the registry is the rule");
    return 1;
  }
  const registry = (await import(pathToFileURL(registryPath).href)) as {
    surfaceColumns: readonly SurfaceColumn[];
  };

  /**
   * The scan set is the whole app shell plus the component and data trees: a page's direct
   * imports can land anywhere under `components/`, and the case that matters is a view that never
   * lived where its name suggests.
   */
  const files = [
    ...walk(resolve(repoRoot, ROUTE_GROUP), repoRoot),
    ...walk(resolve(repoRoot, "components"), repoRoot),
  ];
  const report = checkColumns({ files, rows: registry.surfaceColumns });

  const width = Math.max(...report.routes.map((route) => route.path.length));
  for (const route of report.routes) {
    console.log(`  ${route.mode.padEnd(6)} ${route.path.padEnd(width)}`);
  }
  const { census } = report;
  console.log(
    `\ncolumn-refs: ${census.pages} ${ROUTE_GROUP} page(s) — ${census.column} column, ${census.wide} wide, ${census.bleed} bleed; ${census.scanned} module(s) scanned, ${census.allowances} allowance(s) used`,
  );

  if (report.problems.length === 0) {
    console.log("column-refs: PASS — every page declares its width, and no column page re-centres");
    return 0;
  }
  console.error(`\ncolumn-refs: FAIL — ${report.problems.length} problem(s)`);
  for (const problem of report.problems) {
    console.error(`  ${problem.file}:${problem.line ?? "-"} ${problem.message}`);
  }
  return 1;
}

/**
 * Invoked directly, or imported by a case?
 *
 * `process.argv[1]` rather than `import.meta.url`: this module is also compiled by
 * `tsconfig.datacheck.json`, which pins `module: commonjs`, and `import.meta` is a compile error
 * there — the check has to be loadable by both runners or the test suite cannot import it.
 */
const invokedDirectly = /column-refs\.(?:ts|js)$/.test(process.argv[1] ?? "");

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  if (!argv.includes("--check")) {
    console.error("column-refs: pass --check (there is no write mode; the registry is authored)");
    process.exit(2);
  }
  main().then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error("column-refs: the check itself failed", error);
      process.exit(1);
    },
  );
}
