/**
 * Reading the CRUD & Permissions matrix — the only place `docs/specs/v2-prototype/crud-matrix.md`
 * is opened (#1126).
 *
 * **Server-only, and it says so.** This is the one module in the feature that touches `fs`; a
 * `"use client"` module that value-imports it fails `data:check` E34 (the browser graph has no
 * `node:fs`, so the route 500s at request time while `next build` stays green). The module-scope
 * guard below is the same marker `lib/docs/tree.ts` and `lib/auth/require-role.ts` carry.
 *
 * **A missing file is a named failure, not an empty table.** On this tree the source does not
 * exist yet: #1126's matrix was reviewed on a Page outside the repo and lands with the pending v2
 * docs PR. The page's answer to that is the one honest panel the issue prescribes — a sentence
 * naming the path and saying an owner supplies it — because "the matrix has no cells" and "the
 * matrix could not be read" are different statements and only one of them is true. Nothing here
 * fabricates a row to make the screen look finished.
 *
 * **Read at request time, never at build.** The page is `force-dynamic`, so a matrix that lands
 * is live on the next request with no rebuild, and `pnpm build` needs no file at all — which is
 * also why this read is not a gate step: a build with no source is a green build and an honest
 * page.
 *
 * Node-only (`node:fs`), reached from the server page and from no client graph.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CRUD_MATRIX_PATH,
  CrudMatrixUnreadable,
  type CrudCell,
  parseCrudMatrix,
} from "@/lib/admin/crud-matrix";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/admin/crud-matrix-file.ts is server-only: it reads the matrix source from disk. Read the rows in a page and pass them down as props.",
  );
}

/**
 * The matrix on disk, parsed. Throws `CrudMatrixUnreadable` — never returns a partial list — so
 * the page draws one panel with the reason instead of a table that lost half its rows.
 *
 * The default path is `process.cwd()`-relative because that is how the repo's other committed
 * readers resolve (`lib/admin/growth.ts`, `lib/docs/tree.ts`); the parameter exists so a test can
 * drive a real file without writing into `docs/`.
 */
export function readCrudMatrix(path: string = join(process.cwd(), CRUD_MATRIX_PATH)): CrudCell[] {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new CrudMatrixUnreadable("it is not present in this tree, so there is no matrix to read");
  }

  return parseCrudMatrix(text);
}
