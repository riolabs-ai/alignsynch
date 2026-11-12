/**
 * The platform package — deterministic zip, subsets, preflight, identities (#899).
 *
 * What this file proves, in the order the card asks for it:
 *
 *   1. **The same tree packs to the same sha256.** Twice, and again after an unpack/re-pack.
 *   2. **A subset accounts for what it dropped**, by id, in `manifest.dropped` — and a subset
 *      that would orphan a relationship seat is refused (`B8`), never silently cut.
 *   3. **The build is a refusal (`B7`)** — a package from a tree with one more migration, or a
 *      different lockfile, refuses to open here and names the migration.
 *   4. **Identities carry no credential** — `B4` refuses an identity row with a `password`,
 *      which is the policy the whole declaration group exists for.
 *   5. **Version 1 still reads** — the committed demo bundle parses unchanged, so #147's
 *      contract is additive, not replaced.
 *
 * The filesystem cases work in `mkdtemp` directories: the real package paths are
 * `exports/…` and `data/generated/…`, and a test that wrote those would make `data:check`
 * depend on which test ran first.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import {
  BUNDLE_FORMAT,
  PLATFORM_BUNDLE_VERSION,
  canonicalDemoBundle,
  formatBundleIssue,
  parseBundle,
  serializeBundle,
  type PlatformPayload,
} from "../../content/bundle";
import { assessmentInstances, assessments } from "../../data/assessments";
import { platformIdentities } from "../../data/platform-identities";
import {
  buildIdentity,
  identityPlan,
  lockfileSha256,
  packPackage,
  platformPayload,
  preflightProblems,
  schemaVersion,
  subsetIntegrityProblems,
  subsetPayload,
  unpackPackage,
  activeContent,
} from "../bundle-platform";
import { BundleError, DEMO_BUNDLE_FILE, readStore } from "../bundles";
import { unzipEntries, zipEntries } from "../zip-bridge";

const APP = "test-platform";
const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

const directories: string[] = [];

function workspace(): string {
  const directory = mkdtempSync(join(tmpdir(), "alignsynch-platform-"));
  directories.push(directory);
  return directory;
}

after(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
});

/** The active set as a payload, with a copy the case may mutate. */
function payloadCopy(): PlatformPayload {
  return JSON.parse(JSON.stringify(platformPayload(activeContent(), { appVersion: APP }).payload));
}

/**
 * The envelope text for a payload, **unvalidated** — the refusal cases need a document that
 * `platformBundle()` would itself refuse, so this writes the JSON straight.
 */
function bundleText(payload: PlatformPayload): string {
  return `${JSON.stringify(
    {
      format: BUNDLE_FORMAT,
      bundleVersion: PLATFORM_BUNDLE_VERSION,
      kind: "platform",
      appVersion: APP,
      payload,
    },
    null,
    2,
  )}\n`;
}

/* ================================================================== *
 * 1. Determinism — the property the hash stands on
 * ================================================================== */

describe("the same tree packs to the same bytes", () => {
  it("packs twice and compares the sha256 of both files", () => {
    const directory = workspace();
    const one = packPackage({ out: join(directory, "a.zip"), appVersion: APP });
    const two = packPackage({ out: join(directory, "b.zip"), appVersion: APP });

    assert.equal(
      one.sha256,
      two.sha256,
      "a zip whose hash moves between identical runs is a finding",
    );
    assert.deepEqual(
      readFileSync(one.file),
      readFileSync(two.file),
      "the bytes, not just the counts",
    );
    assert.equal(one.sha256, sha256(readFileSync(one.file)), "the reported hash is the file's");
  });

  it("carries the manifest and the bundle at the archive root, and nothing else at the top", () => {
    const directory = workspace();
    const packed = packPackage({ out: join(directory, "a.zip"), appVersion: APP });
    const names = unzipEntries(readFileSync(packed.file)).map((entry) => entry.name);
    assert.deepEqual(
      names,
      ["bundle.json", "manifest.json"],
      "two documents, media/ only when referenced",
    );
  });

  it("puts a dropped list in the manifest even when nothing was dropped", () => {
    const directory = workspace();
    const packed = packPackage({ out: join(directory, "a.zip"), appVersion: APP });
    assert.deepEqual(
      packed.manifest.manifest.dropped,
      [],
      "an empty list is a fact; a missing key is an absence",
    );
  });
});

describe("export → pack → unpack → pack is byte-identical", () => {
  it("re-packs an unpacked package to the same sha256", () => {
    const directory = workspace();
    const first = packPackage({ out: join(directory, "a.zip"), appVersion: APP });
    const unpacked = unpackPackage(first.file, { out: join(directory, "unpacked") });

    assert.equal(unpacked.bundle.kind, "platform");
    assert.equal(
      readFileSync(join(directory, "unpacked", "bundle.json"), "utf8"),
      serializeBundle(first.bundle),
      "the unpacked bundle is the packed one, byte for byte",
    );
    assert.equal(unpacked.bundle.payload.content.templates.length, assessments.length);
    assert.equal(unpacked.bundle.payload.content.instances.length, assessmentInstances.length);

    const again = packPackage({
      from: join(directory, "unpacked"),
      out: join(directory, "c.zip"),
      appVersion: APP,
    });
    assert.equal(
      again.sha256,
      first.sha256,
      "a round trip that changes the package is a lossy format",
    );
  });

  it("installs the content into a store when asked", () => {
    const directory = workspace();
    const packed = packPackage({ out: join(directory, "a.zip"), appVersion: APP });
    const store = join(directory, "assessments.json");

    const unpacked = unpackPackage(packed.file, {
      out: join(directory, "unpacked"),
      install: true,
      store,
    });
    assert.equal(unpacked.installed, store);

    const read = readStore(store);
    assert.equal(read.kind, "valid");
    assert.equal(
      read.kind === "valid" ? read.records.templates.length : -1,
      assessments.length,
      "the store holds the package's own records",
    );
  });
});

/* ================================================================== *
 * 2. Subsets — derived, and accounted for
 * ================================================================== */

describe("--subset prod strips demo personas and the relationships they hold", () => {
  it("carries zero demo identities and lists every drop by id", () => {
    const full = payloadCopy();
    const subset = subsetPayload(full, { subset: "prod" });

    assert.deepEqual(subset.payload.identities, [], "the fixture declares only demo personas");
    assert.equal(
      subset.dropped.filter((entry) => entry.kind === "identity").length,
      platformIdentities.length,
      "every persona is on the dropped list",
    );
    assert.ok(
      subset.dropped.some((entry) => entry.kind === "instance" && entry.id.includes("avery")),
      "the relationship both personas hold is dropped with them",
    );
    assert.equal(
      subset.payload.content.templates.length,
      full.content.templates.length,
      "templates, plans and options survive — a production tenant needs the product",
    );
    assert.equal(subset.payload.config.plans.length, full.config.plans.length);
    assert.deepEqual(subsetIntegrityProblems(subset.payload, subset.dropped), []);
  });

  it("refuses (B8) to drop a persona that leaves a real seat unowned", () => {
    const full = payloadCopy();
    const instance = full.content.instances[0];
    // One demo seat, one seat that belongs to nobody the package declares — a tenant
    // relationship a `prod` subset would delete if it cascaded on any demo party.
    instance.parties[1].name = "Dana";

    assert.throws(
      () => subsetPayload(full, { subset: "prod" }),
      (error: unknown) =>
        error instanceof BundleError &&
        error.code === "B8" &&
        /would leave relationship "assessment-instance-avery-rowan" with a seat nobody holds/.test(
          error.lines[0],
        ),
    );
  });
});

describe("--subset preview is a thin slice with one persona", () => {
  it("keeps N templates and exactly one identity, and accounts for the rest", () => {
    const full = payloadCopy();
    const subset = subsetPayload(full, { subset: "preview", limit: 2 });

    assert.equal(subset.payload.content.templates.length, 2);
    assert.equal(subset.payload.identities.length, 1, "a preview declares one persona");
    assert.equal(
      subset.dropped.filter((entry) => entry.kind === "template").length,
      full.content.templates.length - 2,
    );
    assert.equal(
      subset.dropped.filter((entry) => entry.kind === "identity").length,
      full.identities.length - 1,
    );
    assert.deepEqual(subsetIntegrityProblems(subset.payload, subset.dropped), []);
  });

  it("defaults to a small slice and packs it", () => {
    const directory = workspace();
    const packed = packPackage({
      out: join(directory, "preview.zip"),
      appVersion: APP,
      subset: "preview",
    });
    assert.equal(packed.manifest.manifest.counts.identities, 1);
    assert.ok(packed.manifest.manifest.counts.templates <= 3, "the default slice is small");
    assert.ok(
      packed.manifest.manifest.dropped.length > 0,
      "a thin slice drops records, and says which",
    );
  });
});

/* ================================================================== *
 * 3. The build is a refusal (B7)
 * ================================================================== */

describe("B7 — a package opens only on the build it was made from", () => {
  it("refuses a schemaVersion ahead of this tree and names the migration", () => {
    const target = buildIdentity(APP);
    const problems = preflightProblems({ ...target, schemaVersion: schemaVersion() + 1 }, target);

    assert.equal(problems.length, 1);
    assert.equal(problems[0].code, "B7");
    assert.match(problems[0].message, /is ahead of this tree's \d+/);
    assert.match(problems[0].message, /pnpm db:migrate/);
    assert.match(problems[0].message, /\.sql/, "the message names the migration it wants");
  });

  it("refuses a package from a different lockfile", () => {
    const target = buildIdentity(APP);
    const problems = preflightProblems(
      { ...target, lockfileSha256: sha256("some other dependency set") },
      target,
    );
    assert.equal(problems.length, 1);
    assert.equal(problems[0].code, "B7");
    assert.match(problems[0].message, /dependency set moved/);
  });

  it("refuses a package from a tree that is behind, because a package is not a downgrade", () => {
    const target = buildIdentity(APP);
    const problems = preflightProblems({ ...target, schemaVersion: schemaVersion() - 1 }, target);
    assert.equal(problems.length, 1);
    assert.match(problems[0].message, /is behind this tree's/);
  });

  it("refuses to unpack a package whose bundle was edited inside the archive", () => {
    const directory = workspace();
    const packed = packPackage({ out: join(directory, "a.zip"), appVersion: APP });
    const entries = unzipEntries(readFileSync(packed.file));
    const bundleEntry = entries.find((entry) => entry.name === "bundle.json");
    assert.ok(bundleEntry !== undefined);

    const tampered = Buffer.from(
      bundleEntry.data.toString("utf8").replace('"appVersion": "', '"appVersion": "Z'),
    );
    const file = join(directory, "tampered.zip");
    writeFileSync(
      file,
      zipEntries(
        entries.map((entry) =>
          entry.name === "bundle.json" ? { name: entry.name, data: tampered } : entry,
        ),
      ),
    );

    assert.throws(
      () => unpackPackage(file, { out: join(directory, "out") }),
      (error: unknown) => error instanceof BundleError && /bundleSha256/.test(error.lines[0]),
    );
    assert.equal(existsSync(join(directory, "out", "bundle.json")), false, "nothing is written");
  });

  it("refuses a zip with no manifest", () => {
    const directory = workspace();
    const file = join(directory, "nomanifest.zip");
    writeFileSync(file, zipEntries([{ name: "bundle.json", data: Buffer.from("{}") }]));
    assert.throws(
      () => unpackPackage(file, { out: join(directory, "out") }),
      (error: unknown) => error instanceof BundleError && /manifest\.json/.test(error.lines[0]),
    );
  });
});

/* ================================================================== *
 * 4. Identities are declarations
 * ================================================================== */

describe("an identity carries three facts and no credential", () => {
  it("refuses (B4) an identity row with a password, at the path that carries it", () => {
    const payload = payloadCopy();
    (payload.identities[0] as unknown as Record<string, unknown>).password = "hunter2";
    const parsed = parseBundle(bundleText(payload));

    assert.equal(parsed.ok, false);
    const issues = parsed.ok ? [] : parsed.issues;
    assert.equal(issues[0]?.code, "B4");
    assert.deepEqual(issues[0]?.path, ["payload", "identities", 0, "password"]);
    const first = issues[0];
    assert.ok(first !== undefined);
    assert.match(
      formatBundleIssue(first),
      /^\[B4\] payload\.identities\.0\.password: forbidden key "password"/,
    );
  });

  it("refuses a passwordHash and a pin too, not only the plain word", () => {
    for (const key of ["passwordHash", "pin", "apiKey", "secret", "token"]) {
      const payload = payloadCopy();
      (payload.identities[0] as unknown as Record<string, unknown>)[key] = "x";
      const parsed = parseBundle(bundleText(payload));
      assert.equal(parsed.ok, false, `"${key}" must be refused`);
      assert.equal(parsed.ok ? "" : parsed.issues[0]?.code, "B4");
    }
  });

  it("plans a create for a declaration the ledger has not seen, and skips one it has", () => {
    const ledger = {
      created: [{ email: "initiator@demo.alignsynch.test", userId: "user-1", package: "a.zip" }],
    };
    const plan = identityPlan(platformIdentities, ledger);
    assert.deepEqual(
      plan.declare.map((identity) => identity.email),
      ["counterparty@demo.alignsynch.test", "admin@demo.alignsynch.test"],
    );
    assert.equal(plan.already.length, 1);
  });
});

/* ================================================================== *
 * 5. Version 1 still reads, and the payload's own references
 * ================================================================== */

describe("bundleVersion 1 still imports", () => {
  it("parses the committed demo bundle exactly as it did before this cut", () => {
    const parsed = parseBundle(readFileSync(DEMO_BUNDLE_FILE, "utf8"));
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.map(formatBundleIssue).join("\n"));
    assert.equal(parsed.bundle.bundleVersion, 1);
    assert.equal(parsed.bundle.kind, "dataset");
  });

  it("re-serializes it unchanged — the canonical round trip is untouched", () => {
    const text = readFileSync(DEMO_BUNDLE_FILE, "utf8");
    const parsed = parseBundle(text);
    assert.ok(parsed.ok);
    assert.equal(serializeBundle(parsed.bundle), text);
  });

  it("refuses a version 3 document, naming both versions this build reads", () => {
    const payload = payloadCopy();
    const raw = JSON.parse(bundleText(payload)) as Record<string, unknown>;
    raw.bundleVersion = 3;
    const parsed = parseBundle(JSON.stringify(raw));
    assert.equal(parsed.ok, false);
    assert.equal(parsed.ok ? "" : parsed.issues[0]?.code, "B6");
    assert.match(parsed.ok ? "" : (parsed.issues[0]?.message ?? ""), /this build reads 1 and 2/);
  });

  it("refuses a version-2 document that is not a platform", () => {
    const raw = {
      format: BUNDLE_FORMAT,
      bundleVersion: PLATFORM_BUNDLE_VERSION,
      kind: "dataset",
      appVersion: APP,
      payload: { templates: [], instances: [] },
    };
    const parsed = parseBundle(JSON.stringify(raw));
    assert.equal(parsed.ok, false);
    assert.equal(parsed.ok ? "" : parsed.issues[0]?.code, "B1");
  });

  it("refuses a v1 dataset claiming to be a platform", () => {
    const parsed = parseBundle(
      JSON.stringify({
        format: BUNDLE_FORMAT,
        bundleVersion: 1,
        kind: "platform",
        appVersion: APP,
        payload: {},
      }),
    );
    assert.equal(parsed.ok, false);
    assert.equal(parsed.ok ? "" : parsed.issues[0]?.code, "B6");
  });
});

describe("the platform payload's own references (B8)", () => {
  it("refuses a price whose plan is not in the package", () => {
    const payload = payloadCopy();
    payload.config.prices[0].planId = "plan-not-here";
    const parsed = parseBundle(bundleText(payload));
    assert.equal(parsed.ok, false);
    const issue = parsed.ok ? undefined : parsed.issues[0];
    assert.equal(issue?.code, "B8");
    assert.match(issue?.message ?? "", /price names plan "plan-not-here"/);
  });

  it("refuses media outside media/ — the container has one media directory", () => {
    const payload = payloadCopy();
    payload.media.push({ path: "../escape.png", sha256: sha256("x"), bytes: 1 });
    const parsed = parseBundle(bundleText(payload));
    assert.equal(parsed.ok, false);
    const issue = parsed.ok ? undefined : parsed.issues[0];
    assert.equal(issue?.code, "B8");
    assert.match(issue?.message ?? "", /not a relative path under media\//);
  });

  it("refuses two declarations with one email (B3)", () => {
    const payload = payloadCopy();
    payload.identities.push({ ...payload.identities[0] });
    const parsed = parseBundle(bundleText(payload));
    assert.equal(parsed.ok, false);
    assert.equal(parsed.ok ? "" : parsed.issues[0]?.code, "B3");
    assert.match(
      parsed.ok ? "" : (parsed.issues[0]?.message ?? ""),
      /one identity, one declaration/,
    );
  });

  it("catches a subset rule that forgets a cascade", () => {
    const full = payloadCopy();
    const subset = subsetPayload(full, { subset: "prod" });
    // A slice that kept a relationship but dropped every template it names — the shape a
    // forgotten cascade produces — is `B8`, not a package missing a record.
    const problems = subsetIntegrityProblems(
      {
        ...subset.payload,
        content: { templates: [], instances: subset.payload.content.instances },
      },
      [],
    );
    assert.ok(problems.length > 0);
    assert.equal(problems[0].code, "B8");
    assert.match(problems[0].message, /names template/);
  });
});

/* ================================================================== *
 * 6. The committed demo bundle is untouched by all of this
 * ================================================================== */
describe("the fixtures' dataset bundle still builds through the v1 path", () => {
  it("is the same bundle the fixtures produce", () => {
    const bundle = canonicalDemoBundle(assessments, assessmentInstances, APP);
    assert.equal(bundle.bundleVersion, 1);
    assert.equal(bundle.kind, "dataset");
    const reparsed = parseBundle(serializeBundle(bundle));
    assert.ok(reparsed.ok);
    assert.equal(serializeBundle(reparsed.bundle), serializeBundle(bundle));
  });

  it("states the build this tree actually is", () => {
    const build = buildIdentity(APP);
    assert.equal(build.appVersion, APP);
    assert.equal(build.schemaVersion, schemaVersion());
    assert.match(build.lockfileSha256, /^[0-9a-f]{64}$/);
    assert.equal(build.lockfileSha256, lockfileSha256());
  });
});
