/**
 * The glossary is generated from the schema comments (#138), so the cases worth proving are
 * the ones the generator's contract is made of:
 *
 *   1. all seven terms come out, each naming the file its prose came from;
 *   2. `--check` is green on a fresh page and red once a comment moves — a stale page is
 *      the drift the CI step exists to catch;
 *   3. a missing comment fails the run and names the type, instead of falling back to
 *      prose somebody wrote by hand;
 *   4. the same rule holds for the two kinds of source: a JSDoc block above a declaration
 *      (Template, Aspect, Opinion, Gap) and a term line in the file's leading comment
 *      (Record, Item, Instance).
 *
 * Every case runs the real script against a sandbox copy of the three schema files, so the
 * assertions are about the bytes the gate would compare, not about a helper exported for
 * the test's convenience.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT = join(ROOT, "scripts/gen-glossary.mjs");
const SCHEMA_FILES = ["content/record.ts", "content/assessment.ts", "content/quiz.ts"];
const TERMS = ["Record", "Item", "Template", "Instance", "Aspect", "Opinion", "Gap"];

const sandboxes: string[] = [];

/** A copy of the three schema files, so a case can break a comment without touching `content/`. */
function sandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "glossary-"));
  sandboxes.push(dir);
  mkdirSync(join(dir, "content"), { recursive: true });
  for (const file of SCHEMA_FILES) copyFileSync(join(ROOT, file), join(dir, file));
  return dir;
}

function generate(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, "--root", dir, ...args], { encoding: "utf8" });
}

/** Remove the JSDoc block directly above `export … <declaration>` in a sandbox file. */
function stripDocAbove(dir: string, file: string, declaration: string): void {
  const path = join(dir, file);
  const lines = readFileSync(path, "utf8").split("\n");
  const at = lines.findIndex((line) =>
    new RegExp(`^export (?:const|type|function) ${declaration}\\b`).test(line),
  );
  if (at === -1) throw new Error(`${declaration} is not declared in ${file}`);
  let start = at - 1;
  while (start >= 0 && !lines[start].startsWith("/**")) start -= 1;
  if (start === -1) throw new Error(`${declaration} has no JSDoc block to remove`);
  lines.splice(start, at - start);
  writeFileSync(path, lines.join("\n"));
}

/** Remove a term line (`*   Term  definition`) from a sandbox file's leading comment. */
function stripGlossaryLine(dir: string, file: string, term: string): void {
  const path = join(dir, file);
  const lines = readFileSync(path, "utf8").split("\n");
  const at = lines.findIndex((line) => new RegExp(`^ \\* {3}${term} {2,}`).test(line));
  if (at === -1) throw new Error(`${term} has no glossary line in ${file}`);
  lines.splice(at, 1);
  writeFileSync(path, lines.join("\n"));
}

afterAll(() => {
  for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true });
});

describe("docs/glossary.md", () => {
  it("defines all seven terms and names the file each came from", () => {
    const dir = sandbox();
    const run = generate(dir);
    expect(run.status, run.stderr).toBe(0);

    const page = readFileSync(join(dir, "docs/glossary.md"), "utf8");
    const headings = [...page.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings).toEqual(TERMS);

    // One `Source:` line per term, and every one of them a file that exists in the tree.
    const sources = [...page.matchAll(/^Source: \[([^\]]+)\]\(([^)]+)\)/gm)].map((match) => [
      match[1],
      match[2],
    ]);
    expect(sources).toHaveLength(TERMS.length);
    for (const [label, target] of sources) {
      expect(SCHEMA_FILES).toContain(label);
      expect(readFileSync(join(dir, "docs", target), "utf8").length).toBeGreaterThan(0);
    }
  });

  it("is current in this checkout, and goes red when a schema comment moves", () => {
    // The committed page is what the gate compares, so this is the drift test in miniature.
    expect(generate(ROOT, "--check").status).toBe(0);

    const dir = sandbox();
    expect(generate(dir).status).toBe(0);
    expect(generate(dir, "--check").status).toBe(0);

    // A comment edited and the page not regenerated: exactly what CI has to catch.
    const file = join(dir, "content/record.ts");
    const before = readFileSync(file, "utf8");
    writeFileSync(
      file,
      before.replace(
        "A template — a record that holds items",
        "A template — a record that holds rows",
      ),
    );
    expect(readFileSync(file, "utf8")).not.toBe(before);
    const stale = generate(dir, "--check");
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain("docs/glossary.md is stale");
    expect(stale.stderr).toContain("committed:");
    expect(stale.stderr).toContain("generated:");
  });

  it("fails naming the type when a JSDoc block is missing, and writes nothing", () => {
    const dir = sandbox();
    stripDocAbove(dir, "content/record.ts", "zTemplate");

    const run = generate(dir);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("no comment for Template");
    expect(run.stderr).toContain("content/record.ts");
    expect(readFileSync(join(dir, "content/record.ts"), "utf8")).not.toContain(
      "A template — a record that holds items",
    );
    expect(() => readFileSync(join(dir, "docs/glossary.md"), "utf8")).toThrow();
  });

  it("fails naming the type when a glossary line is missing", () => {
    const dir = sandbox();
    stripGlossaryLine(dir, "content/record.ts", "Instance");

    const run = generate(dir);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("no comment for AssessmentInstance");
    expect(() => readFileSync(join(dir, "docs/glossary.md"), "utf8")).toThrow();
  });
});
