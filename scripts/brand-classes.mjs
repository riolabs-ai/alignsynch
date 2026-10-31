/**
 * brand-classes — the pure half of `pnpm lint`'s brand-palette rule (#187 stage 4).
 *
 * The palette has exactly one home: the `Brand` record in `data/brand.ts`, which paints
 * `--action` / `--action-foreground` / `--nav-active` onto `<html>` (`lib/brand-theme.ts`)
 * and is read through Tailwind's `bg-action`, `text-action`, `border-action/30` … utilities.
 * A component that types a palette step instead paints QuizHub's indigo on an AlignSynch
 * page — which is exactly what this tree did in 90 places before issue #187.
 *
 * Two rules, no allowlist:
 *
 *   1. `indigo-*` / `purple-*` / `violet-*` — a brand-hue class literal anywhere under
 *      `components/` and `app/`. These three families are the leaked palette: the template
 *      was built from them, so every one is a place where a second brand's colour was decided
 *      by a find-and-replace instead of by the record.
 *   2. `bg-gradient-to-*` (and its arbitrary-value form, `bg-[linear-gradient(…)]`) — a
 *      gradient utility outside the token layer (`app/globals.css`). A gradient is where the
 *      palette leaks hardest: `from-purple-600 to-indigo-600` is two colours and a claim about
 *      how they blend, and neither half is addressed by a token. The token layer may still
 *      own a gradient; a component may not compose one.
 *
 * Not banned, deliberately: `blue-*`, `amber-*`, `green-*`, `red-*`, `slate-*` and friends.
 * Those are *status* hues — "warning", "trending", "success" — and they mean the same thing
 * under both brands. Re-pointing them at `action` would erase the distinction rather than move
 * the palette's home.
 *
 * The scan reads **string literals**, not lines: a comment that names a retired step (this
 * tree has a few, explaining the mapping) is documentation, while a class string is markup.
 * Template literals are read span by span, so a class inside `${…}` interpolation is still
 * checked on the literal text around it.
 */
import ts from "typescript";

/** One violation: where it is, what it said, and which rule it broke. */
export const RULES = {
  palette:
    "palette step — the brand record is the only home for a brand hue (use bg-action / text-action / border-action)",
  gradient:
    "gradient utility — gradients belong to the token layer (app/globals.css), not to a component",
};

const PALETTE = /(?:indigo|purple|violet)-/;
const GRADIENT = /\bbg-gradient-to-/;
const ARBITRARY_GRADIENT = /bg-\[[^\]]*gradient\(/;

/**
 * The string-ish literal text of a node: quoted strings, no-substitution templates, and the
 * three spans of a template expression. Anything else is `undefined`.
 */
function literalText(node) {
  switch (node.kind) {
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
    case ts.SyntaxKind.TemplateHead:
    case ts.SyntaxKind.TemplateMiddle:
    case ts.SyntaxKind.TemplateTail:
      return node.text;
    default:
      return undefined;
  }
}

/** The offending token, with a little context so the report names the class it saw. */
function tokenAt(text, match) {
  let stop = match.index;
  while (stop < text.length && /[\w/[\]."%-]/.test(text[stop])) stop++;
  return text.slice(match.index, stop);
}

/**
 * Every violation in one file's source, as `{ line, column, token, rule, message }`.
 *
 * Exported (rather than inlined in the CLI) because it is the whole rule: `--self-test` in
 * `scripts/lint-brand-classes.mjs` runs it over fixtures that must and must not trip, so a
 * rule that has quietly stopped matching fails the gate instead of reporting a clean tree.
 */
export function scanSource(file, source) {
  const scriptKind =
    file.endsWith(".tsx") || file.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
  const violations = [];

  const visit = (node) => {
    const text = literalText(node);
    if (text !== undefined) {
      for (const [pattern, rule] of [
        [PALETTE, "palette"],
        [GRADIENT, "gradient"],
        [ARBITRARY_GRADIENT, "gradient"],
      ]) {
        const match = pattern.exec(text);
        if (!match) continue;
        // +1 steps over the opening quote / backtick / `}` that `node.text` excludes.
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile) + 1 + match.index,
        );
        violations.push({
          file,
          line: line + 1,
          column: character + 1,
          token: tokenAt(text, match),
          rule,
          message: RULES[rule],
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}

/** `path/to/file.tsx:12:34  bg-purple-600  — <message>`, the form a terminal can jump to. */
export function formatViolation(v) {
  return `${v.file}:${v.line}:${v.column}  ${v.token}\n    ✗ ${v.message}`;
}
