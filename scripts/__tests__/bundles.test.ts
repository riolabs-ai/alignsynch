/**
 * Bundles, refused or round-tripped — the negative and positive cases for `content/bundle.ts`
 * and `scripts/bundles.ts` (#147).
 *
 * Three properties, each asserted against a real file rather than a description of one:
 *
 *   1. **Byte-identical round trip.** Export the fixtures, import them into a store, export
 *      that store, `readFileSync` both — equal strings, not "the same records".
 *   2. **Six refusals, six codes, six paths.** Every case in `BUNDLE_CASES` names the code and
 *      the path a person would need to fix it, and every one leaves the store byte-unchanged
 *      with no `*.tmp-*` behind.
 *   3. **The committed demo bundle is the export.** E32's rule, with one byte changed.
 *
 * The filesystem cases use a `mkdtemp` directory under the OS temp dir: the store is
 * `data/generated/assessments.json` in real life, and a test that wrote it would make
 * `data:check` depend on which test ran first.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import {
  BUNDLE_FORMAT,
  BUNDLE_VERSION,
  LEGACY_BUNDLE_VERSION,
  canonicalDemoBundle,
  formatBundleIssue,
  parseBundle,
  serializeBundle,
  type DatasetBundle,
} from "../../content/bundle";
import { assessmentSessions, assessments } from "../../data/assessments";
import {
  BundleError,
  DEMO_BUNDLE_FILE,
  demoBundleProblems,
  exitCodeFor,
  exportDataset,
  exportTemplate,
  importBundleFile,
  readStore,
} from "../bundles";

/** A provenance stamp that never moves: these tests must not depend on `package.json`. */
const APP = "test-bundles";

const directories: string[] = [];

function workspace(): string {
  const directory = mkdtempSync(join(tmpdir(), "alignsynch-bundles-"));
  directories.push(directory);
  return directory;
}

after(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
});

/** A dataset bundle as text, with `mutate` applied to a fresh copy of the fixtures' payload. */
function datasetText(mutate?: (bundle: DatasetBundle) => void): string {
  const bundle = canonicalDemoBundle(assessments, assessmentSessions, APP);
  const copy = JSON.parse(serializeBundle(bundle)) as DatasetBundle;
  mutate?.(copy);
  return serializeBundle(copy);
}

/**
 * The fixtures as a **version-1** dataset document — the shape this build reads and never
 * writes. Derived from the canonical bundle, so the two documents differ in exactly the two
 * things the migration changed: the version number and the record-array key.
 */
function legacyDatasetText(): string {
  const current = canonicalDemoBundle(assessments, assessmentSessions, APP);
  const payload = JSON.parse(serializeBundle(current)).payload as {
    templates: unknown;
    sessions: unknown;
  };
  return `${JSON.stringify(
    {
      format: BUNDLE_FORMAT,
      bundleVersion: LEGACY_BUNDLE_VERSION,
      kind: "dataset",
      appVersion: current.appVersion,
      payload: { templates: payload.templates, instances: payload.sessions },
    },
    null,
    2,
  )}\n`;
}

function templateText(id: string, mutate?: (payload: Record<string, unknown>) => void): string {
  const template = assessments.find((candidate) => candidate.id === id);
  assert.ok(template !== undefined, `fixture "${id}" must exist`);
  const payload = JSON.parse(JSON.stringify(template)) as Record<string, unknown>;
  mutate?.(payload);
  return `${JSON.stringify(
    {
      format: BUNDLE_FORMAT,
      bundleVersion: BUNDLE_VERSION,
      kind: "template",
      appVersion: APP,
      payload,
    },
    null,
    2,
  )}\n`;
}

const write = (directory: string, name: string, text: string): string => {
  const file = join(directory, name);
  writeFileSync(file, text, "utf8");
  return file;
};

const temporaryFiles = (directory: string): string[] =>
  readdirSync(directory).filter((entry) => entry.includes(".tmp-"));

/* ================================================================== *
 * 1. Byte-identical round trip
 * ================================================================== */

describe("a canonical bundle is a fixed point of serialize(parse(…))", () => {
  it("serializes the fixtures' dataset bundle and re-serializes it unchanged", () => {
    const once = serializeBundle(canonicalDemoBundle(assessments, assessmentSessions, APP));
    const parsed = parseBundle(once);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.map(formatBundleIssue).join("\n"));
    assert.equal(serializeBundle(parsed.bundle), once);
  });

  it("does the same for a template bundle", () => {
    const text = templateText("assessment-relationship-basics");
    const parsed = parseBundle(text);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.map(formatBundleIssue).join("\n"));
    assert.equal(serializeBundle(parsed.bundle), text);
  });
});

describe("export → import → export is byte-identical", () => {
  it("round-trips every template and instance through a store", () => {
    const directory = workspace();
    const store = join(directory, "assessments.json");

    const first = exportDataset({ store, out: join(directory, "one.json"), appVersion: APP });
    const imported = importBundleFile(first.file, { store, appVersion: APP });
    assert.equal(imported.kind, "dataset");
    // The counts are the fixture's, not a number written here: the catalogue grows when the type
    // taxonomy does (`data/assessments.ts` derives one template per purchasable type), and a
    // literal would make adding a type look like a bundle defect.
    assert.equal(imported.templates, assessments.length);
    assert.equal(imported.sessions, assessmentSessions.length);
    assert.equal(imported.materialized, false, "a dataset install has nothing to materialize");

    const second = exportDataset({ store, out: join(directory, "two.json"), appVersion: APP });
    assert.equal(
      readFileSync(second.file, "utf8"),
      readFileSync(first.file, "utf8"),
      "the second export must be the same bytes, not just the same records",
    );

    // The store is the active set, and it is the payload — not an envelope.
    const read = readStore(store);
    assert.equal(read.kind, "valid");
    assert.equal(read.kind === "valid" ? read.records.templates.length : -1, assessments.length);
  });

  it("is idempotent: re-importing the same dataset installs the same bytes", () => {
    const directory = workspace();
    const store = join(directory, "assessments.json");
    const bundle = exportDataset({ store, out: join(directory, "bundle.json"), appVersion: APP });

    importBundleFile(bundle.file, { store, appVersion: APP });
    const once = readFileSync(store, "utf8");
    importBundleFile(bundle.file, { store, appVersion: APP });
    assert.equal(readFileSync(store, "utf8"), once);
  });

  it("round-trips a template into a store that does not hold it", () => {
    const directory = workspace();
    const store = join(directory, "assessments.json");
    const blank = "assessment-blank-template";

    // The template bundle is exported while the fixtures are still the active set — that is
    // the "hand a template to somebody" direction.
    const first = exportTemplate(blank, {
      store,
      out: join(directory, "blank-one.json"),
      appVersion: APP,
    });

    // The receiving store is a dataset without it: `assessment-blank-template` ships as a
    // draft no session copies, so a dataset that leaves it out is still valid.
    const bundle = JSON.parse(datasetText()) as DatasetBundle;
    importBundleFile(
      write(
        directory,
        "reduced.json",
        serializeBundle({
          ...bundle,
          payload: {
            templates: bundle.payload.templates.filter((template) => template.id !== blank),
            sessions: bundle.payload.sessions.filter((session) => session.templateId !== blank),
          },
        }),
      ),
      { store, appVersion: APP },
    );
    const installed = readStore(store);
    assert.equal(installed.kind, "valid");
    assert.deepEqual(
      installed.kind === "valid"
        ? installed.records.templates.map((template) => template.id)
        : ["the store did not parse"],
      assessments.filter((template) => template.id !== blank).map((template) => template.id),
      "the store must not hold the template before the import",
    );

    const appended = importBundleFile(first.file, { store, appVersion: APP });
    assert.equal(appended.kind, "template");
    assert.equal(appended.added, blank);
    assert.equal(appended.materialized, false);

    const second = exportTemplate(blank, {
      store,
      out: join(directory, "blank-two.json"),
      appVersion: APP,
    });
    assert.equal(
      readFileSync(second.file, "utf8"),
      readFileSync(first.file, "utf8"),
      "a template export must survive a store round trip byte for byte",
    );
  });

  it("materializes the fixtures when a template is imported with no store yet", () => {
    const directory = workspace();
    const store = join(directory, "assessments.json");
    const text = templateText("assessment-personal-parent-child", (payload) => {
      payload.id = "assessment-personal-sibling";
      payload.slug = "personal-sibling";
      payload.title = "Personal — Sibling";
    });

    const imported = importBundleFile(write(directory, "sibling.json", text), {
      store,
      appVersion: APP,
    });
    assert.equal(imported.materialized, true, "the fixtures become the store on the first import");
    assert.equal(
      imported.templates,
      assessments.length + 1,
      "every fixture template plus the imported one",
    );

    const exported = exportDataset({ store, out: join(directory, "all.json"), appVersion: APP });
    assert.equal(exported.bundle.payload.templates.length, assessments.length + 1);
    assert.equal(exported.bundle.payload.sessions.length, assessmentSessions.length);
  });
});

/* ================================================================== *
 * 1b. The version-1 shape: read, normalized, never written
 * ================================================================== */

describe("bundleVersion 1 — tolerated for one release, never written back", () => {
  it("parses, and says so", () => {
    const parsed = parseBundle(legacyDatasetText());
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.map(formatBundleIssue).join("\n"));
    assert.equal(parsed.legacy, true);
    assert.equal(parsed.bundle.bundleVersion, BUNDLE_VERSION, "normalized to the current version");
    assert.equal(
      parsed.bundle.kind === "dataset" ? parsed.bundle.payload.sessions.length : -1,
      assessmentSessions.length,
    );
  });

  it("imports into a store written in the current shape", () => {
    const directory = workspace();
    const store = join(directory, "assessments.json");
    const file = write(directory, "legacy.json", legacyDatasetText());

    const result = importBundleFile(file, { store, appVersion: APP });
    assert.equal(result.deprecated, true, "the caller is told the file was a legacy one");
    assert.equal(result.sessions, assessmentSessions.length);
    assert.equal(readStore(store).kind, "valid");

    const text = readFileSync(store, "utf8");
    assert.match(text, /"sessions":/);
    assert.equal(text.includes('"instances"'), false, "the store is written in the new shape");
  });

  it("re-exports as a version 3 document — the old key does not travel back", () => {
    const directory = workspace();
    const store = join(directory, "assessments.json");
    importBundleFile(write(directory, "legacy.json", legacyDatasetText()), {
      store,
      appVersion: APP,
    });

    const exported = exportDataset({ store, out: join(directory, "again.json"), appVersion: APP });
    assert.equal(exported.bundle.bundleVersion, BUNDLE_VERSION);
    const text = readFileSync(exported.file, "utf8");
    assert.match(text, /"bundleVersion": 3/);
    assert.match(text, /"sessions":/);
    assert.equal(text.includes('"instances"'), false);
  });

  it("reads a store left behind by an older build, without E33 calling it invalid", () => {
    const directory = workspace();
    const store = join(directory, "assessments.json");
    const raw = JSON.parse(datasetText()) as { payload: Record<string, unknown> };
    raw.payload.instances = raw.payload.sessions;
    delete raw.payload.sessions;
    writeFileSync(
      store,
      `${JSON.stringify({ templates: raw.payload.templates, instances: raw.payload.instances }, null, 2)}\n`,
      "utf8",
    );

    const read = readStore(store);
    assert.equal(read.kind, "valid");
    assert.equal(
      read.kind === "valid" ? read.records.sessions.length : -1,
      assessmentSessions.length,
    );
  });
});

/* ================================================================== *
 * 2. Refusals — one code, one path, a store left alone
 * ================================================================== */

interface RefusalCase {
  readonly name: string;
  readonly code: string;
  /** A regex the first printed line must match: the code, then the path that carries it. */
  readonly line: RegExp;
  readonly text: () => string;
  /** Whether the store the import collides with must already hold the fixtures. */
  readonly needsStore: boolean;
}

const BUNDLE_CASES: readonly RefusalCase[] = [
  {
    name: "B1 — the envelope's kind is not a kind this build has",
    code: "B1",
    // zod 3 said "Invalid enum value"; zod 4 says `Invalid option: expected one of …`.
    line: /^\[B1\] kind: Invalid (enum value|option)/,
    text: () =>
      datasetText((bundle) => {
        (bundle as unknown as Record<string, unknown>).kind = "quiz";
      }),
    needsStore: false,
  },
  {
    name: "B2 — a template carrying parties (the difference between a template and an instance)",
    code: "B2",
    line: /^\[B2\] payload\.parties: /,
    text: () =>
      templateText("assessment-relationship-basics", (payload) => {
        payload.parties = [];
      }),
    needsStore: false,
  },
  {
    name: "B3 — an instance naming a template outside the bundle",
    code: "B3",
    line: /^\[B3\] sessions: session "assessment-instance-avery-rowan" names template "assessment-not-in-this-bundle"/,
    text: () =>
      datasetText((bundle) => {
        bundle.payload.sessions[0].templateId = "assessment-not-in-this-bundle";
      }),
    needsStore: false,
  },
  {
    name: "B4 — a payload key that names a secret",
    code: "B4",
    line: /^\[B4\] payload\.templates\.0\.secret: forbidden key "secret"/,
    text: () =>
      datasetText((bundle) => {
        (bundle.payload.templates[0] as unknown as Record<string, unknown>).secret = "sk_live_123";
      }),
    needsStore: false,
  },
  {
    name: "B5 — a template import colliding with a record the active store already holds",
    code: "B5",
    line: /^\[B5\] payload\.id: "assessment-relationship-basics" is already a record in the active templates/,
    text: () => templateText("assessment-relationship-basics"),
    needsStore: true,
  },
  {
    name: "B6 — a bundleVersion this build does not read",
    code: "B6",
    line: /^\[B6\] bundleVersion: bundleVersion 9: this build reads 1, 2 and 3/,
    text: () =>
      datasetText((bundle) => {
        (bundle as unknown as Record<string, unknown>).bundleVersion = 9;
      }),
    needsStore: false,
  },
  {
    name: "B9 — a bundleVersion 3 dataset that still carries the legacy key",
    code: "B9",
    line: /^\[B9\] payload\.instances: bundleVersion 3 carries payload\.instances/,
    text: () =>
      datasetText((bundle) => {
        const payload = (bundle as unknown as { payload: Record<string, unknown> }).payload;
        payload.instances = payload.sessions;
        delete payload.sessions;
      }),
    needsStore: false,
  },
  {
    name: "B9 — a payload carrying both keys is ambiguous, not a newer file",
    code: "B9",
    line: /^\[B9\] payload: carries both payload\.sessions and payload\.instances/,
    text: () =>
      datasetText((bundle) => {
        const payload = (bundle as unknown as { payload: Record<string, unknown> }).payload;
        payload.instances = payload.sessions;
      }),
    needsStore: false,
  },
  {
    name: "B9 — a version 1 document already carrying the new key",
    code: "B9",
    line: /^\[B9\] payload\.sessions: bundleVersion 1 carries payload\.sessions/,
    text: () => {
      const raw = JSON.parse(datasetText()) as Record<string, unknown>;
      raw.bundleVersion = LEGACY_BUNDLE_VERSION;
      return `${JSON.stringify(raw, null, 2)}\n`;
    },
    needsStore: false,
  },
];

describe("every malformed bundle gets one path-bearing refusal, and one code", () => {
  for (const testCase of BUNDLE_CASES) {
    it(testCase.name, () => {
      const directory = workspace();
      const store = join(directory, "assessments.json");

      if (testCase.needsStore) {
        // The fixtures *are* the active set; materializing them first is what makes B5 a
        // collision against a store rather than against `data/assessments.ts`.
        const seed = exportDataset({
          store,
          out: join(directory, "seed.json"),
          appVersion: APP,
        });
        importBundleFile(seed.file, { store, appVersion: APP });
      }
      const before = existsSync(store) ? readFileSync(store, "utf8") : null;

      const file = write(directory, "bad.json", testCase.text());

      let thrown: unknown;
      try {
        importBundleFile(file, { store, appVersion: APP });
      } catch (cause) {
        thrown = cause;
      }

      assert.ok(thrown instanceof BundleError, `expected a BundleError, got ${String(thrown)}`);
      assert.equal(thrown.code, testCase.code);
      assert.equal(exitCodeFor(thrown), 1, "a refusal exits 1");
      assert.match(thrown.lines[0], testCase.line);

      const after = existsSync(store) ? readFileSync(store, "utf8") : null;
      assert.equal(after, before, "a refused import leaves the store byte-unchanged");
      assert.deepEqual(temporaryFiles(directory), [], "a refused import leaves no tmp file");
    });
  }

  it("the codes are different rules, not one rule under several names", () => {
    const codes = new Set(BUNDLE_CASES.map((testCase) => testCase.code));
    assert.equal(codes.size, 7);
    assert.deepEqual([...codes].sort(), ["B1", "B2", "B3", "B4", "B5", "B6", "B9"]);
  });

  it("refuses a file that is not JSON at all, naming the path it could not read", () => {
    const directory = workspace();
    const store = join(directory, "assessments.json");
    const file = write(directory, "broken.json", "{ this is not json");

    assert.throws(
      () => importBundleFile(file, { store, appVersion: APP }),
      (error: unknown) =>
        error instanceof BundleError &&
        error.code === "B1" &&
        /^\[B1\] bundle: not JSON — /.test(error.lines[0]),
    );
    assert.equal(existsSync(store), false, "nothing is written when the file cannot be read");
  });

  it("refuses to append to a store it cannot read, and leaves it alone", () => {
    const directory = workspace();
    const store = write(directory, "assessments.json", '{"templates": "done", "instances": []}');
    const before = readFileSync(store, "utf8");
    const file = write(directory, "template.json", templateText("assessment-relationship-basics"));

    assert.throws(
      () => importBundleFile(file, { store, appVersion: APP }),
      (error: unknown) => error instanceof BundleError && error.code === "B1",
    );
    assert.equal(readFileSync(store, "utf8"), before);
  });

  it("writes no file when an export cannot find its template", () => {
    const directory = workspace();
    const out = join(directory, "nope.json");
    assert.throws(
      () => exportTemplate("assessment-does-not-exist", { out, appVersion: APP }),
      (error: unknown) => error instanceof BundleError && error.code === "usage",
    );
    assert.equal(existsSync(out), false);
  });
});

/* ================================================================== *
 * 3. The shipped demo bundle
 * ================================================================== */

describe("E32 — the committed demo bundle is the canonical export of the fixtures", () => {
  it("matches the fixtures byte for byte", () => {
    assert.deepEqual(demoBundleProblems(), []);
  });

  it("is a bundleVersion 3 document that does not spell the retired key", () => {
    const text = readFileSync(DEMO_BUNDLE_FILE, "utf8");
    const parsed = parseBundle(text);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.map(formatBundleIssue).join("\n"));
    assert.equal(parsed.bundle.bundleVersion, BUNDLE_VERSION);
    assert.equal(parsed.legacy, undefined, "the shipped file is written, not merely tolerated");
    assert.match(text, /"sessions":/);
    assert.equal(text.includes('"instances"'), false);
  });

  it("refuses the legacy key by name when the committed bundle keeps it at the new version", () => {
    const directory = workspace();
    const raw = JSON.parse(readFileSync(DEMO_BUNDLE_FILE, "utf8")) as {
      payload: Record<string, unknown>;
    };
    raw.payload.instances = raw.payload.sessions;
    delete raw.payload.sessions;
    const file = write(directory, "half-migrated.json", `${JSON.stringify(raw, null, 2)}\n`);

    const problems = demoBundleProblems({ file });
    assert.equal(problems.length > 0, true, "a half-migrated committed bundle is a finding");
    assert.match(problems.join("\n"), /\[B9\] payload\.instances: bundleVersion 3 carries/);
  });

  it("fails when one byte of it changes", () => {
    const directory = workspace();
    const committed = readFileSync(DEMO_BUNDLE_FILE, "utf8");
    const changed = committed.replace(
      '"title": "Relationship Basics"',
      '"title": "Relationship Basicz"',
    );
    assert.notEqual(changed, committed, "the case must actually change a byte");
    const file = write(directory, "demo.json", changed);

    const problems = demoBundleProblems({ file });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /is not the canonical export of data\/assessments\.ts/);
    assert.match(problems[0], /first difference at byte \d+/);
  });

  it("fails when the file is gone", () => {
    const directory = workspace();
    const problems = demoBundleProblems({ file: join(directory, "missing.json") });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /is missing — write it with/);
  });

  it("ignores appVersion, which is provenance and never gated", () => {
    const directory = workspace();
    const committed = readFileSync(DEMO_BUNDLE_FILE, "utf8");
    const renamed = committed.replace(/"appVersion": "[^"]*"/, '"appVersion": "9.9.9-other-build"');
    assert.notEqual(renamed, committed, "the case must actually change the version");
    const file = write(directory, "demo-other-version.json", renamed);
    assert.deepEqual(demoBundleProblems({ file }), []);
  });
});
