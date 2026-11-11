/**
 * `release.sh --check-limits` derives a Known limits block's names from the tree, proved by running it.
 *
 * The mode exists because a limits block is published verbatim as the GitHub Release body and nothing
 * else reads it: v1.3.0 shipped `lib/flow/paths.ts::answerPath`, where the file exists and the binding
 * never did, and a claim about a nav row that no row could grey. The first is a name in the tree and
 * is what these cases pin; the second is a rendered consequence and stays a human judgement.
 *
 * Every case runs the real script:
 *
 *   1. the current entry's block — the one a release is about to publish — exits 0;
 *   2. a fabricated `path::symbol` exits 1, and the message says the file exists but the binding does
 *      not, so file existence alone is visibly not the test;
 *   3. a doc comment that mentions the same symbol is still not a binding;
 *   4. a file that does not exist exits 1, and a glob that matches nothing exits 1;
 *   5. an App Router fragment resolves by suffix under `app/**` — the form `accept/page.tsx` needs,
 *      because it is not a root-relative path — and a fragment that matches two routes is a finding;
 *   6. a retracted name is struck through and skipped, deliberately, so a correction can record the
 *      false name instead of deleting it;
 *   7. a route claim (`/assessment/...`) is not judged at all: it needs `content/routes.ts`
 *      normalisation and would otherwise fail the correct bullet.
 *
 * Cases 2-7 build a throwaway tree — `release.sh`, its two helpers, and a handful of fixture files —
 * so nothing here depends on or touches the repository's own `CHANGELOG.md`.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Every child runs without the caller's `GIT_*` variables: a probe is never the caller's repo. */
const CHILD_ENV: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "test" };
for (const key of Object.keys(CHILD_ENV)) {
  if (key.startsWith("GIT_")) delete CHILD_ENV[key];
}

const probes: string[] = [];

afterEach(() => {
  while (probes.length > 0) {
    const root = probes.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function checkLimits(root: string, file: string): Run {
  const run = spawnSync("bash", ["scripts/release.sh", "--check-limits", file], {
    cwd: root,
    encoding: "utf8",
    env: CHILD_ENV,
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

/** One limits block, written where the mode can read it, and the run it produces. */
function checkBlock(root: string, block: string): Run {
  const file = join(root, "limits.md");
  writeFileSync(file, `${block}\n`);
  return checkLimits(root, file);
}

/** The newest entry's Known limits block: the candidate a release is about to publish. */
function currentLimitsBlock(): string {
  const changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
  const firstEntry = changelog.search(/^## \[/m);
  const limitsAt = changelog.indexOf("### Known limits", firstEntry);
  expect(limitsAt, "the newest CHANGELOG entry has no Known limits block").toBeGreaterThan(-1);
  const nextEntry = changelog.indexOf("\n## [", limitsAt);
  return changelog.slice(limitsAt, nextEntry === -1 ? undefined : nextEntry);
}

/**
 * A tree shaped like the repository, small enough to read: one route file per App Router shape the
 * mode distinguishes, an exports fixture, and a doc comment that names a symbol it does not export.
 */
function probe(): string {
  const root = mkdtempSync(join(tmpdir(), "release-limits-"));
  probes.push(root);

  for (const file of ["release.sh", "release-version.mjs", "release-limits.mjs"]) {
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(join(root, "scripts", file), readFileSync(join(ROOT, "scripts", file)));
  }
  writeFileSync(join(root, "package.json"), `${JSON.stringify({ name: "probe" }, null, 2)}\n`);

  const files: Record<string, string> = {
    "lib/flow/paths.ts": [
      "/**",
      " * `answerPath` used to live here; the doc block is prose, not a binding.",
      " */",
      "export const ANSWER_PATH_PREFIX = '/answer';",
      "",
      "export function answerSheetPath(id: string): string {",
      '  return ANSWER_PATH_PREFIX + "/" + id;',
      "}",
      "",
    ].join("\n"),
    "lib/reexport.ts": 'export { answerSheetPath as sheetPath } from "./flow/paths";\n',
    "data/surface-registry.ts": "export const zSurface = 1;\n",
    "components/assessment-flow/card.tsx": "export function Card() {\n  return null;\n}\n",
    "components/layout/nav-menus.tsx": "export function NavMenus() {\n  return null;\n}\n",
    "app/(mainlayout)/assessment/instances/[instanceId]/accept/page.tsx": "export default 1;\n",
    "app/(mainlayout)/instances/page.tsx": "export default 1;\n",
    "app/(mainlayout)/settings/layout.tsx": "export default 1;\n",
    "app/(mainlayout)/templates/relationship/layout.tsx": "export default 1;\n",
  };
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

describe("release.sh --check-limits", () => {
  it("passes on the current entry's Known limits block", () => {
    const file = join(tmpdir(), `limits-current-${process.pid}.md`);
    writeFileSync(file, `${currentLimitsBlock()}\n`);
    try {
      const run = checkLimits(ROOT, file);
      expect(run.stderr).toBe("");
      expect(run.status).toBe(0);
      expect(run.stdout).toContain("agrees with the tree");
    } finally {
      rmSync(file, { force: true });
    }
  });

  it("fails on a fabricated path::symbol, because the file exists and the binding does not", () => {
    const root = probe();
    const run = checkBlock(
      root,
      "- the sheet is `lib/flow/paths.ts::answerPath` and nothing else.",
    );
    expect(run.status).toBe(1);
    // The finding names both halves: the file resolvable, the export absent.
    expect(run.stderr).toContain("lib/flow/paths.ts::answerPath");
    expect(run.stderr).toContain("no binding named answerPath");
    expect(run.stderr).toContain("names 1 path(s) this tree does not carry");
  });

  it("does not read a doc comment that mentions a symbol as a binding", () => {
    // `lib/flow/paths.ts` names `answerPath` in a comment; the export is `answerSheetPath`.
    const root = probe();
    const run = checkBlock(root, "- it was called `lib/flow/paths.ts::answerPath` before.");
    expect(run.status).toBe(1);
  });

  it("resolves a symbol through an export list, aliases included", () => {
    const root = probe();
    const run = checkBlock(root, "- the sheet is reached by `lib/reexport.ts::sheetPath`.");
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("exported by lib/reexport.ts");
  });

  it("fails on a file that does not exist, and on a glob that matches nothing", () => {
    const root = probe();
    const missing = checkBlock(root, "- the sheet lives in `lib/flow/nowhere.ts`.");
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("no such file in the tree");

    const glob = checkBlock(root, "- every screen under `nowhere/**/*.tsx` is pending.");
    expect(glob.status).toBe(1);
    expect(glob.stderr).toContain("matches no file");

    const matched = checkBlock(root, "- the band is in `components/**/*.tsx`.");
    expect(matched.status).toBe(0);
    expect(matched.stdout).toContain("file(s)");
  });

  it("resolves an App Router fragment by suffix, and reports one that matches two routes", () => {
    const root = probe();
    const fragment = checkBlock(
      root,
      "- the band is rendered by `accept/page.tsx`, which is not a path from the root.",
    );
    expect(fragment.status).toBe(0);
    expect(fragment.stdout).toContain("is app/(mainlayout)/assessment/instances/[instanceId]");

    const ambiguous = checkBlock(root, "- every screen has a `layout.tsx`.");
    expect(ambiguous.status).toBe(1);
    expect(ambiguous.stderr).toContain("2 files under app/ end with layout.tsx");
  });

  it("skips a struck-through name, and only a struck-through one", () => {
    const root = probe();
    const retracted = checkBlock(
      root,
      "- it first said ~~`lib/flow/paths.ts::answerPath`~~, which the tree does not carry.",
    );
    expect(retracted.status).toBe(0);
    expect(retracted.stdout).toContain("retracted");

    // The same name, plain, is still a claim: the marker is what retracts, not the sentence around it.
    const plain = checkBlock(
      root,
      "- it first said `lib/flow/paths.ts::answerPath`, which the tree does not carry.",
    );
    expect(plain.status).toBe(1);
  });

  it("does not judge a route claim, which needs the route manifest", () => {
    const root = probe();
    const run = checkBlock(
      root,
      "- `/assessment/instances/<id>/answer` and `/v1` are not linked from the navigation.",
    );
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("quotes no path at all");
  });

  it("refuses an empty block and a missing file argument", () => {
    const root = probe();
    expect(checkLimits(root, join(root, "nothing-here.md")).status).toBe(1);

    const empty = join(root, "empty.md");
    writeFileSync(empty, "\n");
    expect(checkLimits(root, empty).status).toBe(1);

    const named = "--check-limits needs a file";
    const usage = spawnSync("bash", ["scripts/release.sh", "--check-limits"], {
      cwd: root,
      encoding: "utf8",
      env: CHILD_ENV,
    });
    expect(usage.status).toBe(2);
    expect(usage.stderr).toContain(named);
  });
});
