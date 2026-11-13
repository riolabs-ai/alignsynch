/**
 * `scripts/install-guard.mjs` — the rules that let the gate skip `pnpm install --frozen-lockfile`.
 *
 * A skip is only safe when *every* rule holds, so most of these cases are negative: each one
 * changes exactly one input and pins that the answer flips back to "install". The last group runs
 * `inspect` / `record` against a real temporary worktree, because the fs half is where the
 * interesting mistakes live (a marker older than the lockfile, a `node_modules` from another
 * lockfile, a marker for a different worktree).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  MARKER_VERSION,
  describe as describeDecision,
  evaluate,
  fingerprint,
  inspect,
  markerPath,
  readMarker,
  record,
} from "../scripts/install-guard.mjs";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

/** A marker that would allow the skip, so each case can break exactly one thing. */
function marker(overrides = {}) {
  return {
    version: MARKER_VERSION,
    hash: HASH_A,
    pnpm: "12.16.1",
    nodeModulesLock: "c".repeat(64),
    recordedAt: "2026-11-13T00:00:00.000Z",
    recordedMs: 1_000_000,
    installMs: 1180,
    ...overrides,
  };
}

const NODE_MODULES_OK = {
  exists: true,
  modulesYaml: true,
  bin: true,
  lockCopyHash: "c".repeat(64),
};

function base(overrides = {}) {
  return {
    force: false,
    hash: HASH_A,
    pnpm: "12.16.1",
    marker: marker(),
    files: { newestMs: 900_000 },
    nodeModules: { ...NODE_MODULES_OK },
    ...overrides,
  };
}

describe("evaluate — a skip needs every rule to hold", () => {
  it("skips when the fingerprint, the pnpm version and node_modules all agree", () => {
    const decision = evaluate(base());
    expect(decision.run).toBe(false);
    expect(decision.savedMs).toBe(1180);
  });

  it("installs when QUIZHUB_FORCE_INSTALL is set, whatever else is true", () => {
    expect(evaluate(base({ force: true }))).toEqual({
      run: true,
      reason: "QUIZHUB_FORCE_INSTALL=1",
    });
  });

  it("installs when there is no marker (a fresh worktree, or a CI runner)", () => {
    const decision = evaluate(base({ marker: null }));
    expect(decision.run).toBe(true);
    expect(decision.reason).toContain("no marker");
  });

  it("installs when the marker is unreadable rather than assuming it was fine", () => {
    const decision = evaluate(base({ marker: { error: "Unexpected token }" } }));
    expect(decision.run).toBe(true);
    expect(decision.reason).toContain("unreadable");
  });

  it("installs when the marker is an older format", () => {
    const decision = evaluate(base({ marker: marker({ version: MARKER_VERSION - 1 }) }));
    expect(decision.run).toBe(true);
    expect(decision.reason).toContain("version");
  });

  it("installs when the marker carries no fingerprint", () => {
    expect(evaluate(base({ marker: marker({ hash: undefined }) })).run).toBe(true);
  });

  it("installs when package.json or the lockfile changed", () => {
    const decision = evaluate(base({ hash: HASH_B }));
    expect(decision.run).toBe(true);
    expect(decision.reason).toContain("aaaaaaaa");
    expect(decision.reason).toContain("bbbbbbbb");
  });

  it("installs when pnpm on PATH is not the pnpm that installed", () => {
    const decision = evaluate(base({ pnpm: "13.0.0" }));
    expect(decision.run).toBe(true);
    expect(decision.reason).toContain("13.0.0");
  });

  it("installs when the marker is older than the manifests", () => {
    const decision = evaluate(base({ files: { newestMs: 2_000_000 } }));
    expect(decision.run).toBe(true);
    expect(decision.reason).toContain("older than");
  });

  it("installs when node_modules is missing", () => {
    const decision = evaluate(
      base({ nodeModules: { ...NODE_MODULES_OK, exists: false, modulesYaml: false } }),
    );
    expect(decision.run).toBe(true);
    expect(decision.reason).toContain("node_modules is missing");
  });

  it("installs when the last install did not finish (.modules.yaml is pnpm's own record)", () => {
    const decision = evaluate(base({ nodeModules: { ...NODE_MODULES_OK, modulesYaml: false } }));
    expect(decision.run).toBe(true);
    expect(decision.reason).toContain(".modules.yaml");
  });

  it("installs when node_modules has no .bin/next — every lane below docs runs it", () => {
    const decision = evaluate(base({ nodeModules: { ...NODE_MODULES_OK, bin: false } }));
    expect(decision.run).toBe(true);
    expect(decision.reason).toContain(".bin/next");
  });

  it("installs when node_modules was installed from a different lockfile", () => {
    const decision = evaluate(base({ nodeModules: { ...NODE_MODULES_OK, lockCopyHash: HASH_B } }));
    expect(decision.run).toBe(true);
    expect(decision.reason).toContain("different lockfile");
  });

  it("does not claim a saving when the marker recorded no duration", () => {
    const decision = evaluate(base({ marker: marker({ installMs: 0 }) }));
    expect(decision.run).toBe(false);
    expect(decision.savedMs).toBeUndefined();
  });
});

describe("describe — the skip line a review reads", () => {
  it("names the fingerprint and the seconds saved", () => {
    const line = describeDecision(
      { run: false, reason: `lockfile unchanged, ${HASH_A.slice(0, 8)}`, savedMs: 1180 },
      marker(),
    );
    expect(line.startsWith("install: skipped (lockfile unchanged, aaaaaaaa)")).toBe(true);
    expect(line).toContain("saved ~1.18s");
    expect(line).toContain("2026-11-13T00:00:00.000Z");
  });

  it("says what it is about to do when it does not skip", () => {
    const line = describeDecision({ run: true, reason: "node_modules is missing" }, null);
    expect(line).toBe(
      "install: not skipped (node_modules is missing) — running pnpm install --frozen-lockfile",
    );
  });
});

describe("inspect / record — the fs half, against a real worktree", () => {
  const roots: string[] = [];

  function worktree({ lockfile = "lockfileVersion: '9.0'\n", pkg = '{"name":"x"}\n' } = {}) {
    const root = mkdtempSync(join(tmpdir(), "install-guard-"));
    roots.push(root);
    writeFileSync(join(root, "pnpm-lock.yaml"), lockfile);
    writeFileSync(join(root, "package.json"), pkg);
    mkdirSync(join(root, "node_modules", ".pnpm"), { recursive: true });
    mkdirSync(join(root, "node_modules", ".bin"), { recursive: true });
    writeFileSync(join(root, "node_modules", ".modules.yaml"), "layoutVersion: 5\n");
    writeFileSync(join(root, "node_modules", ".bin", "next"), "#!/bin/sh\n");
    writeFileSync(join(root, "node_modules", ".pnpm", "lock.yaml"), "pnpm lock copy\n");
    return root;
  }

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("installs first, then skips once the marker is recorded", () => {
    const root = worktree();
    const cache = mkdtempSync(join(tmpdir(), "install-guard-cache-"));
    roots.push(cache);

    const first = inspect(root, { pnpm: "12.16.1", cacheDir: cache });
    expect(first.fingerprint?.hash).toHaveLength(64);
    expect(evaluate({ ...first }).run).toBe(true);

    record(root, { pnpm: "12.16.1", installMs: 1180, cacheDir: cache });
    const second = inspect(root, { pnpm: "12.16.1", cacheDir: cache });
    const decision = evaluate({ ...second });
    expect(decision.run).toBe(false);
    expect(decision.savedMs).toBe(1180);
    expect(readMarker(markerPath(root, cache))?.hash).toBe(second.hash);
  });

  it("installs again when package.json changes, and again when the lockfile does", () => {
    const root = worktree();
    const cache = mkdtempSync(join(tmpdir(), "install-guard-cache-"));
    roots.push(cache);
    record(root, { pnpm: "12.16.1", installMs: 500, cacheDir: cache });
    expect(evaluate({ ...inspect(root, { pnpm: "12.16.1", cacheDir: cache }) }).run).toBe(false);

    writeFileSync(join(root, "package.json"), '{"name":"x","private":true}\n');
    const afterPkg = evaluate({ ...inspect(root, { pnpm: "12.16.1", cacheDir: cache }) });
    expect(afterPkg.run).toBe(true);
    expect(afterPkg.reason).toContain("manifests changed");

    record(root, { pnpm: "12.16.1", installMs: 500, cacheDir: cache });
    writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n# touched\n");
    expect(evaluate({ ...inspect(root, { pnpm: "12.16.1", cacheDir: cache }) }).run).toBe(true);
  });

  it("installs again when node_modules — or just the marker — is deleted", () => {
    const root = worktree();
    const cache = mkdtempSync(join(tmpdir(), "install-guard-cache-"));
    roots.push(cache);
    record(root, { pnpm: "12.16.1", installMs: 500, cacheDir: cache });

    rmSync(join(root, "node_modules"), { recursive: true, force: true });
    const withoutModules = evaluate({ ...inspect(root, { pnpm: "12.16.1", cacheDir: cache }) });
    expect(withoutModules.run).toBe(true);
    expect(withoutModules.reason).toContain("node_modules is missing");

    const second = worktree();
    record(second, { pnpm: "12.16.1", installMs: 500, cacheDir: cache });
    rmSync(markerPath(second, cache), { force: true });
    expect(evaluate({ ...inspect(second, { pnpm: "12.16.1", cacheDir: cache }) }).run).toBe(true);
  });

  it("keys the marker by worktree, so a sibling card cannot inherit the skip", () => {
    const one = worktree();
    const two = worktree();
    const cache = mkdtempSync(join(tmpdir(), "install-guard-cache-"));
    roots.push(cache);
    record(one, { pnpm: "12.16.1", installMs: 500, cacheDir: cache });
    expect(markerPath(one, cache)).not.toBe(markerPath(two, cache));
    const sibling = evaluate({ ...inspect(two, { pnpm: "12.16.1", cacheDir: cache }) });
    expect(sibling.run).toBe(true);
    expect(sibling.reason).toContain("no marker");
  });

  it("returns null from fingerprint when a required manifest is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "install-guard-empty-"));
    roots.push(root);
    expect(fingerprint(root)).toBeNull();
  });
});
