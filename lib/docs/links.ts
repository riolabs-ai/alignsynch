/**
 * `/admin/docs` — what a link inside a document becomes (#892).
 *
 * **The problem this file exists for.** `docs/*.md` is written to be read in a checkout: a link says
 * `[the gate](GATE.md)`, an image says `![](images/gate.png)`, and both are correct there. Rendered
 * inside the product, the same two strings resolve against the *page's* address
 * (`/admin/docs/wiki/modules/app.md`) and land on nothing. There are 1,281 links and 45 images in
 * that tree; rewriting them by hand would be a second source of truth for a graph the gate already
 * walks, so the rewrite is one pure function that every markdown renderer calls.
 *
 * **Pure, and that is the point.** No `fs`, no React, no clock: the answer is a function of the
 * document's own path and the href on the page, so it is testable without a tree and it cannot read
 * a file the reader is not allowed to open. `lib/docs/tree.ts` is the module that opens things, and
 * it re-checks containment itself — a `..` that slips past here still cannot leave `docs/`.
 *
 * **Four answers, and one refusal.** A link is a document, an image, an external address, an
 * in-page anchor, or a site path (`/dashboard` — the absolute links some pages carry); anything else
 * is `unresolved`, and the renderer draws it as plain text. `unresolved` is the honest answer for a
 * link to a file the reader cannot serve (`scripts/verify.sh`), which is most of what is left: a
 * dead anchor that 404s would be a worse lie than a label that is not a link.
 */
import { docAssetHref, docHref } from "@/lib/docs/rows";

/** A path relative to the repository root, and the two prefixes an href can start with. */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** What an href inside a document means. */
export type DocsTarget =
  /** Another document in the manifest's tree — `/admin/docs/<path>`. */
  | { readonly kind: "doc"; readonly href: string }
  /** An image under `docs/` — served by the asset route, never under `public/`. */
  | { readonly kind: "asset"; readonly href: string }
  /** A scheme-qualified address (`https:`, `mailto:`) or protocol-relative (`//host`). */
  | { readonly kind: "external"; readonly href: string }
  /** `#section` — the page's own anchor, left exactly as written. */
  | { readonly kind: "anchor"; readonly href: string }
  /** A root-relative path on this site (`/dashboard`); the route manifest owns what it means. */
  | { readonly kind: "route"; readonly href: string }
  /** Nothing can be served: a `..` that leaves `docs/`, or a file this reader does not render. */
  | { readonly kind: "unresolved" };

/** The directory a document lives in, as segments relative to `docs/`. */
function directoryOf(fromPath: string): string[] {
  const segments = fromPath.split("/");
  segments.pop();
  return segments;
}

/**
 * The `docs/`-relative path an href names, or `null` when it leaves the tree.
 *
 * Resolved by hand rather than with `node:path` so this module stays client-safe: the rules are the
 * three that matter — `.` is the current directory, `..` pops one, and a path that pops past the
 * root is refused. A query string or a hash is dropped from the *path* (the fragment is re-appended
 * by the caller when it is a document).
 */
function relativeTarget(fromPath: string, href: string): string | null {
  const [rawPath = "", ...rest] = href.split("#");
  const [pathPart] = rawPath.split("?");
  const decoded = decodeURIComponent(pathPart);
  const segments = decoded.startsWith("/") ? [] : directoryOf(fromPath);
  for (const segment of decoded.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  const resolved = segments.join("/");
  if (resolved === "") return null;
  return rest.length === 0 ? resolved : `${resolved}#${rest.join("#")}`;
}

/**
 * What to do with one href written in `fromPath`.
 *
 * The fragment is preserved on documents and site paths (a link into a section of another page keeps
 * working) and dropped from images, where it means nothing.
 */
export function resolveDocsTarget(fromPath: string, href: string): DocsTarget {
  const written = href.trim();
  if (written === "") return { kind: "unresolved" };
  if (written.startsWith("#")) return { kind: "anchor", href: written };
  if (written.startsWith("//") || SCHEME.test(written)) return { kind: "external", href: written };
  if (written.startsWith("/")) return { kind: "route", href: written };

  const target = relativeTarget(fromPath, written);
  if (target === null) return { kind: "unresolved" };

  const [path, ...fragment] = target.split("#");
  const suffix = fragment.length === 0 ? "" : `#${fragment.join("#")}`;
  const extension = path.includes(".") ? path.slice(path.lastIndexOf(".")).toLowerCase() : "";

  if (extension === ".md") return { kind: "doc", href: `${docHref(path)}${suffix}` };
  if (IMAGE_EXTENSIONS.includes(extension)) {
    return { kind: "asset", href: docAssetHref(path) };
  }
  return { kind: "unresolved" };
}

/**
 * The image extensions the asset route answers for.
 *
 * Restated here rather than imported from `lib/docs/tree.ts`: that module imports `node:fs`, and a
 * markdown renderer that pulled the list from it would be a client graph reaching a Node builtin —
 * the exact E34 failure this feature is written against. `tree.ts` imports *this* list, and
 * `tests/admin-docs.test.ts` holds the two in step.
 */
export const IMAGE_EXTENSIONS: readonly string[] = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
];
