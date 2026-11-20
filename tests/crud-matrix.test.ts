/**
 * `lib/admin/crud-matrix.ts` — the parse, the figures and the filters (#1126).
 *
 * The page's value rests on four rules that are cheap to break and expensive to notice:
 *
 *   1. **A matrix is a markdown table naming the issue's columns**, in any order, anywhere in the
 *      document, and nothing else is a row. A fenced sample is not a matrix; a required column the
 *      header omits is refused by name rather than drawn blank.
 *   2. **The rank is read, never assumed.** A `priority` column when the header names one, else the
 *      `mvp` column — which is how the committed source writes it — and a header with neither is
 *      refused, because the counts band is built from that value.
 *   3. **Nothing is defaulted.** An unknown status is a refusal carrying the line, a cell with no
 *      object / action / role is a refusal, and the same cell twice is a refusal — because a value
 *      the parser guessed would appear on the page as a fact the source never stated.
 *   4. **The filters are the address.** Every facet round-trips through the URL, the facets
 *      combine, and a value the closed sets do not know is dropped rather than 400'd.
 *
 * `readCrudMatrix` (the `fs` half) is driven twice: once for an absent file — the failure panel the
 * frame card built, and the state of a tree whose `docs/` was pruned — and once for the committed
 * source itself, so the page's row count is proven against the file rather than against a fixture.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ADMIN_PERMISSIONS_PATH,
  CRUD_MATRIX_PATH,
  CRUD_PRIORITIES,
  CRUD_PROTOTYPE_STATUSES,
  CRUD_UPSTREAM_STATUSES,
  CrudMatrixUnreadable,
  conflictedCells,
  countsOf,
  facetsOf,
  filterCells,
  matrixHref,
  parseCrudFilter,
  parseCrudMatrix,
  parseCrudMatrixDocument,
  withFacet,
} from "@/lib/admin/crud-matrix";
import { readCrudMatrix } from "@/lib/admin/crud-matrix-file";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

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

/**
 * The committed source's own shape: eight columns, the rank in `mvp`, and `—` where upstream does
 * not apply — the two things the frame could only guess at before #1158 landed the file.
 */
const FOLDED = `# CRUD & Permissions Matrix

| object | action | role | prototype | selector | upstream | mvp | rationale |
|---|---|---|---|---|---|---|---|
| Template | clone/duplicate | Visitor | missing | — | exists | P1 | Sign-up first. |
| Template | create | Visitor | N/A | — | — | — | Visitors start a relationship. |
| Relationship | leave | Counterparty | hinted | data-leave | conflict | Won’t | Upstream deletes. |
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
      // P0 ∩ (hinted or missing): the artifact's "N P0 still open" — one of the two P0 rows is
      // still only hinted, and the covered one is not open.
      p0Open: 1,
    });
  });

  it("counts the P0s still open as P0 intersected with the prototype's answer", () => {
    expect(countsOf(CELLS).p0Open).toBe(
      CELLS.filter(
        (cell) =>
          cell.priority === "P0" && (cell.prototype === "hinted" || cell.prototype === "missing"),
      ).length,
    );
    expect(countsOf([]).p0Open).toBe(0);
  });

  it("counts conflicts as the rows whose upstream disagrees, not as a typed figure", () => {
    expect(conflictedCells(CELLS).map((cell) => cell.action)).toEqual(["Leave"]);
  });
});

describe("the snapshot pass the source states about itself", () => {
  it("reads the pass from the preamble, in whatever words the file uses", () => {
    expect(
      parseCrudMatrixDocument(
        `Generated from the v2 prototype triage (pass 10, 16 Nov 2026).\n${MATRIX}`,
      ).snapshotPass,
    ).toBe(10);
    expect(parseCrudMatrixDocument(`Triaged (Pass 3) on a Monday.\n${MATRIX}`).snapshotPass).toBe(
      3,
    );
  });

  it("answers null when the document states no pass, rather than borrowing one", () => {
    expect(parseCrudMatrixDocument(MATRIX).snapshotPass).toBeNull();
  });
});

describe("the shape the committed source actually has", () => {
  it("reads the rank from `mvp` when the header names no priority column", () => {
    const document = parseCrudMatrixDocument(FOLDED);

    // The table's shape is the file's: eight columns, in the header's own order, no invented ninth.
    expect(document.columns).toEqual([
      "object",
      "action",
      "role",
      "prototype",
      "selector",
      "upstream",
      "mvp",
      "rationale",
    ]);
    expect(document.cells.map((cell) => cell.priority)).toEqual(["P1", "none", "Won't"]);
    // `mvp` still carries its own text — the column is drawn, not swallowed by the rank.
    expect(document.cells[0]?.mvp).toBe("P1");
  });

  it("reads the source's `—` for upstream as not-applicable, not as a missing value", () => {
    expect(parseCrudMatrix(FOLDED)[1]?.upstream).toBe("n/a");
    // And the closed sets the page's filters are built from know it.
    expect(CRUD_UPSTREAM_STATUSES).toContain("n/a");
  });

  it("draws the ninth column only when the header names it", () => {
    expect(parseCrudMatrixDocument(MATRIX).columns).toContain("priority");
    expect(parseCrudMatrixDocument(MATRIX).columns).toHaveLength(9);
  });

  it("refuses a second table whose header names a different set — a document is one matrix", () => {
    expect(() =>
      parseCrudMatrixDocument(`| object | action | role | prototype | selector | upstream | mvp | rationale |
|---|---|---|---|---|---|---|---|
| Template | create | Visitor | covered | — | exists | P0 | Why. |

A second table, drawn by someone who meant a different shape.

| object | action | role | prototype | selector | upstream | mvp | rationale | priority |
|---|---|---|---|---|---|---|---|---|
| Template | view | Visitor | covered | — | exists | P0 | Why again. | P1 |
`),
    ).toThrow(/second table whose header names/);
  });
});

describe("the committed source — docs/specs/v2-prototype/crud-matrix.md (#1158)", () => {
  /** The file as committed: the one source the page reads, not a fixture standing in for it. */
  const file = join(ROOT, CRUD_MATRIX_PATH);
  const text = readFileSync(file, "utf8");
  const document = readCrudMatrix(file);

  it("reads every row the file carries — pipe lines minus each header and its separator", () => {
    const lines = text.split("\n");
    const pipes = lines.filter((line) => line.startsWith("|")).length;
    const separators = lines.filter(
      (line) => line.trim().startsWith("|") && /^[\s|:-]+$/.test(line.trim()) && line.includes("-"),
    ).length;

    expect(separators).toBeGreaterThan(0);
    expect(document.cells).toHaveLength(pipes - 2 * separators);
    expect(document.cells).toHaveLength(169);
  });

  it("names the source's eight columns, in the source's order", () => {
    expect(document.columns).toEqual([
      "object",
      "action",
      "role",
      "prototype",
      "selector",
      "upstream",
      "mvp",
      "rationale",
    ]);
  });

  it("parses every cell into the page's vocabulary — no row is skipped or defaulted", () => {
    for (const cell of document.cells) {
      expect(CRUD_PROTOTYPE_STATUSES).toContain(cell.prototype);
      expect(CRUD_UPSTREAM_STATUSES).toContain(cell.upstream);
      expect(CRUD_PRIORITIES).toContain(cell.priority);
      expect(cell.object).not.toBe("");
      expect(cell.action).not.toBe("");
      expect(cell.role).not.toBe("");
    }
  });

  it("derives figures that add up to the cell count the acceptance line names", () => {
    const counts = countsOf(document.cells);
    const notApplicable = document.cells.filter((cell) => cell.prototype === "n/a").length;
    const unscheduled = document.cells.filter((cell) => cell.priority === "none").length;

    expect(counts.cells).toBe(169);
    // Every cell lands in exactly one prototype bucket and exactly one rank — no cell is counted
    // twice, and none falls outside the band the page prints.
    expect(counts.covered + counts.hinted + counts.missing).toBe(counts.applicable);
    expect(counts.applicable + notApplicable).toBe(counts.cells);
    expect(counts.p0 + counts.p1 + counts.p2 + counts.wont + unscheduled).toBe(counts.cells);
    expect(counts.conflicts).toBe(conflictedCells(document.cells).length);
    expect(counts.conflicts).toBeGreaterThan(0);
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
  it("refuses an absent source by naming the path — the panel the frame card built", () => {
    expect(() => readCrudMatrix("/nonexistent/crud-matrix.md")).toThrow(CrudMatrixUnreadable);
    expect(() => readCrudMatrix("/nonexistent/crud-matrix.md")).toThrow(
      /is not present in this tree/,
    );
  });

  it("reads a real file on disk into the same document the parser produces", () => {
    const directory = mkdtempSync(join(tmpdir(), "crud-matrix-"));
    const file = join(directory, "crud-matrix.md");
    writeFileSync(file, MATRIX, "utf8");

    expect(readCrudMatrix(file)).toEqual(parseCrudMatrixDocument(MATRIX));
    expect(readCrudMatrix(file).cells).toEqual(CELLS);
  });

  it("refuses an `mvp` that holds no rank when the header names no priority column", () => {
    expect(() =>
      parseCrudMatrix(`| object | action | role | prototype | selector | upstream | mvp | rationale |
|---|---|---|---|---|---|---|---|
| Template | create | Visitor | covered | — | exists | yes | Why. |
`),
    ).toThrow(/has mvp "yes"/);
  });
});
