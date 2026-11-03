/**
 * brand-word — E37: the alignment brand never names the template.
 *
 * Two products ship from this tree. `BRAND=quizhub` is the start template, a first-class product
 * with its own name, its own copy and its own parity snapshot; `BRAND=alignsynch` is the
 * relationship product built on top of it. The template is allowed to say its own name on every
 * page it renders. The other brand is not: an alignment visitor reading "QuizHub" has been told
 * they are looking at somebody else's product, and once the words are in a fixture no typecheck,
 * lint rule or hash can see them — a hash only moves when a route's output changes, which is
 * precisely the case where the copy was already wrong.
 *
 * So the claim is checked at the copy layer, where the words live:
 *
 *     every reader-visible string the alignment build renders is free of the template's name
 *
 * ## Which fixtures are in the render set
 *
 * Not "every fixture" — `data/pages/explore.ts` is quiz copy, and it naming QuizHub is correct on
 * the one brand that renders it. The render set is derived from two facts the tree already holds:
 *
 *   `pageCopyBudget`   route → the page module Next mounts → the fixture that page renders (E23)
 *   `requireQuizProduct()`   the page's own gate: on this brand the route is a 404, so nothing it
 *                            renders reaches a reader
 *
 * A surface is in the set when its page module does **not** call the gate. That derivation is the
 * whole point of the rule rather than a list of files: a file list is widened by editing it, and
 * the two facts above are the boundary itself — adding a quiz surface means gating its page, and
 * the gate is what exempts it here.
 *
 * Two corrections ride on top, and both are named:
 *
 *   `ALIGNMENT_COPY_OVERRIDES`  a shared route whose copy this brand replaces. `/` is the one:
 *                               `app/(marketing)/page.tsx` switches on `brandIdOf(brand)` and
 *                               mounts the alignment composition from `home-alignsynch.ts`, so
 *                               `data/pages/home.ts` (the template's front page) is not what an
 *                               alignment reader sees.
 *   `ALIGNMENT_COPY_EXTRAS`     copy fixtures with no budget row of their own: the brand record
 *                               itself, whose `name`, `description` and `legalName` are printed in
 *                               the title bar, the metadata and the OG image.
 *
 * ## What "reader-visible" means, and why comments are not it
 *
 * The walk is a TypeScript AST, not grep: `template-ancestor:` headers and the comments that
 * explain *why* a fixture used to say the template's name are engineering provenance (#336
 * depends on them), and a rule that failed on them would delete the record of its own reason.
 * Within the AST, `id` is skipped because it is the handle the view joins on and `href` because it
 * is a route — neither is a sentence. Everything else is copy, which is the safe default: a field
 * added to `PageCopy` tomorrow is checked without this module being edited.
 *
 * A template literal is read by its **fragments**: `across${brand.name}.` contributes "across" and
 * ".", so the brand-interpolated sentence the shell renders ("acrossAlignSynch.") passes on the
 * alignment build and the same source passes on the quiz build. That is deliberate — the rule
 * reads what the fixture *spells*, and the brand's own name is not spelled.
 *
 * ## The allowance table only shrinks, and cannot be widened in place
 *
 * `BRAND_WORD_ALLOWANCES` names an **exact** string in an exact file, with the reason it is
 * legal. There is no file-level exemption: the one row below is the template brand's own chrome
 * fixture, which this brand never mounts, and allowing its file instead would also allow every
 * other string in it. An allowance nothing needs is itself a finding, so the table cannot be
 * pre-widened for a string somebody is about to add, and a string moved to another fixture stops
 * matching rather than following its row.
 *
 * ## Every file that may contain the word, and which side of the rule it is on
 *
 * Named here so a reviewer can check the boundary without reading the walker. Only the first two
 * are scanned; the rest are outside the render set by construction, not by an allowance:
 *
 *   `data/pages/marketing.ts`      scanned — one exact string allowed (`quizHubMarketingCopy`,
 *                                  the template brand's chrome, #317)
 *   `data/brands/alignsynch.ts`    scanned — the brand record; it names the template nowhere
 *   `data/brand.ts`                not read — the **template's** record (`name: "QuizHub"`), which
 *                                  `resolveBrand` hands to a quiz build and never to this one
 *   `tests/parity/**`              not read — the harness compares both brands and must name both
 *   `components/**` comments       not read — `template-ancestor:` headers and the notes that
 *                                  record why a surface changed are provenance (#336)
 *   `data/pages/**` comments       not read — the same, in the fixtures
 *   `docs/**`, `README.md`,           not read — prose and an image, other cards' scope
 *   `app/opengraph-image.tsx`
 *
 * A page is not scanned at all: `E23` already fails a copy literal in `app/**` or `components/**`,
 * so a page's words reach a reader through its fixture, which is what this rule reads.
 */
import ts from "typescript";

/** The template's name, matched case-insensitively: `quizhub`, `QuizHub`, `QUIZHUB`. */
export const BRAND_WORD = "quizhub";

/** The pattern every reader-visible string is asked about. */
export const BRAND_WORD_PATTERN = new RegExp(BRAND_WORD, "i");

/** A source file, repo-relative path plus its text — what every pure rule here takes. */
export interface BrandWordSource {
  path: string;
  source: string;
}

/** One reader-visible string, with the line that spells it. */
export interface ReaderString {
  file: string;
  line: number;
  value: string;
}

/** One copy surface, as `data/pages/budget.ts` records it. */
export interface CopySurface {
  route: string;
  /** The page module Next mounts the surface from, repo-relative with its extension. */
  page: string;
  /** The fixture the page renders, extensionless (`data/pages/pricing`). */
  fixture: string;
}

/** One string the alignment brand is allowed to say anyway, and why. */
export interface BrandWordAllowance {
  file: string;
  value: string;
  reason: string;
}

export interface BrandWordProblem {
  rule: "E37";
  message: string;
}

/** What the rule measured — printed on both paths, so a passing run still shows its scope. */
export interface BrandWordCensus {
  /** The fixtures the alignment build reads copy from, sorted. */
  fixtures: string[];
  /** Reader-visible strings walked across them. */
  strings: number;
  /** Page modules that gate themselves out of this brand. */
  gated: number;
  /** Allowance rows that a walked string actually used. */
  allowances: number;
}

export interface BrandWordInput {
  /** `pageCopyBudget`, flattened to the three fields this rule reads. */
  surfaces: readonly CopySurface[];
  /** Page modules whose source calls `requireQuizProduct()` — the quiz product's own routes. */
  gated: readonly string[];
  /** Route → the fixture this brand mounts instead of the shared one. */
  overrides: Readonly<Record<string, string>>;
  /** Fixtures with no budget row that this brand renders. */
  extras: readonly string[];
  /** Every fixture source the walk may read, keyed by `path`. */
  files: readonly BrandWordSource[];
  allowances: readonly BrandWordAllowance[];
}

/** The floor: a walk that resolved fewer fixtures than this has stopped reading the tree. */
export const ALIGNMENT_FIXTURES_MIN_WALKED = 30;

/**
 * The strings the alignment brand may say even though they name the template. One row, exact.
 *
 * `quizHubMarketingCopy` is the `(marketing)` chrome for the **template** brand (#317): its
 * footer line describes a quiz platform, and `app/(marketing)/layout.tsx` mounts
 * `marketingPageCopy` — not this — so no alignment page renders these words. The row allows that
 * one sentence, not the file: `marketingPageCopy` sits in the same module, and a QuizHub string
 * added to *it* is still a finding.
 */
export const BRAND_WORD_ALLOWANCES: readonly BrandWordAllowance[] = [
  {
    file: "data/pages/marketing.ts",
    value: "QuizHub is a quiz platform — create a quiz, play one, share it.",
    reason:
      "quizHubMarketingCopy — the template brand's own chrome (#317); the alignment build mounts marketingPageCopy instead",
  },
];

/**
 * Routes whose copy this brand replaces outright.
 *
 * `/` is the only one: `app/(marketing)/page.tsx` asks `brandIdOf(brand)` and returns
 * `QuizHubHome` or the alignment composition, so the fixture an alignment reader sees is
 * `data/pages/home-alignsynch.ts` and never `data/pages/home.ts`. A second entry here means a
 * second composition switch, and the page it lives in belongs beside this row.
 */
export const ALIGNMENT_COPY_OVERRIDES: Readonly<Record<string, string>> = {
  "/": "data/pages/home-alignsynch",
};

/**
 * Copy fixtures with no `pageCopyBudget` row that this brand renders.
 *
 * The brand record is not page copy — no `PageCopy` schema holds it — but its `name`,
 * `description` and `legalName` are printed in the tab, the metadata and the OG image, so a quiz
 * name typed there is the same defect in a different shape.
 */
export const ALIGNMENT_COPY_EXTRAS: readonly string[] = ["data/brands/alignsynch"];

/** Strip a TS/TSX extension, so `data/pages/pricing.ts` and `data/pages/pricing` compare equal. */
export function fixtureKey(path: string): string {
  return path.replace(/\.tsx?$/, "");
}

/**
 * The page modules that answer 404 on this brand — every `page.tsx` whose source calls
 * `requireQuizProduct()`.
 *
 * Read through the AST rather than a regex: a comment that *mentions* the helper must not exempt
 * its page, because that would be a comment widening the one list the rule is built to keep
 * narrow. The call is the page's own statement that the surface does not exist here.
 */
export function gatedPages(files: readonly BrandWordSource[]): string[] {
  const gated = new Set<string>();
  for (const file of files) {
    if (!/(^|\/)page\.tsx?$/.test(file.path)) continue;
    const source = ts.createSourceFile(
      file.path,
      file.source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const calls = (node: ts.Node): boolean => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "requireQuizProduct"
      ) {
        return true;
      }
      return ts.forEachChild(node, calls) === true;
    };
    if (calls(source)) gated.add(file.path);
  }
  return [...gated].sort();
}

/**
 * Every reader-visible string in one fixture.
 *
 * `id` and `href` are skipped (a handle and a route, never prose), object keys are skipped (a key
 * is the join, not the sentence), and module specifiers are skipped. Template literals are read as
 * their literal fragments — `${brand.name}` contributes nothing, which is exactly right: it
 * resolves to whichever brand is building, so the fixture did not spell a name.
 */
export function readerStrings(file: BrandWordSource): ReaderString[] {
  const found: ReaderString[] = [];
  const source = ts.createSourceFile(
    file.path,
    file.source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const isCopy = (node: ts.Node): boolean => {
    const parent = node.parent;
    if (parent === undefined) return true;
    // A property key is a handle: `{ id: "hero-fineprint" }`.
    if (
      (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) &&
      parent.name === node
    ) {
      return false;
    }
    // `id` is the id the view joins on; `href` is a route. Neither is a sentence.
    if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
      if (parent.name.text === "id" || parent.name.text === "href") return false;
    }
    // A module specifier is a path, not copy.
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return false;
    return true;
  };

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (isCopy(node)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        found.push({ file: file.path, line: line + 1, value: node.text });
      }
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      if (isCopy(node)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        found.push({ file: file.path, line: line + 1, value: node.text });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

/**
 * The fixtures the alignment build reads copy from, in a stable order.
 *
 * A gated surface contributes nothing. An override replaces the shared fixture for that route;
 * a route the budget records with no page at all still counts (the fixture is copy somebody
 * authored for a surface, and this brand serving it is a question the route manifest answers).
 */
export function alignmentFixtures(input: {
  surfaces: readonly CopySurface[];
  gated: readonly string[];
  overrides: Readonly<Record<string, string>>;
  extras: readonly string[];
}): string[] {
  const gated = new Set(input.gated);
  const fixtures = new Set<string>(input.extras);
  for (const surface of input.surfaces) {
    if (gated.has(surface.page)) continue;
    fixtures.add(input.overrides[surface.route] ?? surface.fixture);
  }
  return [...fixtures].sort();
}

/**
 * The rule: no reader-visible string the alignment build renders matches `BRAND_WORD_PATTERN`,
 * except the exact strings `ALLOWANCES` names.
 *
 * Findings are `file:line` so the diagnostic is clickable, and they say what to do: align the
 * words, or gate the page. Allowances that nothing used are findings too — an allowance is a
 * decision about one string, and one that outlived its string is a hole somebody can walk through
 * later.
 */
export function brandWordFindings(input: BrandWordInput): {
  problems: BrandWordProblem[];
  census: BrandWordCensus;
} {
  const problems: BrandWordProblem[] = [];
  const fixtures = alignmentFixtures(input);
  const sources = new Map(input.files.map((file) => [fixtureKey(file.path), file]));

  const usedAllowances = new Set<BrandWordAllowance>();
  let strings = 0;

  for (const fixture of fixtures) {
    const source = sources.get(fixture);
    if (source === undefined) {
      problems.push({
        rule: "E37",
        message: `the alignment copy walk expected ${fixture}.ts and found no source for it — a fixture that resolves to nothing checks nothing (data/pages/budget.ts owns the fixture field)`,
      });
      continue;
    }
    for (const literal of readerStrings(source)) {
      strings += 1;
      if (!BRAND_WORD_PATTERN.test(literal.value)) continue;
      const allowance = input.allowances.find(
        (row) => row.file === literal.file && row.value === literal.value,
      );
      if (allowance !== undefined) {
        usedAllowances.add(allowance);
        continue;
      }
      problems.push({
        rule: "E37",
        message: `${literal.file}:${literal.line} renders "${literal.value}" — the alignment brand must not name the template. Rewrite the words for this product, or gate the page with requireQuizProduct() so this build answers 404 (lib/brand-boundary.ts)`,
      });
    }
  }

  for (const allowance of input.allowances) {
    if (!usedAllowances.has(allowance)) {
      problems.push({
        rule: "E37",
        message: `BRAND_WORD_ALLOWANCES has a row nothing needs: ${allowance.file} "${allowance.value}" (${allowance.reason}). An allowance is a decision about one exact string — delete the row, or correct the string it was written for, instead of leaving the hole open`,
      });
    }
  }

  if (fixtures.length < ALIGNMENT_FIXTURES_MIN_WALKED) {
    problems.push({
      rule: "E37",
      message: `the alignment copy walk resolved ${fixtures.length} fixtures and this rule is measured over at least ${ALIGNMENT_FIXTURES_MIN_WALKED} — a walk that quietly found nothing checks nothing`,
    });
  }

  return {
    problems,
    census: {
      fixtures,
      strings,
      gated: new Set(input.gated).size,
      allowances: usedAllowances.size,
    },
  };
}
