/**
 * Reading the committed growth model — the only place `data/demo/growth-model.json` is opened (#920).
 *
 * The artifact is written by `pnpm growth` and held to the code by `pnpm growth:check`, which is a
 * gate step. That makes a *stale* model impossible to merge and a *missing* one possible: a fresh
 * clone, a deployment that did not ship the file, a hand-edit that broke the JSON. The page's job in
 * that case is to say so, which is why the failure is a named error carrying its reason rather than
 * a `null` the render has to interpret.
 *
 * The `safeParse` is not redundant with the check. `growth:check` holds the *committed* bytes to the
 * generator; this holds *whatever is on disk at request time* to the schema, so a broken deploy is a
 * panel with a sentence instead of a chart of `NaN`. It is the same split `lib/admin/platform-health.ts`
 * makes for the health record, and for the same reason.
 *
 * Node-only (`node:fs`), so this module is reached from a server component and from no client
 * graph — `data:check` E34 walks the client side and fails on a value import that gets here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { zGrowthModel, type GrowthModel } from "@/content/growth-model";

/** The committed path, repo-relative — printed verbatim in a failure, so it is never guessed. */
export const GROWTH_MODEL_PATH = "data/demo/growth-model.json";

/**
 * The artifact could not be read, parsed or validated.
 *
 * `reason` is a sentence an operator can act on: which of the three happened, and where.
 */
export class GrowthModelUnreadable extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "GrowthModelUnreadable";
    this.reason = reason;
  }
}

/** The model on disk, validated. Throws `GrowthModelUnreadable` — never returns a partial document. */
export function readGrowthModel(
  path: string = join(process.cwd(), GROWTH_MODEL_PATH),
): GrowthModel {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new GrowthModelUnreadable(
      `${GROWTH_MODEL_PATH} is not readable in this tree (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new GrowthModelUnreadable(
      `${GROWTH_MODEL_PATH} is not JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const result = zGrowthModel.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.join(".") ?? "the document";
    throw new GrowthModelUnreadable(
      `${GROWTH_MODEL_PATH} does not match the growth-model schema at ${where}: ${first?.message ?? "unknown"}`,
    );
  }

  return result.data;
}
