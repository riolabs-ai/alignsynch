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

const ASSET = /^\/[^?#\s]*\.(?:png|jpe?g|webp|svg|gif|avif|ico)(?:[?#].*)?$/i;

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
  return collect(files, STRING_LITERAL, (match) => {
    const literal = match[1] ?? match[2];
    return literal !== undefined && ASSET.test(literal) ? literal : undefined;
  });
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
