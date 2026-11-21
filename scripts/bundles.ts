/**
 * `pnpm bundles` — export a TEMPLATE or the DEMO DATASET, import either (#147).
 *
 * The bundle itself (envelope, schemas, `parseBundle`, `serializeBundle`) lives in
 * `content/bundle.ts`, because it is the model. This module is the filesystem half: the
 * tenant store, the committed demo bundle, and the four operations a person runs.
 *
 *   pnpm bundles export --template <id>       → exports/<id>.alignsynch.json
 *   pnpm bundles export --dataset             → exports/dataset.alignsynch.json
 *   pnpm bundles export --dataset --check     → is the committed bundle the canonical export? (0/1)
 *   pnpm bundles export --dataset --fix       → write the committed bundle from the fixtures
 *   pnpm bundles import <file>                → validate, then write the tenant store
 *
 * **The store is `data/generated/assessments.json`** (gitignored), holding the canonical
 * `{ templates, sessions }` payload. It is *the active set*: when the file is present it
 * supersedes `data/assessments.ts` for export and for `data:check`'s E1/E2/E31, and deleting
 * it resets the tenant to the fixtures. `data/assessments.ts` stays untouched — it is the
 * demo bundle's source.
 *
 * **Import refuses; it never rewrites.** Nothing is renamed, remapped or suffixed in a bundle
 * this build writes. A dataset import *replaces* the store (it is an install, so re-running it is
 * idempotent and there is no collision to have). A template import appends: if no store
 * exists the fixtures are materialized into it first — this is the moment a tenant stops
 * borrowing our fixtures and owns its data — and any collision with the active set is `B5`,
 * naming every colliding id and slug, with the store left byte-unchanged.
 *
 * **Every write is parse → validate → plan → serialize → tmp + rename**, so no failure path
 * leaves a half-written bundle or a half-imported store: a rejected import leaves the store
 * byte-identical or absent, and unlinks its temporary file. A failed export leaves nothing.
 *
 * The codes are the nine in `scripts/rule-codes.ts`: `B1`–`B4`/`B6`/`B9` are minted by
 * `content/bundle.ts`, and `B5` here — a collision is a fact about the store, so a bundle on
 * its own cannot violate it.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import type { Assessment, AssessmentSession } from "../content/assessment";
import {
  BUNDLE_FORMAT,
  BUNDLE_VERSION,
  LEGACY_BUNDLE_VERSION,
  canonicalDemoBundle,
  datasetCollectionProblems,
  formatBundleIssue,
  normalizeLegacyDatasetPayload,
  parseBundle,
  serializeBundle,
  serializeDatasetPayload,
  zDatasetPayload,
  zLegacyDatasetPayload,
  type Bundle,
  type BundleKind,
  type DatasetBundle,
  type DatasetPayload,
  type TemplateBundle,
} from "../content/bundle";
import { assessmentSessions, assessments } from "../data/assessments";

/* ------------------------------------------------------------------ *
 * Where things live
 * ------------------------------------------------------------------ */

/**
 * The repository root, from this module's own compiled location (`.datacheck/scripts/`).
 * Deliberately not `process.cwd()`: the store and the committed bundle are files of *this
 * repository*, so a CLI run from a subdirectory must not read a different store.
 */
const REPO_ROOT = join(__dirname, "..", "..");

/** The tenant store: the active set when it exists, absent when the fixtures are. */
export const STORE_FILE = join(REPO_ROOT, "data", "generated", "assessments.json");

/** The shipped demo dataset — committed, and held to the fixtures by `data:check` E32. */
export const DEMO_BUNDLE_FILE = join(REPO_ROOT, "data", "bundles", "demo-dataset.alignsynch.json");

/** Where a plain `export` writes when no `--out` is given (gitignored). */
export const EXPORT_DIR = join(REPO_ROOT, "exports");

/** A path as a person reads it: repo-relative when it is inside the repo, absolute otherwise. */
export function displayPath(file: string): string {
  const fromRoot = relative(REPO_ROOT, file);
  return fromRoot === "" || fromRoot.startsWith("..") ? file : fromRoot;
}

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/* ------------------------------------------------------------------ *
 * Refusals
 * ------------------------------------------------------------------ */

/** `B5` is the one code this module mints; a bundle cannot collide with a store it does not know. */
type CliIssueCode = "B5";

type BundleErrorCode =
  | "B1"
  | "B2"
  | "B3"
  | "B4"
  | "B5"
  | "B6"
  | "B7"
  | "B8"
  | "B9"
  | "usage"
  | "io"
  /** Not a bundle's fault: the shell has no credential for the step that was asked for. */
  | "capability";

/**
 * A refusal a caller must surface — one line per problem, already formatted, because "the
 * import failed" with no path is the message this CLI exists to not print. `usage` exits 2
 * (how you called it), everything else 1 (what the file or the store says).
 *
 * `B7` and `B8` are minted by `scripts/bundle-platform.ts` (a package against this tree; a
 * subset against its own references) and share this error type so every refusal prints the
 * same way.
 */
export class BundleError extends Error {
  constructor(
    readonly code: BundleErrorCode,
    readonly lines: readonly string[],
  ) {
    super(lines[0] ?? code);
    this.name = "BundleError";
  }
}

export const bundleErrorText = (error: BundleError): string => error.lines.join("\n");

export const exitCodeFor = (error: BundleError): number => (error.code === "usage" ? 2 : 1);

/* ------------------------------------------------------------------ *
 * The store
 * ------------------------------------------------------------------ */

export interface StoreRecords {
  readonly templates: readonly Assessment[];
  readonly sessions: readonly AssessmentSession[];
}

/** Absent (the fixtures are active) · invalid (E33's finding) · valid (the active set). */
export type StoreRead =
  | { readonly kind: "absent" }
  | { readonly kind: "invalid"; readonly problems: readonly string[] }
  | { readonly kind: "valid"; readonly records: StoreRecords };

/**
 * Read the tenant store without throwing, so `data:check` can report every problem instead
 * of the first. The rules are the bundle's own: the payload shape (a store is a dataset
 * payload, not an envelope — it is what an import installs), then the collection rules
 * (B3). `E33` prints what this returns.
 *
 * **Two shapes, one active set.** The store is gitignored and every build before #1103 phase 3
 * wrote it under the version-1 key. A tree that upgrades with a store in place would otherwise
 * answer E33 "invalid" for a file nobody edited — a data-looking failure for a format change —
 * so a v1 store is read and normalized exactly as a v1 bundle is, and the next import or export
 * writes the current shape. Reading never rewrites: the file on disk stays what it was until a
 * command that writes it runs.
 */
export function readStore(file: string = STORE_FILE): StoreRead {
  if (!existsSync(file)) return { kind: "absent" };

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (cause) {
    return {
      kind: "invalid",
      problems: [`${displayPath(file)}: not JSON — ${messageOf(cause)}`],
    };
  }

  const payload = zDatasetPayload.safeParse(raw);
  let records: DatasetPayload | undefined;
  if (payload.success) {
    records = payload.data;
  } else {
    const legacy = zLegacyDatasetPayload.safeParse(raw);
    if (legacy.success) records = normalizeLegacyDatasetPayload(legacy.data);
  }

  if (records === undefined) {
    const failed = payload.success ? [] : payload.error.issues;
    return {
      kind: "invalid",
      problems: failed.map(
        (issue) => `${displayPath(file)} ${["root", ...issue.path].join(".")}: ${issue.message}`,
      ),
    };
  }

  const collection = datasetCollectionProblems(records);
  if (collection.length > 0) {
    return {
      kind: "invalid",
      problems: collection.map((issue) => `${displayPath(file)}: ${formatBundleIssue(issue)}`),
    };
  }

  return { kind: "valid", records };
}

/**
 * The active set: the store when it is valid, the fixtures when it is absent. An *invalid*
 * store refuses — appending to, or exporting from, a store this build cannot read would
 * either lose records or publish them, and `E33` is the report a person fixes first.
 */
function activeRecords(file: string): { records: StoreRecords; fromStore: boolean } {
  const store = readStore(file);
  if (store.kind === "valid") return { records: store.records, fromStore: true };
  if (store.kind === "invalid") {
    throw new BundleError(
      "B1",
      store.problems.map((problem) => `[B1] ${problem}`),
    );
  }
  return {
    records: { templates: [...assessments], sessions: [...assessmentSessions] },
    fromStore: false,
  };
}

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

/**
 * The whole atomicity story: a canonical serialization to `<file>.tmp-<pid>`, one `rename`
 * over the target, and a temporary file unlinked on any failure. Never a partial file, and
 * never a store the next run has to guess about.
 */
export function writeFileAtomic(file: string, text: string): void {
  const temporary = `${file}.tmp-${process.pid}`;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(temporary, text, "utf8");
    renameSync(temporary, file);
  } catch (cause) {
    rmSync(temporary, { force: true });
    throw new BundleError("io", [`[io] ${displayPath(file)}: ${messageOf(cause)}`]);
  }
}

/** The `package.json` version — provenance in the bundle, never a gate. */
export function readAppVersion(): string {
  try {
    const parsed = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      version?: unknown;
    };
    if (typeof parsed.version !== "string" || parsed.version.length === 0) {
      throw new Error("package.json has no version");
    }
    return parsed.version;
  } catch (cause) {
    throw new BundleError("io", [`[io] package.json: ${messageOf(cause)}`]);
  }
}

/** A dataset payload as the bundle that carries it, validated by `parseBundle` like any import. */
function buildDatasetBundle(
  records: {
    readonly templates: readonly Assessment[];
    readonly sessions: readonly AssessmentSession[];
  },
  appVersion: string,
): DatasetBundle {
  const parsed = parseBundle(
    JSON.stringify({
      format: BUNDLE_FORMAT,
      bundleVersion: BUNDLE_VERSION,
      kind: "dataset" as const,
      appVersion,
      payload: { templates: [...records.templates], sessions: [...records.sessions] },
    }),
  );
  if (!parsed.ok) {
    throw new BundleError("B3", parsed.issues.map(formatBundleIssue));
  }
  if (parsed.bundle.kind !== "dataset") {
    throw new BundleError("B1", ["[B1] bundle: a dataset payload parsed as a template bundle"]);
  }
  return parsed.bundle;
}

/* ------------------------------------------------------------------ *
 * B5 — refusal over rewriting
 * ------------------------------------------------------------------ */

/**
 * A template import may not take an id or a `type/slug` the active set already holds. Both
 * are identity: an id collision would be two records under one name, and `type/slug` is a
 * URL. Renaming the incoming template would rewrite its `templateId` and its item copies and
 * make the byte-identical round trip unprovable, so this refuses and names what collided.
 */
function collisionProblems(active: StoreRecords, template: Assessment): BundleIssueList {
  const issues: BundleIssueList = [];
  const where = (id: string) => {
    if (active.templates.some((existing) => existing.id === id)) return "the active templates";
    if (active.sessions.some((existing) => existing.id === id)) return "the active sessions";
    return undefined;
  };

  const idOwner = where(template.id);
  if (idOwner !== undefined) {
    issues.push({
      code: "B5",
      path: ["payload", "id"],
      message: `"${template.id}" is already a record in ${idOwner} — an import refuses rather than rewriting or renaming (nothing is suffixed in bundle version 1)`,
    });
  }

  const sameSlug = active.templates.find(
    (existing) => existing.type === template.type && existing.slug === template.slug,
  );
  if (sameSlug !== undefined) {
    issues.push({
      code: "B5",
      path: ["payload", "slug"],
      message: `"${template.type}/${template.slug}" is already the identity of template "${sameSlug.id}" — a slug is URL identity, so the import refuses`,
    });
  }

  return issues;
}

type BundleIssueList = {
  code: CliIssueCode;
  path: readonly (string | number)[];
  message: string;
}[];

/* ------------------------------------------------------------------ *
 * Import
 * ------------------------------------------------------------------ */

export interface ImportOptions {
  /** The store to write. Defaults to `data/generated/assessments.json`. */
  readonly store?: string;
  /** Provenance for the `appVersion` this store is written under. */
  readonly appVersion?: string;
}

export interface ImportResult {
  readonly kind: BundleKind;
  readonly store: string;
  readonly templates: number;
  readonly sessions: number;
  /** True when this import turned the fixtures into the store before appending. */
  readonly materialized: boolean;
  /** The template id appended, or `null` for a dataset install. */
  readonly added: string | null;
  /** True when the file was a `bundleVersion: 1` document, read and normalized. */
  readonly deprecated: boolean;
}

/**
 * Validate a whole bundle, plan the resulting store, validate *that*, and only then write.
 * Every refusal happens before the first byte reaches the disk.
 */
export function importBundleFile(file: string, options: ImportOptions = {}): ImportResult {
  const storePath = options.store ?? STORE_FILE;
  const appVersion = options.appVersion ?? readAppVersion();

  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (cause) {
    throw new BundleError("io", [
      `[io] ${displayPath(file)}: cannot read the bundle — ${messageOf(cause)}`,
    ]);
  }

  const parsed = parseBundle(text);
  if (!parsed.ok) {
    throw new BundleError(parsed.issues[0]?.code ?? "B1", parsed.issues.map(formatBundleIssue));
  }
  const bundle: Bundle = parsed.bundle;

  let records: DatasetPayload;
  let materialized = false;
  let added: string | null = null;

  if (bundle.kind === "platform") {
    throw new BundleError("B1", [
      "[B1] kind: this is a platform package (bundleVersion 2) — install it with `pnpm bundle:unpack <file.zip>`, which reads the manifest, checks the build and unpacks the media; `pnpm bundles import` moves records only",
    ]);
  }

  if (bundle.kind === "dataset") {
    // An install, not a merge: replace wholesale, so re-running it is idempotent and there
    // is no collision concept to fail on.
    records = bundle.payload;
  } else {
    const active = activeRecords(storePath);
    const collisions = collisionProblems(active.records, bundle.payload);
    if (collisions.length > 0) throw new BundleError("B5", collisions.map(formatBundleIssue));
    materialized = !active.fromStore;
    added = bundle.payload.id;
    records = {
      templates: [...active.records.templates, bundle.payload],
      sessions: [...active.records.sessions],
    };
  }

  // The store is validated as the bundle an export would produce, so an import can never
  // leave a store that `E33` or the next export would refuse.
  const next = buildDatasetBundle(records, appVersion);
  writeFileAtomic(storePath, serializeDatasetPayload(next.payload));

  return {
    kind: bundle.kind,
    store: storePath,
    templates: next.payload.templates.length,
    sessions: next.payload.sessions.length,
    materialized,
    added,
    deprecated: parsed.legacy === true,
  };
}

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */

export interface ExportOptions {
  /** Where to write. Defaults to `exports/<name>.alignsynch.json`. */
  readonly out?: string;
  /** The store to read. Defaults to `data/generated/assessments.json`. */
  readonly store?: string;
  readonly appVersion?: string;
}

export interface ExportResult<T extends Bundle> {
  readonly file: string;
  readonly bundle: T;
}

/** The active set, as a dataset bundle — what `exportDataset` serializes, without writing it. */
export function activeDataset(
  options: { store?: string; appVersion?: string } = {},
): DatasetBundle {
  const active = activeRecords(options.store ?? STORE_FILE);
  return buildDatasetBundle(active.records, options.appVersion ?? readAppVersion());
}

/** The active set, as a dataset bundle, written atomically. */
export function exportDataset(options: ExportOptions = {}): ExportResult<DatasetBundle> {
  const active = activeRecords(options.store ?? STORE_FILE);
  const bundle = buildDatasetBundle(active.records, options.appVersion ?? readAppVersion());
  const file = options.out ?? join(EXPORT_DIR, "dataset.alignsynch.json");
  writeFileAtomic(file, serializeBundle(bundle));
  return { file, bundle };
}

/** One template from the active set, as a template bundle. */
export function exportTemplate(
  id: string,
  options: ExportOptions = {},
): ExportResult<TemplateBundle> {
  const active = activeRecords(options.store ?? STORE_FILE);
  const template = active.records.templates.find((candidate) => candidate.id === id);
  if (template === undefined) {
    const known = active.records.templates.map((candidate) => candidate.id).join(", ");
    throw new BundleError("usage", [
      `usage: no template "${id}" in ${displayPath(options.store ?? STORE_FILE)} — templates here: ${known}`,
    ]);
  }

  const parsed = parseBundle(
    JSON.stringify({
      format: BUNDLE_FORMAT,
      bundleVersion: BUNDLE_VERSION,
      kind: "template" as const,
      appVersion: options.appVersion ?? readAppVersion(),
      payload: template,
    }),
  );
  if (!parsed.ok) throw new BundleError("B2", parsed.issues.map(formatBundleIssue));
  if (parsed.bundle.kind !== "template") {
    throw new BundleError("B1", ["[B1] bundle: a template parsed as a dataset"]);
  }

  const file = options.out ?? join(EXPORT_DIR, `${template.id}.alignsynch.json`);
  writeFileAtomic(file, serializeBundle(parsed.bundle));
  return { file, bundle: parsed.bundle };
}

/* ------------------------------------------------------------------ *
 * E32 — the committed demo bundle is the canonical export of the fixtures
 * ------------------------------------------------------------------ */

export interface DemoBundleOptions {
  /** The committed file to compare or write. Defaults to `data/bundles/demo-dataset.alignsynch.json`. */
  readonly file?: string;
  readonly appVersion?: string;
}

/** The first place two serializations disagree, in the words a person can act on. */
function firstDifference(committed: string, canonical: string): string {
  const shared = Math.min(committed.length, canonical.length);
  let at = 0;
  while (at < shared && committed[at] === canonical[at]) at += 1;
  const line = committed.slice(0, at).split("\n").length;
  const excerpt = (text: string) => JSON.stringify(text.slice(at, at + 40));
  if (at === shared) {
    const longer = committed.length > canonical.length ? "committed" : "canonical";
    return `${longer} is longer, and the two agree up to byte ${at} (line ${line})`;
  }
  return `first difference at byte ${at} (line ${line}): committed ${excerpt(committed)} vs canonical ${excerpt(canonical)}`;
}

/**
 * The canonical export of `data/assessments.ts`, compared byte for byte with the committed
 * file — its `appVersion` stamp included. `[]` when they agree; the reasons otherwise —
 * `data:check` prints them as `E32`, and `pnpm bundles export --dataset --check` prints them
 * and exits 1.
 *
 * `appVersion` is provenance a reader trusts — the file says which build made it — so the
 * stamp is **gated**: the committed file must name this tree's `package.json` version (#1320).
 * It was structurally invisible while the comparison re-stamped with the committed file's own
 * version, so the stamp drifted four releases without a red gate. The failure names the repair
 * command, and `--fix` writes head's version (`readAppVersion()`) — the stamp is never edited
 * by hand.
 */
export function demoBundleProblems(options: DemoBundleOptions = {}): string[] {
  const file = options.file ?? DEMO_BUNDLE_FILE;
  if (!existsSync(file)) {
    return [
      `${displayPath(file)} is missing — write it with \`pnpm bundles export --dataset --fix\``,
    ];
  }

  const committed = readFileSync(file, "utf8");
  const parsed = parseBundle(committed);
  const appVersion = options.appVersion ?? readAppVersion();

  const canonical = serializeBundle(
    canonicalDemoBundle(assessments, assessmentSessions, appVersion),
  );

  /** The same text with whichever stamp it carries replaced, so a stamp-only diff is not a record diff. */
  const withoutStamp = (text: string) =>
    text.replace(/"appVersion": "[^"]*"/, '"appVersion": "<stamp>"');

  const problems: string[] = [];
  if (!parsed.ok) {
    problems.push(
      `${displayPath(file)} does not parse as a bundle: ${parsed.issues.map(formatBundleIssue).join("; ")}`,
    );
  }
  if (committed === canonical) return problems;

  const stamped = parsed.ok ? parsed.bundle.appVersion : undefined;
  if (stamped !== undefined && stamped !== appVersion) {
    problems.push(
      `${displayPath(file)} says appVersion "${stamped}" and this tree is "${appVersion}" — the stamp is gated to package.json, so a bundle that names another build is a false answer to whoever imports it. Re-stamp it with \`pnpm bundles export --dataset --fix\` (it writes "${appVersion}")`,
    );
  }
  if (withoutStamp(committed) === withoutStamp(canonical)) return problems;

  problems.push(
    `${displayPath(file)} is not the canonical export of data/assessments.ts (${firstDifference(withoutStamp(committed), withoutStamp(canonical))}) — regenerate it with \`pnpm bundles export --dataset --fix\``,
  );
  return problems;
}

/** `--fix`: write the committed demo bundle from the fixtures (same tmp + rename protocol). */
export function writeDemoBundle(options: DemoBundleOptions = {}): ExportResult<DatasetBundle> {
  const file = options.file ?? DEMO_BUNDLE_FILE;
  const bundle = canonicalDemoBundle(
    assessments,
    assessmentSessions,
    options.appVersion ?? readAppVersion(),
  );
  writeFileAtomic(file, serializeBundle(bundle));
  return { file, bundle };
}

/* ------------------------------------------------------------------ *
 * The CLI
 * ------------------------------------------------------------------ */

const USAGE = [
  "usage: pnpm bundles export --dataset [--out <file>] [--store <file>]",
  "       pnpm bundles export --template <id> [--out <file>] [--store <file>]",
  "       pnpm bundles export --dataset --check | --fix",
  "       pnpm bundles import <file> [--store <file>]",
].join("\n");

const usageError = (detail?: string): BundleError =>
  new BundleError("usage", detail === undefined ? [USAGE] : [`usage: ${detail}`, USAGE]);

function value(args: readonly string[], index: number, flag: string): string {
  const next = args[index + 1];
  if (next === undefined || next.startsWith("--")) throw usageError(`${flag} needs a value`);
  return next;
}

function runExport(args: readonly string[]): number {
  let dataset = false;
  let template: string | undefined;
  let out: string | undefined;
  let store: string | undefined;
  let check = false;
  let fix = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dataset") dataset = true;
    else if (arg === "--template") {
      template = value(args, index, "--template");
      index += 1;
    } else if (arg === "--out") {
      out = value(args, index, "--out");
      index += 1;
    } else if (arg === "--store") {
      store = value(args, index, "--store");
      index += 1;
    } else if (arg === "--check") check = true;
    else if (arg === "--fix") fix = true;
    else throw usageError(`unknown flag "${arg}"`);
  }

  if (dataset && template !== undefined) throw usageError("--dataset and --template are exclusive");
  if (check && fix) throw usageError("--check and --fix are exclusive");
  if ((check || fix) && template !== undefined) {
    throw usageError("--check and --fix compare the demo dataset, so they take --dataset");
  }
  if ((check || fix) && store !== undefined) {
    throw usageError("--check and --fix compare the demo bundle, so they take no --store");
  }
  if (!dataset && template === undefined) throw usageError("export needs --dataset or --template");

  if (check) {
    const problems = demoBundleProblems({ file: out });
    if (problems.length > 0) {
      for (const problem of problems) process.stderr.write(`${problem}\n`);
      return 1;
    }
    process.stdout.write(
      `${displayPath(out ?? DEMO_BUNDLE_FILE)} matches the fixtures byte for byte\n`,
    );
    return 0;
  }

  if (fix) {
    const written = writeDemoBundle({ file: out });
    process.stdout.write(
      `wrote ${displayPath(written.file)} — ${written.bundle.payload.templates.length} templates, ${written.bundle.payload.sessions.length} sessions (bundleVersion ${BUNDLE_VERSION}, appVersion ${written.bundle.appVersion})\n`,
    );
    return 0;
  }

  if (dataset) {
    const written = exportDataset({ out, store });
    process.stdout.write(
      `wrote ${displayPath(written.file)} — dataset: ${written.bundle.payload.templates.length} templates, ${written.bundle.payload.sessions.length} sessions (bundleVersion ${BUNDLE_VERSION}, appVersion ${written.bundle.appVersion})\n`,
    );
    return 0;
  }

  const templateId = template;
  if (templateId === undefined) throw usageError("export needs --dataset or --template");
  const written = exportTemplate(templateId, { out, store });
  process.stdout.write(
    `wrote ${displayPath(written.file)} — template "${written.bundle.payload.id}" with ${written.bundle.payload.items.length} aspects (bundleVersion ${BUNDLE_VERSION}, appVersion ${written.bundle.appVersion})\n`,
  );
  return 0;
}

function runImport(args: readonly string[]): number {
  let file: string | undefined;
  let store: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--store") {
      store = value(args, index, "--store");
      index += 1;
    } else if (arg.startsWith("--")) {
      throw usageError(`unknown flag "${arg}"`);
    } else if (file !== undefined) {
      throw usageError(`import takes one file, got more than one ("${file}", "${arg}")`);
    } else {
      file = arg;
    }
  }

  if (file === undefined) throw usageError("import needs a bundle file");

  const result = importBundleFile(file, { store });
  const counts = `${result.templates} templates, ${result.sessions} sessions`;
  // One line, and only when it happened: a legacy document is tolerated, not blessed.
  if (result.deprecated) {
    process.stderr.write(
      `bundle: legacy instances key accepted (deprecated)\n  ${displayPath(file)} is bundleVersion ${LEGACY_BUNDLE_VERSION} — read as bundleVersion ${BUNDLE_VERSION}, and the store is written in the current shape (payload.sessions); export it again to leave the old key behind\n`,
    );
  }
  if (result.kind === "dataset") {
    process.stdout.write(
      `imported ${displayPath(file)} as a dataset — replaced ${displayPath(result.store)} (${counts})\n`,
    );
  } else {
    process.stdout.write(
      `imported ${displayPath(file)} as a template — "${result.added}" appended to ${displayPath(result.store)}${result.materialized ? " (the fixtures became the store first)" : ""} (${counts})\n`,
    );
  }
  return 0;
}

/** Exit status, not a throw: 0 ok, 1 refused, 2 how you called it. */
export function main(argv: readonly string[]): number {
  try {
    const [command, ...rest] = argv;
    if (command === "export") return runExport(rest);
    if (command === "import") return runImport(rest);
    throw usageError(command === undefined ? undefined : `unknown command "${command}"`);
  } catch (cause) {
    if (cause instanceof BundleError) {
      process.stderr.write(`${bundleErrorText(cause)}\n`);
      return exitCodeFor(cause);
    }
    throw cause;
  }
}

/* Only when invoked as a program — the test suite imports these functions. */
if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
