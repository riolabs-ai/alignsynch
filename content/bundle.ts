/**
 * The bundle — one RECORD, portable (#147).
 *
 * Four templates and four instances live in `data/assessments.ts`, compiled into the
 * build. That is a fine store for this repository and a useless one for anybody else: a
 * tenant cannot produce a template this repo can read, and this repo cannot hand a tenant
 * a dataset it can install. The bundle is the file in between — one versioned,
 * self-describing JSON document that carries a TEMPLATE, or a DEMO DATASET (templates,
 * instances, parties, opinions).
 *
 * **The payload is the schemas, not a copy of them.** A template bundle's payload is
 * `zAssessment`; a dataset bundle's payload is `zAssessment` records and
 * `zAssessmentInstance` records, exactly as `content/assessment.ts` defines them. There is
 * no second shape to drift, and the two rules a single record cannot see — a dataset's
 * ids/slugs are unique, and every instance is a copy of a template inside the same file —
 * are the ones `data:check` already runs (E1/E2/E31), reused through
 * `instanceTemplateProblems()` instead of re-implemented.
 *
 * **Canonical, so a round trip is byte-identical.** `parseBundle()` returns the
 * schema-parsed value — zod emits output keys in schema order, every assessment schema is
 * plain (no `.default()`, no `.transform()`), and every value (an ISO instant, an integer
 * score, a string) round-trips JSON losslessly — and `serializeBundle()` is
 * `JSON.stringify(value, null, 2) + "\n"` over that value. So a canonical bundle is a
 * fixed point: `serialize(parse(serialize(x))) === serialize(x)`. That one property is the
 * guarantee the CLI, the committed demo bundle and E32 all stand on, so `bundles.test.ts`
 * pins it and any future schema that adds a transform breaks the test before it breaks a
 * bundle.
 *
 * **No timestamp, and nowhere to hide a secret.** `appVersion` is provenance and is never
 * gated; `bundleVersion` is the one format gate, because a build that half-reads a newer
 * file is worse than one that refuses it. There is no `exportedAt` field: a clock reading
 * would make two exports of the same records differ, which is exactly what the round trip
 * forbids. Every object in the envelope and the payload is `strict()`, so an unknown key is
 * a validation error — and `forbiddenKeyProblems()` refuses a key that names a credential
 * (`token`, `secret`, `password`, `apiKey`, `key`, …) even in a document whose schema would
 * already reject it. That redundancy is deliberate: it is the policy, and it outlives the
 * current shape of the schemas.
 *
 * The codes here are `B1`–`B4`/`B6`; `B5` (a template import colliding with the active
 * store) needs a store to collide with, so it is minted in `scripts/bundles.ts`. All six
 * live in `scripts/rule-codes.ts` with one owner each, the same way the `E` codes do.
 *
 * **`bundleVersion: 2` — the platform package (#899).** One bundle could carry records; a
 * tenant also needs the *configuration* around them, the people the demo flow signs in as,
 * the media those records render, and a statement of which build the file belongs to. That
 * is `kind: "platform"`: `content` (the same `zAssessment` / `zAssessmentInstance` schemas,
 * never a copy), `config` (plans, prices, flags, options — an additive plain schema), `identities`
 * (`{ email, displayName, role }` — **declared, never copied**: there is no password, hash or
 * session field, and `B4` refuses one even if a future schema grows a place to put it),
 * `media` (a path and its hash; the bytes ride in the container, not in the JSON) and `build`
 * (`appVersion`, `schemaVersion`, `lockfileSha256` — what the package was made from, so an
 * import can refuse a target that is not that build).
 *
 * Version 2 is additive and **version 1 still reads**: `PARSEABLE_BUNDLE_VERSIONS` is `[1, 2]`,
 * and a v2 document must be `kind: "platform"` the way a v1 document must be a template or a
 * dataset. Nothing in the v1 shape moved, so the committed demo bundle and E32 did not change.
 */
import { z } from "zod";
import { pathOf } from "./core";
import {
  instanceTemplateProblems,
  zAssessment,
  zAssessmentInstance,
  type Assessment,
  type AssessmentInstance,
} from "./assessment";

/* ------------------------------------------------------------------ *
 * The envelope
 * ------------------------------------------------------------------ */

/** The one document type this build reads and writes. */
export const BUNDLE_FORMAT = "alignsynch-bundle" as const;

/**
 * The version `export` writes for a template or a dataset — unchanged since #147, and the
 * version the committed demo bundle carries.
 */
export const BUNDLE_VERSION = 1 as const;

/** The version the platform package writes (#899). Additive: v1 documents still parse. */
export const PLATFORM_BUNDLE_VERSION = 2 as const;

/**
 * The versions this build reads, and the one gate. A reader that does not know the number
 * refuses the file (`B6`) instead of half-reading it; `appVersion` below says which build
 * wrote it and is provenance, never a refusal — except in a platform package, where `build`
 * carries the `schemaVersion` and `lockfileSha256` that are a refusal (`B7`, in
 * `scripts/bundle-platform.ts`).
 */
export const PARSEABLE_BUNDLE_VERSIONS = [BUNDLE_VERSION, PLATFORM_BUNDLE_VERSION] as const;

export type BundleVersion = (typeof PARSEABLE_BUNDLE_VERSIONS)[number];

/** What a bundle carries: one TEMPLATE, a DEMO DATASET, or the whole PLATFORM (#899). */
export const zBundleKind = z.enum(["template", "dataset", "platform"]);

export type BundleKind = z.infer<typeof zBundleKind>;

/** The kinds each version may carry — a v1 platform and a v2 dataset are both refusals. */
export function bundleKindsFor(version: number): readonly BundleKind[] {
  return version === PLATFORM_BUNDLE_VERSION ? ["platform"] : ["template", "dataset"];
}

/**
 * The envelope every v1 bundle carries, and nothing else: `strict()`, so a key this build
 * does not know is a refusal rather than a field that silently fails to travel.
 */
export const zBundleEnvelope = z
  .object({
    format: z.literal(BUNDLE_FORMAT),
    bundleVersion: z.literal(BUNDLE_VERSION),
    kind: zBundleKind,
    /** Provenance, not a gate: the `package.json` version of the build that wrote it. */
    appVersion: z.string().min(1),
  })
  .strict();

export type BundleEnvelope = z.infer<typeof zBundleEnvelope>;

/** The version-2 envelope: the same four keys, `bundleVersion: 2`, `kind: "platform"`. */
export const zPlatformEnvelope = z
  .object({
    format: z.literal(BUNDLE_FORMAT),
    bundleVersion: z.literal(PLATFORM_BUNDLE_VERSION),
    kind: z.literal("platform"),
    appVersion: z.string().min(1),
  })
  .strict();

export type PlatformEnvelope = z.infer<typeof zPlatformEnvelope>;

/* ------------------------------------------------------------------ *
 * The payload — the model's own schemas
 * ------------------------------------------------------------------ */

/**
 * A DEMO DATASET's payload: the templates, and the instances that copy them. At least one
 * template — a dataset with none installs nothing — and any number of instances. Further
 * rules need the whole payload, so they run in `datasetCollectionProblems()` below.
 */
export const zDatasetPayload = z
  .object({
    templates: z.array(zAssessment).min(1),
    instances: z.array(zAssessmentInstance),
  })
  .strict();

export type DatasetPayload = z.infer<typeof zDatasetPayload>;

export const zTemplateBundleObject = zBundleEnvelope
  .extend({
    kind: z.literal("template"),
    payload: zAssessment,
  })
  .strict();

/** A template bundle: one template, and nothing that needs collection rules. */
export const zTemplateBundle = zTemplateBundleObject;

export type TemplateBundle = z.infer<typeof zTemplateBundleObject>;

export const zDatasetBundleObject = zBundleEnvelope
  .extend({
    kind: z.literal("dataset"),
    payload: zDatasetPayload,
  })
  .strict();

/**
 * A dataset bundle is a self-contained store, so it answers the collection questions a
 * record cannot: `datasetCollectionProblems()` — the same shape as `data:check`'s E1/E2/E31
 * over the fixtures, applied to one file.
 */
export const zDatasetBundle = zDatasetBundleObject.superRefine((bundle, ctx) => {
  for (const issue of datasetCollectionProblems(bundle.payload)) {
    ctx.addIssue({
      code: "custom",
      path: ["payload", ...issue.path],
      message: `[${issue.code}] ${issue.message}`,
    });
  }
});

export type DatasetBundle = z.infer<typeof zDatasetBundleObject>;

/* ------------------------------------------------------------------ *
 * The platform payload — records, config, declarations, media, build (#899)
 * ------------------------------------------------------------------ */

/**
 * The content group: exactly the dataset payload's two arrays, at the root of the platform
 * payload rather than under `payload`. Parties, Aspects and Opinions travel *inside* an
 * instance — they are `zAssessmentInstance`'s own fields — so there is no third copy of them
 * here, and no place for one to drift.
 */
export const zPlatformContent = z
  .object({
    templates: z.array(zAssessment).min(1),
    instances: z.array(zAssessmentInstance),
  })
  .strict();

export type PlatformContent = z.infer<typeof zPlatformContent>;

/**
 * A plan, versioned with the package. Written here rather than imported from
 * `data/billing-plans.ts` because `content/` is the model and `data/` is a tenant's values —
 * the projection lives in `scripts/bundle-platform.ts`, the shape lives here.
 *
 * Every schema in this payload is **plain**: no `.default()`, no `.transform()`. The canonical
 * serializer depends on it (a default would fill a field the file did not carry, and the
 * round trip would no longer be a fixed point).
 */
export const zPlatformPlan = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    monthlyCents: z.number().int().nonnegative(),
    yearlyCents: z.number().int().nonnegative(),
    features: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
  })
  .strict();

export type PlatformPlan = z.infer<typeof zPlatformPlan>;

/** One price row: a plan at an interval. The same projection `billing_plan` stores. */
export const zPlatformPrice = z
  .object({
    planId: z.string().min(1),
    interval: z.enum(["month", "year"]),
    amountCents: z.number().int().nonnegative(),
  })
  .strict();

export type PlatformPrice = z.infer<typeof zPlatformPrice>;

/** A flag and what it ships as — the decision, not the resolver (`lib/flags.ts`). */
export const zPlatformFlag = z
  .object({
    name: z.string().min(1),
    default: z.boolean(),
    templates: z.array(z.string().min(1)),
    note: z.string(),
  })
  .strict();

export type PlatformFlag = z.infer<typeof zPlatformFlag>;

/**
 * An option and its values: a closed list the content or a screen reads (mode, setting, …).
 *
 * The name field is `option`, not `key`, on purpose: `key` is on the forbidden-key list (`B4`)
 * because a credential lives under that name far more often than a value list does, and the
 * policy beats the convenience of a shorter field name.
 */
export const zPlatformOption = z
  .object({
    option: z.string().min(1),
    values: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type PlatformOption = z.infer<typeof zPlatformOption>;

export const zPlatformConfig = z
  .object({
    plans: z.array(zPlatformPlan),
    prices: z.array(zPlatformPrice),
    flags: z.array(zPlatformFlag),
    options: z.array(zPlatformOption),
  })
  .strict();

export type PlatformConfig = z.infer<typeof zPlatformConfig>;

/**
 * A declared identity — three facts and no fourth. Somebody the target creates through its
 * own sign-up endpoint, which is what `pnpm db:seed` does; a password is generated on the
 * target and never travels. `strict()` here plus `B4` over the whole document is the belt and
 * the braces: neither the shape nor the policy has a place for a credential.
 */
export const zPlatformIdentity = z
  .object({
    email: z.email(),
    /** The name the relationship's party rows carry, so a demo sign-in shows the right person. */
    displayName: z.string().min(1),
    role: z.enum(["member", "admin"]),
  })
  .strict();

export type PlatformIdentity = z.infer<typeof zPlatformIdentity>;

/**
 * A media entry: where it sits in the container, and what its bytes hash to. The bytes are in
 * the zip under `media/`, not in this JSON — a base64 blob would make the canonical document
 * large and the diff unreadable.
 */
export const zPlatformMedia = z
  .object({
    path: z.string().min(1),
    sha256: z.string().regex(/^[0-9a-f]{64}$/, "a media entry carries the file's sha256"),
    bytes: z.number().int().nonnegative(),
  })
  .strict();

export type PlatformMedia = z.infer<typeof zPlatformMedia>;

/**
 * The build a package belongs to. `appVersion` is provenance, `schemaVersion` is the highest
 * migration the source tree carried and `lockfileSha256` is the dependency set — the last two
 * are what an import compares against its own tree and refuses on (`B7`).
 */
export const zBundleBuild = z
  .object({
    appVersion: z.string().min(1),
    schemaVersion: z.number().int().nonnegative(),
    lockfileSha256: z.string().regex(/^[0-9a-f]{64}$/, "build.lockfileSha256 is a sha256"),
  })
  .strict();

export type BundleBuild = z.infer<typeof zBundleBuild>;

export const zPlatformPayload = z
  .object({
    content: zPlatformContent,
    config: zPlatformConfig,
    identities: z.array(zPlatformIdentity),
    media: z.array(zPlatformMedia),
    build: zBundleBuild,
  })
  .strict();

export type PlatformPayload = z.infer<typeof zPlatformPayload>;

export const zPlatformBundleObject = zPlatformEnvelope
  .extend({ payload: zPlatformPayload })
  .strict();

/** A platform package: the records, the config, the declarations, the media index, the build. */
export const zPlatformBundle = zPlatformBundleObject.superRefine((bundle, ctx) => {
  for (const issue of platformPayloadProblems(bundle.payload)) {
    ctx.addIssue({
      code: "custom",
      path: ["payload", ...issue.path],
      message: `[${issue.code}] ${issue.message}`,
    });
  }
});

export type PlatformBundle = z.infer<typeof zPlatformBundleObject>;

export type Bundle = TemplateBundle | DatasetBundle | PlatformBundle;

/* ------------------------------------------------------------------ *
 * Codes and issues
 * ------------------------------------------------------------------ */

/**
 * The codes a bundle can fail with, each naming one rule:
 *
 *   B1  envelope shape — not one JSON object, a bad `format`/`kind`, an unknown top-level key
 *   B2  payload record — a `zAssessment` / `zAssessmentInstance` issue, path included
 *   B3  dataset collection — ids or slugs twice, a `templateId` outside the file, a copy that drifted
 *   B4  forbidden key — a key that names a credential, wherever it sits
 *   B6  `bundleVersion` — this build reads 1 and 2
 *   B7  build identity — the package's `schemaVersion` / `lockfileSha256` is not this tree's
 *   B8  a package that drops a record something it keeps still references (a persona its
 *       relationships name, media a record renders)
 *
 * B5 is minted by `scripts/bundles.ts`: it is about the *store* the bundle is imported into,
 * and a bundle on its own cannot violate it. B7 and B8 are minted by
 * `scripts/bundle-platform.ts`: they compare a package with the tree it is opened on, which a
 * document alone cannot do.
 */
export type BundleIssueCode = "B1" | "B2" | "B3" | "B4" | "B6" | "B7" | "B8";

/** One refusal, shaped like a zod issue so a caller formats one way whatever fired. */
export interface BundleIssue {
  readonly code: BundleIssueCode;
  /** Where in the document, as a path into the bundle: `payload.templates[0].parties`. */
  readonly path: readonly (string | number)[];
  readonly message: string;
}

/**
 * One printed line, `[B3] payload.instances: instance "x" names template "y", …`.
 *
 * Takes any code, not only this module's: `B5` is minted by `scripts/bundles.ts` (a template
 * import colliding with the active store), and one line format is the point.
 */
export function formatBundleIssue(issue: {
  readonly code: string;
  readonly path: readonly (string | number)[];
  readonly message: string;
}): string {
  const where = issue.path.length === 0 ? "bundle" : issue.path.join(".");
  return `[${issue.code}] ${where}: ${issue.message}`;
}

/* ------------------------------------------------------------------ *
 * B3 — the collection rules a dataset answers
 * ------------------------------------------------------------------ */

/**
 * A dataset is one store in one file, so the identity and copy rules hold inside it:
 * an id names one record, `type/slug` names one record per collection (the split E2 makes —
 * a template and an instance keep separate URL spaces), every `templateId` resolves here,
 * and every instance's Aspects are its template's. The last two are
 * `instanceTemplateProblems()`, the same function E31 runs, so "a dataset is
 * self-contained" is one rule and not a second implementation of one.
 */
export function datasetCollectionProblems(payload: {
  readonly templates: readonly Assessment[];
  readonly instances: readonly AssessmentInstance[];
}): BundleIssue[] {
  const issues: BundleIssue[] = [];
  const seenIds = new Map<string, string>();

  const claim = (
    id: string,
    label: string,
    path: readonly (string | number)[],
    what: "id" | "slug",
  ) => {
    const owner = seenIds.get(`${what}\u0000${id}`);
    if (owner !== undefined) {
      issues.push({
        code: "B3",
        path,
        message:
          what === "id"
            ? `id "${id}" is used by both ${owner} and ${label} — a bundle is one store, so an id names one record`
            : `"${id}" is the identity of both ${owner} and ${label} — a slug is URL identity, and two records cannot share one`,
      });
      return;
    }
    seenIds.set(`${what}\u0000${id}`, label);
  };

  payload.templates.forEach((template, index) => {
    claim(template.id, `payload.templates[${index}]`, ["templates", index, "id"], "id");
    claim(
      `${template.type}/${template.slug}`,
      `payload.templates[${index}]`,
      ["templates", index, "slug"],
      "slug",
    );
  });
  payload.instances.forEach((instance, index) => {
    claim(instance.id, `payload.instances[${index}]`, ["instances", index, "id"], "id");
    claim(
      `${instance.type}/${instance.slug}`,
      `payload.instances[${index}]`,
      ["instances", index, "slug"],
      "slug",
    );
    // The id claim above already covers every instance; a slug is only compared inside
    // the instance collection, so a template and an instance may share one — E2's split.
  });

  for (const problem of instanceTemplateProblems(payload.templates, payload.instances)) {
    issues.push({ code: "B3", path: ["instances"], message: problem });
  }

  return issues;
}

/* ------------------------------------------------------------------ *
 * B3 / B8 — the platform payload's own references
 * ------------------------------------------------------------------ */

/**
 * What a platform payload has to satisfy that a single record cannot see:
 *
 *   B3  the content is one store — the dataset rules, reused, not re-implemented; and no two
 *       declarations or config rows share an identity (two identities with one email, a plan
 *       id twice, a flag name twice, an option key twice, a media path twice)
 *   B8  every reference resolves *inside the package* — a price names a plan in it, an
 *       instance names a template in it, and media paths are relative, inside `media/`, and
 *       hash-addressed
 *
 * B8 here is the static half. The half that needs a whole dataset — "this subset dropped a
 * persona that a relationship it kept still names" — lives in `scripts/bundle-platform.ts`,
 * because only the packer knows what was dropped.
 */
export function platformPayloadProblems(payload: {
  readonly content: PlatformContent;
  readonly config: PlatformConfig;
  readonly identities: readonly PlatformIdentity[];
  readonly media: readonly PlatformMedia[];
}): BundleIssue[] {
  const issues: BundleIssue[] = [...datasetCollectionProblems(payload.content)];

  const once = (
    key: string,
    label: string,
    path: readonly (string | number)[],
    seen: Map<string, string>,
  ) => {
    const owner = seen.get(key);
    if (owner !== undefined) {
      issues.push({
        code: "B3",
        path,
        message: `"${key}" is declared by both ${owner} and ${label} — one identity, one declaration`,
      });
      return;
    }
    seen.set(key, label);
  };

  const identities = new Map<string, string>();
  payload.identities.forEach((identity, index) => {
    once(identity.email, `identities[${index}]`, ["identities", index, "email"], identities);
  });

  const plans = new Map<string, string>();
  payload.config.plans.forEach((plan, index) => {
    once(plan.id, `config.plans[${index}]`, ["config", "plans", index, "id"], plans);
  });

  const flags = new Map<string, string>();
  payload.config.flags.forEach((flag, index) => {
    once(flag.name, `config.flags[${index}]`, ["config", "flags", index, "name"], flags);
  });

  const options = new Map<string, string>();
  payload.config.options.forEach((option, index) => {
    once(
      option.option,
      `config.options[${index}]`,
      ["config", "options", index, "option"],
      options,
    );
  });

  const prices = new Map<string, string>();
  payload.config.prices.forEach((price, index) => {
    once(
      `${price.planId}/${price.interval}`,
      `config.prices[${index}]`,
      ["config", "prices", index],
      prices,
    );
    if (!payload.config.plans.some((plan) => plan.id === price.planId)) {
      issues.push({
        code: "B8",
        path: ["config", "prices", index, "planId"],
        message: `price names plan "${price.planId}", which this package does not carry — a price without a plan cannot be installed`,
      });
    }
  });

  const media = new Map<string, string>();
  payload.media.forEach((entry, index) => {
    once(entry.path, `media[${index}]`, ["media", index, "path"], media);
    if (
      !entry.path.startsWith("media/") ||
      entry.path.includes("..") ||
      entry.path.includes("\\")
    ) {
      issues.push({
        code: "B8",
        path: ["media", index, "path"],
        message: `"${entry.path}" is not a relative path under media/ — the container has one media directory, and an entry cannot escape it`,
      });
    }
  });

  return issues;
}

/* ------------------------------------------------------------------ *
 * B4 — no key that names a credential, anywhere
 * ------------------------------------------------------------------ */

/**
 * The keys a bundle may never carry, whatever a future schema says. Redundant with
 * `strict()` today — an unknown key is already an error — and meant to stay that way: this
 * is the policy, not a consequence of the current shape. `key` and `pin` are matched exactly
 * (a domain key and a four-digit secret are words, not fragments), the rest as substrings of
 * a key name: `secret`, `token`, `apiKey`/`api-key`, `password` (which is also `passwordHash`),
 * `credential`, `privateKey`/`private-key`.
 */
const FORBIDDEN_KEY = /(^key$|^pin$|secret|token|api-?key|password|credential|private-?key)/i;

/** Every forbidden key in a document, at any depth, each naming its path. */
export function forbiddenKeyProblems(
  value: unknown,
  path: readonly (string | number)[] = [],
): BundleIssue[] {
  const issues: BundleIssue[] = [];

  const walk = (node: unknown, at: readonly (string | number)[]): void => {
    if (Array.isArray(node)) {
      node.forEach((child, index) => {
        walk(child, [...at, index]);
      });
      return;
    }
    if (node === null || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      const next = [...at, key];
      if (FORBIDDEN_KEY.test(key)) {
        issues.push({
          code: "B4",
          path: next,
          message: `forbidden key "${key}" — a bundle carries content, never a credential; no schema has such a field, and this rule refuses one anyway`,
        });
      }
      walk(child, next);
    }
  };

  walk(value, path);
  return issues;
}

/* ------------------------------------------------------------------ *
 * B1 / B2 / B3 / B4 / B6 — read one document
 * ------------------------------------------------------------------ */

/**
 * The envelope with the payload left opaque, so "the envelope is wrong" and "a record is
 * wrong" are two errors with two codes instead of one zod dump. Two shapes, one per version:
 * a v2 document is an envelope with `kind: "platform"`, and it is checked by the v2 schema so
 * a v1-only key cannot slip through it (or the reverse).
 */
const zV1EnvelopeShape = zBundleEnvelope.extend({ payload: z.unknown() }).strict();
const zV2EnvelopeShape = zPlatformEnvelope.extend({ payload: z.unknown() }).strict();

export type BundleParseResult =
  | { readonly ok: true; readonly bundle: Bundle }
  | { readonly ok: false; readonly issues: readonly BundleIssue[] };

function failure(issues: readonly BundleIssue[]): BundleParseResult {
  return { ok: false, issues };
}

/**
 * One zod issue as bundle issues. A `strict()` refusal arrives as **one** issue for the whole
 * object, with the unknown key names in a list — so it is expanded into one issue per key,
 * whose path points at the key a person has to delete rather than at the object that carried
 * it.
 */
function zodIssues(
  issues: readonly z.ZodIssue[],
  code: "B1" | "B2",
  prefix: readonly (string | number)[],
): BundleIssue[] {
  const mapped: BundleIssue[] = [];
  for (const issue of issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) {
        mapped.push({
          code,
          path: [...prefix, ...pathOf(issue), key],
          message: `unknown key "${key}" — a bundle carries exactly what the schema defines (every object is strict)`,
        });
      }
      continue;
    }
    mapped.push({ code, path: [...prefix, ...pathOf(issue)], message: issue.message });
  }
  return mapped;
}

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * Parse one bundle from text. Never throws: every refusal is an issue with a code and a
 * path, collected rather than thrown, the way `data:check` collects its diagnostics — so a
 * file with three malformed records reports three paths and not just the first.
 *
 * Order is deliberate. JSON, then the version (a build must say "format 2" rather than
 * report forty payload errors from a document it cannot read), then forbidden keys (a
 * credential is refused before anything else looks at the document — and a payload key the
 * schema would also reject is reported as B4, which is the policy, not B2, which is the
 * schema), then the envelope, then the payload, then the collection rules.
 */
export function parseBundle(text: string): BundleParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    return failure([{ code: "B1", path: [], message: `not JSON — ${messageOf(cause)}` }]);
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return failure([{ code: "B1", path: [], message: "a bundle is one JSON object" }]);
  }

  const version = (raw as Record<string, unknown>).bundleVersion;
  if (
    typeof version === "number" &&
    !(PARSEABLE_BUNDLE_VERSIONS as readonly number[]).includes(version)
  ) {
    return failure([
      {
        code: "B6",
        path: ["bundleVersion"],
        message: `bundleVersion ${version}: this build reads ${PARSEABLE_BUNDLE_VERSIONS.join(" and ")}`,
      },
    ]);
  }

  const forbidden = forbiddenKeyProblems(raw);
  if (forbidden.length > 0) return failure(forbidden);

  if (version === PLATFORM_BUNDLE_VERSION) {
    const shape = zV2EnvelopeShape.safeParse(raw);
    if (!shape.success) return failure(zodIssues(shape.error.issues, "B1", []));

    const platform = zPlatformPayload.safeParse(shape.data.payload);
    if (!platform.success) return failure(zodIssues(platform.error.issues, "B2", ["payload"]));

    const problems = platformPayloadProblems(platform.data);
    if (problems.length > 0) return failure(problems);

    return {
      ok: true,
      bundle: {
        format: shape.data.format,
        bundleVersion: PLATFORM_BUNDLE_VERSION,
        kind: "platform",
        appVersion: shape.data.appVersion,
        payload: platform.data,
      },
    };
  }

  const shape = zV1EnvelopeShape.safeParse(raw);
  if (!shape.success) {
    return failure(zodIssues(shape.error.issues, "B1", []));
  }

  const envelope = shape.data;

  if (envelope.kind === "platform") {
    return failure([
      {
        code: "B6",
        path: ["bundleVersion"],
        message: `kind "platform" is bundleVersion ${PLATFORM_BUNDLE_VERSION}, and this file says ${BUNDLE_VERSION}`,
      },
    ]);
  }

  const payloadSchema = envelope.kind === "template" ? zAssessment : zDatasetPayload;
  const payload = payloadSchema.safeParse(envelope.payload);
  if (!payload.success) {
    return failure(zodIssues(payload.error.issues, "B2", ["payload"]));
  }

  if (envelope.kind === "template") {
    return {
      ok: true,
      bundle: {
        format: envelope.format,
        bundleVersion: BUNDLE_VERSION,
        kind: "template",
        appVersion: envelope.appVersion,
        payload: payload.data as Assessment,
      },
    };
  }

  const collection = datasetCollectionProblems(payload.data as DatasetPayload);
  if (collection.length > 0) return failure(collection);

  return {
    ok: true,
    bundle: {
      format: envelope.format,
      bundleVersion: BUNDLE_VERSION,
      kind: "dataset",
      appVersion: envelope.appVersion,
      payload: payload.data as DatasetPayload,
    },
  };
}

/**
 * The canonical writer: schema key order, two-space indent, one trailing newline, over the
 * **parsed** value. A canonical bundle is a fixed point of `serialize(parse(…))`, which is
 * what makes export → import → export byte-identical and what E32 compares.
 */
export function serializeBundle(bundle: Bundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

/**
 * The same writer for a dataset **payload** — what the tenant store holds
 * (`data/generated/assessments.json`). It is the payload and not an envelope because the
 * store is a store, not a file somebody mailed: `appVersion` and the format gate belong to
 * the document that travels, and `readStore()` validates this shape.
 */
export function serializeDatasetPayload(payload: DatasetPayload): string {
  return `${JSON.stringify(
    { templates: payload.templates, instances: payload.instances },
    null,
    2,
  )}\n`;
}

/* ------------------------------------------------------------------ *
 * The demo dataset
 * ------------------------------------------------------------------ */

/**
 * The fixtures as a dataset bundle — the artifact a tenant installs, and the file E32
 * holds the committed bundle to. `appVersion` is an argument because this module is pure:
 * the build version is read from `package.json` by the CLI (`scripts/bundles.ts`), not by
 * the content model.
 *
 * Built through `parseBundle()` on purpose, so the bundle that ships is the bundle the
 * importer validates, and a fixture set that cannot form a dataset fails here with B-code
 * paths instead of writing a file nobody can import.
 */
export function canonicalDemoBundle(
  templates: readonly Assessment[],
  instances: readonly AssessmentInstance[],
  appVersion: string,
): DatasetBundle {
  const envelope = {
    format: BUNDLE_FORMAT,
    bundleVersion: BUNDLE_VERSION,
    kind: "dataset" as const,
    appVersion,
    payload: { templates: [...templates], instances: [...instances] },
  };

  const parsed = parseBundle(JSON.stringify(envelope));
  if (!parsed.ok) {
    throw new Error(
      `the demo fixtures do not form a dataset bundle:\n${parsed.issues.map(formatBundleIssue).join("\n")}`,
    );
  }
  if (parsed.bundle.kind !== "dataset") {
    throw new Error("the demo fixtures parsed as a template bundle, not a dataset");
  }
  return parsed.bundle;
}
