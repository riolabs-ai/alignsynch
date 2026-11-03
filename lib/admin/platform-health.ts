/**
 * `/admin/health` — the reads behind the platform-health screen (#508).
 *
 * The screen's rule is one sentence: **no number without a source**. So every fact this module
 * returns is a `Measured<T>` — the value, and either the command that measured it in this checkout
 * (`origin: "live"`) or the instant the record that carries it was written (`origin: "recorded"`).
 * The view decides how to print that; it never decides *what* is true.
 *
 * Three of the four panels have two possible homes, and the split is deliberate:
 *
 *   - **the tree** (`package.json`, the nearest tag, `origin/main`, the commit distance) is read
 *     live when this process has a checkout. That is what makes the release-truth alarm fire on a
 *     tag that is ahead of `package.json` and the deploy drift grow as `main` moves, without a
 *     rebuild or a recorder run.
 *   - **the record** (`data/health/platform-health.json`) is what a deployment has. A Vercel
 *     function's directory has no `.git`, and `db:verify` cannot be run inside a render at all —
 *     the card says so. Every live read therefore has a recorded fallback, and the fallback carries
 *     the record's own `measuredAt` into the page.
 *   - **nothing else.** There is no clock here: no `new Date()`, no `Date.now()`, no relative label.
 *     A health screen whose "2 minutes ago" was computed at render time would be rendered twice,
 *     by the server and at hydration, and would disagree with itself (`#418`, `AGENTS.md`).
 *
 * **Read-only, structurally.** This module imports `node:fs` and `node:child_process` and nothing
 * from the write path — `lib/admin/act.ts` is the console's only mutation entry point and it is not
 * in this file's import graph, which `tests/platform-health.test.ts` asserts over the source.
 *
 * **Server-only.** `readFileSync`/`execFileSync` do not exist in a browser bundle, and the guard
 * below turns a mistaken client import into a loud failure instead of a route that ships a Node
 * module into the browser graph (E34's class of defect).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { zPlatformHealthRecord, type PlatformHealthRecord } from "@/content/platform-health";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/admin/platform-health.ts is server-only: it reads the checkout and the recorded health artifact. Call it from a page.",
  );
}

/** The route, as the page, the sign-in round trip and the nav spell it. */
export const ADMIN_HEALTH_PATH = "/admin/health";

/** The committed artifact — the same path the recorder writes and the screen names on the page. */
export const PLATFORM_HEALTH_RECORD_PATH = "data/health/platform-health.json";

/** The knob an operator turns to move the deploy alarm. Defaulted, never required. */
export const DRIFT_LIMIT_VARIABLE = "PLATFORM_HEALTH_DRIFT_LIMIT";

/** Where the alarm starts, when the variable says nothing. */
export const DEFAULT_DRIFT_LIMIT = 5;

/* ------------------------------------------------------------------ *
 * A measured fact
 * ------------------------------------------------------------------ */

/**
 * One fact and its provenance.
 *
 * `live` carries the command (or file) that answered in *this* checkout — a reader can run it.
 * `recorded` carries the instant the artifact was written, because a value from a file is only as
 * current as that stamp and the page has to say so.
 */
export type Measured<T> =
  | { readonly origin: "live"; readonly value: T; readonly command: string }
  | { readonly origin: "recorded"; readonly value: T; readonly recordedAt: string };

function live<T>(value: T, command: string): Measured<T> {
  return { origin: "live", value, command };
}

function recorded<T>(value: T, at: string): Measured<T> {
  return { origin: "recorded", value, recordedAt: at };
}

/* ------------------------------------------------------------------ *
 * The record
 * ------------------------------------------------------------------ */

/**
 * The record could not be read as the artifact the schema describes.
 *
 * The page draws this as a panel, like `/admin/instances` draws `DatabaseUnavailableError`: a
 * health screen whose own input is missing is a state it can describe. It is **not** rendered as a
 * set of zeroes — "no violations" because nobody could read the report is the one lie this screen
 * must never tell.
 */
export class HealthRecordUnreadable extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`the platform-health record could not be read: ${reason}`);
    this.name = "HealthRecordUnreadable";
    this.reason = reason;
  }
}

/**
 * Read and validate the committed artifact.
 *
 * A missing file, invalid JSON and a shape the schema refuses all become the same typed refusal
 * with the specific reason; the caller has nothing to guess about. A record that *parses* but says
 * something impossible (a `V-11` code) is refused here rather than printed.
 */
export function readPlatformHealthRecord(
  path: string = join(process.cwd(), PLATFORM_HEALTH_RECORD_PATH),
): PlatformHealthRecord {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new HealthRecordUnreadable(
      `${PLATFORM_HEALTH_RECORD_PATH} is not readable in this tree (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new HealthRecordUnreadable(
      `${PLATFORM_HEALTH_RECORD_PATH} is not JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const result = zPlatformHealthRecord.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.join(".") ?? "record";
    throw new HealthRecordUnreadable(
      `${PLATFORM_HEALTH_RECORD_PATH} does not match the record schema at ${where}: ${first?.message ?? "unknown"}`,
    );
  }

  return result.data;
}

/* ------------------------------------------------------------------ *
 * The tree, measured live
 * ------------------------------------------------------------------ */

/** What `git` answered, or `null` when this process has no checkout (a deployment) or no git. */
function git(args: readonly string[]): string | null {
  try {
    const answer = execFileSync("git", [...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const trimmed = answer.trim();
    return trimmed === "" ? null : trimmed;
  } catch {
    return null;
  }
}

/** The tree's own version, from the file Next itself reads at build time. */
function packageVersionOfTree(): string | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const version = (parsed as { version?: unknown }).version;
    return typeof version === "string" && version !== "" ? version : null;
  } catch {
    return null;
  }
}

export interface TreeFacts {
  readonly packageVersion: Measured<string>;
  readonly latestTag: Measured<string>;
  readonly mainSha: Measured<string>;
  readonly headSha: Measured<string>;
}

/**
 * The four tree facts the release and deploy panels compare.
 *
 * Each is read live when it can be and falls back to the record's `tree` block when it cannot, so a
 * deployment (no `.git`) still prints a labelled value instead of an error. The *fallback* is what
 * the label is for: a reader can see at a glance that "1.3.0" came from a file written at 18:04
 * rather than from the tree in front of them.
 */
export function readTreeFacts(record: PlatformHealthRecord): TreeFacts {
  const at = record.tree.measuredAt;

  const version = packageVersionOfTree();
  const tag = git(["describe", "--tags", "--abbrev=0"]);
  const main = git(["rev-parse", "origin/main"]);
  const head = git(["rev-parse", "HEAD"]);

  return {
    packageVersion:
      version === null ? recorded(record.tree.packageVersion, at) : live(version, "package.json"),
    latestTag:
      tag === null
        ? recorded(record.tree.latestTag, at)
        : live(tag, "git describe --tags --abbrev=0"),
    mainSha:
      main === null ? recorded(record.tree.mainSha, at) : live(main, "git rev-parse origin/main"),
    headSha: head === null ? recorded(record.tree.headSha, at) : live(head, "git rev-parse HEAD"),
  };
}

/** A commit this checkout could ask `git` about: full or abbreviated hex, never `unknown`. */
const SHA = /^[0-9a-f]{7,40}$/;

/**
 * How far `main` is ahead of production's commit.
 *
 * The count is `git rev-list --count <deployed>..origin/main` — the command `docs/GATE.md`'s
 * neighbours use and the one the card asks for in evidence. It needs the deployed object in this
 * checkout's history; a deployment (no git), a detached object and an `unknown` commit all fall
 * back to the number the recorder measured, with the record's timestamp as its source.
 */
export function readBehindMain(
  record: PlatformHealthRecord,
  deployedCommit: string,
): Measured<number> {
  const at = record.production.measuredAt;
  if (!SHA.test(deployedCommit)) return recorded(record.production.behindMain, at);

  const answer = git(["rev-list", "--count", `${deployedCommit}..origin/main`]);
  if (answer === null || !/^\d+$/.test(answer)) {
    return recorded(record.production.behindMain, at);
  }
  return live(Number.parseInt(answer, 10), `git rev-list --count ${deployedCommit}..origin/main`);
}

/* ------------------------------------------------------------------ *
 * Release truth — package.json vs the tag vs production (#443)
 * ------------------------------------------------------------------ */

/** `v1.3.0` and `1.3.0` are the same release; only the spelling differs between tag and file. */
export function normaliseVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

export type ReleaseMismatch = "version-tag" | "production-version" | "production-commit";

export interface ReleaseTruth {
  readonly packageVersion: Measured<string>;
  readonly latestTag: Measured<string>;
  readonly productionVersion: Measured<string>;
  readonly productionCommit: Measured<string>;
  readonly mainSha: Measured<string>;
  readonly mismatches: readonly ReleaseMismatch[];
}

/**
 * The three agreements #443 is about, and the loud state when one is absent.
 *
 *   version-tag          the tree's `package.json` is not the version the latest tag names — a tag
 *                        was cut ahead of the file, or the file was bumped without a tag
 *   production-version   production serves a build whose version is not this tree's
 *   production-commit    production is not `origin/main`'s commit
 *
 * `unknown` is not agreement and it is not disagreement: `/api/version` answers `unknown` for a
 * build made without git, and comparing it would invent a mismatch. It is treated as cannot-say —
 * the production row prints the word and the alarms stay quiet about it.
 */
export function releaseTruthOf(facts: {
  readonly tree: TreeFacts;
  readonly productionVersion: Measured<string>;
  readonly productionCommit: Measured<string>;
}): ReleaseTruth {
  const { tree, productionVersion, productionCommit } = facts;
  const mismatches: ReleaseMismatch[] = [];

  const packageVersion = tree.packageVersion.value;
  const tag = tree.latestTag.value;
  if (normaliseVersion(packageVersion) !== normaliseVersion(tag)) mismatches.push("version-tag");

  const served = productionVersion.value;
  if (served !== "unknown" && normaliseVersion(served) !== normaliseVersion(packageVersion)) {
    mismatches.push("production-version");
  }

  const commit = productionCommit.value;
  const main = tree.mainSha.value;
  if (
    commit !== "unknown" &&
    main !== "unknown" &&
    !commit.startsWith(main) &&
    !main.startsWith(commit)
  ) {
    mismatches.push("production-commit");
  }

  return {
    packageVersion: tree.packageVersion,
    latestTag: tree.latestTag,
    productionVersion,
    productionCommit,
    mainSha: tree.mainSha,
    mismatches,
  };
}

/* ------------------------------------------------------------------ *
 * Deploy drift — production behind main, with a configurable limit
 * ------------------------------------------------------------------ */

export interface DriftLimit {
  readonly limit: number;
  readonly origin: "env" | "default";
  readonly variable: string;
  /** A configured value that is not a count. Reported, never silently replaced. */
  readonly problem: string | null;
}

/**
 * The alarm's threshold.
 *
 * `PLATFORM_HEALTH_DRIFT_LIMIT=0` is a legal setting — "production must be exactly `main`" — so the
 * parser's only jobs are to refuse a value that is not a non-negative integer and to say so. A bad
 * value falls back to the default **and** carries the refusal, so the screen reads "5, and your
 * setting was ignored because it is not a count" rather than pretending the operator's knob worked.
 */
export function driftLimitFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DriftLimit {
  const raw = env[DRIFT_LIMIT_VARIABLE];
  if (raw === undefined || raw.trim() === "") {
    return {
      limit: DEFAULT_DRIFT_LIMIT,
      origin: "default",
      variable: DRIFT_LIMIT_VARIABLE,
      problem: null,
    };
  }
  if (!/^\d+$/.test(raw.trim())) {
    return {
      limit: DEFAULT_DRIFT_LIMIT,
      origin: "default",
      variable: DRIFT_LIMIT_VARIABLE,
      problem: `${DRIFT_LIMIT_VARIABLE}="${raw}" is not a whole number of commits; the default applies`,
    };
  }
  return {
    limit: Number.parseInt(raw.trim(), 10),
    origin: "env",
    variable: DRIFT_LIMIT_VARIABLE,
    problem: null,
  };
}

export interface DeployDrift {
  readonly behind: Measured<number>;
  readonly limit: DriftLimit;
  readonly exceeded: boolean;
}

/** The alarm, as a value. `exceeded` is strict: at exactly the limit production is still inside it. */
export function deployDriftOf(input: { behind: Measured<number>; limit: DriftLimit }): DeployDrift {
  return {
    behind: input.behind,
    limit: input.limit,
    exceeded: input.behind.value > input.limit.limit,
  };
}

/* ------------------------------------------------------------------ *
 * Everything the screen renders, in one value
 * ------------------------------------------------------------------ */

/**
 * The four panels' inputs, gathered once per request.
 *
 * Gathered here rather than in the page so the *page* is the gate plus a render (the shape
 * `/admin/audit` and `/admin/instances` share), and so a test can drive every panel with a record
 * and no checkout: `healthFactsOf` is pure apart from the reads it is handed.
 */
export interface HealthFacts {
  readonly record: PlatformHealthRecord;
  readonly tree: TreeFacts;
  readonly release: ReleaseTruth;
  readonly drift: DeployDrift;
}

export function healthFactsOf(
  record: PlatformHealthRecord,
  env: Readonly<Record<string, string | undefined>> = process.env,
): HealthFacts {
  const tree = readTreeFacts(record);
  const production = record.production;
  const recordedAtProduction = production.measuredAt;
  const release = releaseTruthOf({
    tree,
    productionVersion: recorded(production.version, recordedAtProduction),
    productionCommit: recorded(production.commit, recordedAtProduction),
  });
  const drift = deployDriftOf({
    behind: readBehindMain(record, production.commit),
    limit: driftLimitFromEnv(env),
  });
  return { record, tree, release, drift };
}
