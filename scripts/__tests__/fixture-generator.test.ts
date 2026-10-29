/**
 * fixture-generator tests — `scripts/gen-fixtures.mjs` (the `pnpm gen` CLI).
 *
 * Written BEFORE the generator existed, so every case below failed on the tree that had
 * only hand-authored fixtures. The generator is the bulk-variation facility (P3): it emits
 * `data/generated/quizzes.ts` from templates, and the properties it must guarantee above
 * all else are
 *
 *   1. reproducibility — the same `--seed` and `--count` produce byte-identical files,
 *   2. idempotency     — re-running without a seed change rewrites nothing (reports "unchanged"),
 *   3. quizzes only    — no `promotions.ts`. A promotion is addressed to a slot a shelf
 *      renders (E28), and a generated quiz is in no shelf, so a generated campaign can only
 *      fail the data gate; a leftover `promotions.ts` from an older clone is removed.
 *
 * These are exercised by shelling out to the real CLI into a throwaway directory, because a
 * test that re-implements the PRNG or the serializer proves nothing about the command a
 * developer actually runs. The validation half (`data:check` folding generated quizzes into
 * E0–E19) is proven by the `pnpm data:check` run itself, not re-implemented here.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const GENERATOR = join(process.cwd(), "scripts", "gen-fixtures.mjs");

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

function run(args: string[]): string {
  return execFileSync(process.execPath, [GENERATOR, ...args], { encoding: "utf8" });
}

function runExpectFailure(args: string[]): string {
  try {
    run(args);
    assert.fail("expected the generator to exit non-zero");
  } catch (error) {
    const message = (error as Error).message;
    const stderr = (error as { stderr?: string }).stderr ?? "";
    return `${message} ${stderr}`;
  }
}

function generateInto(dir: string, count: number, seed: number): string {
  return run(["--count", String(count), "--seed", String(seed), "--out", dir]);
}

describe("scripts/gen-fixtures.mjs", () => {
  it("is reproducible: the same --seed and --count produce byte-identical output", () => {
    const first = mkdtempSync(join(tmpdir(), "gen-repro-a-"));
    const second = mkdtempSync(join(tmpdir(), "gen-repro-b-"));
    try {
      generateInto(first, 5, 42);
      generateInto(second, 5, 42);
      assert.equal(
        sha256(readFileSync(join(first, "quizzes.ts"))),
        sha256(readFileSync(join(second, "quizzes.ts"))),
      );
    } finally {
      rmSync(first, { recursive: true, force: true });
      rmSync(second, { recursive: true, force: true });
    }
  });

  it("writes quizzes only — promotions are curated, never generated", () => {
    const dir = mkdtempSync(join(tmpdir(), "gen-promos-"));
    try {
      const stdout = generateInto(dir, 20, 42);
      assert.ok(existsSync(join(dir, "quizzes.ts")), "quizzes.ts should be written");
      assert.ok(
        !existsSync(join(dir, "promotions.ts")),
        "promotions.ts must not be emitted: a generated quiz is in no shelf, so E28 has no slot to render its campaign",
      );
      assert.match(stdout, /wrote 20 quizzes/);
      assert.doesNotMatch(stdout, /promotions to/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("removes a promotions.ts left behind by an older generator", () => {
    const dir = mkdtempSync(join(tmpdir(), "gen-stale-promo-"));
    try {
      writeFileSync(join(dir, "promotions.ts"), "export const generatedPromotions = [];\n");
      const stdout = run(["--count", "5", "--seed", "42", "--out", dir]);
      assert.ok(
        !existsSync(join(dir, "promotions.ts")),
        "the stale file must be gone, or data:check E26 keeps failing on a file `pnpm gen` would never write",
      );
      assert.match(stdout, /removed .*promotions\.ts/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is idempotent: a re-run reports 'unchanged' and leaves the bytes untouched", () => {
    const dir = mkdtempSync(join(tmpdir(), "gen-idem-"));
    try {
      generateInto(dir, 5, 42);
      const before = sha256(readFileSync(join(dir, "quizzes.ts")));
      const secondRun = run(["--count", "5", "--seed", "42", "--out", dir]);
      assert.match(secondRun, /unchanged/);
      assert.equal(sha256(readFileSync(join(dir, "quizzes.ts"))), before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("varies with the seed: different --seed produce different bytes", () => {
    const first = mkdtempSync(join(tmpdir(), "gen-seed-a-"));
    const second = mkdtempSync(join(tmpdir(), "gen-seed-b-"));
    try {
      generateInto(first, 5, 42);
      generateInto(second, 5, 43);
      assert.notEqual(
        sha256(readFileSync(join(first, "quizzes.ts"))),
        sha256(readFileSync(join(second, "quizzes.ts"))),
      );
    } finally {
      rmSync(first, { recursive: true, force: true });
      rmSync(second, { recursive: true, force: true });
    }
  });

  it("rejects a non-positive --count and a non-integer --seed", () => {
    const dir = mkdtempSync(join(tmpdir(), "gen-bad-"));
    try {
      assert.match(runExpectFailure(["--count", "0", "--seed", "42", "--out", dir]), /count/i);
      assert.match(
        runExpectFailure(["--count", "5", "--seed", "notanumber", "--out", dir]),
        /seed/i,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
