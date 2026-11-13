/**
 * E40 — rules 6 and 7 of the reference pattern set, with a case for every way each rule is
 * defeated.
 *
 * Rule 6 is one sentence (a number is right-aligned in a table or a label/value list) and rule 7 is
 * another (an empty list draws a bordered block and one action, never blank space). The cases below
 * are the ways those sentences stop being true *or stop being checked*:
 *
 *   the cell       a number that leads the cell is a column; a number inside a sentence is prose; a
 *                  label is never a number; `<dd>` is a label/value pair, so it is measured too
 *   the list       a record list is one whose rows carry an identity; an options list, a copy
 *                  fixture's bullets, a local array and an import are all not data that can be empty
 *   the guard      a zero test guards, a positive test guards, a singular/plural `.length === 1`
 *                  does not — and the branch has to draw something, so an attribute `&&` is not one
 *   the block      bordered, grey and `EmptyState`/`Card` count; a bare sentence does not
 *   the actions    one passes, none is counted, two is a finding, and `asChild` is one control
 *   the boundary   an exemption is one exact list, and a row nothing uses is a finding
 *   the floor      a walk that resolved nothing passes every tree
 *
 * The last section asserts the real tree is clean, because a rule nobody can violate in a test is
 * a comment.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  MIN_LIST_SURFACES,
  MIN_NUMERIC_CELLS,
  NON_EMPTY_LISTS,
  censusFindings,
  isNumericExpression,
  listSurfaces,
  numericCells,
  scopedModules,
  scopedPagePaths,
  type CensusSource,
} from "../ui-census";

const file = (path: string, ...lines: string[]): CensusSource => ({
  path,
  source: lines.join("\n"),
});

/* ================================================================== *
 * Rule 6 — what counts as a number, and what counts as aligned
 * ================================================================== */

describe("isNumericExpression — the vocabulary", () => {
  it("reads a count, a total, a length and a percentage", () => {
    for (const value of [
      "row.aspectCount",
      "measured.count",
      "rows.length",
      "row.percent",
      "template.startedCount",
    ]) {
      assert.equal(isNumericExpression(value), true, value);
    }
  });

  it("reads a call that says it formats a number", () => {
    assert.equal(isNumericExpression("row.total.toLocaleString()"), true);
    assert.equal(isNumericExpression("spreadOf(measured.histogram)"), true);
    assert.equal(isNumericExpression("formatPercentRange(metric(1), metric(2))"), true);
  });

  it("reads a formatted range through its first substitution", () => {
    assert.equal(isNumericExpression("`${measured.min}–${measured.max}`"), true);
  });

  it("does not read a label, a title, a slug or a name", () => {
    for (const value of ["row.title", "row.slug", "row.name", "player.displayName"]) {
      assert.equal(isNumericExpression(value), false, value);
    }
  });
});

describe("numericCells — a number that leads the cell", () => {
  const cell = (markup: string): CensusSource =>
    file(
      "components/admin/demo.tsx",
      `export function Demo({ row }: { row: R }) {`,
      `  return (`,
      `    <Table><TableBody><TableRow>${markup}</TableRow></TableBody></Table>`,
      `  );`,
      `}`,
    );

  it("finds an unaligned number and names its line", () => {
    const cells = numericCells(cell("<TableCell>{row.aspectCount}</TableCell>"));
    assert.equal(cells.length, 1);
    assert.equal(cells[0].aligned, false);
    assert.equal(cells[0].line, 3);
  });

  it("passes `text-right` and passes `tabular-nums`", () => {
    assert.equal(
      numericCells(cell('<TableCell className="text-right">{row.count}</TableCell>'))[0].aligned,
      true,
    );
    assert.equal(
      numericCells(cell('<TableCell className="text-sm tabular-nums">{row.count}</TableCell>'))[0]
        .aligned,
      true,
    );
  });

  it("does not measure a number that follows prose in the same cell", () => {
    const cells = numericCells(
      cell(
        "<dd>{MODE_LABELS[row.mode]} — {opinionKindsFor(row.mode).length} Opinions per Aspect.</dd>",
      ),
    );
    assert.deepEqual(cells, []);
  });

  it("measures a number with a unit after it, because the number leads", () => {
    const cells = numericCells(
      cell("<TableCell>{row.sessionsScored} scored · {row.sessionsOpen} open</TableCell>"),
    );
    assert.equal(cells.length, 1);
  });

  it("does not measure a `<th>`, which carries a label", () => {
    assert.deepEqual(numericCells(cell("<th>Sessions</th>")), []);
  });
});

/* ================================================================== *
 * Rule 7 — what is a list surface
 * ================================================================== */

const PAGE = (body: string[], props = "rows: readonly Row[]"): CensusSource =>
  file(
    "components/admin/demo.tsx",
    'import Link from "next/link";',
    'import { EmptyState } from "@/components/v1/v1-ui";',
    `export function Demo({ ${props.split(":")[0]} }: { ${props} }) {`,
    "  return (",
    "    <>",
    ...body.map((line) => `      ${line}`),
    "    </>",
    "  );",
    "}",
  );

const LIST = [
  "<ul>",
  "  {rows.map((row) => (",
  "    <li key={row.id}>{row.title}</li>",
  "  ))}",
  "</ul>",
];

describe("listSurfaces — a record list over data", () => {
  it("reports an unguarded record list", () => {
    const surfaces = listSurfaces(PAGE(LIST));
    assert.equal(surfaces.length, 1);
    assert.equal(surfaces[0].guard, null);
    assert.deepEqual(surfaces[0].roots, ["rows"]);
  });

  it("ignores a list over a module constant — a literal cannot be empty", () => {
    const surfaces = listSurfaces(
      file(
        "components/admin/demo.tsx",
        'const OPTIONS = [{ id: "a" }, { id: "b" }];',
        "export function Demo() {",
        "  return (",
        "    <ul>",
        "      {OPTIONS.map((option) => (",
        "        <li key={option.id}>{option.id}</li>",
        "      ))}",
        "    </ul>",
        "  );",
        "}",
      ),
    );
    assert.deepEqual(surfaces, []);
  });

  it("ignores a list over an imported fixture", () => {
    const surfaces = listSurfaces(
      file(
        "components/admin/demo.tsx",
        'import { SEATS } from "@/lib/v1/admin-console";',
        "export function Demo() {",
        "  return (",
        "    <ul>{SEATS.map((seat) => (<li key={seat.id}>{seat.title}</li>))}</ul>",
        "  );",
        "}",
      ),
    );
    assert.deepEqual(surfaces, []);
  });

  it("ignores a list of form choices and a list inside a label/value pair", () => {
    assert.deepEqual(
      listSurfaces(
        PAGE(["<select>{rows.map((row) => (<option key={row.id}>{row.title}</option>))}</select>"]),
      ),
      [],
    );
    assert.deepEqual(
      listSurfaces(
        PAGE([
          "<dl>{rows.map((row) => (<div key={row.id}><dt>{row.title}</dt><dd>{row.value}</dd></div>))}</dl>",
        ]),
      ),
      [],
    );
  });

  it("reads a `?? []` fallback back to its own collection, so a copy section is not a surface", () => {
    const surfaces = listSurfaces(
      file(
        "components/support/demo.tsx",
        'import { sectionOf } from "@/lib/page-copy";',
        "export function Demo({ copy }: { copy: PageCopy }) {",
        '  const limits = sectionOf(copy, "limits");',
        "  return (",
        "    <ul>",
        "      {(limits.items ?? []).map((item) => (",
        "        <li key={item.id}>{item.label}</li>",
        "      ))}",
        "    </ul>",
        "  );",
        "}",
      ),
    );
    assert.deepEqual(surfaces, []);
  });
});

describe("listSurfaces — the guard", () => {
  const guarded = (test: string, empty: string[]): CensusSource =>
    PAGE([
      `{${test} ? (`,
      ...empty.map((line) => `  ${line}`),
      ") : (",
      ...LIST.map((line) => `  ${line}`),
      ")}",
    ]);

  it("reads a zero test as the guard and measures its branch", () => {
    const surfaces = listSurfaces(guarded("rows.length === 0", ["<p>Nothing here</p>"]));
    assert.equal(surfaces[0].guard, "rows.length === 0");
    assert.equal(surfaces[0].block, "none");
  });

  it("does not read a singular/plural switch as a guard", () => {
    const surfaces = listSurfaces(PAGE(['<p>{rows.length === 1 ? "one" : "many"}</p>', ...LIST]));
    assert.equal(surfaces[0].guard, null);
  });

  it("reads a positive test as the guard, and a missing else as an omitted region", () => {
    const surfaces = listSurfaces(
      PAGE(["{rows.length > 0 && (", ...LIST.map((line) => `  ${line}`), ")}"]),
    );
    assert.equal(surfaces[0].guard, "rows.length > 0");
    assert.equal(surfaces[0].block, "absent");
  });

  it("reads `cond ? null : <Card>` as an omitted region rather than a missing block", () => {
    const surfaces = listSurfaces(
      file(
        "components/admin/demo.tsx",
        "export function Demo({ rows }: { rows: readonly Row[] }) {",
        "  return (",
        "    <div>",
        "      {rows.length === 0 ? null : (",
        "        <Card>",
        "          <ul>",
        "            {rows.map((row) => (",
        "              <li key={row.id}>{row.title}</li>",
        "            ))}",
        "          </ul>",
        "        </Card>",
        "      )}",
        "    </div>",
        "  );",
        "}",
      ),
    );
    assert.equal(surfaces[0].block, "absent");
  });
});

describe("listSurfaces — the block and the actions", () => {
  const withEmpty = (empty: string[]): CensusSource =>
    PAGE([
      "{rows.length === 0 ? (",
      ...empty.map((line) => `  ${line}`),
      ") : (",
      ...LIST.map((line) => `  ${line}`),
      ")}",
    ]);

  it("reads a dashed border, a muted fill, `EmptyState` and `Card` as blocks", () => {
    for (const markup of [
      ['<p className="rounded-lg border border-dashed px-4 py-6">Nothing</p>'],
      ['<div className="bg-muted/30 px-4 py-6">Nothing</div>'],
      ['<EmptyState title="Nothing" />'],
      ["<Card>", "  <p>Nothing</p>", "</Card>"],
    ]) {
      const surfaces = listSurfaces(withEmpty(markup));
      assert.notEqual(surfaces[0].block, "none", markup.join(" "));
    }
  });

  it("counts one action, no action and two actions", () => {
    const one = listSurfaces(
      withEmpty([
        '<div className="border px-4 py-6">',
        "  <p>Nothing</p>",
        '  <Link href="/x">Add one</Link>',
        "</div>",
      ]),
    );
    assert.equal(one[0].actions, 1);

    const none = listSurfaces(withEmpty(['<p className="border px-4 py-6">Nothing</p>']));
    assert.equal(none[0].actions, 0);

    const two = listSurfaces(
      withEmpty([
        '<div className="border px-4 py-6">',
        "  <p>Nothing</p>",
        '  <Link href="/x">Add one</Link>',
        '  <Link href="/y">Learn more</Link>',
        "</div>",
      ]),
    );
    assert.equal(two[0].actions, 2);
  });

  it("counts `<Button asChild><Link/></Button>` as one control", () => {
    const surfaces = listSurfaces(
      withEmpty([
        '<div className="border px-4 py-6">',
        '  <Button asChild><Link href="/x">Add one</Link></Button>',
        "</div>",
      ]),
    );
    assert.equal(surfaces[0].actions, 1);
  });
});

/* ================================================================== *
 * The rule, the exemptions and the floor
 * ================================================================== */

const SCOPED_PAGES: CensusSource = file(
  "app/(mainlayout)/admin/demo/page.tsx",
  'import { Demo } from "@/components/admin/demo";',
  "export default function Page() {",
  "  return <Demo rows={[]} />;",
  "}",
);

const DEMO = PAGE(LIST);

describe("censusFindings — one finding per shape", () => {
  const run = (files: CensusSource[], exemptions: typeof NON_EMPTY_LISTS = []) =>
    censusFindings({
      files: [SCOPED_PAGES, ...files],
      exemptions,
      floors: { numericCells: 0, listSurfaces: 0 },
    });

  it("flags an unaligned number and names each file and line", () => {
    const { problems } = run([
      file(
        "components/admin/demo.tsx",
        "export function Demo({ rows }: { rows: readonly Row[] }) {",
        "  return (",
        "    <Table><TableBody><TableRow><TableCell>{rows.length}</TableCell></TableRow></TableBody></Table>",
        "  );",
        "}",
      ),
    ]);
    assert.equal(problems.length >= 1, true);
    assert.equal(
      problems.every((problem) => problem.rule === "E40"),
      true,
    );
    assert.equal(
      problems.some((problem) => problem.message.includes("components/admin/demo.tsx:3")),
      true,
    );
  });

  it("flags a list that never tests for empty, and says where the block belongs", () => {
    const { problems } = run([DEMO]);
    assert.equal(
      problems.some((problem) => problem.message.includes("never tests it for empty")),
      true,
    );
  });

  it("passes a list with a bordered block and one action", () => {
    const { problems, census } = run([
      PAGE([
        "{rows.length === 0 ? (",
        '  <div className="border px-4 py-6">',
        "    <p>Nothing yet</p>",
        '    <Link href="/x">Add one</Link>',
        "  </div>",
        ") : (",
        ...LIST.map((line) => `  ${line}`),
        ")}",
      ]),
    ]);
    assert.deepEqual(problems, []);
    assert.equal(census.bordered, 1);
    assert.equal(census.oneAction, 1);
  });

  it("counts an empty region with no action instead of failing it", () => {
    const { problems, census } = run([
      PAGE([
        "{rows.length === 0 ? (",
        '  <p className="border px-4 py-6">Nothing yet</p>',
        ") : (",
        ...LIST.map((line) => `  ${line}`),
        ")}",
      ]),
    ]);
    assert.deepEqual(problems, []);
    assert.equal(census.zeroAction, 1);
  });

  it("fails two actions", () => {
    const { problems } = run([
      PAGE([
        "{rows.length === 0 ? (",
        '  <div className="border px-4 py-6">',
        '    <Link href="/x">Add one</Link>',
        '    <Link href="/y">Learn more</Link>',
        "  </div>",
        ") : (",
        ...LIST.map((line) => `  ${line}`),
        ")}",
      ]),
    ]);
    assert.equal(
      problems.some((problem) => problem.message.includes("draws 2 actions")),
      true,
    );
  });

  it("honours an exact exemption, and reports a row nothing used", () => {
    const clean = () =>
      run([DEMO], [{ file: "components/admin/demo.tsx", receiver: "rows", reason: "test" }]);
    assert.deepEqual(clean().problems, []);

    const unused = run(
      [PAGE(LIST)],
      [{ file: "components/admin/demo.tsx", receiver: "other", reason: "test" }],
    );
    assert.equal(
      unused.problems.some((problem) => problem.message.includes("a row nothing needs")),
      true,
    );
  });

  it("fails a walk that resolved nothing", () => {
    const { problems, census } = censusFindings({ files: [SCOPED_PAGES], exemptions: [] });
    assert.equal(census.listSurfaces, 0);
    assert.equal(census.numericCells, 0);
    assert.equal(
      problems.some((problem) => problem.message.includes(String(MIN_LIST_SURFACES))),
      true,
    );
    assert.equal(
      problems.some((problem) => problem.message.includes(String(MIN_NUMERIC_CELLS))),
      true,
    );
  });
});

/* ================================================================== *
 * The real tree
 * ================================================================== */

const ROOT = process.cwd();

function walk(directory: string, files: CensusSource[] = []): CensusSource[] {
  for (const entry of readdirSync(join(ROOT, directory))) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const path = `${directory}/${entry}`;
    if (statSync(join(ROOT, path)).isDirectory()) walk(path, files);
    else if (path.endsWith(".tsx"))
      files.push({ path, source: readFileSync(join(ROOT, path), "utf8") });
  }
  return files;
}

const TREE: CensusSource[] = [
  ...walk("app"),
  ...walk("components").filter((entry) => !entry.path.startsWith("components/ui/")),
];

describe("the real tree", () => {
  it("right-aligns every numeric cell and gives every empty list a block", () => {
    const { problems, census } = censusFindings({ files: TREE, exemptions: NON_EMPTY_LISTS });

    assert.deepEqual(problems, []);
    assert.ok(census.numericCells >= MIN_NUMERIC_CELLS, `read ${census.numericCells} cells`);
    assert.ok(census.listSurfaces >= MIN_LIST_SURFACES, `read ${census.listSurfaces} surfaces`);
    assert.ok(census.modules > 0, "the scope resolved no modules at all");
  });

  it("scopes to the console and the member dashboard, and never to a quiz surface", () => {
    const pages = scopedPagePaths(TREE);

    assert.ok(pages.length >= 20, `scoped ${pages.length} pages`);
    assert.equal(
      pages.some((page) => page.includes("/admin/")),
      true,
    );
    assert.equal(
      pages.some((page) => page.includes("/dashboard")),
      true,
    );
    // A page that gates itself out of this brand renders nothing here, so it is out of scope.
    for (const page of pages) {
      const source = TREE.find((entry) => entry.path === page)?.source ?? "";
      assert.equal(/requireQuizProduct\s*\(/.test(source), false, page);
    }
  });

  it("scopes the walk by import closure, not by directory", () => {
    const modules = scopedModules(TREE);

    assert.ok(modules.length >= 40, `scoped ${modules.length} modules`);
    // A component no scoped page reaches is nobody's surface.
    assert.equal(modules.includes("components/explore/explore-quiz-list.tsx"), false);
  });
});
