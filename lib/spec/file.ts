/**
 * Reading the project spec's register — the only place `data/spec/validation.json` is opened
 * (#1252).
 *
 * **Server-only, and it says so.** This is the one module in the surface that touches `fs`; a
 * `"use client"` module that value-imports it fails `data:check` E34 (the browser graph has no
 * `node:fs`, so the route answers 500 at request time while `next build` stays green). The
 * module-scope guard below is the same marker `lib/admin/crud-matrix-file.ts` and
 * `lib/docs/tree.ts` carry.
 *
 * **Read at request time, never at build (AS-09).** The three routes are `force-dynamic`, so an
 * edited register is live on the next request with no rebuild, and `pnpm build` needs no file at
 * all — which is why this read is not a gate step: a build with no register is a green build and
 * an honest page.
 *
 * **A missing or invalid file is a named failure, not an empty page.** `SpecUnreadable` carries a
 * sentence an owner can act on, and the page draws it in the panel s04b prescribes — naming the
 * path and the reason, answering **200**, and logging nothing as an error. "The register has no
 * rows" and "the register could not be read" are different statements and only one of them is true;
 * nothing here fabricates a row to make the screen look finished.
 *
 * The path is repo-relative and printed verbatim in that panel, because a reader has to be told
 * *which* file is missing rather than that "the data could not be loaded".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type SpecValidation, zSpecValidation } from "@/content/spec";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/spec/file.ts is server-only: it reads the validation register from disk. Read it in a page and pass the document down as props.",
  );
}

/** The register, repo-relative. One constant: the page, the panel and the tests print this path. */
export const SPEC_VALIDATION_SOURCE = "data/spec/validation.json";

/** The register could not be read. `reason` is the sentence the s04b panel prints. */
export class SpecUnreadable extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`the project spec register could not be read: ${reason}`);
    this.name = "SpecUnreadable";
    this.reason = reason;
  }
}

/**
 * The register on disk, parsed. Throws `SpecUnreadable` — never returns a partial document — so
 * the page draws one panel instead of a matrix that lost half its rows.
 *
 * The default path is `process.cwd()`-relative because that is how the repo's other committed
 * readers resolve (`lib/admin/crud-matrix-file.ts`, `lib/docs/tree.ts`); the parameter exists so a
 * test can drive a real file — or a missing one — without writing into `data/`.
 */
export function readSpecValidation(
  path: string = join(process.cwd(), SPEC_VALIDATION_SOURCE),
): SpecValidation {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new SpecUnreadable("Not Found — the file is not present in this tree");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SpecUnreadable("the file is not JSON, so no row could be read");
  }

  const result = zSpecValidation.safeParse(parsed);
  if (!result.success) {
    const [issue] = result.error.issues;
    const at =
      issue === undefined || issue.path.length === 0 ? "the document" : issue.path.join(".");
    throw new SpecUnreadable(
      `the file does not match the register's schema: ${at} — ${issue?.message ?? "invalid"}`,
    );
  }

  return result.data;
}

/**
 * The register, or the reason it could not be read — the shape every page wants.
 *
 * A page draws one panel on the failure path and the reader on the other, and it must not catch a
 * *different* error as if it were the same thing: only `SpecUnreadable` is answered here, and
 * anything else is rethrown so a real bug still surfaces as a 500 rather than as a quiet "the file
 * is missing".
 */
export interface SpecRead {
  readonly doc: SpecValidation | null;
  readonly reason: string | null;
}

export function readSpecValidationSafe(): SpecRead {
  try {
    return { doc: readSpecValidation(), reason: null };
  } catch (error) {
    if (!(error instanceof SpecUnreadable)) throw error;
    return { doc: null, reason: error.reason };
  }
}
