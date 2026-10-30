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
  canonicalDemoBundle,
  formatBundleIssue,
  parseBundle,
  serializeBundle,
  type DatasetBundle,
} from "../../content/bundle";
import { assessmentInstances, assessments } from "../../data/assessments";
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
  const bundle = canonicalDemoBundle(assessments, assessmentInstances, APP);
  const copy = JSON.parse(serializeBundle(bundle)) as DatasetBundle;
  mutate?.(copy);
  return serializeBundle(copy);
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
    const once = serializeBundle(canonicalDemoBundle(assessments, assessmentInstances, APP));
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
  it("round-trips the four templates and four instances through a store", () => {
    const directory = workspace();
    const store = join(directory, "assessments.json");

    const first = exportDataset({ store, out: join(directory, "one.json"), appVersion: APP });
    const imported = importBundleFile(first.file, { store, appVersion: APP });
    assert.equal(imported.kind, "dataset");
    assert.equal(imported.templates, 4);
    assert.equal(imported.instances, 4);
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
    assert.equal(read.kind === "valid" ? read.records.templates.length : -1, 4);
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
    // draft no instance copies, so a dataset that leaves it out is still valid.
    const bundle = JSON.parse(datasetText()) as DatasetBundle;
    importBundleFile(
      write(
        directory,
        "reduced.json",
        serializeBundle({
          ...bundle,
          payload: {
            templates: bundle.payload.templates.filter((template) => template.id !== blank),
            instances: bundle.payload.instances.filter((instance) => instance.templateId !== blank),
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
      [
        "assessment-relationship-basics",
        "assessment-business-staff-manager",
        "assessment-personal-parent-child",
      ],
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
    assert.equal(imported.templates, 5, "four fixtures plus the imported template");

    const exported = exportDataset({ store, out: join(directory, "all.json"), appVersion: APP });
    assert.equal(exported.bundle.payload.templates.length, 5);
    assert.equal(exported.bundle.payload.instances.length, 4);
  });
});

/* ================================================================== *
 * 2. Six refusals — one code, one path, a store left alone
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
    line: /^\[B1\] kind: Invalid enum value/,
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
    line: /^\[B3\] instances: instance "assessment-instance-avery-rowan" names template "assessment-not-in-this-bundle"/,
    text: () =>
      datasetText((bundle) => {
        bundle.payload.instances[0].templateId = "assessment-not-in-this-bundle";
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
    line: /^\[B6\] bundleVersion: bundleVersion 2: this build reads 1/,
    text: () =>
      datasetText((bundle) => {
        (bundle as unknown as Record<string, unknown>).bundleVersion = 2;
      }),
    needsStore: false,
  },
];

describe("six malformed bundles, six different path-bearing refusals", () => {
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

  it("the six codes are six different rules", () => {
    const codes = new Set(BUNDLE_CASES.map((testCase) => testCase.code));
    assert.equal(codes.size, 6);
    assert.deepEqual([...codes].sort(), ["B1", "B2", "B3", "B4", "B5", "B6"]);
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
