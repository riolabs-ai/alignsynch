/**
 * image-refs — the `next/image` props that are a dev-only 500.
 *
 * `next/image` has two hard rules about intrinsic size, and both of them live inside
 * `if (process.env.NODE_ENV !== "production")` in `next/dist/shared/lib/get-img-props.js`:
 *
 *   no size          a tag passes neither `width`/`height` nor `fill` -> E451,
 *                    `Image with src "…" is missing required "width" property`
 *   size and fill    a tag passes `fill` together with `width`/`height` -> E96,
 *                    `Image with src "…" has both "width" and "fill" properties`
 *
 * Neither rule is read by `next build` or `next start`, so the tag compiles, prerenders and
 * ships; only `pnpm dev` throws. `images.unoptimized: true` hides the same two mistakes in
 * production too, which is why five of them survived on `main` until the follow-up to issue #6
 * fixed them by hand — three of the five sat behind tab state and one behind an unreachable
 * fallback, so nothing ever rendered them.
 *
 * A hand fix is not a check. This module is the check: it extracts every `<Image>` tag and
 * classifies its size source, so `scripts/data-check.ts` can fail the build on the two shapes
 * instead of waiting for a human to click the state that renders them.
 *
 * Deliberately static and structural, like `ui-refs.ts` and `island-refs.ts`: no TypeScript
 * program, no evaluation, no filesystem. Dimensions a static import carries are respected —
 * `import cover from "@/public/card-cover.png"` is a `StaticImageData`, so `src={cover}` is a
 * legitimate size source and must not be flagged; `cover.src` is a plain string and is not.
 */
import type { SourceFile } from "./ui-refs";

/** A `<Image>` tag as written, with only the facts the size rules care about. */
export interface ImageTag {
  /** Repo-relative path, reported verbatim in diagnostics. */
  file: string;
  /** 1-based line of `<Image`, so the diagnostic is clickable. */
  line: number;
  /** The `src` expression as written (inner text of `{…}`, or the literal), if any. */
  src?: string;
  width: boolean;
  height: boolean;
  fill: boolean;
  /** Reported for the census only: `fill` without `sizes` is the next, larger piece of work. */
  sizes: boolean;
  /** `src` is a static import, so the dimensions travel with the value. */
  staticSrc: boolean;
}

export type ImageProblemKind = "missing-dimension" | "fill-with-dimension";

export interface ImageProblem {
  kind: ImageProblemKind;
  file: string;
  line: number;
  message: string;
  tag: ImageTag;
}

export interface ImageCensus {
  /** Every `<Image>` tag in the files given. */
  tags: number;
  /** `width` and `height` both present. */
  dimensioned: number;
  /** `fill` without `width`/`height`. */
  fill: number;
  /** No `width`/`height` and no `fill`, but the `src` is a static import. */
  staticImport: number;
  /** `fill` tags that also pass `sizes` (the debt a future optimisation needs). */
  fillWithSizes: number;
  /** The two error shapes, for the summary line. */
  missingDimension: number;
  fillWithDimension: number;
}

/** `<Image` that is not `<ImageTag`: the word boundary excludes a longer component name. */
const OPEN_TAG = /<Image\b/g;

/** `import cover from "@/public/card-cover.png"` — the default import is a StaticImageData. */
const STATIC_IMPORT = /import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\})?\s+from\s*["']([^"']+)["']/g;
const IMAGE_FILE = /\.(?:png|jpe?g|webp|gif|svg|avif)(?:[?#][^"']*)?$/i;

/** Words that are values, not bindings, inside a `src` expression. */
const KEYWORDS = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "typeof",
  "void",
  "new",
  "in",
  "instanceof",
  "this",
  "await",
]);

interface Attribute {
  /** `expression` is `{…}`, `literal` is `"…"`, `flag` is a bare attribute such as `fill`. */
  kind: "expression" | "literal" | "flag";
  text: string;
}

/** Index of the `}` that closes the `{` at `open`, skipping strings inside it. */
function skipBraces(source: string, open: number): number {
  let quote: string | null = null;
  for (let i = open + 1; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") {
      const close = skipBraces(source, i);
      if (close < 0) return -1;
      i = close;
    } else if (char === "}") return i;
  }
  return -1;
}

/**
 * The tag body between `<Image` and its closing `>`. Braces and quotes are tracked so a `>`
 * inside `onError={(e) => …}`, a template URL or a `//` comment in the tag does not end it —
 * all three shapes are on `main` today.
 */
function scanTag(source: string, start: number): { body: string; end: number } | undefined {
  let depth = 0;
  let quote: string | null = null;

  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{" || char === "(" || char === "[") depth++;
    else if (char === "}" || char === ")" || char === "]") depth--;
    else if (char === ">" && depth === 0) return { body: source.slice(start, i), end: i };
  }

  return undefined;
}

/**
 * Attribute names and values at tag depth 0. A `//` comment inside the tag is skipped whole:
 * `src={media["abstract-geometric-shapes"].src} // Using existing abstract image…` is real
 * code on `main`, and reading its prose as attributes is how a check starts lying.
 */
function attributes(body: string): Map<string, Attribute> {
  const found = new Map<string, Attribute>();
  let i = 0;

  const skipSpace = () => {
    while (i < body.length && /\s/.test(body[i])) i++;
  };

  while (i < body.length) {
    const char = body[i];

    if (char === "/" && body[i + 1] === "/") {
      const newline = body.indexOf("\n", i);
      i = newline === -1 ? body.length : newline;
      continue;
    }
    if (char === "/" && body[i + 1] === "*") {
      const close = body.indexOf("*/", i + 2);
      i = close === -1 ? body.length : close + 2;
      continue;
    }
    if (char === "{") {
      // A spread (`{...props}`) carries no attribute name this scan can read.
      const close = skipBraces(body, i);
      if (close < 0) break;
      i = close + 1;
      continue;
    }

    const name = /^[A-Za-z_$][\w$:-]*/.exec(body.slice(i));
    if (!name) {
      i++;
      continue;
    }
    i += name[0].length;
    skipSpace();

    let value: Attribute = { kind: "flag", text: "" };
    if (body[i] === "=") {
      i++;
      skipSpace();
      if (body[i] === "{") {
        const close = skipBraces(body, i);
        if (close < 0) break;
        value = { kind: "expression", text: body.slice(i + 1, close) };
        i = close + 1;
      } else if (body[i] === '"' || body[i] === "'") {
        const quote = body[i];
        const close = body.indexOf(quote, i + 1);
        value = { kind: "literal", text: close < 0 ? "" : body.slice(i + 1, close) };
        i = close < 0 ? body.length : close + 1;
      } else {
        const token = /^[\w$.]+/.exec(body.slice(i));
        if (token) {
          value = { kind: "expression", text: token[0] };
          i += token[0].length;
        }
      }
    }

    found.set(name[0], value);
  }

  return found;
}

function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

/**
 * Is the offset inside a comment? A commented-out `<Image>` is not a tag, and a check that
 * fails the build on prose is a check someone deletes. Quote-aware, so a `//` inside a URL
 * string does not swallow the rest of the line.
 */
function inComment(source: string, index: number): boolean {
  let quote: string | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < index; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "/" && next === "/") {
      lineComment = true;
      i++;
    } else if (char === "/" && next === "*") {
      blockComment = true;
      i++;
    }
  }

  return lineComment || blockComment;
}

/** Default imports of an image file: the value is a `StaticImageData` with its own size. */
export function staticImageImports(source: string): Set<string> {
  const bindings = new Set<string>();
  STATIC_IMPORT.lastIndex = 0;
  for (let match = STATIC_IMPORT.exec(source); match !== null; match = STATIC_IMPORT.exec(source)) {
    if (IMAGE_FILE.test(match[2])) bindings.add(match[1]);
  }
  return bindings;
}

/**
 * Identifiers an expression reads, minus property names and string contents. `a.b.c` yields
 * `a`; `media["x"].src` yields `media`; `item.avatar || placeholder` yields both bindings.
 */
function identifiersIn(expression: string): string[] {
  const stripped = expression.replace(
    /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g,
    '""',
  );
  const found: string[] = [];
  for (const match of stripped.matchAll(/[A-Za-z_$][\w$]*/g)) {
    const before = stripped.slice(0, match.index).trimEnd();
    // `x.y` reads `x`; the `y` is a property, not a binding.
    if (before.endsWith(".") || before.endsWith("?.")) continue;
    if (KEYWORDS.has(match[0])) continue;
    found.push(match[0]);
  }
  return found;
}

/**
 * A `src` expression whose value is a static import, and stays one. `{cover}` carries the
 * dimensions; `{cover.src}` is the plain string and carries none, which is exactly the
 * mistake that reads as safe.
 *
 * Alternatives are followed rather than approximated: `{cover || fallback}` and
 * `{failed ? a : b}` are static when every value they can produce is a static import — the
 * condition is dropped, because a boolean is not a src.
 */
function isStaticSrc(attribute: Attribute | undefined, bindings: Set<string>): boolean {
  if (attribute?.kind !== "expression" || bindings.size === 0) return false;

  const alternatives = choiceAlternatives(attribute.text);
  if (alternatives.length === 0) return false;

  return alternatives.every((alternative) => {
    const identifiers = identifiersIn(alternative);
    if (identifiers.length === 0 || !identifiers.every((id) => bindings.has(id))) return false;

    // `imported.x` reads a member off the static value, so the value itself is no longer the src.
    return !identifiers.some((id) =>
      new RegExp(`(?:^|[^\\w$.])${id}\\s*(?:\\?\\.|\\.)`).test(alternative),
    );
  });
}

/** Index of the first `?`/`:`/`||` at nesting depth 0, skipping strings; -1 when none. */
function topLevelIndex(expression: string, matches: (char: string, next: string) => boolean) {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < expression.length; i++) {
    const char = expression[i];
    const next = expression[i + 1] ?? "";
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") depth++;
    else if (char === ")" || char === "]" || char === "}") depth--;
    else if (depth === 0 && matches(char, next)) return i;
  }
  return -1;
}

/** The `:` that closes the ternary opened at `question`, counting nested ternaries. */
function matchingColon(source: string, question: number): number {
  let depth = 0;
  let quote: string | null = null;
  let nested = 1;

  for (let i = question + 1; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1] ?? "";
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") {
      depth++;
      continue;
    }
    if (char === ")" || char === "]" || char === "}") {
      depth--;
      continue;
    }
    if (depth !== 0) continue;
    if (char === "?" && next === ".") continue; // optional chaining
    if (char === "?" && next === "?") {
      i++; // nullish coalescing
      continue;
    }
    if (char === "?") {
      nested++;
      continue;
    }
    if (char === ":") {
      nested--;
      if (nested === 0) return i;
    }
  }

  return -1;
}

/** Split at every depth-0 `||` / `??`. */
function splitTopLevel(source: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1] ?? "";
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") depth++;
    else if (char === ")" || char === "]" || char === "}") depth--;
    else if (depth === 0 && (char === "|" || char === "?") && char === next) {
      parts.push(source.slice(start, i));
      i++;
      start = i + 1;
    }
  }

  if (parts.length === 0) return [source];
  parts.push(source.slice(start));
  return parts;
}

/**
 * The values an expression can evaluate to: `a || b`, `a ?? b` and `a ? b : c` each yield
 * their branches, recursively. A ternary's condition is dropped — `failed ? a : b` produces
 * `a` or `b`, and `failed` is not a src. Anything else is one alternative.
 */
function choiceAlternatives(expression: string, depth = 0): string[] {
  const source = expression.trim();
  if (depth > 8) return [source];

  const question = topLevelIndex(
    source,
    (char, next) => char === "?" && next !== "." && next !== "?",
  );
  if (question !== -1) {
    const colon = matchingColon(source, question);
    if (colon !== -1) {
      return [
        ...choiceAlternatives(source.slice(question + 1, colon), depth + 1),
        ...choiceAlternatives(source.slice(colon + 1), depth + 1),
      ];
    }
  }

  const parts = splitTopLevel(source);
  if (parts.length > 1) {
    return parts.flatMap((part) => choiceAlternatives(part, depth + 1));
  }

  return [source];
}

/** Every `<Image>` tag in the given sources, in file/line order. */
export function nextImageTags(files: SourceFile[]): ImageTag[] {
  const tags: ImageTag[] = [];

  for (const file of files) {
    const bindings = staticImageImports(file.source);
    OPEN_TAG.lastIndex = 0;

    for (
      let match = OPEN_TAG.exec(file.source);
      match !== null;
      match = OPEN_TAG.exec(file.source)
    ) {
      const scanned = scanTag(file.source, OPEN_TAG.lastIndex);
      if (!scanned) continue;
      OPEN_TAG.lastIndex = scanned.end;
      if (inComment(file.source, match.index)) continue;

      const attrs = attributes(scanned.body);
      const src = attrs.get("src");
      tags.push({
        file: file.path,
        line: lineAt(file.source, match.index),
        src: src?.text,
        width: attrs.has("width"),
        height: attrs.has("height"),
        fill: attrs.has("fill"),
        sizes: attrs.has("sizes"),
        staticSrc: isStaticSrc(src, bindings),
      });
    }
  }

  return tags.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/**
 * The two shapes `next/image` refuses to render in dev. Everything else is legal: `fill`
 * alone, `width`+`height` alone, or no size at all when the `src` is a static import.
 */
export function imageProblems(files: SourceFile[]): ImageProblem[] {
  const problems: ImageProblem[] = [];

  for (const tag of nextImageTags(files)) {
    const at = `${tag.file}:${tag.line}`;

    if (tag.fill && (tag.width || tag.height)) {
      problems.push({
        kind: "fill-with-dimension",
        file: tag.file,
        line: tag.line,
        tag,
        message: `${at} passes \`fill\` together with \`width\`/\`height\` — next/image throws E96 "has both width and fill properties" in dev (production silently uses fill, so the dimensions are dead code). Drop the dimensions, or drop \`fill\` and keep them`,
      });
      continue;
    }

    if (!tag.fill && !(tag.width && tag.height) && !tag.staticSrc) {
      const missing = tag.width ? "height" : tag.height ? "width" : "width/height";
      problems.push({
        kind: "missing-dimension",
        file: tag.file,
        line: tag.line,
        tag,
        message: `${at} has no intrinsic size (missing \`${missing}\`, no \`fill\`, and \`src\` is not a static import) — next/image throws E451 "is missing required width property" in dev. Pass width/height, use \`fill\` inside a \`relative\` parent, or import the file so its size travels with it`,
      });
    }
  }

  return problems;
}

/** The counts the `data:check` summary prints, so the census is visible on every run. */
export function imageCensus(tags: readonly ImageTag[]): ImageCensus {
  const census: ImageCensus = {
    tags: tags.length,
    dimensioned: 0,
    fill: 0,
    staticImport: 0,
    fillWithSizes: 0,
    missingDimension: 0,
    fillWithDimension: 0,
  };

  for (const tag of tags) {
    if (tag.fill && (tag.width || tag.height)) census.fillWithDimension++;
    else if (tag.fill) {
      census.fill++;
      if (tag.sizes) census.fillWithSizes++;
    } else if (tag.width && tag.height) census.dimensioned++;
    else if (tag.staticSrc) census.staticImport++;
    else census.missingDimension++;
  }

  return census;
}
