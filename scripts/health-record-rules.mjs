/**
 * The rules `pnpm health:record` applies to its **own output**, as pure functions (#680).
 *
 * `data/health/platform-health.json` is read by `/admin/health` as the platform's status, so the
 * recorder must not be able to write anything but platform status into it. Two earlier failures
 * made that a rule rather than a convention:
 *
 *   - a **probe** run — `db:verify` against a copy of `demo` with one session deliberately broken,
 *     `exitCode: 1` on purpose — was written into the platform record, so the screen read `Fail`
 *     forever and a real regression would have hidden inside the noise (#599);
 *   - the record could be written from **any** version of the tree, so a `1.5.0` record sat beside a
 *     `1.6.0` `package.json` and described neither.
 *
 * So the recorder derives the database label from facts it can check and asserts the postcondition
 * afterwards, on the bytes it wrote — never the exit code of the thing it ran (R-29: a command can
 * succeed and still produce the wrong artefact).
 *
 * Three facts identify the demo branch, and all three are refused on:
 *
 *   endpoint  the Neon endpoint the connection string opens. Every branch-copy — including a probe
 *             branch cut from `demo` — gets its own endpoint, which is exactly what makes this the
 *             one check a probe cannot pass.
 *   label     `NEON_BRANCH`, the word somebody typed into `.env.local`. It can be stale or absent,
 *             so it is refused when it says `production` and never trusted on its own.
 *   host      production's endpoint marker, from `scripts/demo-verify-rules.mjs` — the same rule
 *             `pnpm db:seed` refuses on, so one definition guards both writers.
 *
 * Everything here is pure: no database, no clock, no filesystem. `tests/health-record.test.ts`
 * proves the refusals and the postconditions without one.
 */
import { PRODUCTION_HOST_MARKER, endpointOf, hostOf } from "./demo-verify-rules.mjs";

/** The one branch the platform record may be recorded from. */
export const DEMO_NEON_BRANCH = "demo";

/**
 * The demo branch's endpoint. An endpoint outlives every connection string in a checkout, so it is
 * the fact this module can hold; a branch cut from `demo` has a different one, which is the whole
 * refusal below. When the demo branch is re-created (a restore, a move), this constant is what the
 * recorder names in its failure — update it here and say so in `docs/operations/releasing.md`.
 */
export const DEMO_ENDPOINT = "ep-crimson-truth-b4ppwxrp";

/** Every platform-record label starts here, because `demoDatabaseLabel()` is the only writer. */
export const DEMO_LABEL_PREFIX = "demo branch (";

/** How stale a `recordedAt` the recorder will accept as its own: it wrote this run, or it did not. */
export const RECORD_MAX_AGE_MINUTES = 15;

/** A stamp this far ahead of the recorder's clock is a clock fault, not a fresh record. */
const FUTURE_TOLERANCE_MINUTES = 5;

/**
 * Why this run may not write the platform record, or `null` when it may.
 *
 * A message rather than a boolean for the same reason `productionRefusal()` is: the operator needs
 * to know *which* fact refused them, because the fixes differ — point the shell at `demo`, or stop
 * calling this a platform record. Both sentences end with where the evidence belongs instead.
 *
 * @param {{ databaseUrl?: string, neonBranch?: string }} [options]
 */
export function platformDatabaseRefusal({ databaseUrl, neonBranch } = {}) {
  const branch = typeof neonBranch === "string" ? neonBranch.trim().toLowerCase() : "";
  if (branch === "production") {
    return [
      "NEON_BRANCH=production names the live branch. This command writes the platform record that",
      "/admin/health renders as status, and it is recorded from the demo branch only.",
      "Nothing was written.",
    ].join("\n");
  }

  const host = hostOf(databaseUrl);
  if (host === null) {
    return [
      "no DATABASE_URL in this shell (or one that does not parse), so there is no branch to name.",
      "The platform record names the database `db:verify` read, never a guess: export the demo",
      "branch's connection string and re-run. Nothing was written.",
    ].join("\n");
  }

  if (host.toLowerCase().includes(PRODUCTION_HOST_MARKER)) {
    return [
      `DATABASE_URL opens ${host}, the production endpoint (it carries "${PRODUCTION_HOST_MARKER}").`,
      "The platform record is recorded from the demo branch, never from production.",
      "Nothing was written.",
    ].join("\n");
  }

  if (branch !== "" && branch !== DEMO_NEON_BRANCH) {
    return [
      `NEON_BRANCH=${branch} does not name the demo branch, and this checkout's DATABASE_URL opens`,
      `${host}. The platform record is recorded from demo and nothing else. Nothing was written.`,
    ].join("\n");
  }

  const endpoint = endpointOf(databaseUrl);
  if (endpoint !== DEMO_ENDPOINT) {
    return [
      `DATABASE_URL opens ${host} — endpoint ${endpoint ?? "unknown"}, not the demo branch's`,
      `${DEMO_ENDPOINT}. A copy of demo, a scratch branch or a deliberately broken probe is evidence`,
      "about a check, never about the platform: recording it here makes /admin/health read Fail",
      "permanently and hides a real regression in the noise (#599).",
      "",
      "Record it as evidence instead — it goes to data/health/probes/, never to the platform record:",
      `  pnpm health:record --probe <name> --db --proves "<what this run proves>"`,
    ].join("\n");
  }

  return null;
}

/**
 * The `dbVerify.database` label for a run that passed `platformDatabaseRefusal()`: the derived
 * facts, never a typed sentence. `NEON_BRANCH` is printed as it was found (`unset` included),
 * because the label's job is to say what the shell said, not to repeat the check's conclusion.
 *
 * A URL this function cannot parse has no database name; `platformDatabaseRefusal()` has already
 * refused that case, and `unknown` keeps the label total.
 */
export function demoDatabaseLabel({ databaseUrl, neonBranch } = {}) {
  const host = hostOf(databaseUrl) ?? "unknown";
  let database = "unknown";
  try {
    database = new URL(String(databaseUrl).trim()).pathname.replace(/^\//, "") || "unknown";
  } catch {
    // refused before this is reached — the label stays total rather than throwing
  }
  const branch =
    typeof neonBranch === "string" && neonBranch.trim() !== "" ? neonBranch.trim() : "unset";
  return `${DEMO_LABEL_PREFIX}NEON_BRANCH=${branch}, ${database}) · host ${host}`;
}

/* ------------------------------------------------------------------ *
 * Which lane the gate ran, and which lane it was asked for
 *
 * The recorder shells the gate as `env -i … bash scripts/verify.sh` and used to pass no `GATE_LANE`
 * at all, so an operator who exported `GATE_LANE=full` got whatever the classifier chose — a
 * `docs`-lane record, 13 s and no build, from a request for the full one. The record could state a
 * gate result nobody selected, and nothing noticed because `lane` was read off the gate's own
 * output. Two facts are held together here instead: the request named in `gate.command` and the
 * lane the gate printed. `full` is the code lane (`scripts/gate-lanes.sh::resolve_lane`), `auto`
 * lets the classifier decide, and anything else is what `verify.sh` exits 2 on.
 * ------------------------------------------------------------------ */

/** The lanes `verify.sh` reports on its `lane=` line — the four depths of the gate. */
export const GATE_LANES = ["docs", "content", "config", "code"];

/** The values `GATE_LANE` accepts: `auto` classifies, `full` forces the code lane. */
export const GATE_LANE_REQUESTS = ["auto", "full"];

/** `GATE_LANE=full` *is* the code lane — resolve_lane's sentence, not a second definition of it. */
export const FORCED_GATE_LANE = "code";

/** Why a requested `GATE_LANE` cannot be forwarded, or `null` when it can. */
export function gateLaneRequestRefusal(request) {
  if (GATE_LANE_REQUESTS.includes(request)) return null;
  return [
    `GATE_LANE=${JSON.stringify(request)} is not a lane: verify.sh accepts auto (default) or full and`,
    "exits 2 on anything else. Nothing was measured, so nothing was written.",
  ].join("\n");
}

/**
 * The `GATE_LANE` a gate `command` string asks for, or `null` when it names none.
 *
 * The command string is the transcript of the invocation (the `env -i` assignments and the script),
 * so it is where a reader — and this check — finds which lane was selected. `null` is the defect
 * this module exists to catch: a record whose command does not say leaves only the lane the gate
 * happened to pick, which is a result nobody can be held to.
 */
export function requestedGateLane(command) {
  if (typeof command !== "string") return null;
  return /\bGATE_LANE=([a-z]+)\b/.exec(command)?.[1] ?? null;
}

/**
 * What is wrong with the lane pair a record states, as sentences — `[]` when nothing is.
 *
 * `measured` says whether *this* run ran the gate. A block carried from an earlier record states a
 * lane somebody measured once; this run did not ask for it, so it is held only to the agreement rule
 * (a request it does name must match the lane) and never to naming one. A block this run measured is
 * held to both — that is the defect the rule exists for.
 *
 * @param {{ command?: unknown, lane?: unknown }} [gate]
 * @param {{ measured?: boolean }} [context]
 * @returns {string[]}
 */
export function gateLaneProblems(gate = {}, { measured = true } = {}) {
  const command = gate?.command;
  const lane = gate?.lane;
  const requested = requestedGateLane(command);

  if (requested === null) {
    if (!measured) return [];
    return [
      `gate.command is ${JSON.stringify(command)} and does not name GATE_LANE=auto|full — the record states a lane nobody selected`,
    ];
  }
  const refusal = gateLaneRequestRefusal(requested);
  if (refusal !== null) return [refusal.replace(/\n/g, " ")];

  if (!GATE_LANES.includes(lane)) {
    return [
      `gate.lane is ${JSON.stringify(lane)} — verify.sh prints one of ${GATE_LANES.join(", ")}`,
    ];
  }

  const expected = requested === "full" ? FORCED_GATE_LANE : null;
  if (expected !== null && lane !== expected) {
    return [
      `gate.lane is ${JSON.stringify(lane)} but gate.command asked for GATE_LANE=full, which runs the ${expected} lane — the record states a lane the gate did not run`,
    ];
  }

  return [];
}

/** Minutes between two instants, or `null` when either is not an instant. */
function minutesBetween(then, now) {
  const from = Date.parse(then);
  const to = Date.parse(now);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return (to - from) / 60_000;
}

/**
 * What is wrong with the record this run just wrote, as sentences — `[]` when nothing is.
 *
 * Read the reasons, not the rules: each one exists because a record claiming it was true once and
 * was not.
 *
 *   recordedAt      stamped by this run. A carried stamp would make a stale measurement read as
 *                   current, which is the defect the freshness window (#599) exists to catch.
 *   packageVersion  the tree the numbers came from. A `1.5.0` record beside `1.6.0` describes
 *                   neither version, and the release step is where that is discovered.
 *   database        the demo branch. This is the assertion whose absence let a probe's `exitCode: 1`
 *                   into the record in the first place (#680).
 *   gate.lane       the lane the gate *ran*, held against the lane `gate.command` asked for. The
 *                   recorder shells the gate under `env -i`, so a `GATE_LANE=full` request it did
 *                   not forward was silently replaced by the classifier's pick — the record then
 *                   stated a depth nobody selected, and read as though somebody had.
 *
 * @param {unknown} record
 * @param {{ packageVersion?: string, now?: Date | string, maxAgeMinutes?: number, gateMeasured?: boolean }} [context]
 * @returns {string[]}
 */
export function postconditionProblems(record, context = {}) {
  const {
    packageVersion,
    now = new Date(),
    maxAgeMinutes = RECORD_MAX_AGE_MINUTES,
    gateMeasured = true,
  } = context;
  const problems = [];
  const value = typeof record === "object" && record !== null ? record : {};
  const recordedAt = value.recordedAt;
  const age = minutesBetween(recordedAt, now);

  if (age === null) {
    problems.push(
      `recordedAt is ${JSON.stringify(recordedAt)} — not an instant the recorder can vouch for`,
    );
  } else if (age > maxAgeMinutes) {
    problems.push(
      `recordedAt is ${age.toFixed(1)} min old — the record must carry the instant this run wrote it (max ${maxAgeMinutes})`,
    );
  } else if (age < -FUTURE_TOLERANCE_MINUTES) {
    problems.push(
      `recordedAt is ${(-age).toFixed(1)} min in the future — that is a clock fault, not a fresh record`,
    );
  }

  const recordedVersion = value.tree?.packageVersion;
  if (packageVersion !== undefined && recordedVersion !== packageVersion) {
    problems.push(
      `tree.packageVersion is ${JSON.stringify(recordedVersion)} but package.json says ${packageVersion} — the record describes a different tree`,
    );
  }

  const database = value.dbVerify?.database;
  if (typeof database !== "string" || !database.startsWith(DEMO_LABEL_PREFIX)) {
    problems.push(
      `dbVerify.database is ${JSON.stringify(database)} — the platform record is recorded from the demo branch (${DEMO_LABEL_PREFIX}…) and nothing else`,
    );
  } else if (!database.includes(DEMO_ENDPOINT)) {
    problems.push(
      `dbVerify.database names ${JSON.stringify(database)}, which does not carry the demo endpoint ${DEMO_ENDPOINT}`,
    );
  }

  problems.push(...gateLaneProblems(value.gate, { measured: gateMeasured }));

  return problems;
}
