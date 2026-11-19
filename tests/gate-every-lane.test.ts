/**
 * A STEP WHOSE INPUT SPANS LANES RUNS IN EVERY LANE — pinned, because three red mains came from
 * forgetting it (#1251, #1257, #1265).
 *
 * `tests/md-normalised.test.ts` is the only check that reads `docs/` and holds
 * `tests/fixtures/md-normalised.json` against the pages. It went red on `main` three times in four
 * hours, each time from a *docs-only* PR that was green on its own head: a `docs/**` diff classifies
 * as `lane=docs`, the docs lane runs no `test` step, so the one check that can see the drift the diff
 * causes was skipped — and the gate reported green over a red `main`.
 *
 * The repair is placement, not a new test: `md:normalised:check` runs before any lane branch, beside
 * `glossary` and `release:check`, for the reason `scripts/verify.sh` states at each of them — their
 * input spans lanes the diff cannot see. Placement is the whole fix, so placement is what this file
 * pins. Moving that step inside a lane block restores the defect exactly, and no test would notice.
 *
 * Two properties are load-bearing and both are asserted here:
 *
 *   1. the step sits **above** the first `if [ "$LANE" = …` in `verify.sh`, so every lane pays it;
 *   2. the script it calls is the **read-only** mode — `scripts/md-normalise.mjs` with no `--write`.
 *      A check that regenerates the fixture it is checking reports the drift as green, which is the
 *      failure `tests/md-normalised.test.ts`'s own docstring forbids.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VERIFY = readFileSync(join(ROOT, "scripts/verify.sh"), "utf8");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};

/**
 * The step list starts at `deps`, and the first lane branch after it is where the gate begins to run
 * different work per lane — everything between those two points runs everywhere. (An earlier
 * `if [ "$LANE" = ` exists above the steps, in the banner that names the deepest matching path, so
 * the search starts at the step list rather than at the top of the file.)
 */
const STEPS_START = VERIFY.indexOf('run_step "deps (pnpm install --frozen-lockfile)"');
const FIRST_LANE_BRANCH = VERIFY.indexOf('if [ "$LANE" = ', STEPS_START);

describe("a step whose input spans lanes runs in every lane", () => {
  it("puts the md-normalised check above the first lane branch", () => {
    expect(FIRST_LANE_BRANCH).toBeGreaterThan(0);
    const step = VERIFY.indexOf('has_script "md:normalised:check"');
    expect(step).toBeGreaterThan(0);
    // The regression, stated directly: a step below the lane branch is a step the docs lane can skip.
    expect(step).toBeLessThan(FIRST_LANE_BRANCH);
    // And it is a real step, so it lands in the gate summary on every run — not a bare command.
    expect(VERIFY).toContain(
      'run_step "md-normalised (tests/fixtures/md-normalised.json matches the docs/ prose)"',
    );
  });

  it("runs the read-only mode, never a regeneration", () => {
    const script = PKG.scripts?.["md:normalised:check"];
    expect(script).toBe("node scripts/md-normalise.mjs");
    expect(script).not.toContain("--write");
    // The fixture's own test keeps its teeth: the check is added beside it, not in place of it.
    const test = readFileSync(join(ROOT, "tests/md-normalised.test.ts"), "utf8");
    expect(test).toContain('it("says the same words as the page it replaced, on every page"');
  });

  it("keeps the two precedents the placement copies, above the branch as well", () => {
    for (const precedent of ['has_script "glossary:check"', 'has_script "release:check"']) {
      const at = VERIFY.indexOf(precedent);
      expect(at).toBeGreaterThan(0);
      expect(at).toBeLessThan(FIRST_LANE_BRANCH);
    }
  });
});
