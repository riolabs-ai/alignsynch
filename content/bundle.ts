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
 */
import { z } from "zod";
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
 * The format version — the gate. A reader that does not know this number refuses the
 * file (`B6`) instead of half-reading it; `appVersion` below says which build wrote it
 * and is never compared against anything.
 */
export const BUNDLE_VERSION = 1 as const;

/** What a bundle carries: one TEMPLATE, or a DEMO DATASET of templates and instances. */
export const zBundleKind = z.enum(["template", "dataset"]);

export type BundleKind = z.infer<typeof zBundleKind>;

/**
 * The envelope every bundle carries, and nothing else: `strict()`, so a key this build
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
      code: z.ZodIssueCode.custom,
      path: ["payload", ...issue.path],
      message: `[${issue.code}] ${issue.message}`,
    });
  }
});

export type DatasetBundle = z.infer<typeof zDatasetBundleObject>;

export type Bundle = TemplateBundle | DatasetBundle;

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
 *   B6  `bundleVersion` — this build reads exactly 1
 *
 * B5 is minted by `scripts/bundles.ts`: it is about the *store* the bundle is imported into,
 * and a bundle on its own cannot violate it.
 */
export type BundleIssueCode = "B1" | "B2" | "B3" | "B4" | "B6";

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
 * B4 — no key that names a credential, anywhere
 * ------------------------------------------------------------------ */

/**
 * The keys a bundle may never carry, whatever a future schema says. Redundant with
 * `strict()` today — an unknown key is already an error — and meant to stay that way: this
 * is the policy, not a consequence of the current shape. `key` is matched exactly (a
 * domain key, not "any word containing key"), the rest as substrings of a key name.
 */
const FORBIDDEN_KEY = /(^key$|secret|token|api-?key|password|credential|private-?key)/i;

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
 * wrong" are two errors with two codes instead of one zod dump.
 */
const zEnvelopeShape = zBundleEnvelope.extend({ payload: z.unknown() }).strict();

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
    if (issue.code === z.ZodIssueCode.unrecognized_keys) {
      for (const key of issue.keys) {
        mapped.push({
          code,
          path: [...prefix, ...issue.path, key],
          message: `unknown key "${key}" — a bundle carries exactly what the schema defines (every object is strict)`,
        });
      }
      continue;
    }
    mapped.push({ code, path: [...prefix, ...issue.path], message: issue.message });
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
  if (typeof version === "number" && version !== BUNDLE_VERSION) {
    return failure([
      {
        code: "B6",
        path: ["bundleVersion"],
        message: `bundleVersion ${version}: this build reads ${BUNDLE_VERSION}`,
      },
    ]);
  }

  const forbidden = forbiddenKeyProblems(raw);
  if (forbidden.length > 0) return failure(forbidden);

  const shape = zEnvelopeShape.safeParse(raw);
  if (!shape.success) {
    return failure(zodIssues(shape.error.issues, "B1", []));
  }

  const envelope = shape.data;
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
        bundleVersion: envelope.bundleVersion,
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
      bundleVersion: envelope.bundleVersion,
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
