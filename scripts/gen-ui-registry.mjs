#!/usr/bin/env node
/**
 * gen-ui-registry — `docs/ui-registry.md`, from `components/`, `app/` and `data/ui-registry.ts`.
 *
 * THE RULE: the catalogue has two halves and this script is the join. The **structural** half
 * is derived here and never typed by anybody — every component domain, its files, and which
 * routes import it come out of the tree. The **judgement** half is authored in
 * `data/ui-registry.ts` and is nothing this script can derive: what is behind a surface
 * (`status`), which template a reader would pick it for (`templates`), one sentence on what the
 * surface would do if it were implemented (`capability`) and, where it exists, a note. A
 * generator that wrote those sentences would be writing prose about surfaces it has never
 * rendered; a hand-written file list would be a second source of truth for the tree. So neither
 * half may be filled in by the other, and `--check` fails when either one moved alone.
 *
 * WHY THIS IS NOT `data/media.ts`. `gen-media.mjs` derives *everything* because a file's size
 * and kind are facts about bytes. A component's purpose is not a fact about its bytes, and this
 * page exists to preserve intent — the one thing a file cannot tell you. Hence the split, and
 * hence the header on `data/ui-registry.ts` is the only place a capability sentence is written.
 *
 * THE BIJECTION, BOTH DIRECTIONS. Every route under `app/` and every component domain under
 * `components/` has exactly one entry in `data/ui-registry.ts`, and an entry for a surface that
 * no longer exists is as red as a surface with no entry. That is the acceptance this file
 * serves: adding a component directory without a judgement entry fails, and deleting an entry
 * fails. Both errors name the surface.
 *
 * WHAT `status` IS CHECKED AGAINST — the wiring, not the prose. The import graph here resolves
 * `@/` and relative specifiers through `app/`, `components/`, `lib/` and `hooks/`, closes it
 * over each route, and classifies what the surface can reach:
 *
 *   db       a module under `lib/db/` — Postgres, through `pg`
 *   api      a string literal under `/api/`, or an import of `app/api/` — a real HTTP write path
 *   data     a module under `data/` at all
 *   records  a module under `data/` excluding page copy, the brand record and the media registry:
 *            those are words and assets, not records, and a surface that reads only them renders
 *            a stand-in
 *   literal  none of the above
 *
 * and then refuses four claims that cannot be true: `db` without a `lib/db` module, `live`
 * without an `/api` write path, `fixture` without anything under `data/`, and `mock` while
 * reading record fixtures. This is how "every fixture-rendering surface is `fixture` or `mock`,
 * never `live`" stops being a promise in a card and becomes a step in the gate.
 *
 * `templates` IS NOT DERIVED AND IS NOT A RENDER FACT. Both brands render this one route table
 * (`data/brand.ts` swaps a record, not a page), so "which template includes this today" can only
 * mean the scope decision a new template would use to pick: a surface whose implementation is
 * quiz-specific is QuizHub's, one that is the alignment product's is AlignSynch's, and one both
 * need unchanged is both. `[]` is a surface catalogued before any template owns it. The page
 * says all of that in its own words, so a reader is never told a scope decision is a build fact.
 *
 * FORMatter stability. `biome format` owns markdown here: it re-pads tables and rewrites
 * `*emphasis*` to `_emphasis_`. The page therefore carries no tables, keeps every entry on
 * bullets the formatter leaves alone, and applies the same emphasis rewrite the glossary
 * generator applies — so `--check` and `format:check` can never disagree about the same bytes.
 * If you add a table to this page, prove `pnpm format:check docs/ui-registry.md` is clean first.
 *
 * NO NEW RUNTIME DEPENDENCY: `data/ui-registry.ts` imports `zod`, which the app already carries,
 * and nothing else. It is imported here directly (Node strips the types) so the schema the page
 * was built from is the schema the gate validates, not a copy of it.
 *
 * Usage:
 *   node scripts/gen-ui-registry.mjs             # write docs/ui-registry.md
 *   node scripts/gen-ui-registry.mjs --check     # exit 1 + what drifted, naming it
 *   node scripts/gen-ui-registry.mjs --root DIR  # generate under DIR (tests)
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The tree every read is relative to — `--root` moves it, and nothing caches across a move. */
let ROOT = DEFAULT_ROOT;
const OUTPUT = "docs/ui-registry.md";
const JUDGEMENT = "data/ui-registry.ts";

/**
 * The directories the import graph is resolved through: the screens, the component domains, the
 * server-side helpers, and the two module trees a page imports its records from. `data/` and
 * `content/` are here because "reads a fixture" is a question about what a page reaches, and a
 * graph that stopped at the component boundary would answer it for nobody.
 */
const SOURCE_DIRS = ["app", "components", "content", "data", "hooks", "lib"];
const SOURCE_FILE = /\.(?:tsx?|mts)$/;
const RESOLVE_EXT = [".tsx", ".ts", "/index.tsx", "/index.ts"];
const SKIP_DTS = /\.d\.ts$/;

/** Fixtures that are words or assets rather than records — see the header, `records`. */
const NOT_RECORDS = /^data\/(?:pages\/|brand\.ts$|brands\/|media\.ts$)/;

/** `undocumented` is a value in `data/ui-registry.ts`; the page must not spell it differently. */
const UI_UNDOCUMENTED = "undocumented";

class RegistryError extends Error {}

/* ------------------------------------------------------------------ *
 * The tree
 * ------------------------------------------------------------------ */

function walk(dir, found = []) {
  let entries;
  try {
    entries = readdirSync(dir).sort();
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, found);
    else if (SOURCE_FILE.test(entry) && !SKIP_DTS.test(entry)) found.push(full);
  }
  return found;
}

/** Every source file the graph may traverse, as repo-relative POSIX paths. */
function sourceFiles() {
  const files = [];
  for (const dir of SOURCE_DIRS) {
    for (const full of walk(join(ROOT, dir)))
      files.push(relative(ROOT, full).split("\\").join("/"));
  }
  return files;
}

/** `app/(mainlayout)/explore/page.tsx` -> `/explore`; route groups are not URL segments. */
function routePathOf(rel) {
  const path = rel
    .replace(/^app\//, "")
    .replace(/(?:^|\/)page\.tsx$/, "")
    .split("/")
    .filter((segment) => segment.length > 0 && !(segment.startsWith("(") && segment.endsWith(")")))
    .join("/");
  return path.length === 0 ? "/" : `/${path}`;
}

/** `app/api/auth/[...path]/route.ts` -> `/api/auth/[...path]`; same group-stripping as a page. */
function handlerPathOf(rel) {
  const path = rel
    .replace(/^app\//, "")
    .replace(/(?:^|\/)route\.tsx?$/, "")
    .split("/")
    .filter((segment) => segment.length > 0 && !(segment.startsWith("(") && segment.endsWith(")")))
    .join("/");
  return `/${path}`;
}

/** `components/ui/button.tsx` -> `components/ui`; a file at the root of `components/` -> `components`. */
function domainOf(rel) {
  const segments = rel.split("/");
  return segments.length > 2 ? `${segments[0]}/${segments[1]}` : "components";
}

/* ------------------------------------------------------------------ *
 * The import graph
 * ------------------------------------------------------------------ */

const known = new Set();
const imports = new Map();

/** The module specifiers in a file — `import x from "y"`, `export … from "y"`, `import("y")`. */
function specifiersOf(rel) {
  let text;
  try {
    text = readFileSync(join(ROOT, rel), "utf8");
  } catch {
    return { specs: [], text: "" };
  }
  const specs = [];
  for (const match of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g))
    specs.push(match[1]);
  return { specs, text };
}

function resolveSpecifier(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) base = join(dirname(from), spec).split("\\").join("/");
  else return null; // a bare package, or a node: builtin — not this tree
  if (base.endsWith("/")) base = base.slice(0, -1);
  for (const candidate of [base, ...RESOLVE_EXT.map((ext) => base + ext)]) {
    if (known.has(candidate)) return candidate;
  }
  return null;
}

function graphOf(files) {
  for (const rel of files) known.add(rel);
  for (const rel of files) {
    const { specs, text } = specifiersOf(rel);
    const deps = [];
    for (const spec of specs) {
      const hit = resolveSpecifier(rel, spec);
      if (hit !== null) deps.push(hit);
    }
    imports.set(rel, { deps, text });
  }
}

/** Every file reachable from `entry`, itself included. */
function closureOf(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length > 0) {
    const current = stack.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    for (const dep of imports.get(current)?.deps ?? []) stack.push(dep);
  }
  return seen;
}

/**
 * What a set of reachable files can actually reach. See the header for the four classes; this
 * is the only place the classification rule is written.
 */
function wiringOf(reachable) {
  const db = [...reachable].filter((f) => f.startsWith("lib/db/")).sort();
  const data = [...reachable].filter((f) => f.startsWith("data/")).sort();
  const records = data.filter((f) => !NOT_RECORDS.test(f));
  const api = [...reachable]
    .filter((f) => f.startsWith("app/api/") || (imports.get(f)?.text ?? "").includes("/api/"))
    .sort();
  return { db, data, records, api };
}

/* ------------------------------------------------------------------ *
 * The judgement half
 * ------------------------------------------------------------------ */

async function loadJudgement(root) {
  const file = join(root, JUDGEMENT);
  if (!existsSync(file)) {
    throw new RegistryError(
      `${JUDGEMENT} is missing — the structural half is derived, the judgement half is authored`,
    );
  }
  let module;
  try {
    module = await import(pathToFileURL(file).href);
  } catch (error) {
    throw new RegistryError(
      `${JUDGEMENT} does not load: ${error instanceof Error ? error.message.split("\n")[0] : error}`,
    );
  }
  const entries = module.uiRegistry;
  if (!Array.isArray(entries)) {
    throw new RegistryError(`${JUDGEMENT} does not export a \`uiRegistry\` array`);
  }
  if (module.UI_UNDOCUMENTED !== UI_UNDOCUMENTED) {
    throw new RegistryError(
      `${JUDGEMENT} exports UI_UNDOCUMENTED as ${JSON.stringify(module.UI_UNDOCUMENTED)} — this script writes ${JSON.stringify(UI_UNDOCUMENTED)}`,
    );
  }
  return entries;
}

/* ------------------------------------------------------------------ *
 * Derive, then check the two halves against each other
 * ------------------------------------------------------------------ */

function describeSurface(kind, id) {
  return `${kind === "domain" ? "component domain" : "route"} ${id}`;
}

function derive() {
  const files = sourceFiles();
  graphOf(files);

  const closures = new Map();
  const closure = (rel) => {
    if (!closures.has(rel)) closures.set(rel, closureOf(rel));
    return closures.get(rel);
  };

  const routes = files
    .filter((rel) => rel.startsWith("app/") && /(?:^|\/)page\.tsx$/.test(rel))
    .map((rel) => ({ id: routePathOf(rel), file: rel }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const handlers = files
    .filter((rel) => rel.startsWith("app/") && /(?:^|\/)route\.tsx?$/.test(rel))
    .map((rel) => ({ id: handlerPathOf(rel), file: rel }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const byDomain = new Map();
  for (const rel of files.filter((f) => f.startsWith("components/"))) {
    const domain = domainOf(rel);
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain).push(rel);
  }

  const shellRoot = "app/layout.tsx";
  const shell = known.has(shellRoot) ? closure(shellRoot) : new Set();

  const domainCoversShell = new Set(
    [...byDomain.keys()].filter((domain) =>
      [...shell].some((rel) => rel.startsWith("components/") && domainOf(rel) === domain),
    ),
  );

  /** Which routes reach a given component file, memoised per route. */
  const routeDomains = routes.map((route) => ({
    id: route.id,
    file: route.file,
    domains: [
      ...new Set(
        [...closure(route.file)]
          .filter((rel) => rel.startsWith("components/"))
          .map((rel) => domainOf(rel)),
      ),
    ].sort(),
    reachable: closure(route.file),
  }));

  const domains = [...byDomain.entries()]
    .map(([id, list]) => {
      const domainFiles = [...list].sort();
      const reachable = new Set();
      for (const rel of domainFiles) for (const dep of closure(rel)) reachable.add(dep);
      return {
        id,
        kind: "domain",
        files: domainFiles,
        count: domainFiles.length,
        routes: routes
          .filter((route) => domainFiles.some((file) => closure(route.file).has(file)))
          .map((route) => route.id),
        shell: domainCoversShell.has(id),
        wiring: wiringOf(reachable),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const routeSurfaces = routeDomains.map((route) => ({
    id: route.id,
    kind: "route",
    file: route.file,
    domains: route.domains,
    wiring: wiringOf(route.reachable),
  }));

  return { routes, routeSurfaces, handlers, domains, shell: wiringOf(shell) };
}

/**
 * The four claims a surface cannot make, checked against what its imports can actually reach.
 * Returns one message per offending entry.
 */
function wiringErrors(entry, wiring) {
  const errors = [];
  const reach = [
    wiring.db.length > 0 ? `lib/db (${wiring.db.join(", ")})` : null,
    wiring.api.length > 0 ? `/api (${wiring.api.join(", ")})` : null,
    wiring.records.length > 0
      ? `record fixtures (${wiring.records.slice(0, 3).join(", ")}${wiring.records.length > 3 ? ", …" : ""})`
      : null,
    wiring.data.length > 0 ? `${wiring.data.length} module(s) under data/` : null,
  ].filter(Boolean);
  const reads = reach.length > 0 ? reach.join("; ") : "literals only";

  if (entry.status === "db" && wiring.db.length === 0) {
    errors.push(`claims \`db\` but reaches no module under lib/db/ — ${reads}`);
  }
  if (entry.status === "live" && wiring.api.length === 0) {
    errors.push(`claims \`live\` but reaches no /api write path — ${reads}`);
  }
  if (entry.status === "fixture" && wiring.data.length === 0) {
    errors.push(`claims \`fixture\` but reaches no committed fixture under data/ — ${reads}`);
  }
  if (entry.status === "mock" && (wiring.db.length > 0 || wiring.records.length > 0)) {
    errors.push(`claims \`mock\` while reading committed records — ${reads}`);
  }
  return errors;
}

/** Both directions of the bijection, with the derived facts attached to each name. */
function bijectionErrors(structure, entries) {
  const errors = [];
  const byKey = new Map();
  for (const entry of entries) {
    const key = `${entry.kind}:${entry.surface}`;
    if (byKey.has(key))
      errors.push(`duplicate entry for ${describeSurface(entry.kind, entry.surface)}`);
    byKey.set(key, entry);
  }

  const surfaces = [...structure.routeSurfaces, ...structure.domains];
  for (const surface of surfaces) {
    const entry = byKey.get(`${surface.kind}:${surface.id}`);
    if (entry === undefined) {
      if (surface.kind === "domain") {
        const importers =
          surface.shell && surface.routes.length === 0
            ? "imported by app/layout.tsx (every route)"
            : surface.routes.length > 0
              ? `imported by ${surface.routes.join(", ")}`
              : "imported by no route";
        errors.push(
          `no judgement entry for component domain ${surface.id}: ${surface.count} file(s) — ${importers}`,
        );
      } else {
        const domains =
          surface.domains.length > 0 ? surface.domains.join(", ") : "no component domain";
        errors.push(
          `no judgement entry for route ${surface.id} (${surface.file}) — renders ${domains}`,
        );
      }
      continue;
    }
    for (const message of wiringErrors(entry, surface.wiring)) {
      errors.push(`${describeSurface(entry.kind, entry.surface)} ${message}`);
    }
  }

  for (const [key, entry] of byKey) {
    const exists = surfaces.some((surface) => `${surface.kind}:${surface.id}` === key);
    if (!exists) {
      errors.push(
        `entry for ${describeSurface(entry.kind, entry.surface)} has no surface in the tree — the page, or the last file in that domain, is gone`,
      );
    }
  }
  return errors;
}

/* ------------------------------------------------------------------ *
 * Render
 * ------------------------------------------------------------------ */

/** `biome format` rewrites single-asterisk emphasis; the page must already be its fixed point. */
function formatterEmphasis(text) {
  return text.replace(/(^|[^\w*])\*(?!\*)([^*\n]+?)\*(?![\w*])/g, "$1_$2_");
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The comma-joined list a bullet carries, wrapped in backticks where it is a path. */
const codeList = (items) => items.map((item) => `\`${item}\``).join(", ");

function counts(entries, key) {
  const map = new Map();
  for (const entry of entries) map.set(entry[key], (map.get(entry[key]) ?? 0) + 1);
  return map;
}

const TEMPLATE_ORDER = ["alignsynch", "quizhub"];

/** `alignsynch` | `quizhub` | `both` | `none` — the group a surface is rendered under. */
function groupOf(entry) {
  if (entry.templates.length === 0) return "none";
  if (entry.templates.length === TEMPLATE_ORDER.length) return "both";
  return entry.templates[0];
}

const GROUP_TITLES = [
  ["both", "Both templates"],
  ["alignsynch", "AlignSynch"],
  ["quizhub", "QuizHub"],
  ["none", "No template yet"],
];

function renderRoute(surface, entry) {
  const out = [`- \`${surface.id}\` — **${entry.status}**`];
  out.push(`  - capability: ${formatterEmphasis(entry.capability)}`);
  if (surface.domains.length > 0) {
    out.push(`  - components: ${surface.domains.map((domain) => `\`${domain}\``).join(", ")}`);
  } else {
    out.push("  - components: none — the page body is written in the route file");
  }
  const { db, data, records, api } = surface.wiring;
  const reads = [];
  if (db.length > 0) reads.push(`Postgres — ${codeList(db)}`);
  if (api.length > 0) reads.push(`an \`/api\` path — ${codeList(api)}`);
  if (db.length === 0 && api.length === 0) {
    if (records.length > 0) {
      const named = records.slice(0, 3);
      const rest = records.length > named.length ? ` (+${records.length - named.length} more)` : "";
      reads.push(`${plural(records.length, "record fixture")} — ${codeList(named)}${rest}`);
    } else if (data.length > 0) {
      reads.push(`${plural(data.length, "fixture module")} of page copy and assets only`);
    } else reads.push("literals only");
  }
  out.push(`  - reads: ${reads.join(" · ")}`);
  if (entry.notes !== undefined) out.push(`  - notes: ${formatterEmphasis(entry.notes)}`);
  return out;
}

function renderDomain(surface, entry) {
  const out = [`- \`${surface.id}\` — **${entry.status}**`];
  out.push(`  - capability: ${formatterEmphasis(entry.capability)}`);
  const names = surface.files.map((file) => file.slice(surface.id.length + 1));
  out.push(`  - files (${surface.count}): ${codeList(names)}`);
  if (surface.shell && surface.routes.length === 0) {
    out.push("  - routes: every route — imported by `app/layout.tsx`, no page imports it directly");
  } else if (surface.shell) {
    out.push(
      `  - routes (${surface.routes.length}): ${codeList(surface.routes)} — and every other route through \`app/layout.tsx\``,
    );
  } else if (surface.routes.length > 0) {
    out.push(`  - routes (${surface.routes.length}): ${codeList(surface.routes)}`);
  } else {
    out.push("  - routes: none — no route imports this domain today");
  }
  if (entry.notes !== undefined) out.push(`  - notes: ${formatterEmphasis(entry.notes)}`);
  return out;
}

function renderPage(structure, entries) {
  const { routeSurfaces, domains } = structure;

  const statusOf = counts(entries, "status");
  const groups = new Map(GROUP_TITLES.map(([key]) => [key, { routes: [], domains: [] }]));
  for (const surface of routeSurfaces) {
    const entry = entries.find((e) => e.kind === "route" && e.surface === surface.id);
    groups.get(groupOf(entry)).routes.push(renderRoute(surface, entry));
  }
  for (const surface of domains) {
    const entry = entries.find((e) => e.kind === "domain" && e.surface === surface.id);
    groups.get(groupOf(entry)).domains.push(renderDomain(surface, entry));
  }

  const totalFiles = domains.reduce((sum, domain) => sum + domain.count, 0);
  const totalTsx = domains.reduce(
    (sum, domain) => sum + domain.files.filter((file) => file.endsWith(".tsx")).length,
    0,
  );
  const staticRoutes = routeSurfaces.filter((route) => !route.id.includes("[")).length;
  const undocumented = entries.filter((entry) => entry.capability === UI_UNDOCUMENTED);
  const statusLine = ["mock", "fixture", "db", "live"]
    .map((status) => `**${status}** ${statusOf.get(status) ?? 0}`)
    .join(" · ");
  const groupLine = GROUP_TITLES.map(
    ([key, title]) => `${title} ${groups.get(key).routes.length + groups.get(key).domains.length}`,
  ).join(" · ");

  const out = [
    "# UI registry",
    "",
    "Every surface this tree can render, as a resource a template can pick from rather than a set" +
      " of screens somebody has to remember. This page is generated: do not edit it.",
    "",
    "It has two halves, and each one is owned by a different place:",
    "",
    "- **structural** — every component domain with its file count and files, and which routes" +
      " import it. Derived from `components/` and `app/` by `scripts/gen-ui-registry.mjs` on every" +
      " run; never typed.",
    "- **judgement** — `status`, `templates`, `capability` and an optional `notes` per surface, in" +
      " `data/ui-registry.ts`, zod-validated. One entry per surface, and a surface is a route or a" +
      " component domain, never a file.",
    "",
    "`bash scripts/verify.sh` regenerates the page and compares it byte for byte, then checks the" +
      " two halves against each other: a surface in the tree with no entry fails, an entry for a" +
      " surface that is gone fails, and a `status` the surface's own imports contradict fails." +
      " `pnpm ui:registry` is how you fix any of them.",
    "",
    "**`templates` is a scope decision, not a render fact.** Both brands render this one route" +
      " table — `data/brand.ts` swaps a record, not a page — so a surface is listed here under a" +
      " template when that template's product story needs it: a quiz-specific implementation is" +
      " QuizHub's, the alignment product's is AlignSynch's, and a surface both need unchanged is" +
      " under both. A surface no template claims yet has an empty list and sits in _No template" +
      " yet_, which is where a candidate for the next vertical starts its life.",
    "",
    "## Summary",
    "",
    `- routes: **${routeSurfaces.length}** — ${staticRoutes} static, ${routeSurfaces.length - staticRoutes} dynamic, from \`app/**/page.tsx\``,
    `- component domains: **${domains.length}** — ${totalFiles} files under \`components/\`, ${totalTsx} of them \`.tsx\``,
    `- route handlers: **${structure.handlers.length}** — \`app/**/route.ts\`, listed below and not a UI surface`,
    `- status: ${statusLine}`,
    `- templates: ${groupLine}`,
    `- capability written as \`${UI_UNDOCUMENTED}\`: **${undocumented.length}**`,
    "",
    "Status is the judgement half and the wiring is what checks it: `db` reaches `lib/db/`, `live`" +
      " reaches an `/api` write, `fixture` reaches a module under `data/`, and `mock` reaches no" +
      " `lib/db/` module and no record fixture — the media registry is an asset and page copy is" +
      " copy, so a surface whose numbers are literals is still a stand-in.",
    "",
    "Two things this page deliberately does not own. The app's own route table is" +
      " `content/routes.ts` (E10 holds it to the filesystem); the route list here is derived from" +
      " `app/` again rather than read out of that table, so the two can never be a copy of each" +
      " other. And the media a surface draws is `data/media.ts`, generated from `public/` — a" +
      " domain here says which files it has, never which images it addresses.",
    "",
  ];

  out.push("## Undocumented", "");
  if (undocumented.length === 0) {
    out.push(
      "None: every catalogued surface has a `capability` sentence. A surface nobody has described" +
        " belongs here — write `undocumented` as its `capability` and the summary above counts it —" +
        " rather than inventing one.",
      "",
    );
  } else {
    out.push(
      "Catalogued, but nobody has described what the surface would do. These are the gaps this" +
        " page is honest about:",
      "",
    );
    for (const entry of undocumented) {
      out.push(
        `- \`${entry.surface}\` — ${entry.kind === "domain" ? "component domain" : "route"}`,
      );
    }
    out.push("");
  }

  for (const [key, title] of GROUP_TITLES) {
    const group = groups.get(key);
    out.push(`## ${title}`, "");
    if (key === "none") {
      out.push(
        group.routes.length + group.domains.length === 0
          ? "Nothing today: every catalogued surface is claimed by at least one template. This is" +
              " where a surface lands when it is catalogued before a template owns it."
          : "Catalogued, claimed by no template yet.",
        "",
      );
    }
    if (group.routes.length > 0) {
      out.push("### Routes", "", ...group.routes.flatMap((lines) => [...lines, ""]));
    }
    if (group.domains.length > 0) {
      out.push("### Component domains", "", ...group.domains.flatMap((lines) => [...lines, ""]));
    }
  }

  out.push("## Route handlers", "");
  out.push(
    "HTTP handlers, not screens: they have no `page.tsx` and render nothing, so they carry no" +
      " template affinity and no status of their own. The surfaces they serve are catalogued" +
      " above.",
    "",
  );
  if (structure.handlers.length === 0) {
    out.push("None under `app/api/`.", "");
  } else {
    for (const handler of structure.handlers) out.push(`- \`${handler.id}\` — \`${handler.file}\``);
    out.push("");
  }

  return `${out.join("\n").replace(/\n+$/, "")}\n`;
}

/* ------------------------------------------------------------------ *
 * The check
 * ------------------------------------------------------------------ */

/** The first places two pages disagree, for the failure log (glossary's shape). */
function difference(committed, generated, limit = 10) {
  const have = committed === null ? [] : committed.split("\n");
  const want = generated.split("\n");
  const lines = [];
  for (let at = 0; at < Math.max(have.length, want.length) && lines.length < limit; at += 1) {
    if (have[at] === want[at]) continue;
    lines.push(
      `    line ${at + 1}`,
      `  - committed: ${JSON.stringify(have[at] ?? "<no line>")}`,
      `  + generated: ${JSON.stringify(want[at] ?? "<no line>")}`,
    );
  }
  return lines.join("\n");
}

/**
 * Component paths the committed page names but the tree does not (and the reverse).
 *
 * The page lists a domain's files by basename under the domain's own bullet, so the paths are
 * rebuilt from the two lines that carry them — the `- \`components/x\` — **status**` heading and
 * the `  - files (N): …` line under it. Reading the page's own shape is what lets the failure
 * name the one file that drifted instead of "the page is stale".
 */
function fileDrift(committed, structure) {
  const tree = new Set();
  for (const domain of structure.domains) for (const file of domain.files) tree.add(file);

  const named = new Set();
  let domain = null;
  for (const line of (committed ?? "").split("\n")) {
    const heading = /^- `(components[^`]*)` — /.exec(line);
    if (heading !== null) {
      domain = heading[1];
      continue;
    }
    const files = /^ {2}- files \(\d+\): (.+)$/.exec(line);
    if (files === null || domain === null) continue;
    for (const match of files[1].matchAll(/`([^`]+)`/g)) named.add(`${domain}/${match[1]}`);
  }

  const added = [...tree].filter((file) => !named.has(file)).sort();
  const removed = [...named].filter((file) => !tree.has(file)).sort();
  return { added, removed };
}

async function run(root, check) {
  ROOT = root;
  const structure = derive();
  const entries = await loadJudgement(root);

  const errors = bijectionErrors(structure, entries);
  if (errors.length > 0) {
    const list = errors
      .slice(0, 400)
      .map((error) => `  ✗ ${error}`)
      .join("\n");
    const more = errors.length > 400 ? `\n  … and ${errors.length - 400} more` : "";
    process.stderr.write(
      `✗ ${JUDGEMENT} does not cover the tree (${errors.length} problem${errors.length === 1 ? "" : "s"}):\n${list}${more}\n` +
        `  fix: add or remove the entry in ${JUDGEMENT}. The structural half is derived; the judgement half is the file the tree is checked against.\n`,
    );
    return 1;
  }

  const page = renderPage(structure, entries);
  const target = join(root, OUTPUT);

  if (!check) {
    writeFileSync(target, page);
    const files = structure.domains.reduce((sum, domain) => sum + domain.count, 0);
    process.stdout.write(
      `✓ wrote ${OUTPUT} — ${structure.routeSurfaces.length} routes, ${structure.domains.length} domains, ${files} files, ${entries.length} entries\n`,
    );
    return 0;
  }

  const committed = existsSync(target) ? readFileSync(target, "utf8") : null;
  if (committed === page) {
    process.stdout.write(
      `  ${OUTPUT} is current (${structure.routeSurfaces.length} routes, ${structure.domains.length} domains, ${entries.length} entries)\n`,
    );
    return 0;
  }

  const { added, removed } = fileDrift(committed, structure);
  const named = [
    ...added.map((file) => `  + ${file} (in the tree, not in the page)`),
    ...removed.map((file) => `  - ${file} (in the page, not in the tree)`),
  ].join("\n");

  process.stderr.write(
    `✗ ${OUTPUT} is stale — ${committed === null ? "the file is missing" : "the tree and the committed page disagree"}\n` +
      (named.length > 0 ? `${named}\n` : "") +
      `${difference(committed, page)}\n` +
      `  fix: run \`pnpm ui:registry\` and commit the page. If a surface is new, add its entry to ${JUDGEMENT} first.\n`,
  );
  return 1;
}

function main(argv) {
  const check = argv.includes("--check");
  const rootFlag = argv.indexOf("--root");
  const root = rootFlag === -1 ? ROOT : argv[rootFlag + 1];
  if (root === undefined) {
    process.stderr.write("✗ --root needs a directory\n");
    return 1;
  }
  return { root, check };
}

const args = main(process.argv.slice(2));
if (typeof args === "number") process.exitCode = args;
else {
  run(args.root, args.check).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`✗ ${error instanceof RegistryError ? error.message : error}\n`);
      process.exitCode = 1;
    },
  );
}
