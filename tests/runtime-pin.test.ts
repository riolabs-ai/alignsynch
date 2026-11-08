/**
 * One Node runtime, in every place that can drift (issue #682).
 *
 * Production ran **26.x** for a day while `.nvmrc` pinned 24 and `engines` said `>=20.9.0`, so every
 * green check described a runtime production did not use. The Vercel build log named the mechanism
 * out loud — an open-ended `engines` range "will automatically upgrade when a new major Node.js
 * Version is released" — which is why the range is now a pin (`24.x`) rather than a floor.
 *
 * Three of the four places this runtime is stated are files, and a file is only a pin if something
 * fails when the others move. (The fourth, the Vercel project's `nodeVersion`, lives outside the
 * repository and is read from the API: `GET /v9/projects/alignsynch` → `nodeVersion`.)
 *
 *   1. `.nvmrc` is a bare major — `scripts/verify.sh` parses it to digits and refuses to gate a shell
 *      on a different one, so a range or a `v` prefix here is silently unenforced;
 *   2. `engines.node` is that same major as `x` — the form Vercel accepts as a pin;
 *   3. every workflow that sets up Node reads `.nvmrc` instead of spelling a version. A literal in a
 *      workflow is the exact drift this test exists to catch: CI would stop describing the tree.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(...parts: string[]): string {
  return readFileSync(path.join(ROOT, ...parts), "utf8");
}

const nvmrc = read(".nvmrc").trim();
const pkg = JSON.parse(read("package.json")) as { engines?: { node?: string } };

describe("the Node runtime", () => {
  it(".nvmrc pins a bare major", () => {
    expect(nvmrc).toMatch(/^\d+$/);
  });

  it("engines.node pins the same major as .nvmrc", () => {
    expect(pkg.engines?.node).toBe(`${nvmrc}.x`);
  });

  it("every workflow takes the version from .nvmrc rather than a literal", () => {
    const dir = path.join(ROOT, ".github", "workflows");
    const files = readdirSync(dir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
    const withNode = files.filter((f) =>
      read(".github", "workflows", f).includes("actions/setup-node"),
    );

    expect(withNode.length).toBeGreaterThan(0);

    for (const file of withNode) {
      const text = read(".github", "workflows", file);
      expect(text, `${file} must read .nvmrc`).toContain("node-version-file: .nvmrc");
      expect(text, `${file} must not pin a literal node version`).not.toMatch(/^\s*node-version:/m);
    }
  });
});
