/**
 * The CRUD & Permissions matrix — the words-to-rows half (#1126).
 *
 * **What this page is.** The v2 CRUD gap triage (169 object × action × role cells, 16 Nov 2026)
 * lived only as a file outside the repo and a review Page, so every #1119 child re-decided which
 * role may do what. #1126 makes it an admin-only, read-only screen: one row per cell, parsed at
 * request time from `docs/specs/v2-prototype/crud-matrix.md`, and the spec reference every card
 * that adds a create / edit / archive / leave action is judged against.
 *
 * **This module is the parse, and it touches no filesystem.** `lib/admin/crud-matrix-file.ts`
 * owns the read (Node-only, unreachable from a client graph); this half is pure so the client
 * component can filter and label rows without dragging `node:fs` into the browser bundle — the
 * same split `lib/docs/rows.ts` / `lib/docs/tree.ts` makes, and for the same E34 reason.
 *
 * **The file format, as the source actually writes it (#1158).** A matrix is a set of markdown
 * tables whose header row names the issue's own columns — `object, action, role, prototype,
 * selector, upstream, mvp, rationale` — in any order, anywhere in the document, with prose between
 * them. Every other `|`-line is a cell, and a header that omits a required column is refused by
 * name rather than rendered blank.
 *
 * **Priority is a column the source may not have.** The page's counts and its Priority filter can
 * only be recomputed if priority is known, so the parser reads it from a `priority` column when
 * the header names one and otherwise from `mvp` — which is how the landed source writes it:
 * its vocabulary line reads `mvp (priority) = P0 / P1 / P2 / Won't / —`. A header with neither is
 * refused, because a rank the parser guessed is a rank the page would print as fact.
 *
 * **The columns drawn are the columns the header names.** `parseCrudMatrixDocument` returns the
 * source's own column order beside its cells, so the page cannot draw a column the file does not
 * have: the landed source has eight, and a `priority` column appears on screen only once a source
 * carries one. A second table with a different header is refused — two shapes in one document is
 * not one matrix.
 *
 * **Nothing is invented and nothing is defaulted.** An unknown `prototype`, `upstream` or
 * `priority` value is a refusal naming the row, not a `missing` the reader would take as fact; a
 * cell with no object, action or role is refused; the same object × action × role twice is
 * refused, because one cell cannot be two rows. The one honest failure the page draws is exactly
 * this: a source that is absent, or present and not parseable.
 *
 * **The counts are derived, never typed.** `countsOf` is the only place the header figures come
 * from, so every number in the counts band is a consequence of the file and not an assertion about
 * it — which is what makes the acceptance line "counts match the source file" provable instead of
 * copied, and what keeps them true after the source is edited.
 */

/** The page's address — one constant, so the gate, the rail row and the tests cannot disagree. */
export const ADMIN_PERMISSIONS_PATH = "/admin/permissions";

/**
 * The matrix source, repo-relative. Printed verbatim in the failure panel: a reader has to be
 * told *which* file is missing, not that "the data could not be loaded".
 */
export const CRUD_MATRIX_PATH = "docs/specs/v2-prototype/crud-matrix.md";

/**
 * The triage Page the matrix was reviewed on, and the epic every child belongs to. Both leave
 * the app, so both are drawn by `LeavingLink` with its own new-tab contract.
 */
export const CRUD_TRIAGE_PAGE_URL =
  "https://cursor.com/canvas/store-5adda110-c55c-43b0-9b42-d405201b60e3/8f26e4d6-7c4b-482c-b43f-1098864f9ab5";
export const CRUD_EPIC_ISSUE_URL = "https://github.com/riolabs-ai/alignsynch/issues/1119";

/** What the prototype draws for a cell. `n/a` is an axis the screen has no control for. */
export const CRUD_PROTOTYPE_STATUSES = ["covered", "hinted", "missing", "n/a"] as const;
export type CrudPrototypeStatus = (typeof CRUD_PROTOTYPE_STATUSES)[number];

/**
 * What upstream already answers. `conflict` is the row a card has to decide rather than port;
 * `n/a` is the source's own `—` — the vocabulary line says "(— when not applicable)", and 27 of
 * the landed file's 169 cells use it, so it is a status, not an empty cell.
 */
export const CRUD_UPSTREAM_STATUSES = ["exists", "not-found", "conflict", "n/a"] as const;
export type CrudUpstreamStatus = (typeof CRUD_UPSTREAM_STATUSES)[number];

/** The ranking, plus `none` for a cell the matrix deliberately does not schedule. */
export const CRUD_PRIORITIES = ["P0", "P1", "P2", "Won't", "none"] as const;
export type CrudPriority = (typeof CRUD_PRIORITIES)[number];

/** One cell of the matrix — the issue's own eight columns, plus the rank the counts need. */
export interface CrudCell {
  readonly object: string;
  readonly action: string;
  readonly role: string;
  readonly prototype: CrudPrototypeStatus;
  /** The selector the prototype draws for this control, empty when it draws none. */
  readonly selector: string;
  readonly upstream: CrudUpstreamStatus;
  readonly mvp: string;
  readonly rationale: string;
  readonly priority: CrudPriority;
}

/**
 * The document, not just its rows: the cells **and** the columns the source's header names, in
 * that header's order. The console draws the columns it is given, so a table's shape is the
 * file's fact rather than a figure typed into a component.
 */
export interface CrudMatrixDocument {
  readonly cells: readonly CrudCell[];
  readonly columns: readonly CrudColumn[];
  /**
   * The triage pass the source says it was generated from — the `(pass 10, …)` in its own preamble,
   * or `null` when the document does not say. Read rather than typed: the page's snapshot line
   * prints what the file states, and a file that states nothing prints no pass at all.
   */
  readonly snapshotPass: number | null;
}

/** The header figures, all derived. `applicable` excludes the cells whose prototype is `n/a`. */
export interface CrudCounts {
  readonly cells: number;
  readonly applicable: number;
  readonly covered: number;
  readonly hinted: number;
  readonly missing: number;
  readonly p0: number;
  readonly p1: number;
  readonly p2: number;
  readonly wont: number;
  readonly conflicts: number;
  /**
   * The P0 cells the prototype still does not draw — hinted or missing. The artifact's summary line
   * prints it as "N P0 still open (hinted or missing)", so it is a count of the rank *and* the
   * prototype's answer, never of the rank alone.
   */
  readonly p0Open: number;
}

/** The matrix could not be read or parsed. `reason` is a sentence an owner can act on. */
export class CrudMatrixUnreadable extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "CrudMatrixUnreadable";
    this.reason = reason;
  }
}

/* ------------------------------------------------------------------ *\
 * Parsing
 * ------------------------------------------------------------------ */

/** The eight columns a matrix must name, in the order they are read. */
const REQUIRED_COLUMNS = [
  "object",
  "action",
  "role",
  "prototype",
  "selector",
  "upstream",
  "mvp",
  "rationale",
] as const;
type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];

/**
 * A column the source may name instead of folding it into another. The landed source has no
 * `priority` column — its `mvp` column *is* the priority — so the table keeps eight columns and
 * the rank is read from `mvp`; a source that names `priority` separately gets drawn with it.
 */
const OPTIONAL_COLUMNS = ["priority"] as const;
type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];

/** Every column the page knows how to draw — the source's own header words, canonicalised. */
export type CrudColumn = RequiredColumn | OptionalColumn;

/** A header cell, lowercased, as the canonical column name — or `null` for one we do not draw. */
function columnOf(header: string): CrudColumn | null {
  const name = keyOf(header);
  if ((REQUIRED_COLUMNS as readonly string[]).includes(name)) return name as RequiredColumn;
  if ((OPTIONAL_COLUMNS as readonly string[]).includes(name)) return name as OptionalColumn;
  return null;
}

/**
 * Spellings a human writes and the parser accepts. The canonical value is the key; everything
 * after it is what the matrix author's hand produces — `N/A`, `not found`, `Won’t` with a curly
 * apostrophe, an em dash for "no priority". A value outside these is refused rather than guessed:
 * a status the page quietly defaulted would be a claim the source never made.
 */
const PROTOTYPE_SPELLINGS: Record<string, CrudPrototypeStatus> = {
  covered: "covered",
  hinted: "hinted",
  missing: "missing",
  "n/a": "n/a",
  na: "n/a",
};

const UPSTREAM_SPELLINGS: Record<string, CrudUpstreamStatus> = {
  exists: "exists",
  "not-found": "not-found",
  "not found": "not-found",
  notfound: "not-found",
  conflict: "conflict",
  // The source's "— when not applicable": an axis upstream has no answer for, which is a status
  // and not a gap in the row.
  "n/a": "n/a",
  na: "n/a",
  "not applicable": "n/a",
  "—": "n/a",
  "-": "n/a",
};

const PRIORITY_SPELLINGS: Record<string, CrudPriority> = {
  p0: "P0",
  p1: "P1",
  p2: "P2",
  "won't": "Won't",
  wont: "Won't",
  "won’t": "Won't",
  none: "none",
  "—": "none",
  "-": "none",
};

/**
 * A cell's text with the markdown an author types around it removed: backticks, emphasis, a
 * leading list marker. It is presentation, not content — the page prints the text, so a row must
 * not carry its own markup into the table.
 */
function cleanCell(text: string): string {
  return text.replace(/`/g, "").replace(/\*\*/g, "").trim();
}

/** A normalised lookup key for a spelling table, without the emphasis a table cell may carry. */
function keyOf(text: string): string {
  return cleanCell(text).toLowerCase().replace(/\s+/g, " ");
}

/** `| a | b |` → `["a", "b"]`; a leading and trailing pipe are the table's edges, not empty cells. */
function rowCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

/** The `| --- | :---: |` line that separates a header from its rows. */
function isSeparator(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && /^[\s|:-]+$/.test(trimmed) && trimmed.includes("-");
}

/** Every line of a fenced code block is not a table — a format sample must not become cells. */
function withoutFences(markdown: string): string[] {
  const lines: string[] = [];
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (line.trim().startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (!fenced) lines.push(line);
  }
  return lines;
}

/**
 * The matrix in a document: its cells and the columns its header names. Throws
 * `CrudMatrixUnreadable` — never a partial list — so the page renders one honest panel instead of
 * a table that quietly lost the rows it could not read.
 */
export function parseCrudMatrixDocument(markdown: string): CrudMatrixDocument {
  const lines = withoutFences(markdown);
  const cells: CrudCell[] = [];
  const seen = new Map<string, number>();
  let columns: CrudColumn[] | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) continue;

    // The header is the first `|`-line of a block; the row after it is the separator, unless the
    // block is malformed, in which case this line is simply not a matrix and the scan moves on.
    const header = rowCells(line).map((cell) => keyOf(cell));
    const separator = lines[index + 1];
    if (separator === undefined || !isSeparator(separator)) continue;

    const positions = new Map<CrudColumn, number>();
    for (const name of REQUIRED_COLUMNS) {
      const position = header.indexOf(name);
      if (position < 0) {
        throw new CrudMatrixUnreadable(
          `${CRUD_MATRIX_PATH} has a table whose header does not name the "${name}" column (found: ${header.join(", ")})`,
        );
      }
      positions.set(name, position);
    }

    // Where the rank lives: a `priority` column when the header names one, else `mvp`, which is
    // how the source this page was built for writes it. Never a default — the counts depend on it.
    const rankColumn: CrudColumn = header.includes("priority") ? "priority" : "mvp";
    if (rankColumn === "priority") {
      positions.set("priority", header.indexOf("priority"));
    }

    // The columns this table draws, in the header's own order. A document is one matrix, so a
    // second table that names a different set is refused rather than merged into the first.
    const named = header.flatMap((name) => {
      const column = columnOf(name);
      return column === null ? [] : [column];
    });
    if (columns === null) {
      columns = named;
    } else if (
      named.length !== columns.length ||
      named.some((name, at) => name !== columns?.[at])
    ) {
      throw new CrudMatrixUnreadable(
        `${CRUD_MATRIX_PATH}:${index + 1} is a second table whose header names ${named.join(" / ")} where the first names ${columns.join(" / ")} — a document is one matrix`,
      );
    }

    const width = header.length;
    let row = index + 2;
    for (; row < lines.length; row += 1) {
      const body = lines[row];
      if (!body.trim().startsWith("|")) break;
      if (isSeparator(body)) continue;

      const values = rowCells(body);
      if (values.length !== width) {
        throw new CrudMatrixUnreadable(
          `${CRUD_MATRIX_PATH}:${row + 1} has ${values.length} cells where the header has ${width}`,
        );
      }

      const at = (name: CrudColumn): string => values[positions.get(name) ?? 0] ?? "";
      const object = cleanCell(at("object"));
      const action = cleanCell(at("action"));
      const role = cleanCell(at("role"));
      if (object === "" || action === "" || role === "") {
        throw new CrudMatrixUnreadable(
          `${CRUD_MATRIX_PATH}:${row + 1} is a cell with no object, action or role — the three columns are the row's identity`,
        );
      }

      const prototype = PROTOTYPE_SPELLINGS[keyOf(at("prototype"))];
      if (prototype === undefined) {
        throw new CrudMatrixUnreadable(
          `${CRUD_MATRIX_PATH}:${row + 1} has prototype "${cleanCell(at("prototype"))}"; the matrix's vocabulary is ${CRUD_PROTOTYPE_STATUSES.join(" / ")}`,
        );
      }

      const upstream = UPSTREAM_SPELLINGS[keyOf(at("upstream"))];
      if (upstream === undefined) {
        throw new CrudMatrixUnreadable(
          `${CRUD_MATRIX_PATH}:${row + 1} has upstream "${cleanCell(at("upstream"))}"; the matrix's vocabulary is ${CRUD_UPSTREAM_STATUSES.join(" / ")}`,
        );
      }

      const priority = PRIORITY_SPELLINGS[keyOf(at(rankColumn))];
      if (priority === undefined) {
        throw new CrudMatrixUnreadable(
          `${CRUD_MATRIX_PATH}:${row + 1} has ${rankColumn} "${cleanCell(at(rankColumn))}"; the matrix's vocabulary is ${CRUD_PRIORITIES.join(" / ")}${rankColumn === "mvp" ? ' — this header names no "priority" column, so "mvp" carries the rank' : ""}`,
        );
      }

      const identity = `${object}\u0000${action}\u0000${role}`;
      const first = seen.get(identity);
      if (first !== undefined) {
        throw new CrudMatrixUnreadable(
          `${CRUD_MATRIX_PATH}:${row + 1} repeats the cell ${object} · ${action} · ${role} first declared on line ${first} — one cell cannot be two rows`,
        );
      }
      seen.set(identity, row + 1);

      cells.push({
        object,
        action,
        role,
        prototype,
        selector: cleanCell(at("selector")),
        upstream,
        mvp: cleanCell(at("mvp")),
        rationale: cleanCell(at("rationale")),
        priority,
      });
    }

    index = row - 1;
  }

  if (cells.length === 0) {
    throw new CrudMatrixUnreadable(
      `${CRUD_MATRIX_PATH} holds no matrix table whose header names ${REQUIRED_COLUMNS.map((name) => `"${name}"`).join(", ")}`,
    );
  }

  return { cells, columns: columns ?? [], snapshotPass: snapshotPassOf(markdown) };
}

/**
 * The triage pass the document says it was generated from. The source's own preamble reads
 * "Generated from the v2 prototype triage (pass 10, 16 Nov 2026)", so the number is a fact of the
 * file; a file that does not state one answers `null` rather than borrowing the artifact's.
 */
function snapshotPassOf(markdown: string): number | null {
  const match = /\(pass (\d+)\b/i.exec(markdown);
  return match === null ? null : Number(match[1]);
}

/**
 * The cells alone. The page wants the document (its columns are drawn too), so this form exists
 * for the callers that only count or filter — and it is the same parse, never a second one.
 */
export function parseCrudMatrix(markdown: string): CrudCell[] {
  return [...parseCrudMatrixDocument(markdown).cells];
}

/* ------------------------------------------------------------------ *\
 * Deriving the header figures
 * ------------------------------------------------------------------ */

/** The header counts, over the whole matrix — filters narrow the table, never these figures. */
export function countsOf(cells: readonly CrudCell[]): CrudCounts {
  const count = (predicate: (cell: CrudCell) => boolean): number => cells.filter(predicate).length;

  return {
    cells: cells.length,
    applicable: count((cell) => cell.prototype !== "n/a"),
    covered: count((cell) => cell.prototype === "covered"),
    hinted: count((cell) => cell.prototype === "hinted"),
    missing: count((cell) => cell.prototype === "missing"),
    p0: count((cell) => cell.priority === "P0"),
    p1: count((cell) => cell.priority === "P1"),
    p2: count((cell) => cell.priority === "P2"),
    wont: count((cell) => cell.priority === "Won't"),
    conflicts: count((cell) => cell.upstream === "conflict"),
    p0Open: count(
      (cell) =>
        cell.priority === "P0" && (cell.prototype === "hinted" || cell.prototype === "missing"),
    ),
  };
}

/** The rows a card has to decide rather than port, in the source's order. */
export function conflictedCells(cells: readonly CrudCell[]): CrudCell[] {
  return cells.filter((cell) => cell.upstream === "conflict");
}

/* ------------------------------------------------------------------ *\
 * The filters — the URL is the state
 * ------------------------------------------------------------------ */

/**
 * What the address selects. Empty is "no filter", never "nothing matches": every facet is one
 * value or absent, and the facets combine.
 *
 * `object` and `role` are free text because the vocabulary is the matrix's — the chips are built
 * from the rows (`facetsOf`), so a new object needs no change here. `prototype`, `upstream` and
 * `priority` are closed sets, and a value outside the set is dropped: a link somebody edited by
 * hand lands on the unfiltered table rather than on a 400.
 */
export interface CrudFilter {
  readonly object?: string;
  readonly role?: string;
  readonly prototype?: CrudPrototypeStatus;
  readonly upstream?: CrudUpstreamStatus;
  readonly priority?: CrudPriority;
}

/** The facets the address can carry, in the order the page draws them. */
export const CRUD_FACETS = ["object", "role", "prototype", "upstream", "priority"] as const;
export type CrudFacet = (typeof CRUD_FACETS)[number];

/** A query string value: Next hands a repeated key over as an array. The first value wins. */
function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** The filter an address selects. Unknown closed-set values are dropped, never refused. */
export function parseCrudFilter(
  params: Readonly<Record<string, string | string[] | undefined>>,
): CrudFilter {
  const object = firstValue(params.object).trim();
  const role = firstValue(params.role).trim();
  const prototypeKey = keyOf(firstValue(params.prototype));
  const upstreamKey = keyOf(firstValue(params.upstream));
  const priorityKey = PRIORITY_SPELLINGS[keyOf(firstValue(params.priority))];

  return {
    ...(object === "" ? {} : { object }),
    ...(role === "" ? {} : { role }),
    ...(PROTOTYPE_SPELLINGS[prototypeKey] === undefined
      ? {}
      : { prototype: PROTOTYPE_SPELLINGS[prototypeKey] }),
    ...(UPSTREAM_SPELLINGS[upstreamKey] === undefined
      ? {}
      : { upstream: UPSTREAM_SPELLINGS[upstreamKey] }),
    ...(priorityKey === undefined ? {} : { priority: priorityKey }),
  };
}

/** The cells a filter admits. Case-insensitive on the two free-text facets, by value on the rest. */
export function filterCells(cells: readonly CrudCell[], filter: CrudFilter): readonly CrudCell[] {
  const object = filter.object?.toLowerCase();
  const role = filter.role?.toLowerCase();
  return cells.filter(
    (cell) =>
      (object === undefined || cell.object.toLowerCase() === object) &&
      (role === undefined || cell.role.toLowerCase() === role) &&
      (filter.prototype === undefined || cell.prototype === filter.prototype) &&
      (filter.upstream === undefined || cell.upstream === filter.upstream) &&
      (filter.priority === undefined || cell.priority === filter.priority),
  );
}

/** The distinct objects and roles the matrix holds, in the source's order — the chips' words. */
export function facetsOf(cells: readonly CrudCell[]): {
  readonly objects: readonly string[];
  readonly roles: readonly string[];
} {
  const distinct = (values: readonly string[]): string[] => [...new Set(values)];
  return {
    objects: distinct(cells.map((cell) => cell.object)),
    roles: distinct(cells.map((cell) => cell.role)),
  };
}

/** The address for one facet's value. Absent facets are not spelled, so a link stays readable. */
export function matrixHref(filter: CrudFilter): string {
  const query = CRUD_FACETS.flatMap((facet) => {
    const value = filter[facet];
    return value === undefined || value === "" ? [] : [`${facet}=${encodeURIComponent(value)}`];
  });
  return query.length === 0
    ? ADMIN_PERMISSIONS_PATH
    : `${ADMIN_PERMISSIONS_PATH}?${query.join("&")}`;
}

/**
 * The filter with one facet set, cleared, or **toggled** — a chip that is already the selected
 * value links back to no filter, which is what makes a second click a way out of the view.
 */
export function withFacet(filter: CrudFilter, facet: CrudFacet, value: string | null): CrudFilter {
  const next: Record<string, string> = {};
  for (const name of CRUD_FACETS) {
    const current = filter[name];
    if (current !== undefined) next[name] = current;
  }
  if (value === null || next[facet] === value) delete next[facet];
  else next[facet] = value;
  return parseCrudFilter(next);
}
