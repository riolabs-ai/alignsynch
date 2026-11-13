#!/usr/bin/env node
/**
 * scripts/growth.ts — `pnpm growth`: generate the growth model and the sampled operational set (#920).
 *
 * Two artifacts, one distribution:
 *
 *   data/demo/growth-model.json        committed. The 36-cohort aggregate `/admin/growth` charts, and
 *                                      the only thing the page reads. ~40 KB.
 *   data/generated/growth/*.json       gitignored. ~5k sampled relationships with the sessions,
 *                                      payments and churn events a live tenant would hold. This is
 *                                      what an operator clicks through; the model is what they read.
 *
 * The model half is a **solve**, not a retune: `solveGrowthModel` iterates the acquisition index
 * until the final month's ARR lands inside ±1 % of `--target-arr`, and records the index and the pass
 * count in the artifact so the number can be re-derived instead of trusted. A parameter changed here
 * without regenerating turns `pnpm growth:check` red on the next gate run, naming the first field
 * that differs.
 *
 * Every value is a function of `(--seed, --months, --target-arr)` and the authored plans in
 * `content/growth-model.ts`: no clock, no `Math.random()`. Run it twice and the sha256 is the same
 * string, which is the property the demo's screenshot-and-transcript agreement rests on.
 *
 * Usage:
 *   pnpm growth                                     # the committed model: seed 42, 36 months, $3M
 *   pnpm growth --seed 42 --months 36 --target-arr 3000000 --rows 5000
 *   pnpm growth --rows 500 --no-sample              # model only; leave data/generated/ untouched
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GROWTH_DEFAULT_PARAMS,
  GROWTH_MONTH_BOUNDS,
  compareSampleToModel,
  generateGrowthModel,
  sampleGrowthOperations,
  type GrowthParams,
} from "../content/growth-model";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_PATH = "data/demo/growth-model.json";
const SAMPLE_DIR = "data/generated/growth";

const DEFAULT_ROWS = 5_000;

interface Args {
  params: GrowthParams;
  rows: number;
  sample: boolean;
}

function fail(message: string, got?: string): never {
  console.error(`growth: ${message}${got === undefined ? "" : ` (got ${JSON.stringify(got)})`}`);
  process.exit(2);
}

function usage(): void {
  console.log(
    [
      "growth — write the committed growth model and the sampled operational set (#920)",
      "",
      "  --seed <n>          PRNG seed (default 42)",
      "  --months <n>        monthly cohorts, 12–60 (default 36)",
      "  --target-arr <usd>  final-month ARR in whole dollars (default 3000000 — $3,000,000)",
      "  --rows <n>          sampled relationships (default 5000)",
      "  --no-sample         write the model only",
      "  --help              this text",
      "",
      "The model is a committed fixture: regenerating it is a commit, and `pnpm growth:check`",
      "proves the committed bytes are what this script produces.",
    ].join("\n"),
  );
}

function parseArgs(argv: readonly string[]): Args {
  if (argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(0);
  }

  const params: GrowthParams = { ...GROWTH_DEFAULT_PARAMS };
  let rows = DEFAULT_ROWS;
  let sample = true;

  const numberArg = (flag: string, value: string | undefined): number => {
    if (value === undefined || !/^\d+$/.test(value))
      fail(`${flag} must be a non-negative integer`, value);
    return Number(value);
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case "--seed":
        params.seed = numberArg("--seed", value);
        i += 1;
        break;
      case "--months": {
        const months = numberArg("--months", value);
        if (months < GROWTH_MONTH_BOUNDS.min || months > GROWTH_MONTH_BOUNDS.max) {
          fail(
            `--months must be ${GROWTH_MONTH_BOUNDS.min}–${GROWTH_MONTH_BOUNDS.max}`,
            String(months),
          );
        }
        params.months = months;
        i += 1;
        break;
      }
      case "--target-arr": {
        // Dollars on the command line (the issue says "$3M"), cents in the model — the tree's money
        // convention is integer cents everywhere else, and one conversion at the boundary is
        // cheaper than a reader guessing which unit `3000000` is in.
        const dollars = numberArg("--target-arr", value);
        params.targetArrCents = dollars * 100;
        i += 1;
        break;
      }
      case "--rows":
        rows = numberArg("--rows", value);
        i += 1;
        break;
      case "--no-sample":
        sample = false;
        break;
      default:
        fail(`unknown argument ${JSON.stringify(flag)}`, flag);
    }
  }

  if (rows > 50_000) {
    fail("--rows above 50000 defeats the point: the branch is at its ceiling (#909)", String(rows));
  }
  return { params, rows, sample };
}

/** Write only when the bytes changed, so a re-run leaves mtimes alone (the `pnpm gen` precedent). */
function writeIfChanged(relative: string, text: string): "written" | "unchanged" {
  const absolute = join(ROOT, relative);
  mkdirSync(dirname(absolute), { recursive: true });
  try {
    if (readFileSync(absolute, "utf8") === text) return "unchanged";
  } catch {
    // A missing file is the ordinary first run.
  }
  writeFileSync(absolute, text, "utf8");
  return "written";
}

const usd = (cents: number): string =>
  `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const args = parseArgs(process.argv.slice(2));
const { model, json } = generateGrowthModel(args.params);

const sha256 = createHash("sha256").update(json).digest("hex");
const modelStatus = writeIfChanged(MODEL_PATH, json);

console.log(
  `growth: ${model.cohorts.length} monthly cohorts, months ${model.cohorts[0]?.label} → ${model.cohorts.at(-1)?.label}`,
);
console.log(
  `growth: final ARR ${usd(model.totals.finalArrCents)} (${model.totals.finalArrCents} cents) — target ${usd(model.params.targetArrCents)}, off by ${(model.solve.errorBps / 100).toFixed(2)} %`,
);
console.log(
  `growth: solve ${model.solve.method}, acquisition index ${(model.solve.acquisitionIndexBps / 10_000).toFixed(4)}× in ${model.solve.passes} pass(es)`,
);
console.log(
  `growth: ${model.totals.signups.toLocaleString("en-US")} signups, ${model.totals.activeAccounts.toLocaleString("en-US")} active accounts, ${model.totals.churnedAccounts.toLocaleString("en-US")} churned, ${model.totals.failedInvoices.toLocaleString("en-US")} failed invoices, ${model.totals.refundedInvoices.toLocaleString("en-US")} refunded`,
);
console.log(`growth: model ${MODEL_PATH} — ${modelStatus}, sha256 ${sha256}`);

if (!args.sample) {
  console.log("growth: --no-sample — data/generated/growth/ untouched");
  process.exit(0);
}

const sample = sampleGrowthOperations(model, args.rows, args.params.seed);
const files: [string, unknown][] = [
  ["relationships.json", sample.relationships],
  ["sessions.json", sample.sessions],
  ["payments.json", sample.payments],
  ["churn-events.json", sample.churnEvents],
];
for (const [name, rows] of files) {
  const status = writeIfChanged(join(SAMPLE_DIR, name), `${JSON.stringify(rows, null, 2)}\n`);
  console.log(
    `growth: ${SAMPLE_DIR}/${name} — ${(rows as unknown[]).length.toLocaleString("en-US")} rows, ${status}`,
  );
}

// Representativeness is a measured fact, not a claim: print the two distributions side by side so a
// reader (and the handoff) can see the sample drawn from the model rather than scaled out of it.
const comparison = compareSampleToModel(model, sample);
console.log("\ngrowth: sampled vs model — plan mix (final month, % of active accounts)");
for (const row of comparison.planMix) {
  console.log(
    `  ${row.plan.padEnd(10)} model ${row.modelPct.toFixed(1).padStart(5)} %   sampled ${row.sampledPct.toFixed(1).padStart(5)} %`,
  );
}
console.log(`growth: sampled vs model — signups by cohort month (% of the whole)`);
const worst = comparison.signups.reduce(
  (acc, row) => Math.max(acc, Math.abs(row.sampledPct - row.modelPct)),
  0,
);
for (const row of comparison.signups) {
  console.log(
    `  ${String(row.month).padStart(2)}  model ${row.modelPct.toFixed(1).padStart(4)} %   sampled ${row.sampledPct.toFixed(1).padStart(4)} %`,
  );
}
console.log(`growth: worst monthly deviation ${worst.toFixed(1)} percentage points`);
