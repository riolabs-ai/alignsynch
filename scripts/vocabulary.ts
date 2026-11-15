/**
 * vocabulary — E41: the alignment build says "session", never "instance".
 *
 * The noun has been asked for more than once and keeps coming back, because nothing enforced it:
 * a fixture is prose, so no typecheck, no lint rule and no hash can see the word. `pnpm parity`
 * only moves when a route's *output* changes, which is exactly the case where the copy was already
 * wrong. This is the check at the layer the words live in.
 *
 *     every reader-visible string the alignment build renders spells the product's noun, not the
 *     model's
 *
 * ## The vocabulary, written down first
 *
 * A rename is only mechanical once there is a table to classify each string against
 * (`docs/glossary.md` is generated from the schema comments and says the same thing in SQL):
 *
 *   **Template**      the definition — Aspects, roles, price — and it has no sessions
 *   **Relationship**  a published template between two people, bought once, holding every cycle
 *   **Session**       one cycle of answering inside a published relationship
 *   **Assessment**    the scored gap a finished session produces, never the thing a party answers
 *
 * "instance" is the retired word for **session** — the fixture name, the table name and the
 * component names all still carry it, and that is fine: those are handles. What this rule reads is
 * the sentence a reader sees.
 *
 * ## "session" is also a login session, so bare nouns are not free
 *
 * `lib/auth/session.ts` and Neon Auth's own vocabulary already mean an authenticated login by
 * "session". Copy may therefore say "session" only where the context is unmistakably a
 * relationship; where a sentence could be read either way it says "the relationship" or "the
 * session you started". This rule fails the retired noun, and cannot be gamed into
 * "session-session": identifiers are out of its scope entirely and every one of them, when they are
 * eventually renamed, becomes `assessmentSession`, never bare `session` (reported, not renamed,
 * by the card that shipped this check).
 *
 * ## Which fixtures are in the render set
 *
 * The same derivation E37 uses, and for the same reason: a file list is widened by editing it,
 * while the two facts below are the boundary itself. An E23 budget row names the page module and
 * the fixture it renders; a page whose source calls `requireQuizProduct()` answers 404 on this
 * brand, so nothing it renders reaches an alignment reader — and that is also what keeps QuizHub's
 * own copy out of scope, as it must be. `/` is the one override, and `data/brands/alignsynch.ts`
 * is read because the brand record's own name and description are printed in the tab.
 *
 * `alignmentFixtures()` and `readerStrings()` are imported from `scripts/brand-word.ts` rather
 * than copied: the extraction is the part that must be identical for the two rules (comments are
 * provenance and not read; `id` is a handle and `href` a route; a template literal is read by its
 * fragments), and a second copy of it would drift.
 *
 * ## Fills are masked, handles are skipped, and `<...>` is not a fill
 *
 * A `{token}` in copy is a value a component interpolates — `{instances} relationships` is a count,
 * and the token name is a view key, not a sentence (`admin-gaps` fills it with a number). Those are
 * masked before the match. Angle brackets are deliberately **not** masked: `flow_party_<instance-id>`
 * is prose the reader reads, and the cookie's real name carries no such suffix, so the sentence is
 * wrong rather than a handle — it says "session" now.
 *
 * ## The allowance table only shrinks, and cannot be widened in place
 *
 * `VOCABULARY_ALLOWANCES` names an exact string in an exact file with the reason it may keep the
 * word. There is no file-level exemption, and a row no walked string uses is itself a finding, so
 * the table cannot be pre-widened for a string somebody is about to add. It is **empty today** —
 * every reader-visible "instance" was rewordable, and an allowance is a statement that one string
 * cannot be, which is a claim worth making zero of unless the tree forces it.
 */
import {
  type BrandWordSource,
  type CopySurface,
  ALIGNMENT_FIXTURES_MIN_WALKED,
  alignmentFixtures,
  readerStrings,
} from "./brand-word";

/** One row of the product's vocabulary: what a noun is, and the nearest thing it is not. */
export interface VocabularyTerm {
  /** The noun a reader sees. */
  noun: string;
  /** What it names, in the product's own terms. */
  is: string;
  /** The object it is most often confused with, and why that is wrong. */
  not: string;
}

/** The table the rename is classified against. Documentation with a shape, not a rule input. */
export const VOCABULARY: readonly VocabularyTerm[] = [
  {
    noun: "Template",
    is: "the definition — its Aspects, its roles, its price",
    not: "a template holds no sessions; it is what a relationship is made from",
  },
  {
    noun: "Relationship",
    is: "a published template between two people, bought once, holding every cycle",
    not: "a template — it is made from one, and it is not a single act of answering",
  },
  {
    noun: "Session",
    is: "one cycle of answering inside a published relationship",
    not: 'a login session (lib/auth/session.ts) — say "the relationship" or "the session you started" when a sentence could be read either way',
  },
  {
    noun: "Assessment",
    is: "the scored gap a finished session produces",
    not: "the thing a party answers — answers go on a session",
  },
];

/** A retired noun, the word that replaces it, and the pattern a string is asked about. */
export interface BannedNoun {
  /** The noun, as the finding prints it. */
  word: string;
  /** The word the product says instead. */
  says: string;
  /** Matches the noun as a whole word, `instance` and `instances` alike, any case. */
  pattern: RegExp;
}

/**
 * The retired nouns. One row today.
 *
 * The pattern is word-bounded, so `instanceId` inside a copied value would slip through — but no
 * value spells it, and a value that did would be prose about an identifier, which `id`/`href`
 * skipping already handles at the key level. `instance-id` *is* caught: the hyphen ends the word.
 */
export const BANNED_NOUNS: readonly BannedNoun[] = [
  {
    word: "instance",
    says: "session",
    pattern: /\binstances?\b/i,
  },
];

/** One string that may keep a retired noun anyway, in one exact file, with the reason. */
export interface VocabularyAllowance {
  file: string;
  value: string;
  reason: string;
}

export interface VocabularyProblem {
  rule: "E41";
  message: string;
}

/** What the rule measured — printed on both paths, so a passing run still shows its scope. */
export interface VocabularyCensus {
  /** The fixtures the alignment build reads copy from, sorted. */
  fixtures: string[];
  /** Reader-visible strings walked across them. */
  strings: number;
  /** Strings that name a retired noun. Zero is the passing number. */
  naming: number;
  /** Allowance rows a walked string actually used. */
  allowances: number;
}

export interface VocabularyInput {
  /** `pageCopyBudget`, flattened to the three fields the render set needs. */
  surfaces: readonly CopySurface[];
  /** Page modules whose source calls `requireQuizProduct()` — the quiz product's own routes. */
  gated: readonly string[];
  /** Route → the fixture this brand mounts instead of the shared one. */
  overrides: Readonly<Record<string, string>>;
  /** Fixtures with no budget row that this brand renders. */
  extras: readonly string[];
  /** Every fixture source the walk may read, keyed by `path`. */
  files: readonly BrandWordSource[];
  allowances: readonly VocabularyAllowance[];
}

/**
 * The allowance table: exact string, exact file, and empty on purpose.
 *
 * A row here says "this sentence cannot be reworded", which is a strong claim about one string —
 * a product noun, a provider's own error text, a name that is somebody else's. Nothing in the
 * alignment render set needed one when this landed, so the table has no rows, and the unused-row
 * finding below is what stops it from quietly acquiring one for a string that is simply not yet
 * fixed.
 */
export const VOCABULARY_ALLOWANCES: readonly VocabularyAllowance[] = [];

/** Strip a TS/TSX extension, so `data/pages/pricing.ts` and `data/pages/pricing` compare equal. */
export function fixtureKey(path: string): string {
  return path.replace(/\.tsx?$/, "");
}

/**
 * Copy the alignment build renders that `data/pages/budget.ts` does not key a route to.
 *
 * The knowledge base is one document set per brand: `data/knowledge-base.ts` picks
 * `data/knowledge-base-alignsynch-data` for this build and the template's own set otherwise, and
 * the articles render on `/support/articles/[slug]`. No brand name lives in either file, so E37
 * has no reason to read them — this rule does, because seven articles described a session as an
 * "instance" while the check that shipped was watching page fixtures only. The template's file is
 * deliberately not here: its words are QuizHub's, and a rule for this product must not edit them.
 */
export const VOCABULARY_ALIGNMENT_COPY: readonly string[] = ["data/knowledge-base-alignsynch-data"];

/**
 * Blank out the `{token}` fills a component interpolates, so a view key is not read as copy.
 *
 * `{instances} relationships` is a count; the token is the component's join, not the sentence. A
 * brace group with a space in it is left alone — that is prose that happens to contain braces, and
 * masking it would be the hole this rule exists to close.
 */
export function maskFills(value: string): string {
  return value.replace(/\{[A-Za-z0-9_.:-]+\}/g, "\u00b7");
}

/** Which retired noun a string spells, if any. */
export function retiredNounIn(value: string): BannedNoun | undefined {
  const masked = maskFills(value);
  return BANNED_NOUNS.find((noun) => noun.pattern.test(masked));
}

/**
 * The rule: no reader-visible string the alignment build renders names a retired noun, except the
 * exact strings `VOCABULARY_ALLOWANCES` names.
 *
 * Findings are `file:line` so the diagnostic is clickable, and they say what to do: say "session",
 * or name the thing the sentence actually means. Allowances that nothing used are findings too.
 */
export function vocabularyFindings(input: VocabularyInput): {
  problems: VocabularyProblem[];
  census: VocabularyCensus;
} {
  const problems: VocabularyProblem[] = [];
  const fixtures = alignmentFixtures({
    surfaces: input.surfaces,
    gated: input.gated,
    overrides: input.overrides,
    extras: [...input.extras, ...VOCABULARY_ALIGNMENT_COPY],
  });
  const sources = new Map(input.files.map((file) => [fixtureKey(file.path), file]));

  const usedAllowances = new Set<VocabularyAllowance>();
  let strings = 0;
  let naming = 0;

  for (const fixture of fixtures) {
    const source = sources.get(fixture);
    if (source === undefined) {
      problems.push({
        rule: "E41",
        message: `the alignment copy walk expected ${fixture}.ts and found no source for it — a fixture that resolves to nothing checks nothing (data/pages/budget.ts owns the fixture field)`,
      });
      continue;
    }
    for (const literal of readerStrings(source)) {
      strings += 1;
      const noun = retiredNounIn(literal.value);
      if (noun === undefined) continue;
      naming += 1;
      const allowance = input.allowances.find(
        (row) => row.file === literal.file && row.value === literal.value,
      );
      if (allowance !== undefined) {
        usedAllowances.add(allowance);
        continue;
      }
      problems.push({
        rule: "E41",
        message: `${literal.file}:${literal.line} says "${literal.value}" — the product says "${noun.says}", not "${noun.word}". Rewrite the words, or name the thing the sentence means: a template has no sessions, a relationship holds them, an assessment is what a finished one produces`,
      });
    }
  }

  for (const allowance of input.allowances) {
    if (!usedAllowances.has(allowance)) {
      problems.push({
        rule: "E41",
        message: `VOCABULARY_ALLOWANCES has a row nothing needs: ${allowance.file} "${allowance.value}" (${allowance.reason}). An allowance is a decision about one exact string — delete the row, or correct the string it was written for, instead of leaving the hole open`,
      });
    }
  }

  if (fixtures.length < ALIGNMENT_FIXTURES_MIN_WALKED) {
    problems.push({
      rule: "E41",
      message: `the alignment copy walk resolved ${fixtures.length} fixtures and this rule is measured over at least ${ALIGNMENT_FIXTURES_MIN_WALKED} — a walk that quietly found nothing checks nothing`,
    });
  }

  return {
    problems,
    census: {
      fixtures,
      strings,
      naming,
      allowances: usedAllowances.size,
    },
  };
}

/* ------------------------------------------------------------------ *
 * By name: `pnpm vocabulary:census`
 *
 * The gate runs this rule inside `data:check`; this entry point exists so the census can be read
 * on its own — before and after a sweep, on a branch, in a review — without the rest of the
 * validator's output around it. Same walk, same findings, exit 1 on a violation.
 * ------------------------------------------------------------------ */
function readTree(directory: string, files: BrandWordSource[] = []): BrandWordSource[] {
  // Required lazily so the pure tests import this module without touching the filesystem, and
  // typed through the module so `node:test` and the app tsconfig agree on the shapes.
  const { readdirSync, readFileSync, statSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const root = process.cwd();
  for (const entry of readdirSync(join(root, directory))) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const path = `${directory}/${entry}`;
    if (statSync(join(root, path)).isDirectory()) readTree(path, files);
    else if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      files.push({ path, source: readFileSync(join(root, path), "utf8") });
    }
  }
  return files;
}

if (require.main === module) {
  const { pageCopyBudget } =
    require("../data/pages/budget") as typeof import("../data/pages/budget");
  const { ALIGNMENT_COPY_EXTRAS, ALIGNMENT_COPY_OVERRIDES, gatedPages } =
    require("./brand-word") as typeof import("./brand-word");

  const surfaces: CopySurface[] = Object.entries(pageCopyBudget).map(
    ([route, entry]: [string, { page: string; fixture: string }]) => ({
      route,
      page: entry.page,
      fixture: entry.fixture,
    }),
  );

  const { problems, census } = vocabularyFindings({
    surfaces,
    gated: gatedPages(readTree("app")),
    overrides: ALIGNMENT_COPY_OVERRIDES,
    extras: ALIGNMENT_COPY_EXTRAS,
    files: readTree("data"),
    allowances: VOCABULARY_ALLOWANCES,
  });

  console.log(
    `vocabulary:census — ${census.fixtures.length} alignment fixtures, ${census.strings} reader-visible strings`,
  );
  console.log(
    `  retired nouns  ${census.naming} string(s) name one (${BANNED_NOUNS.map((noun) => `${noun.word} → ${noun.says}`).join(", ")})`,
  );
  console.log(`  allowances     ${census.allowances} used of ${VOCABULARY_ALLOWANCES.length}`);

  if (problems.length === 0) {
    console.log("PASS  0 violation(s)");
    process.exit(0);
  }
  console.log(`FAIL  ${problems.length} violation(s)`);
  for (const problem of problems) console.log(`  [${problem.rule}] ${problem.message}`);
  process.exit(1);
}
