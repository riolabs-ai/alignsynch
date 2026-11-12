/**
 * ui-census — E40: rules 6 and 7 of `docs/specs/ux-reference-patterns.md`, measured.
 *
 * The reference pattern set is nine measured screens, and two of its rules are about the shape of
 * data on a screen rather than about a colour or a radius:
 *
 *   rule 6   numbers right-align in label/value lists and tables
 *   rule 7   empty data gets an explicit bordered or grey-media block, never blank space
 *
 * Both were unmeasured. The only evidence anyone had was a grep: `rg -c tabular-nums` returned 14
 * files, and "surfaces with no empty handling" returned 67 — a candidate count somebody would then
 * fix by hand, one grep hit at a time. That is the defect this module exists to remove: a rule with
 * no measurement is a rule that is true on the screens its author happened to open.
 *
 * ## What it measures, and over what
 *
 * The scope is **the console and the member dashboard**, which is what rule 6 names ("admin +
 * member tables and label/value lists") and where C5's data actually lands. It is derived, never
 * listed: every `page.tsx` that sits under an `admin` or `dashboard` directory and does not call
 * `requireQuizProduct()`, plus that page's import closure. A page that gates itself out of this
 * brand (`lib/brand-boundary.ts`) contributes nothing, so the quiz product's own screens and every
 * marketing band are out of scope by construction rather than by exemption.
 *
 * ## Rule 6 — a numeric cell is right-aligned
 *
 * A **cell** is `<TableCell>`, `<td>`, `<th>` or `<dd>` — the two shapes rule 6 names are a table
 * row and a label/value pair, and `<dd>` is how this repo writes the second one (`<dl><dt>/<dd>`,
 * `components/assessment-flow/record-detail-shell.tsx`).
 *
 * A cell is **numeric** when one of its own expression children resolves to a number, by one of
 * three declarations rather than by a hunch:
 *
 *   a field name   the expression's last segment ends in a count/total/length/score/percent/minutes
 *                  word — the vocabulary `NUMERIC_FIELD` spells out, so the table can be read and
 *                  argued with instead of guessed at
 *   a formatter    `toLocaleString()`, `Intl.NumberFormat`, `formatNumber`/`formatCount`/
 *                  `formatPercent` and the console's `spreadOf` — a call whose name says "number"
 *   a segment      a template literal whose first substitution is one of the above
 *
 * It is **aligned** when its `className` carries `tabular-nums` or `text-right`. The issue's own
 * acceptance names both, and they are not the same thing: `tabular-nums` fixes digit width so a
 * column does not shimmer, `text-right` fixes the edge the reference draws. Either satisfies the
 * rule; a numeric cell carrying neither is the finding.
 *
 * A header cell is never numeric — its content is a label — so `<th>`/`<TableHead>` are measured
 * for completeness and always pass. Aligning the *header* of a column the fix moves is part of the
 * fix, not part of the rule: the rule is about the number, and a header is judged by eye.
 *
 * ## Rule 7 — a list surface that can be empty has one bordered block and one action
 *
 * The hard half is "can be empty", because every component maps over something. Four declarations
 * narrow it, and each one is a fact about the source rather than a file list:
 *
 *   **a record list**  the callback's own element carries `key={row.id}` (or `.slug`/`.key`/
 *                      `.name`) — the list renders identified records, which is what a surface
 *                      shows and what rule 7 is about
 *   **data-derived**   the receiver's root is not a module constant and not an import. A local
 *                      `const X = [...]` cannot be empty by construction, and an imported binding
 *                      used directly as a receiver is a module-level array; a prop, a store read or
 *                      a member of a loaded model can be empty, and that is the case the rule is
 *                      about
 *   **not a choice**   the callback renders `<option>` — a `<select>`'s options are a form
 *                      control's vocabulary, not a list surface
 *   **not a pair**     the list sits inside a `<dl>` — that is a label/value list, which rule 6
 *                      covers, and it has no meaningful empty state
 *   **not copy**       the receiver's root is a `sectionOf(copy, …)` local — a copy fixture's
 *                      `items` are a paragraph's bullets, and an authored fixture is never empty
 *
 * What is left is the surface set. Each one must have an **empty region**: a branch of a *zero*
 * test over its collection (`.length === 0`, `.length < 1`, `!rows.length`, an early `if` that
 * returns one). A conditional that tests `.length === 1` is not one — it is a singular/plural
 * wording switch, and reading it as a guard is exactly the false negative that would let a blank
 * list ship.
 *
 * The empty region itself is measured twice:
 *
 *   **the block**   it draws a bordered or grey-media block: `EmptyState`/`NotFoundState` (both
 *                   are `border border-dashed` cards), or an element whose `className` carries
 *                   `border` or a muted fill (`bg-muted`, `bg-gray-*`, `bg-slate-*`). A bare
 *                   `<p>Nothing here</p>` is the "blank space" the rule forbids.
 *   **the actions** how many `<Link>`/`<a>`/`<Button>`/`<button>` it renders. **More than one is
 *                   an error** — an empty state that offers two ways forward is a menu, and the
 *                   reference draws one. **Zero is counted, not failed**: a sub-list with nothing
 *                   to offer (a template that no relationship has used has no action the server
 *                   would accept) must not grow a button to satisfy a census, and the doomed-case
 *                   list for C5 says so. The count is printed so the debt is visible.
 *
 * ## The exemption table only names what the derivation cannot see
 *
 * `NON_EMPTY_LISTS` names an **exact** file and receiver, with the invariant that makes it
 * non-empty or the caller that already draws the empty panel, and a row nothing uses is a finding
 * — the `BRAND_WORD_ALLOWANCES` shape (`scripts/brand-word.ts`). There is no file-level exemption:
 * allowing a file would also allow the next list added to it.
 *
 * ## The floor
 *
 * A walk that resolved nothing passes every tree, so the census asserts a floor on both counts.
 * `MIN_NUMERIC_CELLS` and `MIN_LIST_SURFACES` are the last measured values, near enough that a
 * refactor that stops the walker reading a shape fails here instead of quietly reporting zero.
 */
import ts from "typescript";

/** A source file: repo-relative path plus its text — what every pure rule here takes. */
export interface CensusSource {
  path: string;
  source: string;
}

/** One cell that renders a number, and whether the rule is satisfied. */
export interface NumericCell {
  file: string;
  /** 1-based line of the cell, so the diagnostic is clickable. */
  line: number;
  tag: string;
  /** The numeric expression, whitespace-collapsed, for the diagnostic. */
  expression: string;
  aligned: boolean;
}

/** One list surface — a record list over data — and what its empty region draws. */
export interface ListSurface {
  file: string;
  line: number;
  /** The receiver, whitespace-collapsed: `rows`, `group.templates`, `visible`. */
  receiver: string;
  /** The collection identifiers the receiver mentions — the guard must name all of them. */
  roots: string[];
  /** The length test that guards it, or `null` when nothing does. */
  guard: string | null;
  /**
   * What the empty region draws. `absent` is a list rendered only when it has rows
   * (`{rows.length > 0 && <ul>}`): the region is not drawn at all, which is not the blank space
   * the rule forbids — nothing was left hollow.
   */
  block: "bordered" | "grey" | "absent" | "none";
  /** Action controls inside the empty region. */
  actions: number;
}

export interface CensusProblem {
  rule: "E40";
  message: string;
}

/** One list the derivation cannot classify, named exactly, with the reason. */
export interface NonEmptyList {
  file: string;
  /** The receiver as the walker reads it, whitespace-collapsed. */
  receiver: string;
  reason: string;
}

/** What the census measured — printed on both paths, so a passing run still shows its scope. */
export interface UiCensus {
  /** Modules the walk read: the console's and the member dashboard's import closure. */
  modules: number;
  /** Numeric cells found, and how many carry `tabular-nums`/`text-right`. */
  numericCells: number;
  aligned: number;
  /** List surfaces found, how many have a length-test guard, and what their empty regions draw. */
  listSurfaces: number;
  guarded: number;
  bordered: number;
  /** Lists rendered only when they have rows — the whole region is omitted, so nothing is hollow. */
  absent: number;
  oneAction: number;
  zeroAction: number;
  /** Exemption rows a surface actually used. */
  exemptions: number;
}

/**
 * The field-name vocabulary: a cell whose expression ends in one of these renders a number.
 *
 * Read as a suffix list, not a substring one — `sessionsScored` and `aspectCount` are numbers,
 * `sessionTitle` is not — and kept here rather than derived from a type, because the walker has
 * no type checker and a rule that needs one would not run in `data:check`'s compiled pass.
 */
const NUMERIC_FIELD =
  /(length|count|total|sessions?|sessionsScored|sessionsOpen|parties|percent\w*|score|median|min|max|minutes|seconds|rating|plays|days|level|gap|answers|responses|items?|questions?|number|num|seats?)$/i;

/** A call whose own name says it produces a number. */
const NUMERIC_CALL =
  /toLocaleString\s*\(|Intl\.NumberFormat|formatCount|formatNumber|formatPercent|spreadOf/;

/** Cell tags rule 6 covers: a table cell, a header cell, and a label/value pair's value. */
const CELL_TAGS = new Set(["TableCell", "td", "th", "TableHead", "dd"]);

/** Action controls: one of these inside an empty region is a way forward. */
const ACTION_TAGS = new Set(["Link", "a", "Button", "button"]);

/** Identifiers that are runtime globals, never a collection the caller passed in. */
const GLOBALS = new Set([
  "Object",
  "Array",
  "String",
  "Number",
  "Math",
  "JSON",
  "Intl",
  "Boolean",
  "Date",
  "Map",
  "Set",
  "from",
  "entries",
  "values",
  "keys",
  "filter",
  "map",
  "slice",
  "sort",
  "concat",
  "flatMap",
  "flat",
  "reverse",
  "at",
  "length",
  "true",
  "false",
  "null",
  "undefined",
  "const",
  "as",
  "readonly",
  "satisfies",
  "this",
]);

/** The floor: a walk that resolved fewer than this has stopped reading the tree. */
export const MIN_NUMERIC_CELLS = 10;
export const MIN_LIST_SURFACES = 30;

/**
 * Lists the derivation cannot classify, named exactly, each with the invariant that makes it
 * non-empty or the caller that draws the panel instead.
 *
 * One row is one receiver in one file. A row nothing uses is a finding, and a file-level exemption
 * is not expressible on purpose: the next list added to the same component must be classified.
 */
export const NON_EMPTY_LISTS: readonly NonEmptyList[] = [
  {
    file: "components/admin/docs/docs-hub.tsx",
    receiver: "sections",
    reason:
      "#892 — the sections are `docs/docs.json`'s own, and `zDocsManifest.sections` is `.min(1)`, so a hub with no band is a manifest that does not parse and draws the unreadable panel instead; the empty *result* already draws a bordered block with the clearing action above this map",
  },
  {
    file: "components/admin/audit-log.tsx",
    receiver: "fields",
    reason:
      "one change's own before/after fields, inline in an audit row — `fields.length === 0` already says `none` in place, and a bordered box inside one table cell would put a second frame in the row",
  },
  {
    file: "components/admin/billing-control.tsx",
    receiver: "limits",
    reason:
      "one bullet per billing plan; `PLAN_LIMITS` is `BILLING_PLAN_IDS.map(...)` over a module constant (`admin/billing/page.tsx`), so the count is not data",
  },
  {
    file: "components/admin/report-operations.tsx",
    receiver: "ready.report.aspects",
    reason:
      "the report's rows mirror the sheet's Aspects and `zAssessment.items` is `.min(1)` — an empty block would be a state the model cannot express",
  },
  {
    file: "components/admin/review-artifacts.tsx",
    receiver: "group.entries",
    reason:
      "a release group is built from the entries it holds, so it has at least one — the shelf drops an empty group before this list sees it",
  },
  {
    file: "components/admin/template-editor.tsx",
    receiver: "aspects",
    reason:
      "seeded from `template.items`, and `zAssessment.items` is `.min(1)`; the editor has no remove (a template may not lose its last Aspect)",
  },
  {
    file: "components/assessment-flow/aspect-list.tsx",
    receiver: "rows",
    reason:
      "the stage-3 editor seeds `rows` from the sheet's Aspects (`.min(1)`) and the flow forbids adding or removing a row (V4), so it cannot reach zero",
  },
  {
    file: "components/assessment-flow/template-card.tsx",
    receiver: "groups",
    reason:
      "the caller owns the panel: `template-library.tsx` and `app/(mainlayout)/dashboard/templates/page.tsx` render `TemplateShelfNotice` for `catalogue-empty` and `mine-empty`",
  },
  {
    file: "components/assessment-flow/template-card.tsx",
    receiver: "group.templates",
    reason:
      "`templateGroupsOf` filters a group with no templates out before this component sees it (`template-card.tsx:174`)",
  },
  {
    file: "components/console/stat-card-grid.tsx",
    receiver: "cards",
    reason:
      "a fixed strip, not a read: both callers (`console/overview.tsx`, `v1/admin-console-overview.tsx`) pass a literal array of cards",
  },
  {
    file: "components/dashboard/relationship-cards.tsx",
    receiver: "rows",
    reason:
      "the card list is mounted by `relationships-list.tsx`, which owns the panel — `data-relationships-empty` with the fixture's `empty`/`empty-filter` sections and its one action",
  },
  {
    file: "components/dashboard/relationship-detail.tsx",
    receiver: "aspects",
    reason:
      "the detail's rows come from `relationship.template.items`, and `zAssessment.items` is `.min(1)`",
  },
  {
    file: "components/dashboard/template-shelf.tsx",
    receiver: "cards",
    reason:
      "the docstring states it and the caller does it: `cards.length === 0` is `templates-page.tsx`'s `TemplateShelfNotice`, not this component's hole",
  },
  {
    file: "components/relationship/relationship-edit-panel.tsx",
    receiver: "aspects",
    reason:
      "the relationship's own sheet, seeded from the template's items (`.min(1)`); the panel edits words, never the row count",
  },
  {
    file: "components/v1/admin-template-detail.tsx",
    receiver: "template.items",
    reason: "the template's Aspects; `zAssessment.items` is `.min(1)`",
  },
  {
    file: "components/v1/admin-template-registry.tsx",
    receiver: "templateRows",
    reason:
      "reads the seeded demo store with no filter, no delete and no empty path — the registry cannot be emptied from any control this screen or the store exposes",
  },
  {
    file: "components/v1/admin-users-list.tsx",
    receiver: "rows",
    reason:
      "one seat or member group of the seeded store; the page carries no add, edit or delete (it says so), so neither group can be emptied",
  },
];

/* ------------------------------------------------------------------ *
 * Scope — the console and the member dashboard, derived from the pages
 * ------------------------------------------------------------------ */

/** A page module's route group: the console (`/admin/**`) and the member dashboard. */
const SCOPED_PAGE = /^app\/(?:.*\/)?(?:admin|dashboard)\/(?:.*\/)?page\.tsx$/;

/** A page that answers 404 on this brand — `lib/brand-boundary.ts`. */
const QUIZ_GATE = /requireQuizProduct\s*\(/;

/** Does this page module render on the alignment build? */
export function scopedPagePaths(files: readonly CensusSource[]): string[] {
  return files
    .filter((file) => SCOPED_PAGE.test(file.path) && !QUIZ_GATE.test(file.source))
    .map((file) => file.path)
    .sort();
}

/**
 * The modules the scoped pages render: their own import closure.
 *
 * Attribution is reachability, the same rule `scripts/copy-refs.ts::importClosure` uses for the
 * copy budget and `scripts/client-graph.ts` for the client graph — a component no scoped page
 * imports is nobody's surface, and counting it would make a card fight over a file another card
 * owns.
 */
export function scopedModules(files: readonly CensusSource[]): string[] {
  const known = new Set(files.map((file) => file.path));
  const byPath = new Map(files.map((file) => [file.path, file]));
  const inScope = new Set<string>();

  for (const entry of scopedPagePaths(files)) {
    const seen = new Set<string>([entry]);
    const order: string[] = [entry];
    for (let index = 0; index < order.length; index += 1) {
      const file = byPath.get(order[index]);
      if (file === undefined) continue;
      for (const specifier of moduleSpecifiers(file.source)) {
        const resolved = resolveSpecifier(order[index], specifier, known);
        if (resolved === null || seen.has(resolved)) continue;
        seen.add(resolved);
        order.push(resolved);
      }
    }
    for (const path of order) inScope.add(path);
  }

  return [...inScope].sort();
}

/** Every module specifier a source imports or re-exports. */
function moduleSpecifiers(source: string): string[] {
  const found: string[] = [];
  const pattern = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) found.push(match[1]);
  return found;
}

/** `@/x` and `./x` resolved to a repo-relative path, or `null` when it is a package. */
function resolveSpecifier(
  from: string,
  specifier: string,
  known: ReadonlySet<string>,
): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = specifier.slice(2);
  else if (specifier.startsWith(".")) {
    const parts = from.split("/").slice(0, -1);
    for (const step of specifier.split("/")) {
      if (step === "..") parts.pop();
      else if (step !== "." && step !== "") parts.push(step);
    }
    base = parts.join("/");
  } else return null;

  for (const suffix of [".tsx", ".ts", "/index.tsx", "/index.ts", ""]) {
    if (known.has(`${base}${suffix}`)) return `${base}${suffix}`;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Rule 6 — a numeric cell is right-aligned
 * ------------------------------------------------------------------ */

/** Is this expression text a number, by the vocabulary above? */
export function isNumericExpression(raw: string): boolean {
  const text = raw.trim().replace(/^\{\s*|\s*\}$/g, "");
  if (text === "") return false;
  if (NUMERIC_CALL.test(text)) return true;
  // `{`${min}–${max}`}` — a formatted range is a number when its first substitution is one.
  const first = /\$\{([^}]+)\}/.exec(text);
  if (first !== null) return isNumericExpression(first[1]);
  // The last segment decides: `row.aspectCount` is a count, `aspect.title` is not.
  const last =
    text
      .split(/[?.:+\s()[\]]/)
      .filter((part) => part !== "")
      .pop() ?? "";
  return NUMERIC_FIELD.test(last);
}

/** Every numeric cell in one module, in source order. */
export function numericCells(file: CensusSource): NumericCell[] {
  const source = ts.createSourceFile(
    file.path,
    file.source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const cells: NumericCell[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = opening.tagName.getText(source);
      if (CELL_TAGS.has(tag)) {
        const children = ts.isJsxElement(node) ? node.children : [];
        // The number must **lead** the cell. A cell that opens with prose and mentions a count
        // later (`Mode — 3 Opinions per Aspect.`) is a sentence, and a sentence is not
        // right-aligned; a cell that opens with the number (`{row.aspectCount}`,
        // `{row.sessionsScored} scored · …`) is a column, and rule 6 owns it.
        const lead = children.find((child) => !(ts.isJsxText(child) && child.text.trim() === ""));
        const leadExpression =
          lead !== undefined && ts.isJsxExpression(lead) ? lead.expression : undefined;
        const numericText =
          leadExpression === undefined || !isNumericExpression(leadExpression.getText(source))
            ? null
            : leadExpression.getText(source).replace(/\s+/g, " ");
        if (numericText !== null) {
          const attribute = opening.attributes.properties.find(
            (property) =>
              ts.isJsxAttribute(property) && property.name.getText(source) === "className",
          );
          const className = attribute === undefined ? "" : attribute.getText(source);
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          cells.push({
            file: file.path,
            line: line + 1,
            tag,
            expression: numericText,
            aligned: /tabular-nums|text-right/.test(className),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return cells;
}

/* ------------------------------------------------------------------ *
 * Rule 7 — a list surface that can be empty
 * ------------------------------------------------------------------ */

/** Locals that hold a compile-time array: a literal, or a copy section's own bullets. */
function staticLocals(source: ts.SourceFile): Set<string> {
  const statics = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      let init: ts.Expression = node.initializer;
      while (
        ts.isAsExpression(init) ||
        ts.isSatisfiesExpression(init) ||
        ts.isParenthesizedExpression(init)
      ) {
        init = init.expression;
      }
      if (ts.isArrayLiteralExpression(init)) statics.add(node.name.text);
      // `const limits = sectionOf(copy, "limits")` — a copy section, so `.items` is bullets.
      if (ts.isCallExpression(init) && ts.isIdentifier(init.expression)) {
        if (init.expression.text === "sectionOf" || init.expression.text === "headingOf") {
          statics.add(node.name.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return statics;
}

/** Every identifier this module imports — a module-level binding, so never a caller's rows. */
function importedNames(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && node.importClause !== undefined) {
      const clause = node.importClause;
      if (clause.name !== undefined) names.add(clause.name.text);
      const bindings = clause.namedBindings;
      if (bindings !== undefined && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements)
          names.add((element.propertyName ?? element.name).text);
      }
      if (bindings !== undefined && ts.isNamespaceImport(bindings)) names.add(bindings.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

/** Is the test a *zero* test — the guard an empty region hangs on? */
function isZeroTest(test: string, roots: readonly string[]): boolean {
  const names = roots.map((root) => `\\b${root.replace(/\$/g, "\\$")}\\b`).join("|");
  if (new RegExp(`(?:${names})[\\w.$]*\\s*\\.length\\s*(?:===|==)\\s*0\\b`).test(test)) return true;
  if (new RegExp(`(?:${names})[\\w.$]*\\s*\\.length\\s*(?:<=|<)\\s*(?:1|0)\\b`).test(test))
    return true;
  if (new RegExp(`0\\s*(?:===|==|>=)\\s*(?:${names})[\\w.$]*\\s*\\.length`).test(test)) return true;
  return new RegExp(`!\\s*(?:${names})[\\w.$]*\\s*\\.length`).test(test);
}

/**
 * Is the test a *positive* test — the mirror form, `{rows.length > 0 ? <ul> : <p>nothing</p>}`?
 *
 * A truthiness test counts: `{rows.length && <ul>}` only renders with rows. Reading only the zero
 * polarity would report every mirror-form guard as missing, which is the false positive that makes
 * a census ignorable.
 */
function isPositiveTest(test: string, roots: readonly string[]): boolean {
  const names = roots.map((root) => `\\b${root.replace(/\$/g, "\\$")}\\b`).join("|");
  if (new RegExp(`(?:${names})[\\w.$]*\\s*\\.length\\s*(?:>|>=|!==)\\s*(?:0|1)\\b`).test(test)) {
    return true;
  }
  if (new RegExp(`(?:${names})[\\w.$]*\\s*\\.length\\s*$`).test(test.trim())) return true;
  return new RegExp(`(?:${names})[\\w.$]*\\s*\\.length\\s*&&`).test(`${test} &&`);
}

/** Does a branch draw an explicit block? */
function blockOf(source: ts.SourceFile, branch: ts.Node): ListSurface["block"] {
  // `rows.length === 0 ? null : <Card>` omits the region when empty — the mirror of the `&&`
  // form, and the same answer: nothing is left hollow, so there is no block to draw.
  if (branch.kind === ts.SyntaxKind.NullKeyword || ts.isIdentifier(branch)) {
    const name = branch.getText(source);
    if (name === "null" || name === "undefined") return "absent";
  }

  let block: ListSurface["block"] = "none";
  const visit = (node: ts.Node): void => {
    if (block !== "none") return;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = opening.tagName.getText(source);
      const className =
        opening.attributes.properties
          .find(
            (property) =>
              ts.isJsxAttribute(property) && property.name.getText(source) === "className",
          )
          ?.getText(source) ?? "";
      if (tag === "EmptyState" || tag === "NotFoundState" || tag === "Card") block = "bordered";
      else if (/["'`][^"'`]*\bborder\b/.test(className)) block = "bordered";
      else if (/bg-(?:muted|gray|slate|zinc)/.test(className)) block = "grey";
    }
    ts.forEachChild(node, visit);
  };
  visit(branch);
  return block;
}

/** How many action controls a branch renders. */
function actionsOf(source: ts.SourceFile, branch: ts.Node): number {
  let actions = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = opening.tagName.getText(source);
      if (ACTION_TAGS.has(tag)) {
        // `<Button asChild><Link/></Button>` is **one** control: `asChild` hands its own props to
        // the child, so counting both would report every `asChild` link as a second action.
        const asChild = opening.attributes.properties.some(
          (property) => ts.isJsxAttribute(property) && property.name.getText(source) === "asChild",
        );
        if (!asChild) actions += 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(branch);
  return actions;
}

/**
 * The identifiers a receiver's collection comes from, followed to the root of its chain.
 *
 * `(limits.items ?? [])` is `limits`; `[...live, ...archived]` is both; `Object.entries(x)` is `x`
 * and `groupsIn(row.gaps)` is `row`. The distinction matters twice: a receiver rooted in a local
 * array literal cannot be empty, and a guard has to name *every* collection the list merges.
 */
function rootsOf(node: ts.Expression, source: ts.SourceFile): string[] {
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return rootsOf(node.expression, source);
  }
  if (ts.isIdentifier(node)) return GLOBALS.has(node.text) ? [] : [node.text];
  if (ts.isPropertyAccessExpression(node)) return rootsOf(node.expression, source);
  if (ts.isElementAccessExpression(node)) return rootsOf(node.expression, source);
  if (ts.isArrayLiteralExpression(node)) {
    return [
      ...new Set(
        node.elements.flatMap((element) =>
          rootsOf(
            ts.isSpreadElement(element) ? element.expression : (element as ts.Expression),
            source,
          ),
        ),
      ),
    ];
  }
  if (ts.isBinaryExpression(node)) {
    return [...new Set([...rootsOf(node.left, source), ...rootsOf(node.right, source)])];
  }
  if (ts.isCallExpression(node)) {
    const args = node.arguments.flatMap((argument) => rootsOf(argument, source));
    const callee = ts.isPropertyAccessExpression(node.expression)
      ? rootsOf(node.expression.expression, source)
      : [];
    return [...new Set([...callee, ...args])];
  }
  return [];
}

/** Every list surface in one module, in source order. */
export function listSurfaces(file: CensusSource): ListSurface[] {
  const source = ts.createSourceFile(
    file.path,
    file.source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const statics = staticLocals(source);
  const imported = importedNames(source);
  const text = (node: ts.Node): string => node.getText(source).replace(/\s+/g, " ");

  /**
   * Every conditional in the module that could be a guard, with both of its branches.
   *
   * `taken` and `other` rather than `then`/`else`, because lint refuses an object with a `then`
   * property — it is indistinguishable from a thenable.
   */
  interface Guard {
    test: string;
    taken: ts.Node;
    other: ts.Node | null;
  }

  /**
   * Does this node *render* — is it a branch of JSX, rather than an attribute value?
   *
   * `className={cn("px-0", groups.length === 0 && "px-6")}` has a branch (`"px-6"`) that draws
   * nothing, and reading its `&&` as the list's guard is how a drawn empty block gets reported as
   * missing. Only a branch that can mount something is a candidate.
   */
  const renders = (node: ts.Node | null): boolean => {
    if (node === null) return false;
    if (
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node) ||
      ts.isReturnStatement(node) ||
      ts.isBlock(node)
    ) {
      return true;
    }
    if (ts.isParenthesizedExpression(node)) return renders(node.expression);
    return false;
  };

  const guards: Guard[] = [];
  const collect = (node: ts.Node): void => {
    if (ts.isConditionalExpression(node)) {
      const draws = renders(node.whenTrue) || renders(node.whenFalse);
      if (draws) {
        guards.push({ test: text(node.condition), taken: node.whenTrue, other: node.whenFalse });
      }
    } else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      if (renders(node.right)) {
        guards.push({ test: text(node.left), taken: node.right, other: null });
      }
    } else if (ts.isIfStatement(node)) {
      guards.push({
        test: text(node.expression),
        taken: node.thenStatement,
        other: node.elseStatement ?? null,
      });
    }
    ts.forEachChild(node, collect);
  };
  collect(source);

  const surfaces: ListSurface[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.getText(source) === "map" &&
      insideJsx(node)
    ) {
      const callback = node.arguments[0];
      const callbackText = callback === undefined ? "" : text(callback);
      const receiver = node.expression.expression;
      const receiverText = text(receiver);
      const roots = rootsOf(receiver, source);
      const isRecordList = /key=\{[^}]*\.(?:id|[a-z_]+_id|slug|key|name)\b/.test(callbackText);
      const isChoice = /<(?:option|SelectItem|RadioGroupItem)\b/.test(callbackText);
      const isPair = insideTag(node, source, "dl");
      const isStatic =
        roots.length === 0 || roots.every((root) => statics.has(root) || imported.has(root));

      if (isRecordList && !isChoice && !isPair && !isStatic) {
        // The guard has to name the collection's own field, not just its root: `ready.report.aspects`
        // and `ready.not_computable` share the root `ready`, and a test on one of them says nothing
        // about the other.
        const lastName = (receiverText.match(/\b[A-Za-z_$][\w$]*\b/g) ?? []).pop() ?? "";
        const named = (test: string): boolean =>
          roots.every((root) => new RegExp(`\\b${root.replace(/\$/g, "\\$")}\\b`).test(test)) &&
          (lastName === "" || new RegExp(`\\b${lastName.replace(/\$/g, "\\$")}\\b`).test(test));
        const zero = guards.find(
          (candidate) => named(candidate.test) && isZeroTest(candidate.test, roots),
        );
        const positive = guards.find(
          (candidate) => named(candidate.test) && isPositiveTest(candidate.test, roots),
        );
        const guard = zero ?? positive;
        const branch =
          guard === undefined ? null : contains(guard.taken, node) ? guard.other : guard.taken;
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        surfaces.push({
          file: file.path,
          line: line + 1,
          receiver: receiverText,
          roots,
          guard: guard === undefined ? null : guard.test,
          block:
            branch === null
              ? // A positive test with no else branch renders the list only when it has rows:
                // nothing is left hollow, so there is no region to draw a block in.
                positive !== undefined && zero === undefined
                ? "absent"
                : "none"
              : blockOf(source, branch),
          actions: branch === null ? 0 : actionsOf(source, branch),
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return surfaces;
}

/** Is this node inside a JSX expression container — i.e. does it render? */
function insideJsx(node: ts.Node): boolean {
  for (let parent = node.parent; parent !== undefined; parent = parent.parent) {
    if (ts.isJsxExpression(parent)) return true;
  }
  return false;
}

/** Is this node inside a JSX element with this tag? */
function insideTag(node: ts.Node, source: ts.SourceFile, tag: string): boolean {
  for (let parent = node.parent; parent !== undefined; parent = parent.parent) {
    if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText(source) === tag) {
      return true;
    }
  }
  return false;
}

/** Does the outer node contain the inner one? */
function contains(outer: ts.Node, inner: ts.Node): boolean {
  return inner.getStart() >= outer.getStart() && inner.getEnd() <= outer.getEnd();
}

/* ------------------------------------------------------------------ *
 * The rule
 * ------------------------------------------------------------------ */

export interface UiCensusInput {
  /** Every module the walk may read: `app/**` and `components/**`, `.tsx`. */
  files: readonly CensusSource[];
  exemptions: readonly NonEmptyList[];
  /**
   * The floor for this walk. The real gate leaves it at the constants above; a case that drives
   * three files lowers it, because a fixture tree is not the tree the floor was measured on.
   */
  floors?: { numericCells?: number; listSurfaces?: number };
}

const ONE_LINE = (value: string): string => value.replace(/\s+/g, " ");

/**
 * The two rules, over the console's and the member dashboard's modules.
 *
 * Every finding names `file:line` and says what to do, because a census whose output is a count is
 * a dashboard, not a check. The exemption table is read in both directions: a row nothing used is a
 * finding, so the boundary cannot be pre-widened for work somebody is about to do.
 */
export function censusFindings(input: UiCensusInput): {
  problems: CensusProblem[];
  census: UiCensus;
} {
  const problems: CensusProblem[] = [];
  const inScope = new Set(scopedModules(input.files));
  const modules = input.files.filter(
    (file) => inScope.has(file.path) && file.path.endsWith(".tsx"),
  );

  const usedExemptions = new Set<NonEmptyList>();
  let numericCellsSeen = 0;
  let aligned = 0;
  let surfaces = 0;
  let guarded = 0;
  let bordered = 0;
  let absent = 0;
  let oneAction = 0;
  let zeroAction = 0;

  for (const file of modules) {
    for (const cell of numericCells(file)) {
      numericCellsSeen += 1;
      if (cell.aligned) {
        aligned += 1;
        continue;
      }
      problems.push({
        rule: "E40",
        message: `${cell.file}:${cell.line} <${cell.tag}> renders the number {${ONE_LINE(cell.expression)}} without \`tabular-nums\` or \`text-right\` — rule 6 right-aligns numbers in tables and label/value lists, and a proportional figure makes a column shimmer as its digits change (docs/specs/ux-reference-patterns.md)`,
      });
    }

    for (const surface of listSurfaces(file)) {
      surfaces += 1;
      const exemption = input.exemptions.find(
        (row) => row.file === surface.file && row.receiver === surface.receiver,
      );
      if (exemption !== undefined) {
        usedExemptions.add(exemption);
        continue;
      }

      if (surface.guard === null) {
        problems.push({
          rule: "E40",
          message: `${surface.file}:${surface.line} maps ${ONE_LINE(surface.receiver)} and never tests it for empty — rule 7 gives an empty list an explicit bordered block plus one action, never blank space. Guard it with a zero test over ${surface.roots.join(", ")} and draw the block`,
        });
        continue;
      }
      guarded += 1;

      if (surface.block === "absent") {
        absent += 1;
        continue;
      }

      if (surface.block === "none") {
        problems.push({
          rule: "E40",
          message: `${surface.file}:${surface.line} guards ${ONE_LINE(surface.receiver)} on "${ONE_LINE(surface.guard)}" but the empty branch draws no bordered or grey-media block — rule 7 requires the block, and a bare sentence in the space is the blank space it forbids`,
        });
        continue;
      }
      bordered += 1;

      if (surface.actions > 1) {
        problems.push({
          rule: "E40",
          message: `${surface.file}:${surface.line} draws ${surface.actions} actions in the empty region for ${ONE_LINE(surface.receiver)} — rule 7 gives an empty state exactly one way forward, and a second control turns it into a menu`,
        });
        continue;
      }
      if (surface.actions === 0) zeroAction += 1;
      else oneAction += 1;
    }
  }

  for (const exemption of input.exemptions) {
    if (!usedExemptions.has(exemption)) {
      problems.push({
        rule: "E40",
        message: `NON_EMPTY_LISTS has a row nothing needs: ${exemption.file} ${exemption.receiver} (${exemption.reason}). An exemption is a decision about one list — delete the row, or correct the receiver it was written for, instead of leaving the hole open`,
      });
    }
  }

  if (numericCellsSeen < (input.floors?.numericCells ?? MIN_NUMERIC_CELLS)) {
    problems.push({
      rule: "E40",
      message: `the census read ${numericCellsSeen} numeric cells and this rule is measured over at least ${input.floors?.numericCells ?? MIN_NUMERIC_CELLS} — a walk that found nothing checks nothing`,
    });
  }
  if (surfaces < (input.floors?.listSurfaces ?? MIN_LIST_SURFACES)) {
    problems.push({
      rule: "E40",
      message: `the census read ${surfaces} list surfaces and this rule is measured over at least ${input.floors?.listSurfaces ?? MIN_LIST_SURFACES} — a walk that found nothing checks nothing`,
    });
  }

  return {
    problems,
    census: {
      modules: modules.length,
      numericCells: numericCellsSeen,
      aligned,
      listSurfaces: surfaces,
      guarded,
      bordered,
      absent,
      oneAction,
      zeroAction,
      exemptions: usedExemptions.size,
    },
  };
}

/* ------------------------------------------------------------------ *
 * `pnpm ui:census` — the same walk, printed for a human
 * ------------------------------------------------------------------ */

/** Every `.tsx` under the two UI roots, minus the vendored primitives. */
function readTree(): CensusSource[] {
  // Required lazily: `data:check` imports this module and must not read a directory it did not ask
  // for, and the CLI is the only caller that wants the whole tree.
  const { readdirSync, readFileSync, statSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const root = process.cwd();

  const walk = (directory: string, files: CensusSource[]): CensusSource[] => {
    for (const entry of readdirSync(join(root, directory))) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const path = `${directory}/${entry}`;
      if (statSync(join(root, path)).isDirectory()) walk(path, files);
      else if (path.endsWith(".tsx") && !path.startsWith("components/ui/")) {
        files.push({ path, source: readFileSync(join(root, path), "utf8") });
      }
    }
    return files;
  };

  return [...walk("app", []), ...walk("components", [])];
}

if (require.main === module) {
  const files = readTree();
  const { problems, census } = censusFindings({ files, exemptions: NON_EMPTY_LISTS });

  console.log(
    `ui:census — rules 6 and 7 over ${census.modules} modules (the console and the member dashboard)`,
  );
  console.log(
    `  rule 6  ${census.numericCells} numeric cells, ${census.aligned} right-aligned, ${census.numericCells - census.aligned} flagged`,
  );
  console.log(
    `  rule 7  ${census.listSurfaces} list surfaces, ${census.guarded} guarded, ${census.bordered} with a bordered block, ${census.absent} omitted when empty, ${census.oneAction} with one action, ${census.zeroAction} with none (counted, not failed)`,
  );
  console.log(`  ${census.exemptions} exemption(s) used of ${NON_EMPTY_LISTS.length}`);

  if (problems.length === 0) {
    console.log("PASS  0 violations");
    process.exit(0);
  }
  console.log(`FAIL  ${problems.length} violation(s)`);
  for (const problem of problems) console.log(`  [${problem.rule}] ${problem.message}`);
  process.exit(1);
}
