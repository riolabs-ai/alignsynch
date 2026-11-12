/**
 * `pnpm bundle:pack` / `pnpm bundle:unpack` — the platform package (#899).
 *
 * `scripts/bundles.ts` moves **records**: one JSON file, canonical, refused rather than
 * rewritten. This module moves a **platform**: those same records, plus the configuration
 * around them (plans, prices, flags, options), the people a demo flow signs in as, the media
 * they render and the build the file belongs to — in one deterministic `.zip`, with a manifest
 * that says what is *not* in it.
 *
 * Five decisions, each one the reason a code exists:
 *
 * 1. **The payload is the schemas.** `content` is exactly `zAssessment` / `zAssessmentInstance`
 *    — Aspects, parties and opinions travel inside an instance, as they always did — so there
 *    is no second shape to drift between the package and the store.
 *
 * 2. **Identities are declared, never copied.** A row is `{ email, displayName, role }`. There
 *    is no password: `B4` refuses a key that names one, and the shape has nowhere to put one.
 *    `identities --apply` creates each row through the target branch's own `sign-up/email`
 *    endpoint, exactly as `pnpm db:seed` does, and records the ids it created so
 *    `identities --cleanup` can remove them again (#865: the demo branch is shared).
 *
 * 3. **The zip is deterministic.** `scripts/zip.mjs` fixes entry order, mtime and compression,
 *    so packing the same tree twice gives the same sha256. A hash that moves between identical
 *    runs is a finding, not a flaky test — which is why `bundle-platform.test.ts` asserts it
 *    rather than assuming it.
 *
 * 4. **A package states its build, and the target refuses the rest (`B7`).** `build` carries
 *    `schemaVersion` (the highest migration the source tree had) and `lockfileSha256`. An
 *    import into a tree that is behind, or on a different dependency set, refuses and names the
 *    migration to apply. A package never runs SQL: `pnpm db:migrate` stays a human step.
 *
 * 5. **Subsets are derived and accounted for.** `--subset prod` strips the demo personas and
 *    the relationships they hold *entirely*; a relationship with one demo seat and one real
 *    seat is refused (`B8`), not silently deleted, because that is a tenant's data. Every
 *    dropped record is an entry in `manifest.dropped`, so "what is not in here" is a fact.
 *
 * The two new codes are minted here because both compare a package with a tree or a subset with
 * its source — a document on its own cannot violate either. `B1`–`B4`/`B6` stay where they are
 * (`content/bundle.ts`), `B5` stays in `scripts/bundles.ts`.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import { z } from "zod";

import {
  ALIGNMENT_SETTINGS,
  ASSESSMENT_MODES,
  OPINION_KINDS,
  type Assessment,
  type AssessmentInstance,
} from "../content/assessment";
import {
  BUNDLE_FORMAT,
  PLATFORM_BUNDLE_VERSION,
  formatBundleIssue,
  parseBundle,
  serializeBundle,
  serializeDatasetPayload,
  zPlatformMedia,
  type BundleBuild,
  type BundleIssue,
  type PlatformBundle,
  type PlatformConfig,
  type PlatformContent,
  type PlatformIdentity,
  type PlatformMedia,
  type PlatformOption,
  type PlatformPayload,
  type PlatformPlan,
  type PlatformPrice,
} from "../content/bundle";
import {
  BILLING_INTERVALS,
  billingPlans,
  planPriceCents,
  type BillingPlan,
} from "../data/billing-plans";
import { flags } from "../data/flags";
import { isDemoIdentity, platformIdentities } from "../data/platform-identities";
import {
  BundleError,
  STORE_FILE,
  activeDataset,
  displayPath,
  readAppVersion,
  writeFileAtomic,
} from "./bundles";
import { unzipEntries, zipEntries } from "./zip-bridge";

/* ------------------------------------------------------------------ *
 * Where things live
 * ------------------------------------------------------------------ */

/** The repository root, from this module's compiled location (`.datacheck/scripts/`). */
const REPO_ROOT = join(__dirname, "..", "..");

/** The archive's two JSON documents, at its root. */
export const PACKAGE_MANIFEST_FILE = "manifest.json";
export const PACKAGE_BUNDLE_FILE = "bundle.json";

/** Where a plain `unpack` writes (gitignored): `<dir>/bundle.json`, `<dir>/media/**`. */
export const UNPACK_DIR = join(REPO_ROOT, "exports", "unpacked");

/** The ledger of auth users a package import created, so `--cleanup` can remove them (#865). */
export const IDENTITY_LEDGER = join(REPO_ROOT, "exports", "package-identities.json");

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const sha256 = (data: Buffer | string): string => createHash("sha256").update(data).digest("hex");

/* ------------------------------------------------------------------ *
 * The build identity
 * ------------------------------------------------------------------ */

/** The migration files, in order, as `{ version, file }`. */
export function migrations(): { version: number; file: string }[] {
  const directory = join(REPO_ROOT, "db", "migrations");
  return readdirSync(directory)
    .filter((entry) => /^\d{4}_.+\.sql$/.test(entry))
    .sort()
    .map((file) => ({ version: Number.parseInt(file.slice(0, 4), 10), file }));
}

/** The highest migration this tree carries — `build.schemaVersion`. */
export function schemaVersion(): number {
  const all = migrations();
  return all.length === 0 ? 0 : all[all.length - 1].version;
}

/** The migration file a version names, for a refusal that says what to apply. */
export function migrationFor(version: number): string {
  return (
    migrations().find((entry) => entry.version === version)?.file ??
    `${String(version).padStart(4, "0")}_*.sql`
  );
}

/** `pnpm-lock.yaml`'s sha256 — the dependency set, which is how "all packages" travels. */
export function lockfileSha256(): string {
  const file = join(REPO_ROOT, "pnpm-lock.yaml");
  if (!existsSync(file)) {
    throw new BundleError("io", [
      `[io] pnpm-lock.yaml: missing, so a package cannot state its build`,
    ]);
  }
  return sha256(readFileSync(file));
}

/** What this tree is: the package's `build`, and the preflight it is compared against. */
export function buildIdentity(appVersion: string = readAppVersion()): BundleBuild {
  return { appVersion, schemaVersion: schemaVersion(), lockfileSha256: lockfileSha256() };
}

/**
 * `B7` — a package may not be opened on a tree that is not its build.
 *
 * `schemaVersion` is the refusal that matters: a package written by a tree with `0041` applied
 * carries rows the target's model does not know, and the answer is a deliberate
 * `pnpm db:migrate` by a person, never an automatic one — a package that applied SQL would be
 * a migration tool wearing a data format's clothes. `lockfileSha256` catches the other half:
 * the same migrations on a different dependency set is a different build. `appVersion` is
 * provenance and is only reported, because it moves on every release while a package stays
 * installable.
 */
export function preflightProblems(build: BundleBuild, target: BundleBuild): BundleIssue[] {
  const problems: BundleIssue[] = [];

  if (build.schemaVersion > target.schemaVersion) {
    problems.push({
      code: "B7",
      path: ["payload", "build", "schemaVersion"],
      message: `package schemaVersion ${build.schemaVersion} (${migrationFor(build.schemaVersion)}) is ahead of this tree's ${target.schemaVersion} (${migrationFor(target.schemaVersion)}) — apply \`pnpm db:migrate\` on the target first; a package never applies SQL`,
    });
  }

  if (build.schemaVersion < target.schemaVersion) {
    problems.push({
      code: "B7",
      path: ["payload", "build", "schemaVersion"],
      message: `package schemaVersion ${build.schemaVersion} is behind this tree's ${target.schemaVersion} (${migrationFor(target.schemaVersion)}) — pack from the build you are installing into, a package is not a downgrade path`,
    });
  }

  if (build.lockfileSha256 !== target.lockfileSha256) {
    problems.push({
      code: "B7",
      path: ["payload", "build", "lockfileSha256"],
      message: `package targets lockfile ${build.lockfileSha256.slice(0, 12)}…, this tree is ${target.lockfileSha256.slice(0, 12)}… — the dependency set moved, so this is not the build the package was made from`,
    });
  }

  return problems;
}

/* ------------------------------------------------------------------ *
 * The config group — projected, never re-authored
 * ------------------------------------------------------------------ */

/** One plan, as the package carries it. The `cta` and `recommended` fields stay behind: they
 *  are presentation, and a card's ribbon is the brand's decision, not a tenant's data. */
export function platformPlan(plan: BillingPlan): PlatformPlan {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    monthlyCents: plan.monthlyCents,
    yearlyCents: plan.yearlyCents,
    features: [...plan.features],
    limitations: [...plan.limitations],
  };
}

/** One price row per plan × interval — the same projection `billingPlanRows()` writes to the DB. */
export function platformPrices(): PlatformPrice[] {
  return billingPlans.flatMap((plan) =>
    BILLING_INTERVALS.map((interval) => ({
      planId: plan.id,
      interval,
      amountCents: planPriceCents(plan, interval),
    })),
  );
}

/**
 * The options table: every closed value list the model owns, derived from the enums rather
 * than typed again. A package that carried a hand-written `["basic", "advanced"]` would be a
 * second copy that a new mode does not reach.
 */
export function platformOptions(): PlatformOption[] {
  return [
    { option: "assessment.mode", values: [...ASSESSMENT_MODES] },
    { option: "assessment.setting", values: [...ALIGNMENT_SETTINGS] },
    { option: "assessment.opinion", values: [...OPINION_KINDS] },
    { option: "billing.interval", values: [...BILLING_INTERVALS] },
  ];
}

/** The config group of a package, projected from the fixtures that already own each fact. */
export function platformConfig(): PlatformConfig {
  return {
    plans: billingPlans.map(platformPlan),
    prices: platformPrices(),
    flags: Object.entries(flags).map(([name, flag]) => ({
      name,
      default: flag.default,
      templates: [...(flag.templates ?? [])],
      note: flag.note,
    })),
    options: platformOptions(),
  };
}

/* ------------------------------------------------------------------ *
 * Media
 * ------------------------------------------------------------------ */

/** Every `media/…` path a document mentions — the records' own references, walked not guessed. */
export function referencedMediaPaths(content: PlatformContent): string[] {
  const found = new Set<string>();
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      if (node.startsWith("media/")) found.add(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (node === null || typeof node !== "object") return;
    for (const child of Object.values(node as Record<string, unknown>)) walk(child);
  };
  walk(content);
  return [...found].sort();
}

/**
 * The media index for a content group: one entry per referenced path, hashed from
 * `public/<path minus "media/">`. A reference with no file is `B8` — a package that names an
 * image it does not carry installs a broken screen, and the operator finding that out at pack
 * time is the whole point.
 */
export function mediaIndex(
  content: PlatformContent,
  read: (path: string) => Buffer | undefined = (path) =>
    existsSync(join(REPO_ROOT, "public", path))
      ? readFileSync(join(REPO_ROOT, "public", path))
      : undefined,
): { media: PlatformMedia[]; bytes: Map<string, Buffer>; problems: BundleIssue[] } {
  const media: PlatformMedia[] = [];
  const bytes = new Map<string, Buffer>();
  const problems: BundleIssue[] = [];

  for (const path of referencedMediaPaths(content)) {
    const data = read(path);
    if (data === undefined) {
      problems.push({
        code: "B8",
        path: ["content"],
        message: `a record references "${path}", which this tree does not carry under public/ — a package ships the bytes it names`,
      });
      continue;
    }
    media.push({ path, sha256: sha256(data), bytes: data.length });
    bytes.set(path, data);
  }

  return { media, bytes, problems };
}

/* ------------------------------------------------------------------ *
 * The platform payload
 * ------------------------------------------------------------------ */

export interface PayloadOptions {
  readonly appVersion?: string;
  readonly identities?: readonly PlatformIdentity[];
}

/** The dataset's content as a platform payload, config and identities included. */
export function platformPayload(
  content: PlatformContent,
  options: PayloadOptions = {},
): { payload: PlatformPayload; media: Map<string, Buffer>; problems: BundleIssue[] } {
  const index = mediaIndex(content);
  const payload: PlatformPayload = {
    content: { templates: content.templates, instances: content.instances },
    config: platformConfig(),
    identities: [...(options.identities ?? platformIdentities)],
    media: index.media,
    build: buildIdentity(options.appVersion),
  };
  return { payload, media: index.bytes, problems: index.problems };
}

/** The active set (the tenant store when it exists, the fixtures otherwise) as content. */
export function activeContent(options: { store?: string } = {}): PlatformContent {
  const dataset = activeDataset({ store: options.store });
  return { templates: dataset.payload.templates, instances: dataset.payload.instances };
}

/* ------------------------------------------------------------------ *
 * Subsets — derived, and accounted for
 * ------------------------------------------------------------------ */

/** What a package does not carry, and why. The manifest's `dropped` array. */
export const zDroppedRecord = z
  .object({
    kind: z.enum(["template", "instance", "identity", "media", "plan", "flag", "option"]),
    id: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

export type DroppedRecord = z.infer<typeof zDroppedRecord>;

export const SUBSETS = ["prod", "preview"] as const;
export type Subset = (typeof SUBSETS)[number];

/** How many templates a `preview` slice keeps when `--limit` is not given. */
export const PREVIEW_DEFAULT_LIMIT = 3;

export interface SubsetOptions {
  readonly subset: Subset;
  readonly limit?: number;
}

export interface SubsetResult {
  readonly payload: PlatformPayload;
  readonly dropped: DroppedRecord[];
}

const lower = (value: string) => value.toLowerCase();

/**
 * The two derived subsets, and the one refusal that keeps them safe.
 *
 * **prod** strips the demo personas and *only* the relationships whose every seat is one of
 * them. A relationship with one demo seat and one real seat is `B8`: dropping the persona would
 * orphan a tenant's relationship seat, and dropping the relationship would delete a tenant's
 * data — neither is the packer's call, so it refuses and names both.
 *
 * **preview** is a thin slice: the first `N` templates, one persona, and the relationships that
 * survive both (their template is in the slice, and every seat belongs to the persona it
 * declares). Everything else is on the `dropped` list, by id.
 */
export function subsetPayload(full: PlatformPayload, options: SubsetOptions): SubsetResult {
  if (options.subset === "prod") return prodSubset(full);
  return previewSubset(full, options.limit ?? PREVIEW_DEFAULT_LIMIT);
}

function prodSubset(full: PlatformPayload): SubsetResult {
  const dropped: DroppedRecord[] = [];
  const keptIdentities: PlatformIdentity[] = [];
  const demoPersonas = new Map<string, string>();

  for (const identity of full.identities) {
    if (isDemoIdentity(identity)) {
      demoPersonas.set(lower(identity.displayName), identity.email);
      dropped.push({
        kind: "identity",
        id: identity.email,
        reason: "demo persona — a production package carries no demo sign-in",
      });
    } else {
      keptIdentities.push(identity);
    }
  }

  const keptInstances: AssessmentInstance[] = [];
  const orphaned: string[] = [];

  for (const instance of full.content.instances) {
    const seats = instance.parties.map((party) => lower(party.name));
    const demoSeats = seats.filter((seat) => demoPersonas.has(seat));
    const realSeats = seats.filter((seat) => !demoPersonas.has(seat));

    if (demoSeats.length === 0) {
      keptInstances.push(instance);
      continue;
    }

    if (realSeats.length > 0) {
      orphaned.push(
        `[B8] payload.content.instances: dropping persona ${demoSeats
          .map((seat) => `"${demoPersonas.get(seat)}"`)
          .join(
            ", ",
          )} would leave relationship "${instance.id}" with a seat nobody holds (${realSeats
          .map((seat) => `"${seat}"`)
          .join(", ")}) — keep the persona, or drop the relationship deliberately`,
      );
      continue;
    }

    dropped.push({
      kind: "instance",
      id: instance.id,
      reason: `every seat is a demo persona (${demoSeats.map((seat) => `"${seat}"`).join(", ")})`,
    });
  }

  if (orphaned.length > 0) throw new BundleError("B8", orphaned);

  return {
    payload: {
      ...full,
      content: { templates: full.content.templates, instances: keptInstances },
      identities: keptIdentities,
    },
    dropped,
  };
}

function previewSubset(full: PlatformPayload, limit: number): SubsetResult {
  const dropped: DroppedRecord[] = [];
  const keptTemplates = full.content.templates.slice(0, limit);
  const keptTemplateIds = new Set(keptTemplates.map((template) => template.id));

  for (const template of full.content.templates.slice(limit)) {
    dropped.push({
      kind: "template",
      id: template.id,
      reason: `outside this preview's ${limit} template(s) (--limit raises it)`,
    });
  }

  // The persona: one that holds a seat on a relationship this slice can keep, else the first.
  const owners = new Set<string>();
  for (const instance of full.content.instances) {
    if (!keptTemplateIds.has(instance.templateId)) continue;
    for (const party of instance.parties) owners.add(lower(party.name));
  }
  const persona =
    full.identities.find((identity) => owners.has(lower(identity.displayName))) ??
    full.identities[0];
  const personaNames = new Set(persona === undefined ? [] : [lower(persona.displayName)]);

  for (const identity of full.identities) {
    if (persona !== undefined && identity.email === persona.email) continue;
    dropped.push({
      kind: "identity",
      id: identity.email,
      reason: "a preview declares one persona — this is a thin slice, not a tenant",
    });
  }

  const keptInstances: AssessmentInstance[] = [];
  for (const instance of full.content.instances) {
    if (!keptTemplateIds.has(instance.templateId)) {
      dropped.push({
        kind: "instance",
        id: instance.id,
        reason: `its template "${instance.templateId}" is outside this preview's ${limit} template(s)`,
      });
      continue;
    }
    const unowned = instance.parties
      .map((party) => lower(party.name))
      .filter((seat) => !personaNames.has(seat));
    if (unowned.length > 0) {
      dropped.push({
        kind: "instance",
        id: instance.id,
        reason: `seat ${unowned.map((seat) => `"${seat}"`).join(", ")} belongs to a persona this preview does not declare`,
      });
      continue;
    }
    keptInstances.push(instance);
  }

  const content: PlatformContent = { templates: keptTemplates, instances: keptInstances };
  const stillReferenced = new Set(referencedMediaPaths(content));
  const media: PlatformMedia[] = [];
  for (const entry of full.media) {
    if (stillReferenced.has(entry.path)) {
      media.push(entry);
      continue;
    }
    dropped.push({
      kind: "media",
      id: entry.path,
      reason: "no record in this slice references it",
    });
  }

  return {
    payload: {
      ...full,
      content,
      identities: persona === undefined ? [] : [persona],
      media,
    },
    dropped,
  };
}

/**
 * `B8`, the other half: the subset *accounts* for what it dropped.
 *
 * Called on the result before it is written, so a subset rule that forgets a cascade is a
 * refusal instead of a package missing a record nobody noticed. The two facts checked are the
 * ones a manifest cannot lie about: every relationship's template is in the package, and every
 * declared media file a kept record names is carried.
 */
export function subsetIntegrityProblems(
  subset: PlatformPayload,
  dropped: readonly DroppedRecord[],
): BundleIssue[] {
  const problems: BundleIssue[] = [];
  const templates = new Set(subset.content.templates.map((template) => template.id));
  const media = new Set(subset.media.map((entry) => entry.path));
  const accounted = new Set(dropped.map((entry) => `${entry.kind}\u0000${entry.id}`));

  for (const instance of subset.content.instances) {
    if (templates.has(instance.templateId)) continue;
    const isAccounted = accounted.has(`instance\u0000${instance.id}`);
    problems.push({
      code: "B8",
      path: ["content", "instances"],
      message: `relationship "${instance.id}" names template "${instance.templateId}", which this package does not carry — ${
        isAccounted
          ? "its own drop is accounted for, the reference is not"
          : "and nothing on the dropped list explains it"
      }`,
    });
  }

  for (const path of referencedMediaPaths(subset.content)) {
    if (media.has(path)) continue;
    problems.push({
      code: "B8",
      path: ["media"],
      message: `a kept record references "${path}", which this package does not carry — the manifest would say the file is absent and the screen would break`,
    });
  }

  return problems;
}

/* ------------------------------------------------------------------ *
 * The container
 * ------------------------------------------------------------------ */

export const PACKAGE_FORMAT = "alignsynch-package" as const;
export const PACKAGE_VERSION = 1 as const;

/**
 * `manifest.json` — what the container holds, and what it deliberately does not.
 *
 * Deliberately no timestamp: the manifest is inside the thing whose hash is the package's
 * identity, so a clock reading would make two packs of one tree differ.
 */
export const zPackageManifest = z
  .object({
    format: z.literal(PACKAGE_FORMAT),
    packageVersion: z.literal(PACKAGE_VERSION),
    manifest: z
      .object({
        bundle: z.literal(PACKAGE_BUNDLE_FILE),
        bundleSha256: z.string().regex(/^[0-9a-f]{64}$/),
        bundleVersion: z.number().int(),
        appVersion: z.string().min(1),
        schemaVersion: z.number().int().nonnegative(),
        lockfileSha256: z.string().regex(/^[0-9a-f]{64}$/),
        counts: z
          .object({
            templates: z.number().int().nonnegative(),
            instances: z.number().int().nonnegative(),
            identities: z.number().int().nonnegative(),
            plans: z.number().int().nonnegative(),
            flags: z.number().int().nonnegative(),
            options: z.number().int().nonnegative(),
            media: z.number().int().nonnegative(),
          })
          .strict(),
        dropped: z.array(zDroppedRecord),
        media: z.array(zPlatformMedia),
      })
      .strict(),
  })
  .strict();

export type PackageManifest = z.infer<typeof zPackageManifest>;

/** The manifest a payload and its drop list produce. */
export function packageManifest(
  payload: PlatformPayload,
  bundleText: string,
  appVersion: string,
  dropped: readonly DroppedRecord[],
): PackageManifest {
  return {
    format: PACKAGE_FORMAT,
    packageVersion: PACKAGE_VERSION,
    manifest: {
      bundle: PACKAGE_BUNDLE_FILE,
      bundleSha256: sha256(bundleText),
      bundleVersion: PLATFORM_BUNDLE_VERSION,
      appVersion,
      schemaVersion: payload.build.schemaVersion,
      lockfileSha256: payload.build.lockfileSha256,
      counts: {
        templates: payload.content.templates.length,
        instances: payload.content.instances.length,
        identities: payload.identities.length,
        plans: payload.config.plans.length,
        flags: payload.config.flags.length,
        options: payload.config.options.length,
        media: payload.media.length,
      },
      dropped: [...dropped],
      media: [...payload.media],
    },
  };
}

/** One platform bundle, validated through the same `parseBundle` an import runs. */
export function platformBundle(payload: PlatformPayload, appVersion: string): PlatformBundle {
  const parsed = parseBundle(
    JSON.stringify({
      format: BUNDLE_FORMAT,
      bundleVersion: PLATFORM_BUNDLE_VERSION,
      kind: "platform" as const,
      appVersion,
      payload,
    }),
  );
  if (!parsed.ok)
    throw new BundleError(parsed.issues[0]?.code ?? "B1", parsed.issues.map(formatBundleIssue));
  if (parsed.bundle.kind !== "platform") {
    throw new BundleError("B1", ["[B1] bundle: a platform payload parsed as something else"]);
  }
  return parsed.bundle;
}

/** The canonical text of a platform bundle: the fixed point `serialize(parse(…))` promises. */
export function serializePlatformBundle(bundle: PlatformBundle): string {
  return serializeBundle(bundle);
}

function writeBinaryAtomic(file: string, data: Buffer): void {
  const temporary = `${file}.tmp-${process.pid}`;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(temporary, data);
    renameSync(temporary, file);
  } catch (cause) {
    rmSync(temporary, { force: true });
    throw new BundleError("io", [`[io] ${displayPath(file)}: ${messageOf(cause)}`]);
  }
}

export interface PackOptions {
  /** Where to write the package. Defaults to `exports/<kind>.alignsynch.zip`. */
  readonly out?: string;
  readonly appVersion?: string;
  readonly subset?: Subset;
  readonly limit?: number;
  /** The active store, when the caller wants a specific one (a test, or a preview branch). */
  readonly store?: string;
  /** Pack from an unpacked directory's `bundle.json` instead of the active set (round trips). */
  readonly from?: string;
}

export interface PackResult {
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly manifest: PackageManifest;
  readonly bundle: PlatformBundle;
}

/**
 * Pack the active set (or a directory's `bundle.json`) into one deterministic zip.
 *
 * Order of refusals, because the first error a person sees should be the first thing they can
 * act on: the payload's own references (`B8` from `platformPayloadProblems`), the subset
 * (`B8` when it would orphan a seat), the bundle (`B1`–`B4`/`B6` through `parseBundle`), and
 * last the zip.
 */
export function packPackage(options: PackOptions = {}): PackResult {
  const appVersion = options.appVersion ?? readAppVersion();

  let full: PlatformPayload;
  let mediaBytes = new Map<string, Buffer>();

  if (options.from !== undefined) {
    const file = join(options.from, PACKAGE_BUNDLE_FILE);
    if (!existsSync(file)) {
      throw new BundleError("io", [
        `[io] ${displayPath(file)}: a directory pack needs its bundle.json`,
      ]);
    }
    const parsed = parseBundle(readFileSync(file, "utf8"));
    if (!parsed.ok)
      throw new BundleError(parsed.issues[0]?.code ?? "B1", parsed.issues.map(formatBundleIssue));
    if (parsed.bundle.kind !== "platform") {
      throw new BundleError("B1", [
        `[B1] kind: ${displayPath(file)} is a "${parsed.bundle.kind}" bundle, not a platform package`,
      ]);
    }
    full = parsed.bundle.payload;
    for (const entry of full.media) {
      const source = join(options.from, entry.path);
      if (!existsSync(source)) {
        throw new BundleError("B8", [
          `[B8] media: ${displayPath(source)} is missing — a package carries the bytes its index names`,
        ]);
      }
      mediaBytes.set(entry.path, readFileSync(source));
    }
  } else {
    const content = activeContent({ store: options.store });
    const built = platformPayload(content, { appVersion });
    if (built.problems.length > 0) {
      throw new BundleError("B8", built.problems.map(formatBundleIssue));
    }
    full = built.payload;
    mediaBytes = built.media;
  }

  let payload = full;
  let dropped: DroppedRecord[] = [];

  if (options.subset !== undefined) {
    const subset = subsetPayload(full, { subset: options.subset, limit: options.limit });
    const problems = subsetIntegrityProblems(subset.payload, subset.dropped);
    if (problems.length > 0) throw new BundleError("B8", problems.map(formatBundleIssue));
    payload = subset.payload;
    dropped = subset.dropped;
  }

  const bundle = platformBundle(payload, appVersion);
  const bundleText = serializePlatformBundle(bundle);
  const manifest = packageManifest(payload, bundleText, appVersion, dropped);

  const entries: { name: string; data: Buffer }[] = [
    { name: PACKAGE_BUNDLE_FILE, data: Buffer.from(bundleText, "utf8") },
    {
      name: PACKAGE_MANIFEST_FILE,
      data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    },
  ];
  for (const entry of payload.media) {
    const data = mediaBytes.get(entry.path);
    if (data === undefined) {
      throw new BundleError("B8", [`[B8] media: "${entry.path}" has no bytes to pack`]);
    }
    entries.push({ name: entry.path, data });
  }

  const archive = zipEntries(entries);
  const file =
    options.out ?? join(REPO_ROOT, "exports", `${options.subset ?? "platform"}.alignsynch.zip`);
  writeBinaryAtomic(file, archive);

  return { file, sha256: sha256(archive), bytes: archive.length, manifest, bundle };
}

/* ------------------------------------------------------------------ *
 * Unpack
 * ------------------------------------------------------------------ */

export interface UnpackOptions {
  /** Where to write the unpacked package. Defaults to `exports/unpacked/`. */
  readonly out?: string;
  /** Also install the content into the tenant store (`data/generated/assessments.json`). */
  readonly install?: boolean;
  readonly store?: string;
  readonly target?: BundleBuild;
}

export interface UnpackResult {
  readonly dir: string;
  readonly bundle: PlatformBundle;
  readonly manifest: PackageManifest;
  readonly installed: string | null;
}

const entryBytes = (entries: readonly { name: string; data: Buffer }[], name: string): Buffer => {
  const entry = entries.find((candidate) => candidate.name === name);
  if (entry === undefined) {
    throw new BundleError("B1", [
      `[B1] ${name}: the package does not contain it — a package is manifest.json, bundle.json and media/`,
    ]);
  }
  return entry.data;
};

/**
 * Read a package: the zip, then the manifest, then the bundle's own hash, then the bundle, then
 * the preflight against *this* tree. Every step refuses before the first byte is written, so a
 * failed unpack leaves the output directory untouched.
 */
export function unpackPackage(file: string, options: UnpackOptions = {}): UnpackResult {
  let archive: Buffer;
  try {
    archive = readFileSync(file);
  } catch (cause) {
    throw new BundleError("io", [
      `[io] ${displayPath(file)}: cannot read the package — ${messageOf(cause)}`,
    ]);
  }

  let entries: { name: string; data: Buffer }[];
  try {
    entries = unzipEntries(archive);
  } catch (cause) {
    throw new BundleError("B1", [`[B1] ${displayPath(file)}: ${messageOf(cause)}`]);
  }

  const manifestText = entryBytes(entries, PACKAGE_MANIFEST_FILE).toString("utf8");
  let manifestJson: unknown;
  try {
    manifestJson = JSON.parse(manifestText);
  } catch (cause) {
    throw new BundleError("B1", [`[B1] ${PACKAGE_MANIFEST_FILE}: not JSON — ${messageOf(cause)}`]);
  }
  const manifest = zPackageManifest.safeParse(manifestJson);
  if (!manifest.success) {
    throw new BundleError(
      "B1",
      manifest.error.issues.map(
        (issue) => `[B1] ${[PACKAGE_MANIFEST_FILE, ...issue.path].join(".")}: ${issue.message}`,
      ),
    );
  }

  const bundleBytes = entryBytes(entries, PACKAGE_BUNDLE_FILE);
  const bundleText = bundleBytes.toString("utf8");
  const actual = sha256(bundleBytes);
  if (actual !== manifest.data.manifest.bundleSha256) {
    throw new BundleError("B1", [
      `[B1] manifest.manifest.bundleSha256: the package says ${manifest.data.manifest.bundleSha256.slice(0, 12)}… and its bundle.json hashes to ${actual.slice(0, 12)}… — the archive was edited or damaged`,
    ]);
  }

  for (const entry of manifest.data.manifest.media) {
    const carried = entries.find((candidate) => candidate.name === entry.path);
    if (carried === undefined) {
      throw new BundleError("B1", [
        `[B1] ${entry.path}: the manifest lists it and the archive does not contain it`,
      ]);
    }
    if (sha256(carried.data) !== entry.sha256) {
      throw new BundleError("B1", [
        `[B1] ${entry.path}: bytes do not match the sha256 in the manifest`,
      ]);
    }
  }

  const parsed = parseBundle(bundleText);
  if (!parsed.ok)
    throw new BundleError(parsed.issues[0]?.code ?? "B1", parsed.issues.map(formatBundleIssue));
  if (parsed.bundle.kind !== "platform") {
    throw new BundleError("B1", [
      `[B1] kind: ${displayPath(file)} carries a "${parsed.bundle.kind}" bundle, not a platform package`,
    ]);
  }

  const target = options.target ?? buildIdentity();
  const preflight = preflightProblems(parsed.bundle.payload.build, target);
  if (preflight.length > 0) throw new BundleError("B7", preflight.map(formatBundleIssue));

  const dir = options.out ?? UNPACK_DIR;
  writeFileAtomic(join(dir, PACKAGE_BUNDLE_FILE), bundleText);
  writeFileAtomic(join(dir, PACKAGE_MANIFEST_FILE), `${JSON.stringify(manifest.data, null, 2)}\n`);
  for (const entry of entries) {
    if (!entry.name.startsWith("media/")) continue;
    writeBinaryAtomic(join(dir, entry.name), entry.data);
  }

  let installed: string | null = null;
  if (options.install === true) {
    const store = options.store ?? STORE_FILE;
    writeFileAtomic(
      store,
      serializeDatasetPayload({
        templates: parsed.bundle.payload.content.templates as Assessment[],
        instances: parsed.bundle.payload.content.instances as AssessmentInstance[],
      }),
    );
    installed = store;
  }

  return { dir, bundle: parsed.bundle, manifest: manifest.data, installed };
}

/* ------------------------------------------------------------------ *
 * Identities — declared, created through the target's own sign-up endpoint
 * ------------------------------------------------------------------ */

/**
 * The ledger…a list of auth users this run created, keyed by email, with the id the branch's
 * auth server issued. It is the only way `--cleanup` can remove *exactly* what was created:
 * matching by email alone could delete an account a person made.
 */
export const zIdentityLedger = z
  .object({
    created: z.array(
      z
        .object({ email: z.email(), userId: z.string().min(1), package: z.string().min(1) })
        .strict(),
    ),
  })
  .strict();

export type IdentityLedger = z.infer<typeof zIdentityLedger>;

export function readLedger(file: string = IDENTITY_LEDGER): IdentityLedger {
  if (!existsSync(file)) return { created: [] };
  const parsed = zIdentityLedger.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    throw new BundleError("io", [
      `[io] ${displayPath(file)}: not an identity ledger — ${parsed.error.issues[0]?.message ?? "shape"}`,
    ]);
  }
  return parsed.data;
}

const writeLedger = (ledger: IdentityLedger, file: string = IDENTITY_LEDGER): void => {
  writeFileAtomic(file, `${JSON.stringify(ledger, null, 2)}\n`);
};

/** What a package's identities would do on this machine, without doing it. */
export function identityPlan(
  identities: readonly PlatformIdentity[],
  ledger: IdentityLedger,
): { declare: PlatformIdentity[]; already: { email: string; userId: string }[] } {
  const known = new Set(ledger.created.map((entry) => lower(entry.email)));
  return {
    declare: identities.filter((identity) => !known.has(lower(identity.email))),
    already: ledger.created.map((entry) => ({ email: entry.email, userId: entry.userId })),
  };
}

/**
 * Create one identity through the branch's **own** `sign-up/email` endpoint — the same call
 * `pnpm db:seed` makes, so the account is a real Neon Auth user with a Better Auth hash, no
 * SDK and no SQL INSERT into `neon_auth`.
 *
 * The password is 24 random bytes, base64url, generated here and never printed, stored or
 * returned: the session token in the response is not read either. Only `user.id` comes back,
 * because it is the handle `--cleanup` needs.
 */
export async function createIdentity(
  identity: PlatformIdentity,
  origin = process.env.DEMO_ORIGIN ?? "http://localhost:3000",
): Promise<string> {
  const base = process.env.NEON_AUTH_BASE_URL;
  if (base === undefined || base.length === 0) {
    throw new BundleError("capability", [
      "usage: NEON_AUTH_BASE_URL is not set — an identity is created by a branch's own auth server, and this shell has no credentials (run it through `bin/withenv.sh`)",
    ]);
  }

  const response = await fetch(`${base.replace(/\/+$/, "")}/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      email: identity.email,
      password: randomBytes(24).toString("base64url"),
      name: identity.displayName,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    user?: { id?: unknown };
    code?: string;
  };
  if (!response.ok) {
    throw new BundleError("io", [
      `account ${identity.email}: sign-up answered HTTP ${response.status}${body.code ? ` (${body.code})` : ""} — is NEON_AUTH_BASE_URL this branch's auth server?`,
    ]);
  }
  const userId = body.user?.id;
  if (typeof userId !== "string" || userId.length === 0) {
    throw new BundleError("io", [
      `account ${identity.email}: sign-up answered ${response.status} with no user id`,
    ]);
  }
  return userId;
}

/**
 * Remove the auth users a package import created, by the ids in the ledger only — and unbind
 * any party seat they held, because `party.user_id` is a text column with no foreign key.
 * Same shape as `pnpm db:seed`'s removal (#865): the demo branch is shared, so a package that
 * created accounts must be able to take them away again.
 */
export async function removeIdentities(
  ledger: IdentityLedger,
  options: { readonly databaseUrl?: string } = {},
): Promise<{ removed: number }> {
  if (ledger.created.length === 0) return { removed: 0 };
  const url = options.databaseUrl ?? process.env.DATABASE_URL;
  if (url === undefined || url.length === 0) {
    throw new BundleError("capability", [
      "usage: DATABASE_URL is not set — removing an auth user needs the branch's unpooled connection string (run with `bin/withenv.sh`)",
    ]);
  }

  const { default: pg } = (await import("pg")) as unknown as {
    default: { Client: new (config: { connectionString: string }) => PgClient };
  };
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const ids = ledger.created.map((entry) => entry.userId);
    await client.query("UPDATE party SET user_id = NULL WHERE user_id = ANY($1::text[])", [ids]);
    await client.query("DELETE FROM demo_account WHERE user_id = ANY($1::text[])", [ids]);
    await client
      .query("DELETE FROM user_profile WHERE user_id = ANY($1::text[])", [ids])
      .catch(() => undefined);
    const removed = await client.query(
      "DELETE FROM neon_auth.users WHERE id::text = ANY($1::text[])",
      [ids],
    );
    return { removed: removed.rowCount ?? ids.length };
  } finally {
    await client.end().catch(() => undefined);
  }
}

interface PgClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(text: string, values?: readonly unknown[]): Promise<{ rowCount: number | null }>;
}

/* ------------------------------------------------------------------ *
 * The CLI
 * ------------------------------------------------------------------ */

const USAGE = [
  "usage: pnpm bundle:pack --dataset [--subset prod|preview] [--limit N] [--out <file.zip>]",
  "       pnpm bundle:pack --from <unpacked-dir> --out <file.zip>",
  "       pnpm bundle:unpack <file.zip> [--out <dir>] [--install]",
  "       pnpm bundle:identities <file.zip> [--apply] [--cleanup] [--ledger <file>]",
].join("\n");

const usageError = (detail?: string): BundleError =>
  new BundleError("usage", detail === undefined ? [USAGE] : [`usage: ${detail}`, USAGE]);

function value(args: readonly string[], index: number, flag: string): string {
  const next = args[index + 1];
  if (next === undefined || next.startsWith("--")) throw usageError(`${flag} needs a value`);
  return next;
}

export function runPack(args: readonly string[]): number {
  let dataset = false;
  let from: string | undefined;
  let out: string | undefined;
  let subset: Subset | undefined;
  let limit: number | undefined;
  let store: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dataset") dataset = true;
    else if (arg === "--from") {
      from = value(args, index, "--from");
      index += 1;
    } else if (arg === "--out") {
      out = value(args, index, "--out");
      index += 1;
    } else if (arg === "--store") {
      store = value(args, index, "--store");
      index += 1;
    } else if (arg === "--subset") {
      const name = value(args, index, "--subset");
      if (!(SUBSETS as readonly string[]).includes(name)) {
        throw usageError(`--subset takes ${SUBSETS.join(" or ")}, not "${name}"`);
      }
      subset = name as Subset;
      index += 1;
    } else if (arg === "--limit") {
      const raw = value(args, index, "--limit");
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isInteger(parsed) || parsed < 1)
        throw usageError(`--limit takes a positive integer, not "${raw}"`);
      limit = parsed;
      index += 1;
    } else {
      throw usageError(`unknown flag "${arg}"`);
    }
  }

  if (dataset && from !== undefined) throw usageError("--dataset and --from are exclusive");
  if (!dataset && from === undefined) throw usageError("pack needs --dataset or --from <dir>");
  if (limit !== undefined && subset !== "preview")
    throw usageError("--limit only applies to --subset preview");

  const packed = packPackage({ out, subset, limit, from, store });
  const counts = packed.manifest.manifest.counts;
  const lines = [
    `wrote ${displayPath(packed.file)} — ${packed.bytes} bytes, sha256 ${packed.sha256}`,
    `  ${counts.templates} templates, ${counts.instances} instances, ${counts.identities} identities, ${counts.plans} plans, ${counts.flags} flags, ${counts.options} options, ${counts.media} media`,
    `  build: appVersion ${packed.manifest.manifest.appVersion}, schemaVersion ${packed.manifest.manifest.schemaVersion}, lockfileSha256 ${packed.manifest.manifest.lockfileSha256.slice(0, 12)}…`,
    subset === undefined
      ? "  subset: none — the whole active set"
      : `  subset: ${subset} — ${packed.manifest.manifest.dropped.length} record(s) dropped, listed in manifest.json`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
}

export function runUnpack(args: readonly string[]): number {
  let file: string | undefined;
  let out: string | undefined;
  let install = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--out") {
      out = value(args, index, "--out");
      index += 1;
    } else if (arg === "--install") install = true;
    else if (arg.startsWith("--")) throw usageError(`unknown flag "${arg}"`);
    else if (file === undefined) file = arg;
    else throw usageError(`unpack takes one package, got a second ("${arg}")`);
  }

  if (file === undefined) throw usageError("unpack needs a package file");

  const unpacked = unpackPackage(file, { out, install });
  const counts = unpacked.manifest.manifest.counts;
  const lines = [
    `unpacked ${displayPath(file)} into ${displayPath(unpacked.dir)}`,
    `  ${counts.templates} templates, ${counts.instances} instances, ${counts.identities} identities, ${counts.media} media (${unpacked.manifest.manifest.dropped.length} dropped)`,
    `  this tree satisfies build schemaVersion ${unpacked.manifest.manifest.schemaVersion} and lockfile ${unpacked.manifest.manifest.lockfileSha256.slice(0, 12)}…`,
    unpacked.installed === null
      ? "  not installed — re-run with --install to write the tenant store"
      : `  installed the content into ${displayPath(unpacked.installed)}`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
}

export async function runIdentities(args: readonly string[]): Promise<number> {
  let file: string | undefined;
  let apply = false;
  let cleanup = false;
  let ledgerFile: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--apply") apply = true;
    else if (arg === "--cleanup") cleanup = true;
    else if (arg === "--ledger") {
      ledgerFile = value(args, index, "--ledger");
      index += 1;
    } else if (arg.startsWith("--")) throw usageError(`unknown flag "${arg}"`);
    else if (file === undefined) file = arg;
    else throw usageError(`identities takes one package, got a second ("${arg}")`);
  }

  if (file === undefined) throw usageError("identities needs a package file");
  if (apply && cleanup) throw usageError("--apply and --cleanup are exclusive");

  const ledgerPath = ledgerFile ?? IDENTITY_LEDGER;
  const ledger = readLedger(ledgerPath);

  if (cleanup) {
    const { removed } = await removeIdentities(ledger, {});
    writeLedger({ created: [] }, ledgerPath);
    process.stdout.write(
      `removed ${removed} account(s) this ledger created, and cleared ${displayPath(ledgerPath)}\n`,
    );
    return 0;
  }

  const unpacked = unpackPackage(file, { out: join(REPO_ROOT, "exports", "unpacked-identities") });
  const identities = unpacked.bundle.payload.identities;
  const plan = identityPlan(identities, ledger);

  if (!apply) {
    const lines = [
      `${displayPath(file)} declares ${identities.length} identity(ies); this is a dry run — nothing is created`,
      ...identities.map(
        (identity) =>
          `  would declare ${identity.email} (${identity.role})${plan.already.some((entry) => entry.email === identity.email) ? " — already created by an earlier run" : ""}`,
      ),
      "  re-run with --apply to create them through this branch's sign-up endpoint",
    ];
    process.stdout.write(`${lines.join("\n")}\n`);
    return 0;
  }

  const created = [...ledger.created];
  for (const identity of plan.declare) {
    const userId = await createIdentity(identity);
    created.push({ email: identity.email, userId, package: file });
    writeLedger({ created }, ledgerPath);
    process.stdout.write(`  created ${identity.email} (${identity.role})\n`);
  }
  process.stdout.write(
    `created ${plan.declare.length} identity(ies); the ledger is ${displayPath(ledgerPath)} — \`pnpm bundle:identities <file> --cleanup\` removes exactly these\n`,
  );
  return 0;
}

/** Exit status, not a throw: 0 ok, 1 refused, 2 how you called it. */
export async function main(argv: readonly string[]): Promise<number> {
  try {
    const [command, ...rest] = argv;
    if (command === "pack") return runPack(rest);
    if (command === "unpack") return runUnpack(rest);
    if (command === "identities") return await runIdentities(rest);
    throw usageError(command === undefined ? undefined : `unknown command "${command}"`);
  } catch (cause) {
    if (cause instanceof BundleError) {
      process.stderr.write(`${cause.lines.join("\n")}\n`);
      return cause.code === "usage" ? 2 : 1;
    }
    throw cause;
  }
}

if (require.main === module) {
  void main(process.argv.slice(2)).then((code) => process.exit(code));
}
