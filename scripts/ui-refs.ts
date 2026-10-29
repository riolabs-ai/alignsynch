/**
 * ui-refs — the hardcoded references a zod model cannot see.
 *
 * `content/` proves every link the *data* emits, but the shell links a user actually
 * clicks are written inline in components: `href="/dashboard"`, `avatar:
 * "/testimonials/jessica.png"`. Two of those shipped 404ing on `main` (issue #20), and
 * nothing in `data:check` could see them. This module extracts those literals so
 * `scripts/data-check.ts` can resolve them against the route manifest and `public/`,
 * and so the negative cases can be tested without touching the filesystem.
 *
 * Deliberately static: only *literals* are checked. `href={item.href}` and
 * `` href={`/quiz/${id}`}`` are dynamic by design and are left to the runtime.
 */

export interface SourceFile {
  /** Repo-relative path, reported verbatim in diagnostics. */
  path: string;
  source: string;
}

export interface UiReference {
  file: string;
  /** 1-based line of the literal, so the diagnostic is clickable. */
  line: number;
  /** The literal exactly as written. */
  value: string;
}

/** `href="/x"` and `href={"/x"}` — the two ways the codebase spells it. */
const HREF_ATTR = /href=(?:"([^"]*)"|\{\s*"([^"]*)"\s*\})/g;

/** Client-side navigation to a literal: `router.push("/x")`, `redirect("/x")`. */
const NAV_CALL = /\b(?:router\.(?:push|replace)|redirect)\(\s*"([^"]*)"\s*\)/g;

/** Any quoted literal — used only to hunt for `public/` asset paths. */
const STRING_LITERAL = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/g;

/** A backtick literal. An interpolated one (`${id}`) is dynamic and stays with the runtime. */
const TEMPLATE_LITERAL = /`([^`\\]*)`/g;

const ASSET = /^\/[^?#\s]*\.(?:png|jpe?g|webp|svg|gif|avif|ico)(?:[?#].*)?$/i;

/**
 * A path inside a class list or a style string: `bg-[url('/hero-bg.jpg')]`,
 * `"url(/newsletter-bg.png)"`. The whole string does not start with `/`, so `ASSET` above
 * reads it as a class list and the asset was invisible to every check — three real
 * backgrounds shipped that way.
 */
const CSS_URL =
  /url\(\s*['"]?(\/[^'")\s?#]*\.(?:png|jpe?g|webp|svg|gif|avif|ico)(?:[?#][^'")\s]*)?)['"]?\s*\)/gi;

/** `"/x"` is checkable; `http(s)://`, `mailto:`, `tel:`, `#frag` and bare words are not. */
function isInternalPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("${");
}

/** `/dashboard/user?tab=wallet#top` → `/dashboard/user`. */
export function routeOf(value: string): string {
  return value.split(/[?#]/)[0];
}

/** `/placeholder.svg?height=500` → `/placeholder.svg`. */
export function assetOf(value: string): string {
  return value.split(/[?#]/)[0];
}

function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

function collect(
  files: SourceFile[],
  pattern: RegExp,
  value: (match: RegExpExecArray) => string | undefined,
) {
  const found: UiReference[] = [];
  for (const file of files) {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(file.source); match !== null; match = pattern.exec(file.source)) {
      const literal = value(match);
      if (literal === undefined) continue;
      found.push({ file: file.path, line: lineAt(file.source, match.index), value: literal });
    }
  }
  return found;
}

/** Every literal the UI navigates to: `href` attributes plus `router.push`/`redirect`. */
export function navigationReferences(files: SourceFile[]): UiReference[] {
  return [
    ...collect(files, HREF_ATTR, (match) => match[1] ?? match[2]),
    ...collect(files, NAV_CALL, (match) => match[1]),
  ];
}

/** Every literal that looks like a `public/` asset path, wherever it is written. */
export function assetReferences(files: SourceFile[]): UiReference[] {
  const found: (UiReference & { at: number })[] = [];

  /** One literal body -> its asset paths (whole-literal, or `url(...)` inside it). */
  const inspect = (file: SourceFile, literal: string, bodyStart: number) => {
    if (ASSET.test(literal)) {
      found.push({
        file: file.path,
        line: lineAt(file.source, bodyStart - 1),
        value: literal,
        at: bodyStart - 1,
      });
    }

    // A path inside a class/style string: the literal as a whole is not an asset, but the
    // `url(...)` in it is.
    CSS_URL.lastIndex = 0;
    for (let nested = CSS_URL.exec(literal); nested !== null; nested = CSS_URL.exec(literal)) {
      const index = bodyStart + nested.index;
      found.push({
        file: file.path,
        line: lineAt(file.source, index),
        value: nested[1],
        at: index,
      });
    }
  };

  for (const file of files) {
    STRING_LITERAL.lastIndex = 0;
    for (
      let match = STRING_LITERAL.exec(file.source);
      match !== null;
      match = STRING_LITERAL.exec(file.source)
    ) {
      inspect(file, match[1] ?? match[2] ?? "", match.index + 1);
    }

    TEMPLATE_LITERAL.lastIndex = 0;
    for (
      let match = TEMPLATE_LITERAL.exec(file.source);
      match !== null;
      match = TEMPLATE_LITERAL.exec(file.source)
    ) {
      const literal = match[1] ?? "";
      // `${id}` makes it dynamic: the model or the route owns it, not a static path.
      if (literal.includes("${")) continue;
      inspect(file, literal, match.index + 1);
    }
  }

  return found
    .sort((a, b) => a.file.localeCompare(b.file) || a.at - b.at)
    .map(({ at: _at, ...reference }) => reference);
}

/** Internal references whose path no route resolves. External/scheme/fragment values are skipped. */
export function findDeadLinks(
  files: SourceFile[],
  resolves: (route: string) => boolean,
): UiReference[] {
  return navigationReferences(files).filter((reference) => {
    if (!isInternalPath(reference.value)) return false;
    return !resolves(routeOf(reference.value));
  });
}

/** Asset literals with no file under `public/`. `exists` receives the query/hash-free path. */
export function findMissingAssets(
  files: SourceFile[],
  exists: (asset: string) => boolean,
): UiReference[] {
  return assetReferences(files).filter((reference) => !exists(assetOf(reference.value)));
}
