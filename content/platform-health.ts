/**
 * The platform-health record — the artifact `/admin/health` renders (#508).
 *
 * The console's health screen answers four questions, and every one of them is a **measurement**
 * with a time and a command behind it: what `db:verify` said, what the gate cost, whether the tag,
 * `package.json` and production agree, and how far production trails `main`. A page that computed
 * any of those from a clock or a guess would be a screen an operator cannot act on, so the values
 * live in one recorded document (`data/health/platform-health.json`, written by
 * `scripts/health-record.mjs`) and the page prints the record's own `measuredAt` beside each number.
 *
 * **Why a schema and not a bare `JSON.parse`.** The record is committed, so it is read on every
 * request of a tree that did not write it. `strict()` turns a hand-edit that adds a key into a red
 * build rather than a field nobody renders; the `code` pattern is the narrow one that matters,
 * because the screen's whole claim about `db:verify` is that it prints the code **the script**
 * printed (`V11`, `V21`) — a record carrying `V-11` or `v11` is not that claim, and refusing it
 * here means the page cannot print a code the script never wrote.
 *
 * **Why the tree block is recorded even though it can be read live.** `package.json`, the nearest
 * tag and `origin/main` are read at request time on a checkout (that is what makes the mismatch
 * alarm fire when the two disagree), and a deployment has no `.git` and may have no `package.json`
 * beside the server. The recorded values are the fallback in exactly that case, and the page says
 * which of the two it printed — never a value with no provenance.
 */
import { z } from "zod";

import { zIsoDateTime } from "./core";

/**
 * One `db:verify` violation: the rule code exactly as the script prints it, and the sentence that
 * follows it on the same line (`  V11  instance "…" (answering): …`).
 */
export const zPlatformHealthViolation = z
  .object({
    code: z
      .string()
      .regex(/^V\d+$/, "a db:verify rule code is V followed by digits — the script's own spelling"),
    message: z.string().min(1),
  })
  .strict();

export type PlatformHealthViolation = z.infer<typeof zPlatformHealthViolation>;

/**
 * The last `db:verify` run.
 *
 * `database` is a **label**, never a URL: a connection string carries a password and this document
 * is committed. `exitCode` is the process's own — `null` only for `not-run`, which is the honest
 * record of a machine with no `DATABASE_URL` rather than a run that passed.
 */
export const zPlatformHealthDbVerify = z
  .object({
    command: z.string().min(1),
    ranAt: zIsoDateTime,
    database: z.string().min(1),
    exitCode: z.number().int().nullable(),
    result: z.enum(["pass", "fail", "error", "not-run"]),
    /** The script's own summary line — the `✓ …` sentence, or the `✗ … violation(s)` line. */
    summary: z.string().min(1),
    violations: z.array(zPlatformHealthViolation),
  })
  .strict();

/**
 * The CI yield, as `python3 docs/gate-baseline.py --window <day>` prints it.
 *
 * `successes`/`runs` are head SHAs whose *first* run was green over head SHAs that ran at all —
 * the definition `docs/GATE.md` baseline section gives — so `percent` is derived from two counts a
 * reader can re-derive, never a rate typed on its own.
 */
export const zPlatformHealthYield = z
  .object({
    window: z.string().min(1),
    measuredAt: zIsoDateTime,
    command: z.string().min(1),
    successes: z.number().int().nonnegative(),
    runs: z.number().int().nonnegative(),
    percent: z.number().min(0).max(100),
    runP50Seconds: z.number().nonnegative(),
    runP95Seconds: z.number().nonnegative(),
  })
  .strict();

/** One `verify.sh` run: the lane it classified into, how long it took, and the CI yield beside it. */
export const zPlatformHealthGate = z
  .object({
    lane: z.enum(["docs", "content", "config", "code", "full"]),
    seconds: z.number().nonnegative(),
    measuredAt: zIsoDateTime,
    command: z.string().min(1),
    yield: zPlatformHealthYield,
  })
  .strict();

/**
 * What production answered. `state` is the probe's own outcome: `answering` means `GET
 * /api/version` returned a commit, `unreachable` means it did not and the last recorded values are
 * what the screen has. `commit` may be the literal `unknown` — `/api/version` answers that for a
 * build made without git, and a guess would be worse than the word.
 */
export const zPlatformHealthProduction = z
  .object({
    state: z.enum(["answering", "unreachable"]),
    version: z.string().min(1),
    commit: z.string().min(1),
    status: z.number().int(),
    measuredAt: zIsoDateTime,
    source: z.string().min(1),
    /** `git rev-list --count <commit>..origin/main` at record time; the fallback when a render has no git. */
    behindMain: z.number().int().nonnegative(),
  })
  .strict();

/** The tree the record was written from — the fallback for a deployment with no `.git`. */
export const zPlatformHealthTree = z
  .object({
    packageVersion: z.string().min(1),
    latestTag: z.string().min(1),
    headSha: z.string().min(1),
    mainSha: z.string().min(1),
    measuredAt: zIsoDateTime,
  })
  .strict();

export const zPlatformHealthRecord = z
  .object({
    schemaVersion: z.literal(1),
    recordedAt: zIsoDateTime,
    recorder: z.string().min(1),
    dbVerify: zPlatformHealthDbVerify,
    gate: zPlatformHealthGate,
    production: zPlatformHealthProduction,
    tree: zPlatformHealthTree,
  })
  .strict();

export type PlatformHealthRecord = z.infer<typeof zPlatformHealthRecord>;
export type PlatformHealthDbVerify = z.infer<typeof zPlatformHealthDbVerify>;
export type PlatformHealthGate = z.infer<typeof zPlatformHealthGate>;
export type PlatformHealthProduction = z.infer<typeof zPlatformHealthProduction>;
export type PlatformHealthTree = z.infer<typeof zPlatformHealthTree>;
