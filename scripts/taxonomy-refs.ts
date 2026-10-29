/**
 * taxonomy-refs — the display labels the content model already owns.
 *
 * E10 resolves the links a component writes down; E18/E19 own the media paths. Neither
 * can see a *label*: a component that types `<span>Science</span>` where the category
 * table already says `Science` renders text no fixture can change, so renaming the
 * subject leaves the page stale and every gate stays green. The P2 inventory measured
 * this tier: 26 hits across 6 files (docs/P2-INVENTORY.md, DUP).
 *
 * A hit is a JSX text node, or a JSX attribute, whose whole value equals a schema-owned
 * label — the exact shape a re-typed label takes (`<span>Science</span>`,
 * `<SelectItem label="Science">`). Deliberately narrow:
 *
 *  - a *record-shaped* literal inside a component-level mock array (`category: "Science"`)
 *    is E21's business, not this scan's: it is invented data, and its fix is a fixture.
 *    Matching those here would flag 99 strings that belong to other work units.
 *  - prose that merely contains a label (`"Explore our Science quizzes"`) is page copy
 *    with no home yet (the COPY tier); E20 matches whole nodes, so it is not flagged.
 *  - expression values (`{categoryName(id)}`, `{quiz.title}`) are the fix, not a hit:
 *    only literals are read, exactly like ui-refs.ts.
 *
 * Pure (no fs) so the negative cases can drive it with source strings, like ui-refs.ts.
 */
import ts from "typescript";

import type { SourceFile } from "./ui-refs";

/** Which table the label comes from — the diagnostic says where to render it from. */
export type TaxonomyKind = "category" | "quiz" | "badge";

export interface TaxonomyLabel {
  /** The exact display string the model owns. */
  label: string;
  kind: TaxonomyKind;
  /** The record id the label belongs to, reported in the diagnostic. */
  id: string;
}

export interface TaxonomyHit {
  file: string;
  /** 1-based line of the literal, so the diagnostic is clickable. */
  line: number;
  /** The literal as written, whitespace-normalized. */
  label: string;
  kind: TaxonomyKind;
  /** The record that already owns this label. */
  owner: string;
  /** Where the value should have come from: the selector, not the string. */
  from: string;
}

const ORIGIN: Record<TaxonomyKind, string> = {
  category: "quizCategories",
  quiz: "the quiz fixture",
  badge: "QuizStats.badge.label",
};

const WHITESPACE = /\s+/g;

/**
 * JSX writes some labels with XML entities (`Science &amp; Technology`), so the raw text
 * of the node is not the label. Decoding the five that can appear in prose keeps the
 * comparison honest without pulling in a parser.
 */
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function normalize(text: string): string {
  return text
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(WHITESPACE, " ")
    .trim();
}

/** `label` -> the first record that owns it. Duplicate labels across records collapse. */
export function taxonomyVocabulary(
  entries: readonly TaxonomyLabel[],
): ReadonlyMap<string, TaxonomyLabel> {
  const vocabulary = new Map<string, TaxonomyLabel>();
  for (const entry of entries) {
    const label = normalize(entry.label);
    if (label === "" || vocabulary.has(label)) continue;
    vocabulary.set(label, { ...entry, label });
  }
  return vocabulary;
}

/**
 * The label literals in `files`. `vocabulary` comes from the schema
 * (`taxonomyVocabulary`), never from the component tree, so the scan cannot agree with
 * the code it is checking.
 */
export function findTaxonomyLiterals(
  files: readonly SourceFile[],
  vocabulary: ReadonlyMap<string, TaxonomyLabel>,
): TaxonomyHit[] {
  const hits: TaxonomyHit[] = [];

  for (const file of files) {
    const scriptKind = file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(
      file.path,
      file.source,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    const report = (node: ts.Node, text: string) => {
      const label = normalize(text);
      const owner = vocabulary.get(label);
      if (!owner) return;
      hits.push({
        file: file.path,
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        label,
        kind: owner.kind,
        owner: owner.id,
        from: ORIGIN[owner.kind],
      });
    };

    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node)) report(node, node.text);
      else if (ts.isJsxAttribute(node) && node.initializer) {
        const initializer = node.initializer;
        if (ts.isStringLiteral(initializer)) report(node, initializer.text);
      } else if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        ts.isJsxExpression(node.parent)
      ) {
        // `<span>{"Science"}</span>` is the same duplication wearing braces: a curly
        // expression is only the fix when it reads the model.
        report(node, node.text);
      }
      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  return hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/** The two record shapes the vocabulary is built from, so this module needs no fixture. */
export interface TaxonomySources {
  categories: readonly { id: string; name: string }[];
  quizzes: readonly {
    id: string;
    title: string;
    stats?: { badge?: { label: string } | undefined } | undefined;
  }[];
  /** Promotion overlays carry their own badge copy (data/promotions.ts). */
  badges?: readonly { id: string; badge?: { label: string } | undefined }[];
}

/** Category names + quiz titles + badge labels, as one vocabulary. */
export function taxonomyEntries(sources: TaxonomySources): TaxonomyLabel[] {
  const entries: TaxonomyLabel[] = [];
  for (const category of sources.categories) {
    entries.push({ label: category.name, kind: "category", id: category.id });
  }
  for (const quiz of sources.quizzes) {
    entries.push({ label: quiz.title, kind: "quiz", id: quiz.id });
    const badge = quiz.stats?.badge;
    if (badge) entries.push({ label: badge.label, kind: "badge", id: quiz.id });
  }
  for (const promotion of sources.badges ?? []) {
    const badge = promotion.badge;
    if (badge) entries.push({ label: badge.label, kind: "badge", id: promotion.id });
  }
  return entries;
}
