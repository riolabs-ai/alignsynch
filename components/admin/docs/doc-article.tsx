/**
 * template-ancestor: components/support/article-detail.tsx   (variation: a markdown body from docs/**.md, rewritten links, with a crumb and a sibling list around it)
 *
 * `/admin/docs/[...slug]` — one document, rendered where it is written (#892).
 *
 * **Nothing is copied out of `docs/`.** The body is the file, read per request by
 * `lib/docs/tree.ts`; the title and the question are the manifest's row. That is the whole point of
 * the screen: `scripts/docs-check.mjs` already holds the tree, the manifest and 1,281 links together,
 * so a reader that re-authored a page would be a second source of truth for prose the gate inspects.
 *
 * **Links and images are rewritten, not trusted.** A document written for a checkout carries a sibling
 * markdown link and an image reference relative to its own directory; both would resolve against this
 * page's address and land on nothing. `lib/docs/links.ts::resolveDocsTarget` turns the first into a
 * `/admin/docs/…` address and the second into an `/api/docs/asset/…` one, leaves external links and
 * `#anchors` alone, and refuses anything it cannot serve — a refused link renders as plain text rather
 * than an anchor that 404s. The rewrite is pure and tested without a tree.
 *
 * **A server component, deliberately.** The markdown parser runs on the request, so the browser gets
 * prose instead of a parser plus 117 files' worth of AST work — and the module never touches `fs`
 * itself, which keeps E34's client graph clean by construction.
 *
 * Every word of the furniture comes from `data/pages/admin-docs-document.ts` (E23 budget 0); the
 * document's own title, question and body are the tree's.
 */
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import Markdown from "react-markdown";

import { DocFeedback } from "@/components/admin/docs/doc-feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PageCopy } from "@/content/pages";
import { resolveDocsTarget } from "@/lib/docs/links";
import type { DocsRow } from "@/lib/docs/rows";
import { NEW_TAB_LABEL } from "@/lib/marketing-routes";
import { itemLabel, sectionOf } from "@/lib/page-copy";

export interface DocArticleProps {
  copy: PageCopy;
  /** The manifest row this address names: its title is the heading, its question the lede. */
  row: DocsRow;
  /** The document's markdown, exactly as `docs/**` holds it. */
  body: string;
  /** The other pages in this section, in manifest order. */
  siblings: readonly DocsRow[];
  previous: DocsRow | null;
  next: DocsRow | null;
}

/** The inline text of a link's children, for the accessible name an external link needs. */
function textOf(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  return "";
}

const LINK_CLASS = "text-action underline underline-offset-2 hover:text-action/80";
const MUTED_CLASS = "text-muted-foreground";

/**
 * The markdown renderer's element map.
 *
 * Built per render because the link rewrite needs the *document's own* path to resolve `../`: the
 * same `![](img.png)` means two different files in two different sections. `node` is dropped before
 * the props reach the DOM (react-markdown hands it over, React would warn).
 */
function markdownComponents(fromPath: string) {
  return {
    h1: ({ node: _node, ...props }: { node?: unknown }) => (
      <h1 className="mt-8 mb-4 text-3xl font-bold text-foreground" {...props} />
    ),
    h2: ({ node: _node, ...props }: { node?: unknown }) => (
      <h2 className="mt-8 mb-3 text-2xl font-bold text-foreground" {...props} />
    ),
    h3: ({ node: _node, ...props }: { node?: unknown }) => (
      <h3 className="mt-6 mb-2 text-xl font-semibold text-foreground" {...props} />
    ),
    h4: ({ node: _node, ...props }: { node?: unknown }) => (
      <h4 className="mt-5 mb-2 text-base font-semibold text-foreground" {...props} />
    ),
    p: ({ node: _node, ...props }: { node?: unknown }) => (
      <p className="mb-4 text-sm leading-relaxed text-foreground" {...props} />
    ),
    ul: ({ node: _node, ...props }: { node?: unknown }) => (
      <ul className="mb-4 list-disc space-y-1 pl-6 text-sm leading-relaxed" {...props} />
    ),
    ol: ({ node: _node, ...props }: { node?: unknown }) => (
      <ol className="mb-4 list-decimal space-y-1 pl-6 text-sm leading-relaxed" {...props} />
    ),
    li: ({ node: _node, ...props }: { node?: unknown }) => <li className="pl-1" {...props} />,
    blockquote: ({ node: _node, ...props }: { node?: unknown }) => (
      <blockquote
        className="mb-4 border-l-2 border-action/40 pl-4 text-sm text-muted-foreground italic"
        {...props}
      />
    ),
    hr: ({ node: _node, ...props }: { node?: unknown }) => (
      <hr className="my-8 border-border" {...props} />
    ),
    pre: ({ node: _node, ...props }: { node?: unknown }) => (
      <pre
        className="mb-4 overflow-x-auto rounded-md border border-border bg-muted/50 p-3 text-xs leading-relaxed"
        {...props}
      />
    ),
    code: ({ node: _node, ...props }: { node?: unknown }) => (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs" {...props} />
    ),
    strong: ({ node: _node, ...props }: { node?: unknown }) => (
      <strong className="font-semibold text-foreground" {...props} />
    ),
    a: ({
      node: _node,
      href,
      children,
    }: {
      node?: unknown;
      href?: string;
      children?: ReactNode;
    }) => {
      const target = resolveDocsTarget(fromPath, href ?? "");
      if (target.kind === "doc" || target.kind === "route") {
        return (
          <Link href={target.href} className={LINK_CLASS}>
            {children}
          </Link>
        );
      }
      if (target.kind === "external") {
        return (
          <a
            href={target.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${textOf(children)} — ${NEW_TAB_LABEL}`}
            className={LINK_CLASS}
          >
            {children}
          </a>
        );
      }
      if (target.kind === "anchor" || target.kind === "asset") {
        return (
          <a href={target.href} className={LINK_CLASS}>
            {children}
          </a>
        );
      }
      // A file this reader cannot serve (`scripts/verify.sh`, a record under `docs/`): the label is
      // the honest answer, because a link that 404s is a worse one.
      return <span className={MUTED_CLASS}>{children}</span>;
    },
    img: ({ node: _node, src, alt }: { node?: unknown; src?: string | Blob; alt?: string }) => {
      const target = typeof src === "string" ? resolveDocsTarget(fromPath, src) : null;
      if (target === null || target.kind !== "asset") return null;
      return (
        // biome-ignore lint/performance/noImgElement: a markdown image carries no intrinsic size, and `next/image` needs `width`/`height` or a `fill` parent — declaring a ratio the file does not have would distort every screenshot in docs/ (AGENTS.md records the dev-only 500 for a sizeless `next/image`).
        <img
          src={target.href}
          alt={alt ?? ""}
          className="my-6 max-w-full rounded-md border border-border"
        />
      );
    },
  };
}

/** One step of the reading order: the word on the control, the page it opens, and the chevron's side. */
function StepLink({
  label,
  row,
  icon,
  iconAfter,
}: {
  label: string;
  row: DocsRow;
  /** The chevron, passed in as an element: a `direction="next"` prop would be a string literal in a
   *  component, which E23 counts as copy the fixture should own. */
  icon: ReactNode;
  /** Whether the chevron follows the title (the next page) or precedes it (the previous one). */
  iconAfter?: boolean;
}) {
  return (
    <Link
      href={row.href}
      className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-action/40 hover:bg-muted/50"
    >
      {iconAfter === true ? null : icon}
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block truncate font-medium text-foreground">{row.title}</span>
      </span>
      {iconAfter === true ? icon : null}
    </Link>
  );
}

export function DocArticle({ copy, row, body, siblings, previous, next }: DocArticleProps) {
  const documentCopy = sectionOf(copy, "document");
  const feedbackCopy = sectionOf(copy, "feedback");
  const empty = body.trim() === "";

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {copy.cta === undefined ? null : (
          <Link href={copy.cta.href} className="font-medium text-action hover:underline">
            {copy.cta.label}
          </Link>
        )}
        <span aria-hidden>/</span>
        <span>{row.sectionTitle}</span>
      </nav>

      <header className="space-y-2">
        <div className="flex items-start gap-2">
          <FileText className="mt-1 h-5 w-5 shrink-0 text-action" aria-hidden />
          <h1 className="text-2xl font-bold text-foreground">{row.title}</h1>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{row.question}</p>
      </header>

      <article className="max-w-none">
        {empty ? (
          <p className={MUTED_CLASS}>{itemLabel(documentCopy, "empty-body")}</p>
        ) : (
          <Markdown components={markdownComponents(row.path)}>{body}</Markdown>
        )}
      </article>

      {/* #894 — the note a reader files about this page. It sits directly under the body, because
          the panel quotes the heading the reader had in view and that is only true here. */}
      <DocFeedback copy={feedbackCopy} path={row.path} title={row.title} />

      {previous === null && next === null ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          {previous === null ? (
            <span />
          ) : (
            <StepLink
              label={itemLabel(documentCopy, "previous")}
              row={previous}
              icon={<ChevronLeft className="h-4 w-4" aria-hidden />}
            />
          )}
          {next === null ? (
            <span />
          ) : (
            <StepLink
              label={itemLabel(documentCopy, "next")}
              row={next}
              icon={<ChevronRight className="h-4 w-4" aria-hidden />}
              iconAfter
            />
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {itemLabel(documentCopy, "contents")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {siblings.map((sibling) => (
            <Link
              key={sibling.path}
              href={sibling.href}
              className={
                sibling.path === row.path
                  ? "block rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground"
                  : "block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }
            >
              {sibling.title}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
