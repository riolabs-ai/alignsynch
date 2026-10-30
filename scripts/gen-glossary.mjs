#!/usr/bin/env node
/**
 * scripts/gen-glossary.mjs — `docs/glossary.md`, generated from the schema comments (#138).
 *
 * THE RULE: every definition on that page is a comment in `content/`, copied — not
 * rewritten. Nothing in this script writes prose. If a term has no comment the run fails
 * and names the type, so the fix always lands in the schema: never in this script, and
 * never in the generated page.
 *
 * WHERE THE PROSE COMES FROM — one of exactly two places, both inside a schema file:
 *
 *   doc            the JSDoc block directly above the declaration TERMS names. Four terms
 *                  have one: Template (`zTemplate`), Aspect (`zAspect`), Opinion
 *                  (`zOpinionsObject`) and Gap (`gapOf` — the function the `Gap` type is
 *                  computed by, and the comment that defines it).
 *   glossary-line  the term list in the file's leading comment — `content/record.ts`'s
 *                  "Terms are the glossary's, used exactly" block. Record, Item and
 *                  Instance have no JSDoc of their own, and that list is where the schema
 *                  defines them. A paragraph written here instead would be exactly the
 *                  drift this generator exists to prevent.
 *
 * All three schema files are read. The term table is resolved against an index of every
 * exported declaration in `content/record.ts`, `content/assessment.ts` and
 * `content/quiz.ts`, so a term whose type was renamed (or moved between those files)
 * fails loudly instead of quietly rendering nothing. `quiz.ts` contributes no term today
 * — the seven are record/assessment vocabulary — but it is part of the model this page
 * describes, and a term added there resolves through the same index.
 *
 * WHY THE OUTPUT IS FORMATTER-STABLE: `--check` regenerates the page and compares it to
 * the committed one, so the generator's bytes and the committed bytes have to agree
 * forever. `biome format` owns markdown in this repo, and its one prose rewrite is
 * single-asterisk emphasis -> underscore, which `formatterEmphasis()` applies here. The
 * result is a fixed point of the formatter: `pnpm format:check` and `--check` can never
 * disagree about the same file.
 *
 * Usage:
 *   node scripts/gen-glossary.mjs             # write docs/glossary.md
 *   node scripts/gen-glossary.mjs --check     # exit 1 + the first difference if stale
 *   node scripts/gen-glossary.mjs --root DIR  # generate under DIR (tests)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The schema files the glossary is generated from. Read on every run, all three. */
const SCHEMA_FILES = ["content/record.ts", "content/assessment.ts", "content/quiz.ts"];

const OUTPUT = "docs/glossary.md";

/**
 * The seven terms, in the order issue #138 lists them.
 *
 * `type` is the exported type the entry is about — it must exist in one of SCHEMA_FILES,
 * and its name is what an error names. `from` says where that type's definition is
 * written, not where this script would like it to be.
 */
const TERMS = [
  { term: "Record", type: "Record", from: { kind: "glossary-line" } },
  { term: "Item", type: "Item", from: { kind: "glossary-line" } },
  { term: "Template", type: "Template", from: { kind: "doc", declaration: "zTemplate" } },
  { term: "Instance", type: "AssessmentInstance", from: { kind: "glossary-line" } },
  { term: "Aspect", type: "Aspect", from: { kind: "doc", declaration: "zAspect" } },
  { term: "Opinion", type: "Opinions", from: { kind: "doc", declaration: "zOpinionsObject" } },
  { term: "Gap", type: "Gap", from: { kind: "doc", declaration: "gapOf" } },
];

class GlossaryError extends Error {}

const readLines = (file) => readFileSync(file, "utf8").split("\n");

/**
 * Every exported declaration in the schema files: name -> { file, lines, line }.
 * A name exported twice is kept in file order, so the first match wins and a duplicate
 * is visible in the index instead of being silently overwritten.
 */
function indexDeclarations(root) {
  const index = new Map();
  for (const file of SCHEMA_FILES) {
    const lines = readLines(join(root, file));
    lines.forEach((line, at) => {
      const match = /^export (?:const|type|function|interface|class) ([A-Za-z_$][\w$]*)/.exec(line);
      if (!match) return;
      if (!index.has(match[1])) index.set(match[1], { file, lines, at });
    });
  }
  return index;
}

/** The `/** … *\/` block that ends on the line directly above `at`, or null. */
function docAbove(lines, at) {
  if (at === 0 || lines[at - 1].trim() !== "*/") return null;
  for (let k = at - 1; k >= 0; k -= 1) {
    if (lines[k].startsWith("/**")) return lines.slice(k, at).join("\n");
    if (k < at - 1 && lines[k].includes("*/")) return null; // a different block ends first
  }
  return null;
}

/** A JSDoc block as plain prose lines: the comment markers removed, nothing else. */
function cleanBlock(block) {
  return block
    .replace(/^\/\*\*/, "")
    .replace(/\*\/\s*$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* {0,1}/, "").trimEnd())
    .join("\n")
    .trim();
}

/** Paragraphs, each one its source lines joined with a single space. */
function paragraphs(text) {
  return text
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** The file's leading comment block, as raw lines (empty when the file does not open with one). */
function leadingComment(lines) {
  if (!lines[0].startsWith("/**")) return [];
  const end = lines.findIndex((line, at) => at > 0 && line.includes("*/"));
  return end === -1 ? [] : lines.slice(0, end + 1);
}

/**
 * The term list line in a file's leading comment, with its continuation lines.
 *
 *   *   Record    id, slug, type, status, date — the post.
 *   *   Aspect     an Item: "a characteristic …
 *   *              Opinions, Values, and Discussion."
 *
 * A term line is `*` + exactly three spaces + the term; anything indented further is that
 * term's continuation, and a line that starts a new term ends the previous one.
 */
function glossaryLine(lines, term) {
  const block = leadingComment(lines);
  const termLine = new RegExp(`^ \\* {3}\`?${escapeRe(term)}\`? {2,}(\\S.*)$`);
  const startsTerm = /^ \* {3}\S/;
  const continuation = /^ \* {4,}(\S.*)$/;

  for (let at = 0; at < block.length; at += 1) {
    const match = termLine.exec(block[at]);
    if (!match) continue;
    const text = [match[1].trim()];
    for (let next = at + 1; next < block.length; next += 1) {
      if (startsTerm.test(block[next])) break;
      const more = continuation.exec(block[next]);
      if (!more) break;
      text.push(more[1].trim());
    }
    return text.join(" ");
  }
  return null;
}

/**
 * The one markdown rewrite `biome format` applies to prose: single-asterisk emphasis
 * becomes underscore. Applied here so the generated page is a fixed point of the
 * formatter — otherwise `format:check` would rewrite the page and `--check` would then
 * call the formatter's own output stale, on every run, forever.
 */
function formatterEmphasis(text) {
  return text.replace(/(^|[^\w*])\*(?!\*)([^*\n]+?)\*(?![\w*])/g, "$1_$2_");
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** One entry's prose and where it came from. Throws GlossaryError, naming the type. */
function entryFor(spec, index, root) {
  const type = index.get(spec.type);
  if (!type) {
    throw new GlossaryError(
      `no exported type ${spec.type} in ${SCHEMA_FILES.join(", ")} — the glossary term "${spec.term}" has nothing to point at`,
    );
  }

  if (spec.from.kind === "doc") {
    const declaration = index.get(spec.from.declaration);
    if (!declaration) {
      throw new GlossaryError(
        `no exported declaration ${spec.from.declaration} in ${SCHEMA_FILES.join(", ")} — the prose for "${spec.term}" went missing`,
      );
    }
    const block = docAbove(declaration.lines, declaration.at);
    if (block === null) {
      throw new GlossaryError(
        `no comment for ${spec.type}: expected a JSDoc block directly above \`${spec.from.declaration}\` in ${declaration.file}`,
      );
    }
    return {
      term: spec.term,
      prose: paragraphs(cleanBlock(block)),
      file: declaration.file,
      declaration: spec.from.declaration,
    };
  }

  const hits = SCHEMA_FILES.map((file) => ({
    file,
    text: glossaryLine(readLines(join(root, file)), spec.term),
  })).filter((hit) => hit.text !== null);
  if (hits.length === 0) {
    throw new GlossaryError(
      `no comment for ${spec.type}: expected a "${spec.term}  <definition>" line in the leading comment of ${SCHEMA_FILES.join(", ")}, or a JSDoc block above its declaration`,
    );
  }
  if (new Set(hits.map((hit) => hit.text)).size > 1) {
    throw new GlossaryError(
      `conflicting comments for ${spec.type}: ${hits.map((hit) => `${hit.file} says "${hit.text}"`).join("; ")} — one term, one definition`,
    );
  }
  return { term: spec.term, prose: [hits[0].text], file: hits[0].file, declaration: null };
}

/** The whole page. Deterministic: no timestamp, no environment, no clock. */
function renderPage(entries) {
  const out = [
    "# Glossary",
    "",
    "The domain's terms, defined by the schema comments in `content/`. This page is generated:" +
      " do not edit it. Change the comment in the schema, then run `pnpm glossary`; the gate" +
      " fails while the committed page is stale.",
    "",
    "Each entry names the file its prose came from.",
    "",
  ];

  for (const entry of entries) {
    out.push(`## ${entry.term}`, "");
    for (const paragraph of entry.prose) out.push(formatterEmphasis(paragraph), "");
    const link = `[${entry.file}](../${entry.file})`;
    out.push(`Source: ${link}${entry.declaration ? ` — \`${entry.declaration}\`` : ""}.`, "");
  }

  return `${out.join("\n").replace(/\n+$/, "")}\n`;
}

/** The first places the committed page and the generated page disagree, for the failure log. */
function difference(committed, generated) {
  const have = committed === null ? [] : committed.split("\n");
  const want = generated.split("\n");
  const lines = [];
  const total = Math.max(have.length, want.length);
  for (let at = 0; at < total && lines.length < 12; at += 1) {
    if (have[at] === want[at]) continue;
    lines.push(
      `    line ${at + 1}`,
      `  - committed: ${JSON.stringify(have[at] ?? "<no line>")}`,
      `  + generated: ${JSON.stringify(want[at] ?? "<no line>")}`,
    );
  }
  return lines.join("\n");
}

function main(argv) {
  const check = argv.includes("--check");
  const rootFlag = argv.indexOf("--root");
  const root = rootFlag === -1 ? ROOT : argv[rootFlag + 1];
  if (root === undefined) {
    process.stderr.write("✗ --root needs a directory\n");
    return 1;
  }
  return run(root, check);
}

function run(root, check) {
  try {
    const index = indexDeclarations(root);
    const entries = TERMS.map((spec) => entryFor(spec, index, root));
    const page = renderPage(entries);
    const target = join(root, OUTPUT);

    if (!check) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, page);
      process.stdout.write(
        `✓ wrote ${OUTPUT} — ${entries.length} terms from ${SCHEMA_FILES.length} schema files\n`,
      );
      return 0;
    }

    const committed = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (committed === page) {
      process.stdout.write(`  ${OUTPUT} is current (${entries.length} terms)\n`);
      return 0;
    }

    process.stderr.write(
      `✗ ${OUTPUT} is stale — ${committed === null ? "the file is missing" : "the committed page is not what the schema comments generate"}\n` +
        `${difference(committed, page)}\n` +
        "  fix: run `pnpm glossary` and commit the page (change the schema comment, never the page)\n",
    );
    return 1;
  } catch (error) {
    if (!(error instanceof GlossaryError)) throw error;
    process.stderr.write(`✗ ${error.message}\n`);
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
