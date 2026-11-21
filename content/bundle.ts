/**
 * The bundle — one RECORD, portable (#147).
 *
 * Four templates and four sessions live in `data/assessments.ts`, compiled into the
 * build. That is a fine store for this repository and a useless one for anybody else: a
 * tenant cannot produce a template this repo can read, and this repo cannot hand a tenant
 * a dataset it can install. The bundle is the file in between — one versioned,
 * self-describing JSON document that carries a TEMPLATE, or a DEMO DATASET (templates,
 * sessions, parties, opinions).
 *
 * **The payload is the schemas, not a copy of them.** A template bundle's payload is
 * `zAssessment`; a dataset bundle's payload is `zAssessment` records and
 * `zAssessmentSession` records, exactly as `content/assessment.ts` defines them. There is
 * no second shape to drift, and the two rules a single record cannot see — a dataset's
 * ids/slugs are unique, and every session is a copy of a template inside the same file —
 * are the ones `data:check` already runs (E1/E2/E31), reused through
 * `sessionTemplateProblems()` instead of re-implemented.
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
 * **No timestamp, and nowhere to hide a secret.** `appVersion` is provenance — it says which
 * build made the file — and E32 holds the committed demo bundle's stamp equal to
 * `package.json` (`pnpm bundles export --dataset --fix` re-stamps it; the stamp is never edited
 * by hand), because an import that is told the wrong build is told a lie. `bundleVersion` is the
 * one *format* gate, because a build that half-reads a newer
 * file is worse than one that refuses it. There is no `exportedAt` field: a clock reading
 * would make two exports of the same records differ, which is exactly what the round trip
 * forbids. Every object in the envelope and the payload is `strict()`, so an unknown key is
 * a validation error — and `forbiddenKeyProblems()` refuses a key that names a credential
 * (`token`, `secret`, `password`, `apiKey`, `key`, …) even in a document whose schema would
 * already reject it. That redundancy is deliberate: it is the policy, and it outlives the
 * current shape of the schemas.
 *
 * The codes here are `B1`–`B4`/`B6`/`B9`; `B5` (a template import colliding with the active
 * store) needs a store to collide with, so it is minted in `scripts/bundles.ts`. All nine
 * live in `scripts/rule-codes.ts` with one owner each, the same way the `E` codes do.
 *
 * **`bundleVersion: 2` — the platform package (#899).** One bundle could carry records; a
 * tenant also needs the *configuration* around them, the people the demo flow signs in as,
 * the media those records render, and a statement of which build the file belongs to. That
 * is `kind: "platform"`: `content` (the same `zAssessment` / `zAssessmentSession` schemas,
 * never a copy), `config` (plans, prices, flags, options — an additive plain schema), `identities`
 * (`{ email, displayName, role }` — **declared, never copied**: there is no password, hash or
 * session field, and `B4` refuses one even if a future schema grows a place to put it),
 * `media` (a path and its hash; the bytes ride in the container, not in the JSON) and `build`
 * (`appVersion`, `schemaVersion`, `lockfileSha256` — what the package was made from, so an
 * import can refuse a target that is not that build).
 *
 * Version 2 is additive and **version 1 still reads**: a v2 document must be `kind: "platform"`
 * the way a v1 document must be a template or a dataset. Nothing in the v1 shape moved, so the
 * committed demo bundle and E32 did not change.
 *
 * **`bundleVersion: 3` — the record arrays say `sessions` (#1103 phase 3).** Sessions are the
 * product's noun, and the file format was the last place still spelling the retired one. A
 * version-3 dataset carries `payload.sessions`; the version-1 key is **read and never written**
 * — a bundle exported before this cut still imports (the CLI prints one deprecation line), is
 * normalized to the new shape in memory, and the next export of it is a v3 document. There are
 * exactly three readings and each is one rule:
 *
 *   - **v3 + `payload.sessions`** — the format this build writes.
 *   - **v1 + the legacy key** — tolerated for one release, so a stored file is not a silent
 *     break. `LEGACY_BUNDLE_VERSION` names it, and `parseBundle()` marks the result `legacy`.
 *   - **anything else** — `B9`: the version and the record-array key must agree. A document
 *     carrying **both** keys is that same refusal, because an ambiguous file has no reading at
 *     all and picking one would be a guess about which half of it is newer.
 *
 * The row ids did not move (`assessment-instance-*` are keys in the database, in relationships
 * and in the atlas fixtures): vocabulary moved, identity did not.
 */
import { z } from "zod";
import { pathOf } from "./core";
import {
  sessionTemplateProblems,
  zAssessment,
  zAssessmentSession,
  type Assessment,
  type AssessmentSession,
} from "./assessment";

/* ------------------------------------------------------------------ *
 * The envelope
 * ------------------------------------------------------------------ */

/** The one document type this build reads and writes. */
export const BUNDLE_FORMAT = "alignsynch-bundle" as const;

/**
 * The version `export` writes for a template or a dataset: the record arrays under
 * `payload.sessions` (#1103 phase 3). Bumped from 1 so a reader can tell the two shapes apart
 * without sniffing keys, and so a v1 file is a version this build recognises rather than a
 * file it half-reads.
 */
export const BUNDLE_VERSION = 3 as const;

/**
 * The version #147 shipped, and the **only** one that spells the record arrays
 * `payload.instances`. This build reads it and never writes it — see the module docstring —
 * and `LEGACY_BUNDLE_VERSION` exists so the tolerance has a name a test can point at instead
 * of a bare `1`.
 */
export const LEGACY_BUNDLE_VERSION = 1 as const;

/** The version the platform package writes (#899). Additive: v1 documents still parse. */
export const PLATFORM_BUNDLE_VERSION = 2 as const;

/**
 * The versions this build reads, and the one gate. A reader that does not know the number
 * refuses the file (`B6`) instead of half-reading it; `appVersion` below says which build
 * wrote it and is provenance, never a refusal — except in a platform package, where `build`
 * carries the `schemaVersion` and `lockfileSha256` that are a refusal (`B7`, in
 * `scripts/bundle-platform.ts`).
 */
export const PARSEABLE_BUNDLE_VERSIONS = [
  LEGACY_BUNDLE_VERSION,
  PLATFORM_BUNDLE_VERSION,
  BUNDLE_VERSION,
] as const;

export type BundleVersion = (typeof PARSEABLE_BUNDLE_VERSIONS)[number];

/** `1`, `2` and `3` — the list as a person reads it, in one place so `B6` cannot drift. */
export function parseableVersionList(): string {
  const versions = PARSEABLE_BUNDLE_VERSIONS.map(String);
  return `${versions.slice(0, -1).join(", ")} and ${versions[versions.length - 1]}`;
}

/** What a bundle carries: one TEMPLATE, a DEMO DATASET, or the whole PLATFORM (#899). */
export const zBundleKind = z.enum(["template", "dataset", "platform"]);

export type BundleKind = z.infer<typeof zBundleKind>;

/** The kinds each version may carry — a v2 platform and a v2 dataset are both refusals. */
export function bundleKindsFor(version: number): readonly BundleKind[] {
  return version === PLATFORM_BUNDLE_VERSION ? ["platform"] : ["template", "dataset"];
}

/**
 * The envelope every current bundle carries, and nothing else: `strict()`, so a key this build
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

/**
 * The version-1 envelope: the same four keys and `kind`, with `bundleVersion: 1`. Read-only —
 * `export` writes `zBundleEnvelope`.
 */
export const zLegacyBundleEnvelope = zBundleEnvelope
  .extend({ bundleVersion: z.literal(LEGACY_BUNDLE_VERSION) })
  .strict();

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
 * The key a version-1 dataset spelled the record arrays with. It is a **literal constant**
 * rather than a spelled-out field because there is exactly one place in this module that may
 * ever read it — the v1 branch of `parseBundle()` — and a second occurrence would be a second
 * reader of a format this build does not write.
 */
export const LEGACY_SESSIONS_KEY = "instances" as const;

/**
 * A DEMO DATASET's payload: the templates, and the sessions that copy them. At least one
 * template — a dataset with none installs nothing — and any number of sessions. Further
 * rules need the whole payload, so they run in `datasetCollectionProblems()` below.
 */
export const zDatasetPayload = z
  .object({
    templates: z.array(zAssessment).min(1),
    sessions: z.array(zAssessmentSession),
  })
  .strict();

export type DatasetPayload = z.infer<typeof zDatasetPayload>;

/**
 * The version-1 payload, read and never written: the same two arrays, the sessions under
 * `LEGACY_SESSIONS_KEY`. `parseBundle()` normalizes it to `DatasetPayload` before anything
 * else sees it, so no other module has to know there are two shapes.
 */
export const zLegacyDatasetPayload = z
  .object({
    templates: z.array(zAssessment).min(1),
    [LEGACY_SESSIONS_KEY]: z.array(zAssessmentSession),
  })
  .strict();

export type LegacyDatasetPayload = z.infer<typeof zLegacyDatasetPayload>;

/** A version-1 dataset payload as the current shape: the one line the tolerance costs. */
export function normalizeLegacyDatasetPayload(payload: LegacyDatasetPayload): DatasetPayload {
  return { templates: payload.templates, sessions: payload[LEGACY_SESSIONS_KEY] };
}

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
 * payload rather than under `payload`. Parties, Aspects and Opinions travel *inside* a
 * session — they are `zAssessmentSession`'s own fields — so there is no third copy of them
 * here, and no place for one to drift.
 */
export const zPlatformContent = z
  .object({
    templates: z.array(zAssessment).min(1),
    instances: z.array(zAssessmentSession),
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
 *   B2  payload record — a `zAssessment` / `zAssessmentSession` issue, path included
 *   B3  dataset collection — ids or slugs twice, a `templateId` outside the file, a copy that drifted
 *   B4  forbidden key — a key that names a credential, wherever it sits
 *   B6  `bundleVersion` — this build reads 1, 2 and 3
 *   B7  build identity — the package's `schemaVersion` / `lockfileSha256` is not this tree's
 *   B8  a package that drops a record something it keeps still references (a persona its
 *       relationships name, media a record renders)
 *   B9  the record-array key disagrees with the version — `payload.instances` under a v3
 *       document, `payload.sessions` under a v1 one, or both keys in one payload
 *
 * B5 is minted by `scripts/bundles.ts`: it is about the *store* the bundle is imported into,
 * and a bundle on its own cannot violate it. B7 and B8 are minted by
 * `scripts/bundle-platform.ts`: they compare a package with the tree it is opened on, which a
 * document alone cannot do.
 */
export type BundleIssueCode = "B1" | "B2" | "B3" | "B4" | "B6" | "B7" | "B8" | "B9";

/** One refusal, shaped like a zod issue so a caller formats one way whatever fired. */
export interface BundleIssue {
  readonly code: BundleIssueCode;
  /** Where in the document, as a path into the bundle: `payload.templates[0].parties`. */
  readonly path: readonly (string | number)[];
  readonly message: string;
}

/**
 * One printed line, `[B3] payload.sessions: session "x" names template "y", …`.
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
 * a template and a session keep separate URL spaces), every `templateId` resolves here,
 * and every session's Aspects are its template's. The last two are
 * `sessionTemplateProblems()`, the same function E31 runs, so "a dataset is
 * self-contained" is one rule and not a second implementation of one.
 *
 * `key` is the name the *document* gives the session array, used only for the label and the
 * path a person acts on: `sessions` in every bundle this build writes, and
 * `LEGACY_SESSIONS_KEY` for the two documents that still spell it the other way (a v1 dataset,
 * and a v2 platform package, whose content group has not moved). The rule is the same either
 * way — only the address of the offending row differs, and a path that named a key the file
 * does not carry would send somebody to the wrong line.
 */
export function datasetCollectionProblems(
  payload: {
    readonly templates: readonly Assessment[];
    readonly sessions: readonly AssessmentSession[];
  },
  key: string = "sessions",
): BundleIssue[] {
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
  payload.sessions.forEach((session, index) => {
    claim(session.id, `payload.${key}[${index}]`, [key, index, "id"], "id");
    claim(
      `${session.type}/${session.slug}`,
      `payload.${key}[${index}]`,
      [key, index, "slug"],
      "slug",
    );
    // The id claim above already covers every session; a slug is only compared inside
    // the session collection, so a template and a session may share one — E2's split.
  });

  for (const problem of sessionTemplateProblems(payload.templates, payload.sessions)) {
    issues.push({ code: "B3", path: [key], message: problem });
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
 *   B8  every reference resolves *inside the package* — a price names a plan in it, a
 *       session names a template in it, and media paths are relative, inside `media/`, and
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
  const issues: BundleIssue[] = [
    ...datasetCollectionProblems(
      { templates: payload.content.templates, sessions: payload.content[LEGACY_SESSIONS_KEY] },
      // A platform package is bundleVersion 2 and its content group has not moved, so a path
      // here names the key the document really carries.
      LEGACY_SESSIONS_KEY,
    ),
  ];

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
 * B1 / B2 / B3 / B4 / B6 / B9 — read one document
 * ------------------------------------------------------------------ */

/**
 * The envelope with the payload left opaque, so "the envelope is wrong" and "a record is
 * wrong" are two errors with two codes instead of one zod dump. One shape per version: v2 is
 * a platform envelope, v3 the current one, v1 the read-only predecessor — each checked by its
 * own schema so a key from another version cannot slip through it.
 */
const zCurrentEnvelopeShape = zBundleEnvelope.extend({ payload: z.unknown() }).strict();
const zLegacyEnvelopeShape = zLegacyBundleEnvelope.extend({ payload: z.unknown() }).strict();
const zV2EnvelopeShape = zPlatformEnvelope.extend({ payload: z.unknown() }).strict();

export type BundleParseResult =
  | {
      readonly ok: true;
      readonly bundle: Bundle;
      /**
       * The document was written before the sessions key: `bundleVersion: 1`, record array
       * under `LEGACY_SESSIONS_KEY`. The payload above is already normalized to the current
       * shape, so this flag is the whole of the tolerance — the CLI prints one deprecation
       * line with it, and nothing writes the old shape back.
       */
      readonly legacy?: true;
    }
  | { readonly ok: false; readonly issues: readonly BundleIssue[] };

function failure(issues: readonly BundleIssue[]): BundleParseResult {
  return { ok: false, issues };
}

/**
 * B9 — the version and the record-array key must agree.
 *
 * A `bundleVersion: 3` document carrying the legacy key is not "an old file wearing a new
 * number": it is a file somebody half-migrated, and reading it would either ignore a payload
 * or install one in a shape its own version says it is not. A payload carrying **both** keys is
 * the same refusal, because an ambiguous document has no single reading and picking one half is
 * a guess about which half is newer.
 *
 * This runs before the payload schema so the refusal is one named code with a path at the key,
 * rather than a `strict()` "unknown key" from whichever half happened to be second.
 */
function recordKeyProblems(raw: Record<string, unknown>, version: number): BundleIssue[] {
  if (raw.kind !== "dataset") return [];
  const payload = raw.payload;
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return [];

  const record = payload as Record<string, unknown>;
  const hasSessions = Object.hasOwn(record, "sessions");
  const hasLegacy = Object.hasOwn(record, LEGACY_SESSIONS_KEY);

  if (hasSessions && hasLegacy) {
    return [
      {
        code: "B9",
        path: ["payload"],
        message: `carries both payload.sessions and payload.${LEGACY_SESSIONS_KEY} — a bundle is one shape per version, and an ambiguous file has no reading rather than two`,
      },
    ];
  }
  if (version === BUNDLE_VERSION && hasLegacy) {
    return [
      {
        code: "B9",
        path: ["payload", LEGACY_SESSIONS_KEY],
        message: `bundleVersion ${BUNDLE_VERSION} carries payload.${LEGACY_SESSIONS_KEY} — this version spells the session array payload.sessions; only bundleVersion ${LEGACY_BUNDLE_VERSION} carried the old key, so either export the file again or correct its version`,
      },
    ];
  }
  if (version === LEGACY_BUNDLE_VERSION && hasSessions) {
    return [
      {
        code: "B9",
        path: ["payload", "sessions"],
        message: `bundleVersion ${LEGACY_BUNDLE_VERSION} carries payload.sessions — that key belongs to bundleVersion ${BUNDLE_VERSION}, and a v1 reader would silently install no sessions at all`,
      },
    ];
  }
  return [];
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
        message: `bundleVersion ${version}: this build reads ${parseableVersionList()}`,
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

  const legacy = version === LEGACY_BUNDLE_VERSION;

  // Before the payload schema: one named refusal with a path at the key, instead of a
  // `strict()` unknown-key from whichever of the two shapes happened to be read second.
  const keyProblems = recordKeyProblems(raw as Record<string, unknown>, version as number);
  if (keyProblems.length > 0) return failure(keyProblems);

  const shape = (legacy ? zLegacyEnvelopeShape : zCurrentEnvelopeShape).safeParse(raw);
  if (!shape.success) {
    return failure(zodIssues(shape.error.issues, "B1", []));
  }

  const envelope = shape.data;

  if (envelope.kind === "platform") {
    return failure([
      {
        code: "B6",
        path: ["bundleVersion"],
        message: `kind "platform" is bundleVersion ${PLATFORM_BUNDLE_VERSION}, and this file says ${version}`,
      },
    ]);
  }

  if (envelope.kind === "template") {
    const payload = zAssessment.safeParse(envelope.payload);
    if (!payload.success) return failure(zodIssues(payload.error.issues, "B2", ["payload"]));

    return {
      ok: true,
      bundle: {
        format: envelope.format,
        bundleVersion: BUNDLE_VERSION,
        kind: "template",
        appVersion: envelope.appVersion,
        payload: payload.data,
      },
      ...(legacy ? { legacy: true as const } : {}),
    };
  }

  // One reading, two spellings: a v1 payload is parsed by the v1 schema and normalized here,
  // so nothing downstream of `parseBundle()` knows the old key exists.
  const payload = (legacy ? zLegacyDatasetPayload : zDatasetPayload).safeParse(envelope.payload);
  if (!payload.success) return failure(zodIssues(payload.error.issues, "B2", ["payload"]));

  const dataset: DatasetPayload = legacy
    ? normalizeLegacyDatasetPayload(payload.data as LegacyDatasetPayload)
    : (payload.data as DatasetPayload);

  const collection = datasetCollectionProblems(dataset);
  if (collection.length > 0) return failure(collection);

  return {
    ok: true,
    bundle: {
      format: envelope.format,
      bundleVersion: BUNDLE_VERSION,
      kind: "dataset",
      appVersion: envelope.appVersion,
      payload: dataset,
    },
    ...(legacy ? { legacy: true as const } : {}),
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
    { templates: payload.templates, sessions: payload.sessions },
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
  sessions: readonly AssessmentSession[],
  appVersion: string,
): DatasetBundle {
  const envelope = {
    format: BUNDLE_FORMAT,
    bundleVersion: BUNDLE_VERSION,
    kind: "dataset" as const,
    appVersion,
    payload: { templates: [...templates], sessions: [...sessions] },
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
