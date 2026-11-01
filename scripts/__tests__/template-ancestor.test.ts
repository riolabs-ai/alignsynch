/**
 * The template-ancestor header — the negative cases for `scripts/template-ancestor.ts` (#336).
 *
 * The rule is a claim about every component in the tree, so the cases below are the ways a claim
 * goes wrong: a file that never got a header, a header that names a file nobody wrote, a component
 * that names itself, an approval that no array records, an array row that outlived its rebuild, an
 * ancestry that closes on itself. Each one is asserted against a violated input, and the last
 * section asserts the real tree is clean — a rule nobody can violate in a test is a comment.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  TEMPLATE_ANCESTOR_EXEMPTIONS,
  TEMPLATE_ANCESTOR_MIN_WALKED,
  ancestorCensus,
  exportsJsx,
  firstCommentBlock,
  readAncestorHeader,
  templateAncestorFindings,
  type AncestorSource,
  type TemplateAncestorExemption,
} from "../template-ancestor";

const source = (...lines: string[]) => lines.join("\n");

const CARD = source(
  '"use client";',
  "",
  "// template-ancestor: components/ui/card.tsx   (variation: one card per row, no footer)",
  "",
  'import { Card } from "@/components/ui/card";',
  "",
  "export function Rows() {",
  "  return <Card>hello</Card>;",
  "}",
);

const EXEMPT = source(
  "/**",
  " * template-ancestor: none — approved #336",
  " *",
  " * The blind rule: withholding has no ancestor.",
  " */",
  "export function Report() {",
  "  return <section>nothing to draw</section>;",
  "}",
);

const existsWhen = (...paths: string[]) => {
  const set = new Set(paths);
  return (path: string) => set.has(path);
};

const findingsFor = (
  files: readonly AncestorSource[],
  options: { exemptions?: readonly TemplateAncestorExemption[]; existing?: string[] } = {},
) =>
  templateAncestorFindings({
    files,
    exemptions: options.exemptions ?? [],
    exists: existsWhen(...(options.existing ?? ["components/ui/card.tsx"])),
  });

/* ================================================================== *
 * The extraction — what counts as JSX, and what a header says
 * ================================================================== */

describe("exportsJsx — the scope of the rule", () => {
  it("reads a component, a fragment and a self-closing element", () => {
    assert.equal(exportsJsx("export const A = () => <Card>x</Card>;"), true);
    assert.equal(exportsJsx("export const B = () => <>x</>;"), true);
    assert.equal(exportsJsx("export const C = () => <Media />;"), true);
    assert.equal(exportsJsx('export const D = () => <div className="p-4" />;'), true);
  });

  it("does not read a type argument — `Promise<Quiz>` is not an element", () => {
    assert.equal(exportsJsx("export async function f(): Promise<Quiz> { return q; }"), false);
    assert.equal(exportsJsx("const [map] = useState<Record<string, boolean>>({});"), false);
    assert.equal(exportsJsx("type Row = { id: string };\nexport type Rows = Row[];"), false);
  });

  it("does not read a tag named in a comment or inside a string", () => {
    assert.equal(exportsJsx("/** the body is <Card>s */\nexport const x = 1;"), false);
    assert.equal(exportsJsx("// <Card /> is the ancestor\nexport const x = 1;"), false);
    assert.equal(exportsJsx('const tag = "<Card>x</Card>";\nexport const x = tag;'), false);
  });
});

describe("firstCommentBlock", () => {
  it("skips a leading directive and the blank lines under it", () => {
    assert.equal(
      firstCommentBlock(source('"use client";', "", "// one", "// two", "import x from 'y';")),
      "// one\n// two",
    );
  });

  it("returns the docblock, and nothing when the file opens with code", () => {
    assert.match(firstCommentBlock("/**\n * hello\n */\nimport x;"), /hello/);
    assert.equal(firstCommentBlock('import x from "y";'), "");
  });
});

describe("readAncestorHeader", () => {
  it("reads the ancestor form out of a `//` block", () => {
    assert.deepEqual(readAncestorHeader(CARD), {
      kind: "ancestor",
      ancestor: "components/ui/card.tsx",
      variation: "one card per row, no footer",
    });
  });

  it("reads the ancestor form out of a docblock", () => {
    const doc = source(
      "/**",
      " * template-ancestor: components/quiz/quiz-play.tsx   (variation: five-notch bands, no timer)",
      " *",
      " * The play surface.",
      " */",
    );
    assert.deepEqual(readAncestorHeader(doc), {
      kind: "ancestor",
      ancestor: "components/quiz/quiz-play.tsx",
      variation: "five-notch bands, no timer",
    });
  });

  it("reads an approved exception, with an em dash or a hyphen", () => {
    assert.deepEqual(readAncestorHeader(EXEMPT), { kind: "none", issue: 336 });
    assert.deepEqual(readAncestorHeader("// template-ancestor: none - approved #12\n"), {
      kind: "none",
      issue: 12,
    });
  });

  it("returns null when the block carries no header, and quotes a malformed one", () => {
    assert.equal(readAncestorHeader("/**\n * just prose\n */\n"), null);
    assert.equal(readAncestorHeader('import x from "y";'), null);
    assert.deepEqual(readAncestorHeader("// template-ancestor: somewhere\n"), {
      kind: "malformed",
      raw: "somewhere",
    });
  });
});

/* ================================================================== *
 * The rules — every way a claim goes wrong, violated on purpose
 * ================================================================== */

describe("templateAncestorFindings", () => {
  it("passes a file that names a real ancestor, and counts it", () => {
    const files = [{ path: "components/x/rows.tsx", source: CARD }];
    assert.deepEqual(findingsFor(files), []);
    assert.deepEqual(ancestorCensus(files), { walked: 1, withAncestor: 1, approved: 0 });
  });

  it("fails a component with no header at all — the case the rule exists for", () => {
    const found = findingsFor([
      { path: "components/x/bare.tsx", source: source("export const A = () => <p>x</p>;") },
    ]);
    assert.equal(found.length, 1);
    assert.equal(found[0]?.rule, "E35");
    assert.match(
      String(found[0]?.message),
      /components\/x\/bare\.tsx: no template-ancestor header/,
    );
    assert.match(String(found[0]?.message), /none — approved #<issue>/);
  });

  it("fails a header that names a file nobody wrote", () => {
    const found = findingsFor([
      {
        path: "components/x/ghost.tsx",
        source:
          "// template-ancestor: components/x/invented.tsx   (variation: the whole band)\nexport const A = () => <p>x</p>;",
      },
    ]);
    assert.equal(found.length, 1);
    assert.match(String(found[0]?.message), /no such file exists/);
  });

  it("fails a component that names itself, and an ancestor outside components/", () => {
    const itself = findingsFor([
      {
        path: "components/x/self.tsx",
        source:
          "// template-ancestor: components/x/self.tsx   (variation: everything)\nexport const A = () => <p>x</p>;",
      },
    ]);
    assert.equal(itself.length, 1);
    assert.match(String(itself[0]?.message), /names itself/);

    const outside = findingsFor([
      {
        path: "components/x/lib.tsx",
        source:
          "// template-ancestor: lib/thing.tsx   (variation: everything)\nexport const A = () => <p>x</p>;",
      },
    ]);
    assert.equal(outside.length, 1);
    assert.match(String(outside[0]?.message), /an ancestor is a component under components\//);
  });

  it("fails a variation that says nothing", () => {
    const found = findingsFor([
      {
        path: "components/x/empty.tsx",
        source:
          "// template-ancestor: components/ui/card.tsx   (variation: .)\nexport const A = () => <p>x</p>;",
      },
    ]);
    assert.equal(found.length, 1);
    assert.match(String(found[0]?.message), /says nothing/);
  });

  it("fails an unapproved `none`, and an approval the array records differently", () => {
    const unapproved = findingsFor([{ path: "components/x/none.tsx", source: EXEMPT }]);
    assert.equal(unapproved.length, 1);
    assert.match(String(unapproved[0]?.message), /does not carry/);

    const mismatch = findingsFor([{ path: "components/x/none.tsx", source: EXEMPT }], {
      exemptions: [{ file: "components/x/none.tsx", issue: 999, reason: "approved elsewhere" }],
    });
    assert.equal(mismatch.length, 1);
    assert.match(String(mismatch[0]?.message), /approved on #336 .* records #999/);
  });

  it("fails an exemption row whose file has since been rebuilt onto an ancestor", () => {
    const found = findingsFor([{ path: "components/x/rows.tsx", source: CARD }], {
      exemptions: [{ file: "components/x/rows.tsx", issue: 336, reason: "predates the rule" }],
    });
    assert.equal(found.length, 1);
    assert.match(String(found[0]?.message), /the rebuild landed, so delete the row/);
  });

  it("fails an exemption row for a file the walk does not have", () => {
    const found = findingsFor([{ path: "components/x/rows.tsx", source: CARD }], {
      exemptions: [{ file: "components/x/gone.tsx", issue: 336, reason: "deleted surface" }],
    });
    assert.equal(found.length, 1);
    assert.match(
      String(found[0]?.message),
      /components\/x\/gone\.tsx: is in TEMPLATE_ANCESTOR_EXEMPTIONS/,
    );
  });

  it("fails an ancestry that closes on itself", () => {
    const a =
      "// template-ancestor: components/x/b.tsx   (variation: bands, no timer)\nexport const A = () => <p>x</p>;";
    const b =
      "// template-ancestor: components/x/a.tsx   (variation: cards, no footer)\nexport const B = () => <p>x</p>;";
    const found = findingsFor(
      [
        { path: "components/x/a.tsx", source: a },
        { path: "components/x/b.tsx", source: b },
      ],
      { existing: ["components/x/a.tsx", "components/x/b.tsx"] },
    );
    assert.equal(found.length, 1);
    assert.match(String(found[0]?.message), /closes on itself/);
    assert.match(
      String(found[0]?.message),
      /components\/x\/a\.tsx → components\/x\/b\.tsx → components\/x\/a\.tsx/,
    );
  });

  it("fails the walk itself when it read nothing", () => {
    const found = findingsFor([]);
    assert.equal(found.length, 1);
    assert.match(String(found[0]?.message), /read 0 components/);
  });
});

/* ================================================================== *
 * The tree this ships in
 * ================================================================== */

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
      continue;
    }
    if (!entry.endsWith(".tsx")) continue;
    files.push(
      full
        .slice(process.cwd().length + 1)
        .split("\\")
        .join("/"),
    );
  }
  return files;
}

const realComponents: AncestorSource[] = walk(join(process.cwd(), "components"))
  .filter((path) => !path.startsWith("components/ui/"))
  .map((path) => ({ path, source: readFileSync(join(process.cwd(), path), "utf8") }));

const realFiles = realComponents.filter((file) => exportsJsx(file.source));

describe("the real tree", () => {
  it("has a header on every component that renders JSX", () => {
    assert.deepEqual(
      templateAncestorFindings({
        files: realFiles,
        exemptions: TEMPLATE_ANCESTOR_EXEMPTIONS,
        exists: (path) => {
          try {
            statSync(join(process.cwd(), path));
            return true;
          } catch {
            return false;
          }
        },
      }),
      [],
    );
  });

  it("walked a tree, not an empty list — the census is what makes the clean answer mean something", () => {
    const census = ancestorCensus(realFiles);
    assert.ok(
      census.walked >= TEMPLATE_ANCESTOR_MIN_WALKED,
      `expected at least ${TEMPLATE_ANCESTOR_MIN_WALKED} components, read ${census.walked}`,
    );
    assert.equal(
      census.walked,
      census.withAncestor + census.approved,
      "every walked component is either a variation or an approved exception",
    );
    assert.equal(
      census.approved,
      TEMPLATE_ANCESTOR_EXEMPTIONS.length,
      "the approved count and the exemption array are the same list",
    );
    assert.ok(
      realComponents.every((file) => !file.path.startsWith("components/ui/")),
      "components/ui/** is vendored and stays out of the walk",
    );
    assert.ok(
      realComponents.length > realFiles.length,
      "some .tsx files under components/ hold no JSX and are correctly out of scope",
    );
  });
});
