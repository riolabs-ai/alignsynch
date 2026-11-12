/**
 * brand-classes — the pure half of `pnpm lint`'s brand-palette rule (#187 stage 4).
 *
 * The palette has exactly one home: the `Brand` record in `data/brand.ts`, which paints
 * `--action` / `--action-foreground` / `--nav-active` onto `<html>` (`lib/brand-theme.ts`)
 * and is read through Tailwind's `bg-action`, `text-action`, `border-action/30` … utilities.
 * A component that types a palette step instead paints QuizHub's indigo on an AlignSynch
 * page — which is exactly what this tree did in 90 places before issue #187.
 *
 * Five rules, no allowlist:
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
 *   3. `text-accent` — the accent as an *ink*. This is not a taste rule: the shipped AlignSynch
 *      accent is a cyan that measures 2.64:1 on white, so a link or a body sentence painted with
 *      it is unreadable, and `accent` is a surface token (badges, chips, chart series) by
 *      decision. `text-accent-foreground` — the ink *on* an accent fill — stays legal, as do
 *      `bg-accent` and `border-accent`.
 *
 *   4. `shadow-*` on a **form surface** — a file that renders `<FormSurface>` (`components/ui/
 *      form-surface.tsx`), or an auth screen (`components/auth/**`, every one of which is a form
 *      surface). The owner's decision is that a form carries **no** shadow: depth comes from the
 *      border and the background contrast, and the shadow scale stays for elements genuinely
 *      raised *over* the page. `shadow-none` is legal — it is the explicit opt-out a composed
 *      literal needs when it has to cancel a default — and nothing else is.
 *   5. `<Card>` on an auth screen — `Card`'s own default is `shadow-sm`, so a bare `Card` in
 *      `components/auth/**` is the second form look the previous rule exists to delete. The auth
 *      screens are the loudest form in the product (`shadow-xl border-0`) and the rule makes the
 *      quiet treatment the only one they can draw.
 *
 * Rules 4 and 5 are not palette rules, and they live here because this is the file `pnpm lint`
 * already runs over `components/` and `app/` — a second lint script for one class family would be
 * a second thing to run. They read the *file*, not only its literals: "is this a form surface" is
 * a property of the component's markup, and an auth screen is one by path.
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
  accentInk:
    "text-accent — `accent` is a surface token (2.64:1 on white on the AlignSynch cyan); use text-accent-foreground on an accent fill, or text-action for a link",
  formShadow:
    "shadow on a form surface — depth comes from the border and the background contrast; `FormSurface` owns the treatment and `shadow-none` is the only shadow a form surface may name",
  formCard:
    "a `Card` on an auth screen — an auth screen is a form surface and draws `FormSurface`; `Card`'s default `shadow-sm` is the second form look this rule removes",
};

const PALETTE = /(?:indigo|purple|violet)-/;
const GRADIENT = /\bbg-gradient-to-/;
const ARBITRARY_GRADIENT = /bg-\[[^\]]*gradient\(/;
/**
 * `text-accent` as an *ink*, which the AlignSynch palette makes unreadable: the cyan measures
 * 2.64:1 on white, below every floor. The lookahead keeps `text-accent-foreground` legal — that
 * is the ink *on* an accent fill, which is the one way the accent carries text at all — and
 * `bg-accent` / `border-accent` are surfaces and stay legal too.
 */
const ACCENT_INK = /\btext-accent(?![\w-])/;

/**
 * A shadow utility, any size, plus the arbitrary form (`shadow-[0_1px_0_#000]`). The
 * lookbehind keeps `drop-shadow-md` (a filter, not a surface shadow) and `text-shadow` out of
 * it: a `-` before the word means it is part of a longer utility's name.
 */
const SHADOW = /(?<![\w-])shadow(?:-[\w[\]().,%#_-]+)?/;

/** `shadow-none` is the explicit opt-out, and the only shadow a form surface may name. */
const SHADOW_OPT_OUT = /^shadow-none$/;

/** A file that renders the shared form surface — `components/ui/form-surface.tsx`'s component. */
const FORM_SURFACE = /<\s*FormSurface\b/;

/** An auth screen is a form surface by path, whether or not it has been converted yet. */
const AUTH_SCREEN = /^components\/auth\//;

/** A bare `Card`, but not `CardHeader` / `CardContent` / `CardTitle` / `CardDescription`. */
const CARD_TAG = /<\s*Card(?=[\s/>])/;

/**
 * The source with comments blanked **in place**: same length, same offsets, so a match found in
 * the masked text still reports the right line. `Card` is a word this tree's doc comments use
 * constantly ("the card's own `shadow-sm`"), and a rule that read them would fail on the
 * explanation rather than on the code — the same trap `scripts/client-graph.ts` names.
 */
function maskComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (comment) =>
    comment.replace(/[^\n]/g, " "),
  );
}

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
  const masked = maskComments(source);
  const isFormSurface = FORM_SURFACE.test(masked) || AUTH_SCREEN.test(file);

  const visit = (node) => {
    const text = literalText(node);
    if (text !== undefined) {
      const patterns = [
        [PALETTE, "palette"],
        [GRADIENT, "gradient"],
        [ARBITRARY_GRADIENT, "gradient"],
        [ACCENT_INK, "accentInk"],
      ];
      if (isFormSurface) patterns.push([SHADOW, "formShadow"]);
      for (const [pattern, rule] of patterns) {
        const match = pattern.exec(text);
        if (!match) continue;
        const token = tokenAt(text, match);
        // `shadow-none` is the opt-out, not a shadow: a form surface may name it and nothing else.
        if (rule === "formShadow" && SHADOW_OPT_OUT.test(token)) continue;
        // +1 steps over the opening quote / backtick / `}` that `node.text` excludes.
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile) + 1 + match.index,
        );
        violations.push({
          file,
          line: line + 1,
          column: character + 1,
          token,
          rule,
          message: RULES[rule],
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  /**
   * Rule 5 — an auth screen draws the form surface, not a `Card`. Read from the masked source
   * rather than from a literal: the tag *is* the finding, and `Card`'s default `shadow-sm` is
   * invisible to a rule that only reads class strings.
   */
  if (AUTH_SCREEN.test(file)) {
    for (const match of masked.matchAll(new RegExp(CARD_TAG.source, "g"))) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(match.index);
      violations.push({
        file,
        line: line + 1,
        column: character + 1,
        token: "<Card",
        rule: "formCard",
        message: RULES.formCard,
      });
    }
  }

  return violations;
}

/** `path/to/file.tsx:12:34  bg-purple-600  — <message>`, the form a terminal can jump to. */
export function formatViolation(v) {
  return `${v.file}:${v.line}:${v.column}  ${v.token}\n    ✗ ${v.message}`;
}
