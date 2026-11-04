/**
 * leaving-links — a link out of the dashboard opens a new tab (E39).
 *
 * The product has two trees: `app/(mainlayout)/**` is the dashboard (the shell a signed-in
 * reader works in) and `app/(marketing)/**` is the public site (`/`, `/welcome`, `/pricing`,
 * `/terms`, `/privacy`, `/help`, the support articles). A dashboard link to a public page
 * moves the reader out of the app; done in the same tab it throws away the screen they were
 * on — a half-finished form, a filtered list, the quiz they were mid-way through. So the rule
 * is that the departure opens a **new tab**, marked as such, or it is a defect.
 *
 * Three properties, and all three are checked:
 *
 *   - `target="_blank"` on the element that carries the literal `href`;
 *   - `rel="noopener noreferrer"` on the same element — `noopener` because a page holding
 *     `window.opener` can navigate the app's tab, `noreferrer` because the public site has no
 *     business knowing which in-app screen the reader left;
 *   - and the departure is announced. `aria-label` is the announcement (the accessible name
 *     must end "opens in a new tab"), the `ExternalLink` marker beside it is the visual half.
 *
 * **Scope is derived, never listed.** The dashboard's files are the ones reachable from
 * `app/(mainlayout)/**` and *not* reachable from `app/(marketing)/**` or `app/(auth)/**`:
 * attribution by the import graph, the same question E23 asks of the copy budget. A module both
 * trees render cannot carry a `target` — that would change what a marketing page does to its
 * own reader — so it is out of the first rule, and the second rule covers it instead: a
 * dashboard file may only mount such a surface in leaving mode (see `departureSurfaces`).
 *
 * `components/layout/leaving-link.tsx` is the sanctioned way to leave, and the rule accepts it
 * by name because the component owns the pair. Everything here is pure — the tree arrives as
 * `{ path → source }` — so `scripts/__tests__/leaving-links.test.ts` drives every shape (a
 * bare `Link`, a correct `a`, the component, a shared surface, the mount that forgot its prop)
 * without a filesystem, and its last section asserts the real tree is clean.
 */
import { importClosure, localImports, resolveSpecifier } from "./copy-refs";
import { hrefLiterals, type SourceFile } from "./ui-refs";

export interface LeavingFinding {
  readonly rule: "E39";
  /** Repo-relative path, reported verbatim so a terminal can jump to it. */
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

/** The tree the reader is working in, and the two trees they can leave for. */
export const DASHBOARD_GROUP = "app/(mainlayout)";
export const PUBLIC_GROUPS: readonly string[] = ["app/(marketing)", "app/(auth)"];

/**
 * The floor for the dashboard walk. A classifier that quietly matched no file would report a
 * clean tree, which is worse than no rule; measured at ~430 on the tree that added this rule
 * (pages, layouts, and every component only the dashboard reaches), so 150 is a floor a large
 * refactor cannot trip by accident and an empty walk cannot pass.
 */
export const LEAVING_MIN_WALKED = 150;

/** The component that owns `target` + `rel` + the marker (`components/layout/leaving-link.tsx`). */
export const LEAVING_COMPONENT = "LeavingLink";

const MARKETING_PAGE = /^app\/\(marketing\)\/(?:(.+)\/)?page\.tsx?$/;

/**
 * The routes the public site answers, derived from the page files in the group.
 *
 * Derived because the list in a doc goes stale the moment a marketing page ships: `/help` and
 * `/support/articles/[slug]` are public pages the original card did not name, and a hand-kept
 * list would have called them in-app navigation.
 */
export function marketingRoutes(paths: readonly string[]): string[] {
  const routes = new Set<string>();
  for (const path of paths) {
    const match = MARKETING_PAGE.exec(path.split("\\").join("/"));
    if (!match) continue;
    routes.add(match[1] === undefined ? "/" : `/${match[1]}`);
  }
  return [...routes].sort();
}

/** `/pricing?plan=pro` → `/pricing`; `/#templates` → `/`. */
export function routeOfHref(href: string): string {
  return href.split(/[?#]/)[0] || "/";
}

/**
 * Whether a literal `href` addresses the public site. `[slug]` is a prefix match
 * (`/support/articles/[slug]` owns `/support/articles/xyz`); everything else is exact.
 */
export function isMarketingDestination(routes: readonly string[], href: string): boolean {
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("${")) return false;
  const route = routeOfHref(href);
  return routes.some((candidate) =>
    candidate.endsWith("/[slug]")
      ? route.startsWith(candidate.slice(0, -"[slug]".length)) || route === candidate
      : route === candidate,
  );
}

/** Every path reachable from the page/layout files under `prefix`, seeded by them. */
function reachableFrom(files: readonly SourceFile[], prefix: string): Set<string> {
  const reached = new Set<string>();
  for (const file of files) {
    if (!file.path.startsWith(prefix)) continue;
    for (const path of importClosure(file.path, files)) reached.add(path);
  }
  return reached;
}

/**
 * The dashboard's own files: reachable from `app/(mainlayout)/**`, not reachable from either
 * public tree. This is the set the first rule reads.
 */
export function dashboardFiles(files: readonly SourceFile[]): SourceFile[] {
  const dashboard = reachableFrom(files, DASHBOARD_GROUP);
  const publicTrees = PUBLIC_GROUPS.flatMap((group) => [...reachableFrom(files, group)]);
  const shared = new Set(publicTrees);
  return files.filter((file) => dashboard.has(file.path) && !shared.has(file.path));
}

/** One JSX opening element: the tag, its extent and its start-tag text. */
interface Element {
  readonly tag: string;
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** The `>` that closes a start tag, tracking quotes and `{}` so `=>` and `"a>b"` do not end it. */
function startTagEnd(source: string, from: number): number | undefined {
  let quote: string | undefined;
  let braces = 0;
  for (let i = from; i < source.length; i += 1) {
    const char = source[i];
    if (quote !== undefined) {
      if (char === quote && source[i - 1] !== "\\") quote = undefined;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") braces += 1;
    else if (char === "}") braces -= 1;
    else if (braces === 0 && char === ">") return i;
    // A `<` at depth 0 means this was not a start tag after all (`a < b`), so stop looking.
    else if (braces === 0 && char === "<") return undefined;
  }
  return undefined;
}

/** Every JSX opening element in a source, in file order. */
function elements(source: string): Element[] {
  const found: Element[] = [];
  const pattern = /<([A-Za-z][\w.$]*)/g;
  for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) {
    const end = startTagEnd(source, pattern.lastIndex);
    if (end === undefined) continue;
    found.push({
      tag: match[1],
      start: match.index,
      end,
      text: source.slice(match.index, end + 1),
    });
  }
  return found;
}

/** The innermost element containing `at` — the one whose tag owns the attribute there. */
function enclosing(elementsOfFile: readonly Element[], at: number): Element | undefined {
  let best: Element | undefined;
  for (const element of elementsOfFile) {
    if (element.start > at || element.end < at) continue;
    if (best === undefined || element.start > best.start) best = element;
  }
  return best;
}

const TARGET_BLANK = /target=(?:"_blank"|\{\s*"_blank"\s*\})/;
const REL_ATTR = /rel=(?:"([^"]*)"|\{\s*"([^"]*)"\s*\})/;

/** `rel` carries both tokens, in any order and with any spacing. */
function relIsSafe(relText: string): boolean {
  const tokens = relText.trim().split(/\s+/);
  return tokens.includes("noopener") && tokens.includes("noreferrer");
}

/**
 * Every literal dashboard link to a public page that does not open a new tab.
 *
 * A literal, because the check is static by the same decision `scripts/ui-refs.ts` states:
 * `href={item.href}` is the model's business, and a rule that guessed at it would be a rule
 * that guesses. The element is read, not the line, so a multi-line JSX tag is checked whole.
 */
export function unmarkedLeavingLinks(input: {
  readonly files: readonly SourceFile[];
  readonly routes: readonly string[];
  /** The shared surfaces that take `leaving`; their tags are accepted as a marked departure. */
  readonly surfaces?: readonly DepartureSurface[];
}): LeavingFinding[] {
  const findings: LeavingFinding[] = [];
  const leavingTags = new Set((input.surfaces ?? []).map((surface) => surface.symbol));
  for (const file of input.files) {
    const elementsOfFile = elements(file.source);
    for (const link of hrefLiterals([file])) {
      if (!isMarketingDestination(input.routes, link.value)) continue;
      const element = enclosing(elementsOfFile, link.at);
      if (element === undefined) {
        findings.push({
          rule: "E39",
          file: file.path,
          line: link.line,
          message: `links "${link.value}" outside any element — the departure cannot be marked`,
        });
        continue;
      }
      if (element.tag === LEAVING_COMPONENT) continue;
      if (TARGET_BLANK.test(element.text) && relIsSafe(relTextOf(element.text))) continue;
      // A shared row (`NavRow`) takes the destination as a prop, so it cannot spell the pair at
      // the call site: `leaving` is that row's contract, and it is only accepted from a surface
      // this walk found — not from a tag that merely says the word.
      if (leavingTags.has(element.tag) && /(?:^|\s)leaving(?:=|\s|\/|>)/.test(element.text)) {
        continue;
      }
      findings.push({
        rule: "E39",
        file: file.path,
        line: link.line,
        message:
          `<${element.tag} href="${link.value}"> leaves the dashboard for the public site without ` +
          `target="_blank" + rel="noopener noreferrer" — use LeavingLink ` +
          `(components/layout/leaving-link.tsx), which owns the pair and the marker`,
      });
    }
  }
  return findings;
}

function relTextOf(tagText: string): string {
  const match = REL_ATTR.exec(tagText);
  return match?.[1] ?? match?.[2] ?? "";
}

/** A module the dashboard shares with a public tree, and the export that carries the departure. */
export interface DepartureSurface {
  /** Repo-relative module path, e.g. `components/layout/footer.tsx`. */
  readonly module: string;
  /** The exported component the dashboard mounts, e.g. `Footer`. */
  readonly symbol: string;
}

/** A top-level declaration: a function, a component or a value the module exports or uses. */
interface Declaration {
  readonly name: string;
  readonly exported: boolean;
  readonly start: number;
  readonly end: number;
}

const DECLARATION = /^(?:export\s+)?(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm;
const IMPORT_SYMBOLS = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;

/** Every top-level declaration in a module, in file order. */
function declarationsOf(source: string): Declaration[] {
  const starts = [...source.matchAll(DECLARATION)];
  return starts.map((match, index) => ({
    name: match[1],
    exported: /^export\b/.test(match[0]),
    start: match.index,
    end: starts[index + 1]?.index ?? source.length,
  }));
}

/** The declarations a set of root names reaches, following one name mentioned by another. */
function reachableDeclarations(
  declarations: readonly Declaration[],
  roots: readonly string[],
  source: string,
): Set<string> {
  const reached = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const name = queue.pop() as string;
    if (reached.has(name)) continue;
    reached.add(name);
    const declaration = declarations.find((candidate) => candidate.name === name);
    if (declaration === undefined) continue;
    const body = source.slice(declaration.start, declaration.end);
    for (const other of declarations) {
      if (other.name === name || reached.has(other.name)) continue;
      const mention = new RegExp(`\\b${other.name.replace(/\$/g, "\\$")}\\b`);
      if (!mention.test(body)) continue;
      queue.push(other.name);
    }
  }
  return reached;
}

/** The symbols one file imports from one module, resolved through `@/` and relative paths. */
export function importedSymbols(
  file: SourceFile,
  module: string,
  known: ReadonlySet<string>,
): string[] {
  const symbols: string[] = [];
  IMPORT_SYMBOLS.lastIndex = 0;
  for (
    let match = IMPORT_SYMBOLS.exec(file.source);
    match !== null;
    match = IMPORT_SYMBOLS.exec(file.source)
  ) {
    if (resolveSpecifier(file.path, match[2], known) !== module) continue;
    for (const part of match[1].split(",")) {
      const name = part
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim();
      if (name) symbols.push(name);
    }
  }
  return symbols;
}

/**
 * The shared surfaces that carry a public link — `Footer` and `AppNav` are the two today: the
 * marketing layout mounts `Footer` and so does the tournaments page, and the marketing header
 * mounts `PublicNav` from the module the dashboard's rail lives in. Neither may hard-code a
 * `target` (that would open the public site's own navigation in a new tab), so the departure is
 * a **prop** the mount passes: `leaving`.
 *
 * Derived from the tree, in three steps: the module is reachable from both the dashboard and a
 * public tree; it is split into top-level declarations; and an *exported* declaration is a
 * surface when the declarations the dashboard imports reach a marketing `href`. Attribution is
 * by reference, not by line, so the rail's rows are attributed to `AppNav` (their component)
 * rather than to the internal menu function that happens to spell the href.
 */
export function departureSurfaces(input: {
  readonly files: readonly SourceFile[];
  readonly routes: readonly string[];
}): DepartureSurface[] {
  const dashboard = reachableFrom(input.files, DASHBOARD_GROUP);
  const shared = new Set(PUBLIC_GROUPS.flatMap((group) => [...reachableFrom(input.files, group)]));
  const dashboardFiles = input.files.filter(
    (file) => dashboard.has(file.path) && !shared.has(file.path),
  );
  const publicFiles = input.files.filter((file) => shared.has(file.path));
  const known = new Set(input.files.map((file) => file.path));
  const surfaces: DepartureSurface[] = [];

  for (const file of input.files) {
    if (!dashboard.has(file.path) || !shared.has(file.path)) continue;
    const declarations = declarationsOf(file.source);
    const spenders = declarations.filter((declaration) =>
      hrefLiterals([
        { path: file.path, source: file.source.slice(declaration.start, declaration.end) },
      ]).some((link) => isMarketingDestination(input.routes, link.value)),
    );
    if (spenders.length === 0) continue;

    const dashboardImports = new Set(
      dashboardFiles.flatMap((importer) => importedSymbols(importer, file.path, known)),
    );
    const publicImports = new Set(
      publicFiles.flatMap((importer) => importedSymbols(importer, file.path, known)),
    );

    for (const declaration of declarations) {
      if (!declaration.exported) continue;
      // **Both trees** is the whole test. A symbol only the dashboard mounts (`AppNav`) can
      // leave unconditionally inside its own module, so there is no prop to check; one only the
      // marketing tree mounts (`PublicNav`) has no dashboard mount at all. The symbol both trees
      // mount (`Footer`) is exactly the case that needs `leaving`, because its markup cannot be
      // written for one of them.
      if (!dashboardImports.has(declaration.name) || !publicImports.has(declaration.name)) continue;
      const reached = reachableDeclarations(declarations, [declaration.name], file.source);
      if (!spenders.some((spender) => reached.has(spender.name))) continue;
      surfaces.push({ module: file.path, symbol: declaration.name });
    }
  }
  return surfaces.sort(
    (a, b) => a.module.localeCompare(b.module) || a.symbol.localeCompare(b.symbol),
  );
}

/**
 * A dashboard file that mounts a shared departure surface must mount it in leaving mode.
 *
 * `leaving` is the one prop name the shell's shared chrome takes (`Footer`, `AppNav`): it says
 * "this mount is inside the app", so the surface opens a public destination in a new tab and
 * keeps an in-app destination in the tab the reader is in. A mount without it silently renders
 * the marketing behaviour inside the dashboard — the shape the element rule cannot see, because
 * the literal lives in the shared module and not at the mount.
 */
export function unmarkedLeavingMounts(input: {
  readonly files: readonly SourceFile[];
  readonly surfaces: readonly DepartureSurface[];
  /** The whole walk, so an import of a shared module resolves even though it is not in scope. */
  readonly sources?: readonly SourceFile[];
}): LeavingFinding[] {
  const findings: LeavingFinding[] = [];
  if (input.surfaces.length === 0) return findings;
  const sources = input.sources ?? input.files;
  const known = new Set(sources.map((file) => file.path));

  for (const file of input.files) {
    const imported = new Set(localImports(file, known));
    const tags = new Set(
      input.surfaces.filter((surface) => imported.has(surface.module)).map((s) => s.symbol),
    );
    if (tags.size === 0) continue;
    for (const element of elements(file.source)) {
      if (!tags.has(element.tag)) continue;
      if (/(?:^|\s)leaving(?:=|\s|\/|>)/.test(element.text)) continue;
      const line = file.source.slice(0, element.start).split("\n").length;
      findings.push({
        rule: "E39",
        file: file.path,
        line,
        message:
          `<${element.tag}> renders public links and is shared with the marketing tree — this ` +
          `dashboard mount must pass \`leaving\` so its links open a new tab`,
      });
    }
  }
  return findings;
}

/** The derived route set in the spelling the runtime table uses: `[slug]` → `*`. */
export function routePatterns(routes: readonly string[]): string[] {
  return routes
    .map((route) => (route.endsWith("/[slug]") ? `${route.slice(0, -"[slug]".length)}*` : route))
    .sort();
}

/**
 * `lib/marketing-routes.ts` is the runtime half of this rule and must equal the derived set.
 *
 * A component cannot read `app/(marketing)` at render time, so it matches against a table; a
 * table nobody holds to the tree is exactly the list-that-goes-stale the derivation exists to
 * avoid. The two are compared as sets, in both directions: a page that ships without a row is a
 * red build, and a row with no page is one too.
 */
export function runtimeTableDrift(input: {
  readonly routes: readonly string[];
  readonly table: readonly string[];
}): LeavingFinding[] {
  const derived = routePatterns(input.routes);
  const runtime = [...input.table].sort();
  const missing = derived.filter((route) => !runtime.includes(route));
  const stray = runtime.filter((route) => !derived.includes(route));
  if (missing.length === 0 && stray.length === 0) return [];
  return [
    {
      rule: "E39",
      file: "lib/marketing-routes.ts",
      line: 1,
      message:
        `LEAVING_ROUTES does not match the pages under app/(marketing): ` +
        `${missing.length > 0 ? `missing ${missing.join(", ")}` : ""}` +
        `${missing.length > 0 && stray.length > 0 ? "; " : ""}` +
        `${stray.length > 0 ? `no page for ${stray.join(", ")}` : ""} — the runtime table and the ` +
        `marketing group are one list, produced by the router on one side and by hand on the other`,
    },
  ];
}
