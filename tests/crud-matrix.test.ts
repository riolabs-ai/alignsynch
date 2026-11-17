/**
 * `lib/admin/crud-matrix.ts` — the parse, the figures and the filters (#1126).
 *
 * The page's value rests on three rules that are cheap to break and expensive to notice:
 *
 *   1. **A matrix is a markdown table naming the nine columns**, in any order, anywhere in the
 *      document, and nothing else is a row. A fenced sample is not a matrix; a column the header
 *      omits is refused by name rather than drawn blank.
 *   2. **Nothing is defaulted.** An unknown status is a refusal carrying the line, a cell with no
 *      object / action / role is a refusal, and the same cell twice is a refusal — because a value
 *      the parser guessed would appear on the page as a fact the source never stated.
 *   3. **The filters are the address.** Every facet round-trips through the URL, the facets
 *      combine, and a value the closed sets do not know is dropped rather than 400'd.
 *
 * `readCrudMatrix` (the `fs` half) is driven twice: once for the absent file, which is this tree's
 * standing state, and once for a real file on disk, so the two halves are proven together rather
 * than only in the page's stub.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ADMIN_PERMISSIONS_PATH,
  CrudMatrixUnreadable,
  conflictedCells,
  countsOf,
  facetsOf,
  filterCells,
  matrixHref,
  parseCrudFilter,
  parseCrudMatrix,
  withFacet,
} from "@/lib/admin/crud-matrix";
import { readCrudMatrix } from "@/lib/admin/crud-matrix-file";

/** A document shaped like the one #1126 names: prose, then a table, then more prose. */
const MATRIX = `# CRUD & Permissions

The v2 matrix, as it was triaged on 16 Nov 2026.

| Object | Action | Role | Prototype | Selector | Upstream | MVP | Rationale | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Template | Create | Initiator | covered | \`data-template-create\` | exists | yes | The library's own create path. | P0 |
| Template | Archive | Initiator | hinted | \`data-card-kebab\` | not found | yes | No archive control draws today. | **P0** |
| Relationship | Leave | Counterparty | missing | \`data-close-relationship\` | conflict | no | Upstream deletes; the spec closes. | P1 |
| Template | Restore | Admin-curator | N/A |  | exists | no | Not a role action on this screen. | — |
| Relationship | Propose a change | Initiator | missing |  | not-found | no | The silent write this replaces. | Won’t |

A note between the tables is not a row.
`;

const CELLS = parseCrudMatrix(MATRIX);

describe("parseCrudMatrix", () => {
  it("reads one cell per body row, with the markdown stripped and the spellings normalised", () => {
    expect(CELLS).toHaveLength(5);
    expect(CELLS[0]).toEqual({
      object: "Template",
      action: "Create",
      role: "Initiator",
      prototype: "covered",
      selector: "data-template-create",
      upstream: "exists",
      mvp: "yes",
      rationale: "The library's own create path.",
      priority: "P0",
    });
    // `**P0**` is emphasis, not a different value; `N/A` is the matrix's own `n/a`.
    expect(CELLS[1]?.priority).toBe("P0");
    expect(CELLS[3]?.prototype).toBe("n/a");
    // `not found`, `not-found` and a curly apostrophe are the same three facts.
    expect(CELLS[1]?.upstream).toBe("not-found");
    expect(CELLS[4]?.upstream).toBe("not-found");
    expect(CELLS[4]?.priority).toBe("Won't");
    // An em dash is "this cell is not scheduled", not a missing value.
    expect(CELLS[3]?.priority).toBe("none");
  });

  it("reads the columns by name, so a header in another order is the same matrix", () => {
    const reordered =
      parseCrudMatrix(`| priority | rationale | role | object | action | mvp | prototype | upstream | selector |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P2 | Odd order. | Initiator | Template | Duplicate | yes | covered | exists | data-duplicate |
`);
    expect(reordered).toHaveLength(1);
    expect(reordered[0]?.object).toBe("Template");
    expect(reordered[0]?.action).toBe("Duplicate");
    expect(reordered[0]?.priority).toBe("P2");
  });

  it("refuses a table whose header omits a column, naming the column", () => {
    expect(() =>
      parseCrudMatrix(`| Object | Action | Role | Prototype | Selector | Upstream | MVP | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Template | Create | Initiator | covered | data-x | exists | yes | P0 |
`),
    ).toThrow(/does not name the "rationale" column/);
  });

  it("refuses an unknown status rather than defaulting it, and says which line", () => {
    expect(() =>
      parseCrudMatrix(`| Object | Action | Role | Prototype | Selector | Upstream | MVP | Rationale | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Template | Create | Initiator | maybe | data-x | exists | yes | Why. | P0 |
`),
    ).toThrow(/prototype "maybe"/);

    expect(() =>
      parseCrudMatrix(`| Object | Action | Role | Prototype | Selector | Upstream | MVP | Rationale | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Template | Create | Initiator | covered | data-x | probably | yes | Why. | P0 |
`),
    ).toThrow(/upstream "probably"/);

    expect(() =>
      parseCrudMatrix(`| Object | Action | Role | Prototype | Selector | Upstream | MVP | Rationale | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Template | Create | Initiator | covered | data-x | exists | yes | Why. | soon |
`),
    ).toThrow(/priority "soon"/);
  });

  it("refuses a cell with no identity and a cell declared twice", () => {
    expect(() =>
      parseCrudMatrix(`| Object | Action | Role | Prototype | Selector | Upstream | MVP | Rationale | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | Create | Initiator | covered | data-x | exists | yes | Why. | P0 |
`),
    ).toThrow(/no object, action or role/);

    expect(() =>
      parseCrudMatrix(`| Object | Action | Role | Prototype | Selector | Upstream | MVP | Rationale | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Template | Create | Initiator | covered | data-x | exists | yes | Why. | P0 |
| Template | Create | Initiator | hinted | data-y | exists | yes | Also why. | P1 |
`),
    ).toThrow(/repeats the cell Template · Create · Initiator/);
  });

  it("refuses a document with no matrix in it — a fence is a sample, not rows", () => {
    expect(() =>
      parseCrudMatrix(`# Just prose

\`\`\`md
| Object | Action | Role | Prototype | Selector | Upstream | MVP | Rationale | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Template | Create | Initiator | covered | data-x | exists | yes | Why. | P0 |
\`\`\`
`),
    ).toThrow(/holds no matrix table/);
  });
});

describe("countsOf", () => {
  it("derives every header figure from the rows", () => {
    expect(countsOf(CELLS)).toEqual({
      cells: 5,
      applicable: 4,
      covered: 1,
      hinted: 1,
      missing: 2,
      p0: 2,
      p1: 1,
      p2: 0,
      wont: 1,
      conflicts: 1,
    });
  });

  it("holds the example figures #1126 states, from a 169-cell matrix", () => {
    // The issue's own totals: 169 cells, 124 applicable, 37 covered / 25 hinted / 62 missing,
    // 33 P0 / 18 P1 / 28 P2 / 15 Won't, 4 conflicts. Generated here so the arithmetic is proven
    // against the numbers the acceptance line quotes, not against a second transcript of them.
    const cell = (index: number) => ({
      object: `Object ${index % 17}`,
      action: `Action ${index}`,
      role: ["Visitor", "Initiator", "Counterparty", "Admin-curator"][index % 4] ?? "Initiator",
      prototype:
        index < 37
          ? ("covered" as const)
          : index < 62
            ? ("hinted" as const)
            : index < 124
              ? ("missing" as const)
              : ("n/a" as const),
      selector: "",
      upstream: index < 4 ? ("conflict" as const) : ("exists" as const),
      mvp: "",
      rationale: "",
      priority:
        index < 33
          ? ("P0" as const)
          : index < 51
            ? ("P1" as const)
            : index < 79
              ? ("P2" as const)
              : index < 94
                ? ("Won't" as const)
                : ("none" as const),
    });
    const counts = countsOf(Array.from({ length: 169 }, (_, index) => cell(index)));

    expect(counts).toEqual({
      cells: 169,
      applicable: 124,
      covered: 37,
      hinted: 25,
      missing: 62,
      p0: 33,
      p1: 18,
      p2: 28,
      wont: 15,
      conflicts: 4,
    });
  });

  it("counts conflicts as the rows whose upstream disagrees, not as a typed figure", () => {
    expect(conflictedCells(CELLS).map((cell) => cell.action)).toEqual(["Leave"]);
  });
});

describe("the filters", () => {
  it("narrows by one facet and by several at once", () => {
    expect(filterCells(CELLS, { role: "Initiator" })).toHaveLength(3);
    expect(filterCells(CELLS, { role: "initiator" })).toHaveLength(3);
    expect(filterCells(CELLS, { object: "Template", role: "Initiator" })).toHaveLength(2);
    expect(filterCells(CELLS, { prototype: "missing" })).toHaveLength(2);
    expect(filterCells(CELLS, { upstream: "conflict" })).toHaveLength(1);
    expect(filterCells(CELLS, { priority: "none" })).toHaveLength(1);
    expect(filterCells(CELLS, {})).toHaveLength(5);
  });

  it("drops a value the closed sets do not know, and keeps a free-text facet as written", () => {
    expect(parseCrudFilter({ priority: "urgent" })).toEqual({});
    expect(parseCrudFilter({ prototype: "N/A" })).toEqual({ prototype: "n/a" });
    expect(parseCrudFilter({ upstream: "not found" })).toEqual({ upstream: "not-found" });
    expect(parseCrudFilter({ priority: "—" })).toEqual({ priority: "none" });
    expect(parseCrudFilter({ role: "Counterparty" })).toEqual({ role: "Counterparty" });
    // A repeated key is an array; the first value is the one the address meant.
    expect(parseCrudFilter({ role: ["Initiator", "Admin-curator"] })).toEqual({
      role: "Initiator",
    });
  });

  it("round-trips the filter through the address, and toggles a chip off with a second click", () => {
    expect(matrixHref({})).toBe(ADMIN_PERMISSIONS_PATH);
    expect(matrixHref({ role: "Initiator" })).toBe("/admin/permissions?role=Initiator");
    expect(matrixHref({ object: "Template", priority: "P0" })).toBe(
      "/admin/permissions?object=Template&priority=P0",
    );
    // The facets are always spelled in one order, so two links to the same view are one string.
    expect(matrixHref(parseCrudFilter({ priority: "P0", object: "Template" }))).toBe(
      "/admin/permissions?object=Template&priority=P0",
    );

    expect(withFacet({}, "priority", "P0")).toEqual({ priority: "P0" });
    expect(withFacet({ priority: "P0" }, "priority", "P0")).toEqual({});
    expect(withFacet({ role: "Initiator" }, "role", null)).toEqual({});
  });

  it("lists the distinct objects and roles in the source's order, for the chips", () => {
    expect(facetsOf(CELLS)).toEqual({
      objects: ["Template", "Relationship"],
      roles: ["Initiator", "Counterparty", "Admin-curator"],
    });
  });
});

describe("readCrudMatrix", () => {
  it("refuses an absent source by naming the path, which is this tree's state today", () => {
    expect(() => readCrudMatrix("/nonexistent/crud-matrix.md")).toThrow(CrudMatrixUnreadable);
    expect(() => readCrudMatrix("/nonexistent/crud-matrix.md")).toThrow(
      /is not present in this tree/,
    );
  });

  it("reads a real file on disk into the same cells the parser produces", () => {
    const directory = mkdtempSync(join(tmpdir(), "crud-matrix-"));
    const file = join(directory, "crud-matrix.md");
    writeFileSync(file, MATRIX, "utf8");

    expect(readCrudMatrix(file)).toEqual(CELLS);
  });
});
