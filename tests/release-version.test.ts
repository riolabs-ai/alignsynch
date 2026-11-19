/**
 * The version classifier the release script cuts by, asserted as cases rather than prose.
 *
 * `scripts/release.sh` used to answer every version question with one `x.y.z` pattern and one awk
 * that split on `.` and compared three integers. That combination refused `1.1.0-rc1` outright, so
 * no release candidate could pass the gate, and it would have refused the *final* release after
 * the candidate as well (`"0-rc1" + 0` is `0`, so `1.1.0-rc1 -> 1.1.0` read as "not a bump").
 *
 * Semver precedence is not integer comparison, so it lives in `scripts/release-version.mjs` and is
 * pinned here: validity, the pattern the CHANGELOG parser greps with, and the bump guard — the
 * three answers the shell reads back as exit codes.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  VERSION_TOKEN,
  compareVersions,
  isBump,
  isPrerelease,
  isVersion,
  normalizeVersion,
  stripV,
} from "../scripts/release-version.mjs";

const CLI = fileURLToPath(new URL("../scripts/release-version.mjs", import.meta.url));

/** The exit code the shell reads, with stderr left out of the comparison on purpose. */
function cli(...args: string[]): number {
  const run = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return run.status ?? -1;
}

/** The words a verb prints, for `normalize` and `compare`. */
function cliOut(...args: string[]): { status: number; stdout: string } {
  const run = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return { status: run.status ?? -1, stdout: (run.stdout ?? "").trim() };
}

describe("a version is semver, not three integers", () => {
  const versions = [
    "1.0.0",
    "0.9.9",
    "1.1.0-rc1",
    "1.1.0-beta.2",
    "1.1.0-rc.1",
    "1.1.0+build.5",
    "1.1.0-rc.1+build.5",
  ];

  it.each(versions)("accepts %s", (version) => {
    expect(isVersion(version)).toBe(true);
  });

  it.each(["1.1.0.0", "1.1", "v1.1.0", "1.1.0-", "1.1.0+", "01.1.0", "1.1.0-01", "", " 1.1.0"])(
    "refuses %j",
    (version) => {
      expect(isVersion(version)).toBe(false);
    },
  );

  it("tells a pre-release from build metadata on a final version", () => {
    expect(isPrerelease("1.1.0-rc1")).toBe(true);
    expect(isPrerelease("1.1.0-beta.2")).toBe(true);
    expect(isPrerelease("1.1.0")).toBe(false);
    // `+build` is metadata: same precedence as the release it decorates, and not a pre-release.
    expect(isPrerelease("1.1.0+build.5")).toBe(false);
    expect(isPrerelease("1.1.0.0")).toBe(false);
  });
});

describe("the pattern the CHANGELOG parser greps with", () => {
  // `scripts/release.sh` interpolates this string into `grep -E` (headings, insertion point) and
  // into an awk regex (the footer stop). Asserting the token instead of the script's text keeps
  // the guarantee where the guarantee lives: one pattern, used three ways.
  const heading = new RegExp(`^## \\[${VERSION_TOKEN}\\]`);
  const footer = new RegExp(`^\\[${VERSION_TOKEN}\\]: `);

  it("sees a pre-release heading as an entry", () => {
    expect(heading.test("## [1.1.0-rc1] - 2026-10-31")).toBe(true);
    expect(heading.test("## [1.0.0] - 2026-10-30")).toBe(true);
    expect(heading.test("## [Unreleased] - 2026-10-30")).toBe(false);
    expect(heading.test("## [1.1.0.0] - 2026-10-30")).toBe(false);
  });

  it("sees a pre-release footer as a link definition, so an entry cannot swallow it", () => {
    expect(footer.test("[1.1.0-rc1]: https://example.test/compare/v1.0.0...v1.1.0-rc1")).toBe(true);
    expect(footer.test("[1.0.0]: https://example.test/releases/tag/v1.0.0")).toBe(true);
    expect(footer.test("- `feat` — a bullet with [a link](https://example.test)")).toBe(false);
  });
});

describe("the bump guard", () => {
  // `1.0.0 -> 1.1.0-rc1` is how a candidate is cut, `1.1.0-rc1 -> 1.1.0` is how the release after
  // it lands, and everything else here must be refused: a cut only ever moves forward.
  it.each([
    ["1.0.0", "1.1.0-rc1", true],
    ["1.1.0-rc1", "1.1.0", true],
    ["1.0.0", "2.0.0", true],
    ["1.1.0-rc1", "1.1.0-rc2", true],
    ["1.1.0-alpha", "1.1.0-beta", true],
    ["1.1.0", "1.1.0-rc1", false],
    ["1.1.0-rc1", "1.1.0-rc1", false],
    ["1.1.0", "1.1.0", false],
    ["1.0.0", "0.9.9", false],
    ["1.1.0.0", "1.1.0", false],
    ["v1.1.0", "1.1.0", false],
    ["1.1.0", "1.1.0.0", false],
    ["1.1.0+build.5", "1.1.0", false], // equal precedence: metadata is not a bump
  ])("%s -> %s is a bump: %s", (from, to, expected) => {
    expect(isBump(from, to)).toBe(expected);
  });
});

describe("semver precedence, in the order the spec states it", () => {
  it("orders a pre-release below its release", () => {
    expect(compareVersions("1.1.0-rc1", "1.1.0")).toBe(-1);
    expect(compareVersions("1.1.0", "1.1.0-rc1")).toBe(1);
    expect(compareVersions("1.1.0", "1.1.0+build.5")).toBe(0);
  });

  it("compares identifiers by number before text", () => {
    expect(compareVersions("1.1.0-rc.2", "1.1.0-rc.10")).toBe(-1); // 10 > 2, unlike "rc.10" < "rc.2"
    expect(compareVersions("1.1.0-1", "1.1.0-alpha")).toBe(-1); // a number sorts below a word
    expect(compareVersions("1.1.0-alpha", "1.1.0-beta")).toBe(-1);
  });

  it("reads a malformed version as no answer, not as a guess", () => {
    expect(compareVersions("1.1.0.0", "1.1.0")).toBeNull();
    expect(compareVersions("1.1.0", "v1.1.0")).toBeNull();
  });
});

describe("the CLI, which is how the shell asks", () => {
  it("prints the pattern the script greps with", () => {
    const token = execFileSync(process.execPath, [CLI, "token"], { encoding: "utf8" }).trim();
    expect(token).toBe(VERSION_TOKEN);
  });

  it("answers yes with 0 and no with 1", () => {
    expect(cli("valid", "1.1.0-rc1")).toBe(0);
    expect(cli("valid", "1.1.0.0")).toBe(1);
    expect(cli("prerelease", "1.1.0-rc1")).toBe(0);
    expect(cli("prerelease", "1.1.0")).toBe(1);
    expect(cli("bump", "1.0.0", "1.1.0-rc1")).toBe(0);
    expect(cli("bump", "1.1.0", "1.1.0-rc1")).toBe(1);
    expect(cli("bump", "1.1.0-rc1")).toBe(2); // usage, not "no": the caller is wrong
  });
});

/* -------------------------------------------------------------------------- *
 * #1248 — one normaliser, and the tagged spelling is not a second version
 * -------------------------------------------------------------------------- */

describe("the tag prefix, accepted once (#1248)", () => {
  // Found by the `v2.0.0-rc1.3` cut, measured rather than guessed: `pnpm release:preflight
  // v2.0.0-rc1.3` passed ten checks, `bash scripts/release.sh --tag-only v2.0.0-rc1.3` exited 2 with
  // "'v2.0.0-rc1.3' is not a semantic version", and `node scripts/release-record.mjs check
  // v2.0.0-rc1.3` reported `vv2.0.0-rc1.3` — the double prefix is the tell that each script had its
  // own idea of the spelling. One function strips it now, and the strict answers stay strict.

  it("strips the prefix once, never as a global replace", () => {
    expect(stripV("v2.0.0-rc1.3")).toBe("2.0.0-rc1.3");
    expect(stripV("2.0.0-rc1.3")).toBe("2.0.0-rc1.3");
    expect(stripV("vv1.1.0")).toBe("v1.1.0"); // one `v` off, and the survivor is not a version
    expect(stripV("")).toBe("");
  });

  it("normalises either spelling to the bare version", () => {
    expect(normalizeVersion("v2.0.0-rc1.3")).toBe("2.0.0-rc1.3");
    expect(normalizeVersion("2.0.0-rc1.3")).toBe("2.0.0-rc1.3");
    expect(normalizeVersion("v1.1.0+build.5")).toBe("1.1.0+build.5");
  });

  it("does not buy the `v` form by accepting a malformed version", () => {
    // The MUST NOT from #1248, as cases: a normaliser that widened validity would make every caller
    // below it accept these, and a tag would then be cut from a string no parser agrees with.
    expect(normalizeVersion("vv2.0.0-rc1.3")).toBeNull();
    expect(normalizeVersion("1.1.0.0")).toBeNull();
    expect(normalizeVersion("01.0.0")).toBeNull();
    expect(normalizeVersion("1.1")).toBeNull();
    expect(normalizeVersion("")).toBeNull();
    expect(normalizeVersion(undefined)).toBeNull();
  });

  it("leaves the library answers bare-semver only", () => {
    // `isVersion` and `compareVersions` are the strict layer; if these ever pass, the normaliser has
    // been folded into validity and the suite above stopped meaning anything.
    expect(isVersion("v2.0.0-rc1.3")).toBe(false);
    expect(compareVersions("2.0.0-rc1.3", "v2.0.0-rc1.3")).toBeNull();
  });
});

describe("the CLI answers the same for either spelling (#1248)", () => {
  it.each(["2.0.0-rc1.3", "v2.0.0-rc1.3"])("valid %s is a version", (version) => {
    expect(cli("valid", version)).toBe(0);
  });

  it.each(["1.1.0.0", "01.0.0", "1.1", "vv2.0.0-rc1.3"])(
    "valid %j is not, tagged spelling or not",
    (version) => {
      expect(cli("valid", `v${version}`)).toBe(1);
      expect(cli("valid", version)).toBe(1);
    },
  );

  it.each(["2.0.0-rc1.3", "v2.0.0-rc1.3"])("prerelease %s is a pre-release", (version) => {
    expect(cli("prerelease", version)).toBe(0);
  });

  it("bumps across the two spellings", () => {
    expect(cli("bump", "2.0.0-rc1.2", "2.0.0-rc1.3")).toBe(0);
    expect(cli("bump", "v2.0.0-rc1.2", "2.0.0-rc1.3")).toBe(0);
    expect(cli("bump", "2.0.0-rc1.2", "v2.0.0-rc1.3")).toBe(0);
    expect(cli("bump", "v2.0.0-rc1.3", "2.0.0-rc1.3")).toBe(1); // the same version is not a bump
    expect(cli("bump", "v2.0.0-rc1.3", "v2.0.0-rc1.2")).toBe(1);
  });

  it("compares across the two spellings, and prints the order", () => {
    expect(cliOut("compare", "v2.0.0-rc1.2", "2.0.0-rc1.3")).toEqual({ status: 0, stdout: "-1" });
    expect(cliOut("compare", "2.0.0-rc1.3", "v2.0.0-rc1.2")).toEqual({ status: 0, stdout: "1" });
    expect(cliOut("compare", "v2.0.0-rc1.3", "2.0.0-rc1.3")).toEqual({ status: 0, stdout: "0" });
    expect(cli("compare", "vv2.0.0", "2.0.0")).toBe(2); // not a version: usage, never a guess
  });

  it("prints the bare form for a script to hold", () => {
    expect(cliOut("normalize", "v2.0.0-rc1.3")).toEqual({ status: 0, stdout: "2.0.0-rc1.3" });
    expect(cliOut("normalize", "2.0.0-rc1.3")).toEqual({ status: 0, stdout: "2.0.0-rc1.3" });
    expect(cliOut("normalize", "vv2.0.0-rc1.3")).toEqual({ status: 1, stdout: "" });
  });
});
