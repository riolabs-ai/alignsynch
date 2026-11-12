#!/usr/bin/env node
/**
 * scripts/growth-check.ts — `pnpm growth:check`: the committed model is what this tree generates (#920).
 *
 * The failure this exists for is the one a fixture cannot see: `content/growth-model.ts` gains a
 * plan, a churn rate or a curve parameter and `data/demo/growth-model.json` is left alone. Nothing
 * else in the gate notices — `typecheck` is happy, `data:check` has no invariant over the model, and
 * the page renders a chart of a business the code no longer describes. So the check regenerates the
 * model **from the committed file's own parameters** and compares the two documents value by value,
 * printing the first field path that differs with both sides.
 *
 * A field path, not a diff, because the artifact is 40 KB of JSON: `months[17].plans[1].mrrCents`
 * names the edit a human made, and `-  "mrrCents": 40288113` does not.
 *
 * Usage:
 *   pnpm growth:check           # exit 0 identical, exit 1 with the first difference
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  generateGrowthModel,
  zGrowthModel,
  zGrowthParams,
  type GrowthParams,
} from "../content/growth-model";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_PATH = "data/demo/growth-model.json";

function fail(lines: readonly string[]): never {
  for (const line of lines) console.error(line);
  process.exit(1);
}

/** The first differing field, as a path and both values — or `null` when the two agree. */
function firstDifference(
  expected: unknown,
  actual: unknown,
  path = "",
): { path: string; expected: unknown; actual: unknown } | null {
  if (Object.is(expected, actual)) return null;

  const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      return {
        path: `${path}.length`,
        expected: expected.length,
        actual: actual.length,
      };
    }
    for (let index = 0; index < expected.length; index += 1) {
      const nested = firstDifference(expected[index], actual[index], `${path}[${index}]`);
      if (nested) return nested;
    }
    return null;
  }

  if (isObject(expected) && isObject(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    for (const key of keys) {
      const nested = firstDifference(
        expected[key],
        actual[key],
        path === "" ? key : `${path}.${key}`,
      );
      if (nested) return nested;
    }
    return null;
  }

  return { path, expected, actual };
}

const format = (value: unknown): string => (value === undefined ? "absent" : JSON.stringify(value));

let committedText: string;
try {
  committedText = readFileSync(join(ROOT, MODEL_PATH), "utf8");
} catch (error) {
  fail([
    `✗ growth:check — ${MODEL_PATH} is not readable (${error instanceof Error ? error.message : String(error)})`,
    `  generate it: pnpm growth`,
  ]);
}

let committedRaw: unknown;
try {
  committedRaw = JSON.parse(committedText);
} catch (error) {
  fail([
    `✗ growth:check — ${MODEL_PATH} is not JSON (${error instanceof Error ? error.message : String(error)})`,
    `  generate it: pnpm growth`,
  ]);
}

const committed = zGrowthModel.safeParse(committedRaw);
if (!committed.success) {
  const first = committed.error.issues[0];
  fail([
    `✗ growth:check — ${MODEL_PATH} does not match zGrowthModel at ${first?.path.join(".") ?? "the document"}: ${first?.message ?? "unknown"}`,
    `  generate it: pnpm growth`,
  ]);
}

/**
 * The parameters the committed model was generated with. Reading them from the file rather than
 * from `GROWTH_DEFAULT_PARAMS` is what makes the check catch a *parameter* edit: if the default
 * curve changes and the artifact does not, the regenerated months differ from the committed ones.
 */
let params: GrowthParams;
try {
  params = zGrowthParams.parse(committed.data.params);
} catch (error) {
  fail([
    `✗ growth:check — ${MODEL_PATH} carries parameters this build cannot express (${error instanceof Error ? error.message : String(error)})`,
    `  generate it: pnpm growth`,
  ]);
}

const regenerated = generateGrowthModel(params);

// The committed document is the "expected" side and the regeneration the "actual" one, so the
// diagnostic reads the way a reader expects: what the file says, then what the code says.
const difference = firstDifference(committed.data, regenerated.model);
if (difference) {
  fail([
    `✗ growth:check — ${MODEL_PATH} is stale at ${difference.path}`,
    `  committed:  ${format(difference.expected)}`,
    `  regenerated: ${format(difference.actual)}`,
    `  fix: pnpm growth --seed ${params.seed} --months ${params.months} --target-arr ${params.targetArrCents / 100}, then review the diff`,
  ]);
}

// A byte comparison on top of the field comparison: the field walk proves the *values*, this proves
// the file was written by the generator and not hand-reformatted into a different key order.
if (regenerated.json !== committedText) {
  fail([
    `✗ growth:check — ${MODEL_PATH} matches field by field but not byte for byte`,
    `  the committed file has been reformatted or its key order changed; regenerate it: pnpm growth`,
  ]);
}

const final = committed.data.totals.finalArrCents;
console.log(
  `✓ growth:check — ${committed.data.cohorts.length} cohorts, final ARR $${(final / 100).toLocaleString("en-US")} ` +
    `(off by ${(committed.data.solve.errorBps / 100).toFixed(2)} %), ${MODEL_PATH} is what this tree generates`,
);
