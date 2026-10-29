/**
 * copy-refs — the page-copy ratchet (E23), as pure derivations.
 *
 * The inventory (`docs/P2-INVENTORY.md`) counted 1,809 page-copy strings with no
 * home. A count in a document is not a gate: nothing stops the next component
 * from typing the sentence back in. This module is the gate's arithmetic, and it
 * is deliberately separate from the filesystem so the negative cases can be
 * tested without a tree:
 *
 *   importClosure()   which modules a route's page really renders. Attribution is
 *                     by *reachability*, not by directory: a component no page
 *                     imports is not that route's copy, so it is not in the
 *                     closure and not counted. A directory-listing budget would
 *                     make deleting a dead component a budget regression.
 *   leafLiterals()    the strings a component still writes itself: JSX text nodes
 *                     and string attribute values, minus the technical attributes
 *                     that are markup (className, href, alt, variant, …) and minus
 *                     segments with no letters (`$`, `"`, emoji — glyphs, not copy).
 *   copyProblems()    the rule: every counted literal is named `file:line`; a
 *                     literal longer than 24 chars is an error on its own (a
 *                     sentence has no business in a component), and the *count* may
 *                     not exceed the route's recorded budget. The budget only goes
 *                     down, and raising one is a reviewable diff, not a side effect.
 *
 * It also proves the two directions that keep a fixture honest: the fixture must be
 * reachable from the page module (written and wired, not written and forgotten), and
 * every id a component asks for (`sectionOf(copy, "x")`, `itemLabel(copy, "y")`) must
 * exist in that route's fixture — the runtime lookup throws, this makes it a red build.
 */
import ts from "typescript";

/** Relative, not `@/`: `data:check` compiles this file to `.datacheck/` and runs it
 *  under plain node, which does not read `tsconfig.json` paths. */
import type { PageCopy, PageCopyBudget, PageCopyTable } from "../content/pages";

export interface SourceFile {
  /** Repo-relative path, reported verbatim in diagnostics. */
  path: string;
  source: string;
}

export interface CopyLiteral {
  file: string;
  /** 1-based line of the literal, so the diagnostic is clickable. */
  line: number;
  value: string;
}

export interface CopyProblem {
  code: "E23";
  message: string;
}

/**
 * A string longer than this is a sentence, and a sentence in a component is the
 * defect the whole unit exists to remove. 24 is the inventory's line between a
 * label and prose (`"Only 12 spots left"` is 18, `"Specially selected quizzes you
 * don't want to miss"` is 48). It is a floor, not the whole rule: the budget counts
 * the short ones too.
 */
export const COPY_LITERAL_MAX = 24;

/* ------------------------------------------------------------------ *
 * Which files a route renders
 * ------------------------------------------------------------------ */

const IMPORT_FROM = /import\s+(?:type\s+)?(?:[\w*{}\s,$]*?\s+from\s+)?["']([^"']+)["']/g;
const EXPORT_FROM =
  /export\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

/** `@/components/x` and `./x` resolve inside the repo; `next/link` and `swiper` do not. */
export function resolveSpecifier(
  from: string,
  specifier: string,
  known: ReadonlySet<string>,
): string | undefined {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = specifier.slice(2);
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const segments = from.split("/").slice(0, -1);
    for (const part of specifier.split("/")) {
      if (part === "." || part === "") continue;
      if (part === "..") segments.pop();
      else segments.push(part);
    }
    base = segments.join("/");
  } else {
    return undefined;
  }

  for (const candidate of [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
  ]) {
    if (known.has(candidate)) return candidate;
  }
  return undefined;
}

/** Every module a file imports, as repo-relative paths — the unresolved ones dropped. */
export function localImports(file: SourceFile, known: ReadonlySet<string>): string[] {
  const found: string[] = [];
  for (const pattern of [IMPORT_FROM, EXPORT_FROM, DYNAMIC_IMPORT]) {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(file.source); match !== null; match = pattern.exec(file.source)) {
      const specifier = match[1];
      if (!specifier) continue;
      const resolved = resolveSpecifier(file.path, specifier, known);
      if (resolved) found.push(resolved);
    }
  }
  return found;
}

/**
 * The transitive import closure of `entry`, `entry` included. Deterministic order
 * (breadth-first, discovery order) so a diagnostic lists files the same way twice.
 */
export function importClosure(entry: string, sources: readonly SourceFile[]): string[] {
  const byPath = new Map(sources.map((file) => [file.path, file]));
  const known = new Set(byPath.keys());
  const seen = new Set<string>([entry]);
  const order: string[] = [entry];
  for (let i = 0; i < order.length; i += 1) {
    const file = byPath.get(order[i]);
    if (!file) continue;
    for (const imported of localImports(file, known)) {
      if (seen.has(imported)) continue;
      seen.add(imported);
      order.push(imported);
    }
  }
  return order.filter((path) => byPath.has(path));
}

/* ------------------------------------------------------------------ *
 * What a file still spells out
 * ------------------------------------------------------------------ */

/**
 * Attributes that are markup, not copy: they address a thing (href, src, id), name
 * a variant (variant, size, type), place a popover (`align`, `orientation`), or carry
 * styling (any `*class*`), a11y plumbing (`aria-*`) or a test hook (`data-*`). `alt`
 * is excluded too, because alt text is `MediaEntry.alt`'s job (E17–E19) — a literal
 * alt is a media defect, not a copy one.
 */
const TECHNICAL_ATTRIBUTES = new Set([
  "align",
  "alt",
  "asChild",
  "color",
  "defaultValue",
  "fill",
  "height",
  "href",
  "htmlFor",
  "id",
  "key",
  "name",
  "orientation",
  "rel",
  "role",
  "size",
  "src",
  "stroke",
  "strokeWidth",
  "target",
  "type",
  "unoptimized",
  "value",
  "variant",
  "width",
]);

function isTechnicalAttribute(name: string): boolean {
  return (
    TECHNICAL_ATTRIBUTES.has(name) ||
    /class/i.test(name) ||
    name.startsWith("aria-") ||
    name.startsWith("data-") ||
    name.startsWith("xmlns") ||
    /^(viewBox|d|points)$/.test(name)
  );
}

/** JSX collapses runs of whitespace (newlines and indentation) into one space. */
function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The strings a component still writes: JSX text nodes and string attribute values.
 * Segments without a letter are glyphs (`$`, `"`, `🎉`) and are not copy. A string
 * literal inside an expression (`{x ?? "Uncategorised"}`) is *not* extracted — the
 * inventory's node kinds are jsx-text and attribute, and matching that keeps the two
 * counts comparable.
 */
export function leafLiterals(file: SourceFile): CopyLiteral[] {
  const source = ts.createSourceFile(
    file.path,
    file.source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: CopyLiteral[] = [];
  const lineOf = (node: ts.Node) =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.JsxText) {
      const text = collapse(node.getText(source));
      if (/[A-Za-z]/.test(text)) found.push({ file: file.path, line: lineOf(node), value: text });
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(source);
      const initializer = node.initializer;
      if (!isTechnicalAttribute(name) && ts.isStringLiteral(initializer)) {
        const text = collapse(initializer.text);
        if (/[A-Za-z]/.test(text)) {
          found.push({ file: file.path, line: lineOf(initializer), value: text });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/* ------------------------------------------------------------------ *
 * References a component makes to the fixture
 * ------------------------------------------------------------------ */

const SECTION_REF = /\bsectionOf\(\s*[^,()]+,\s*"([^"]+)"\s*\)/g;
const ITEM_REF = /\bitem(?:Of|Label|Value|Body)\(\s*[^,()]+,\s*"([^"]+)"\s*\)/g;
const PAGE_ITEM_REF = /\bpageItemOf\(\s*[^,()]+,\s*"([^"]+)"\s*\)/g;

function referencesIn(
  files: readonly SourceFile[],
  pattern: RegExp,
): { id: string; where: string }[] {
  const found: { id: string; where: string }[] = [];
  for (const file of files) {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(file.source); match !== null; match = pattern.exec(file.source)) {
      const line = file.source.slice(0, match.index).split("\n").length;
      found.push({ id: match[1], where: `${file.path}:${line}` });
    }
  }
  return found;
}

/* ------------------------------------------------------------------ *
 * The rule
 * ------------------------------------------------------------------ */

export interface CopyCheckInput {
  copies: PageCopyTable;
  budget: PageCopyBudget;
  sources: readonly SourceFile[];
  routePatterns: readonly string[];
  /** Does this route pattern resolve? E23 holds every copied `href` to it. */
  resolves: (href: string) => boolean;
}

/** The files attributed to a route: its page module plus the closure inside its own dirs. */
export function attributedFiles(
  entry: { page: string; dirs: readonly string[] },
  sources: readonly SourceFile[],
): string[] {
  const closure = importClosure(entry.page, sources);
  return closure.filter((path) => entry.dirs.some((dir) => path.startsWith(`${dir}/`)));
}

/** Every `href` a copy emits, so a link that moved out of JSX is still checked. */
function copyHrefs(copy: PageCopy): string[] {
  const hrefs: string[] = [];
  const add = (link?: { href: string }) => {
    if (link) hrefs.push(link.href);
  };
  add(copy.cta);
  add(copy.secondaryCta);
  for (const section of copy.sections ?? []) {
    add(section.cta);
    add(section.secondaryCta);
  }
  return hrefs;
}

/**
 * E23, in one place. Returns every problem; an empty list is the proof. The caller
 * reports them and exits non-zero, exactly like the other invariants.
 */
export function copyProblems(input: CopyCheckInput): CopyProblem[] {
  const { copies, budget, sources, routePatterns, resolves } = input;
  const problems: CopyProblem[] = [];
  const fail = (message: string) => problems.push({ code: "E23", message });
  const byPath = new Map(sources.map((file) => [file.path, file]));

  // Positive control: the check is worthless on an empty table.
  if (!("/" in copies)) {
    fail('no PageCopy fixture for "/" — the ratchet has nothing to prove');
  }

  for (const [route, copy] of Object.entries(copies)) {
    if (!routePatterns.includes(route)) {
      fail(
        `data/pages: "${route}" is not a route in content/routes.ts — copy is keyed by the route pattern the manifest owns`,
      );
    }
    if (!(route in budget)) {
      fail(
        `data/pages: "${route}" has copy but no data/pages/budget.ts entry — record the surface and its measured budget so the next unit can only lower it`,
      );
    }
    for (const href of copyHrefs(copy)) {
      if (!resolves(href)) {
        fail(`data/pages${route}: cta href "${href}" resolves to no route in content/routes.ts`);
      }
    }
    const sectionIds = new Set<string>();
    for (const section of copy.sections ?? []) {
      if (sectionIds.has(section.id)) {
        fail(`data/pages${route}: section id "${section.id}" is declared twice`);
      }
      sectionIds.add(section.id);
      const itemIds = new Set<string>();
      for (const item of section.items ?? []) {
        if (itemIds.has(item.id)) {
          fail(
            `data/pages${route}: section "${section.id}" declares item "${item.id}" twice — the view resolves it by id, so one wins silently`,
          );
        }
        itemIds.add(item.id);
      }
    }
  }

  for (const [route, entry] of Object.entries(budget)) {
    if (!(route in copies)) {
      fail(
        `data/pages/budget.ts: "${route}" has a budget but no fixture in data/pages/index.ts — a budget with no copy is a stale slot`,
      );
      continue;
    }

    const page = byPath.get(entry.page);
    if (!page) {
      fail(
        `data/pages/budget.ts: "${route}" names page "${entry.page}", which is not in components/ or app/`,
      );
      continue;
    }

    const missingDir = entry.dirs.find(
      (dir) => !sources.some((file) => file.path.startsWith(`${dir}/`)),
    );
    if (missingDir) {
      fail(
        `data/pages/budget.ts: "${route}" declares dir "${missingDir}", which holds no source files — the surface was renamed or deleted`,
      );
    }

    const closure = importClosure(entry.page, sources);
    if (!closure.some((path) => path === entry.fixture || path.startsWith(`${entry.fixture}.`))) {
      fail(
        `data/pages/budget.ts: "${route}" names fixture "${entry.fixture}", which "${entry.page}" never imports — copy written and not wired changes nothing`,
      );
    }

    const attributed = attributedFiles(entry, sources).filter((path) => byPath.has(path));
    if (attributed.length === 0) {
      fail(
        `data/pages/budget.ts: "${route}" attributes no files — "${entry.page}" imports nothing under ${entry.dirs.join(", ")}, so a budget of ${entry.budget} proves nothing`,
      );
      continue;
    }

    // The page module is part of the surface: it is where `sectionOf(copy, "id")` is
    // called, so a typo there has to be seen even though `app/` is not a component dir.
    const attributedSources = [page, ...attributed.map((path) => byPath.get(path))]
      .filter((file): file is SourceFile => file !== undefined)
      .filter((file, index, all) => all.findIndex((other) => other.path === file.path) === index);

    const copy = copies[route];
    const literals = attributedSources.flatMap((file) => leafLiterals(file));

    for (const literal of literals) {
      if (literal.value.length > COPY_LITERAL_MAX) {
        fail(
          `${literal.file}:${literal.line} still renders the literal "${literal.value}" (${literal.value.length} chars) — move it to ${entry.fixture}.ts and pass the section down`,
        );
      }
    }

    if (literals.length > entry.budget) {
      const counted = literals
        .slice(0, 12)
        .map((literal) => `${literal.file}:${literal.line} "${literal.value}"`)
        .join("; ");
      fail(
        `"${route}" measures ${literals.length} leaf literals, budget is ${entry.budget}: ${counted}${literals.length > 12 ? "; …" : ""} — the budget only goes down`,
      );
    }

    const sectionIds = new Set((copy.sections ?? []).map((section) => section.id));
    const itemIds = new Set(
      (copy.sections ?? []).flatMap((section) => (section.items ?? []).map((item) => item.id)),
    );
    for (const reference of referencesIn(attributedSources, SECTION_REF)) {
      if (!sectionIds.has(reference.id)) {
        fail(
          `${reference.where} asks for section "${reference.id}", which ${entry.fixture}.ts does not declare (have: ${[...sectionIds].join(", ")})`,
        );
      }
    }
    for (const reference of referencesIn(attributedSources, ITEM_REF)) {
      if (!itemIds.has(reference.id)) {
        fail(
          `${reference.where} asks for copy item "${reference.id}", which ${entry.fixture}.ts does not declare in any section — a typo renders nothing at runtime`,
        );
      }
    }

    // Page-level items are a different bag: `pageItemOf(copy, "x")` resolves against
    // `items` on the route, never against a section's.
    const pageItemIds = new Set((copy.items ?? []).map((item) => item.id));
    for (const reference of referencesIn(attributedSources, PAGE_ITEM_REF)) {
      if (!pageItemIds.has(reference.id)) {
        fail(
          `${reference.where} asks for page item "${reference.id}", which ${entry.fixture}.ts does not declare in \`items\` — a typo renders nothing at runtime`,
        );
      }
    }
  }

  return problems;
}

/** What a route measures right now, for the report line and for recording a new budget. */
export function measureRoute(
  entry: { page: string; dirs: readonly string[] },
  sources: readonly SourceFile[],
): { files: string[]; literals: CopyLiteral[] } {
  const byPath = new Map(sources.map((file) => [file.path, file]));
  const page = byPath.get(entry.page);
  const files = attributedFiles(entry, sources).filter((path) => byPath.has(path));
  const surface = page
    ? [page, ...files.map((path) => byPath.get(path))]
    : files.map((p) => byPath.get(p));
  return {
    files: page ? [entry.page, ...files] : files,
    literals: surface.flatMap((file) => (file ? leafLiterals(file) : [])),
  };
}
