/**
 * The render harness the parity snapshot runs on: one route in, one normalised document out.
 *
 * ## What "render" means here, and what it does not
 *
 * The page module and the route group's layout are the real ones — the same default exports
 * the router resolves (since #317 there are two groups: the product shell and the marketing
 * chrome, and the route names which one it lives in) — rendered with React's own server renderer
 * (`renderToPipeableStream` rather than `renderToStaticMarkup`, because three of the seven pages
 * unwrap `params` with `use()`, which only a real render can do). What is *not* real, and why:
 *
 *   * **`next/image` → a plain `<img>`.** Next's `<Image>` needs the Next runtime to compute its
 *     srcset, and it throws for a missing `width` (`AGENTS.md` lists that as a build-invisible
 *     pitfall — `/` has one today). The harness measures markup, and the gate's `next build`
 *     compiles the real component for both brands, so the props Next derives are covered there
 *     and the element's `src`/`alt`/`sizes` are covered here.
 *   * **`next/navigation` → a stub.** There is no router in a node process. `usePathname` answers
 *     the route under test, so the sidebar's active item is part of the snapshot; `notFound`
 *     stays the real function, so a fixture that stops resolving fails loudly instead of
 *     snapshotting an empty page.
 *   * **`@/lib/db/assessments` → `data/assessments.ts`.** `/assessment/[slug]` is the one route
 *     that reads Postgres at request time, and the gate has no `DATABASE_URL` on purpose
 *     (`AGENTS.md`: `pnpm build` must pass with it unset; the `db:*` scripts are not gate steps).
 *     The fixture is the same source `pnpm db:seed` writes *from* and `pnpm db:verify` holds the
 *     rows to, so this renders the record the database returns after a seed — not a stand-in
 *     invented for the test.
 *   * **`app/layout.tsx` → a wrapper `<div>`.** The root layout imports `next/font/google` and
 *     `globals.css`, which only a Next build can resolve. The two things it contributes to output
 *     are the brand's theme custom properties and the document title; the vars are restated on
 *     the wrapper as `data-brand-vars` (so a palette change is still a diff here) and the title is
 *     a metadata string, not markup.
 *
 * ## The clock, and why there is no mask
 *
 * Three of the seven pages print a label derived from `new Date()`: `/quiz/[id]`'s reward
 * countdown, the footer's `© <year>`, and — through `formatRelative`'s default — nothing else, as
 * every other label is a pure function of `content/core.ts`'s `DEMO_NOW_ISO`. Freezing `Date` to
 * that same instant leaves nothing time-dependent to mask: the render becomes a pure function of
 * the tree, and the snapshot pins the countdown's *format* as well as its value. Nothing is
 * masked beyond that, deliberately — a mask that hides markup hides the drift the snapshot exists
 * to catch.
 */
import React from "react";

import { DEMO_NOW_ISO } from "@/content/core";
import { brand } from "@/data/brand";
import { brandThemeVars } from "@/lib/brand-theme";
import type { RouteLayout } from "./routes";

/** The pathname `usePathname()` answers: set per route, so the shell's active item is in the snapshot. */
export const navigation = { pathname: "/" };

/** Elements that never take children, so they must not indent what follows them. */
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * Freeze the process clock at the repo's fixture instant.
 *
 * A `Date` subclass, not `vi.useFakeTimers()`: fake timers also stub `setTimeout`, and React's
 * server renderer uses it to schedule work — the render would hang rather than become
 * deterministic. This replaces only the reading of "now", which is the whole surface the repo's
 * formatters touch.
 */
export function freezeClock(iso: string = DEMO_NOW_ISO): void {
  const instant = new Date(iso).getTime();
  const RealDate = Date;

  class FrozenDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(instant);
      else super(...(args as [number]));
    }

    static now(): number {
      return instant;
    }
  }

  (globalThis as unknown as { Date: typeof Date }).Date = FrozenDate as unknown as typeof Date;
}

/** Render an element to an HTML string, waiting for every suspense boundary to settle. */
async function renderToHtml(element: React.ReactElement): Promise<string> {
  const { renderToPipeableStream } = await import("react-dom/server");
  const { Writable } = await import("node:stream");

  return await new Promise<string>((resolve, reject) => {
    const chunks: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(String(chunk));
        callback();
      },
    });

    sink.on("finish", () => resolve(chunks.join("")));
    sink.on("error", reject);

    const stream = renderToPipeableStream(element, {
      onAllReady() {
        stream.pipe(sink);
      },
      onError(error) {
        reject(error);
      },
    });
  });
}

/**
 * One route, both layers: the page inside the real layout its group mounts.
 *
 * `(mainlayout)` is the product shell; `(marketing)` is the public header and footer (#317). The
 * caller names the group because the page module cannot: a file's path is not visible to it, and
 * the harness must mount what the router mounts or it hashes a page nobody receives.
 *
 * The brand's theme vars ride on the wrapper so a palette edit is visible in the snapshot even
 * though the root layout cannot be rendered here (see the header).
 */
export async function renderRoute(
  page: (props: { params: Promise<Record<string, string>> }) => unknown | Promise<unknown>,
  params: Record<string, string>,
  pathname: string,
  layout: RouteLayout = "mainlayout",
): Promise<string> {
  const { SidebarProvider } = await import("@/components/layout/sidebar-context");
  const Layout =
    layout === "marketing"
      ? (await import("@/app/(marketing)/layout")).default
      : (await import("@/app/(mainlayout)/layout")).default;

  navigation.pathname = pathname;

  // Three of the seven pages are synchronous and unwrap `params` with React's `use()`, which only
  // exists inside a render — so those are handed to the renderer as components. An `async` page
  // cannot be rendered as a component by `react-dom/server`, and none of them call a hook outside
  // a render, so those are awaited here and their element is what gets rendered.
  const isAsync = page.constructor.name === "AsyncFunction";
  const body = (
    isAsync
      ? await page({ params: Promise.resolve(params) })
      : React.createElement(
          page as unknown as React.ComponentType<{ params: Promise<Record<string, string>> }>,
          { params: Promise.resolve(params) },
        )
  ) as React.ReactNode;

  // The layout is awaited for the same reason, and it became `async` in #212: the shell renders
  // the signed-in person, which the layout resolves from the request before it hands the header
  // its props. `shellAccount()` answers `null` here — this process has no auth environment and no
  // request, which is the shell's signed-out state — so the snapshot is the same on every run.
  const shell = (await (
    Layout as unknown as (props: { children: React.ReactNode }) => Promise<React.ReactNode>
  )({ children: body })) as React.ReactElement;

  return await renderToHtml(
    React.createElement(
      "div",
      {
        "data-parity-brand": brand.name,
        "data-parity-brand-vars": JSON.stringify(brandThemeVars(brand)),
      },
      React.createElement(
        SidebarProvider as unknown as React.ComponentType<{ children: React.ReactNode }>,
        null,
        shell,
      ),
    ),
  );
}

/** Two spaces of indent, and the deepest level that is indented. */
const INDENT = "  ";
const MAX_INDENT_DEPTH = 6;

/** Leading whitespace for a depth, capped so a deep page does not become mostly margin. */
function indent(depth: number): string {
  return INDENT.repeat(Math.min(depth, MAX_INDENT_DEPTH));
}

/**
 * The snapshot form of a rendered document: whitespace collapsed, one element per line.
 *
 * Two transformations, both presentational — the string compared is a lossless function of the
 * HTML apart from them, so a real change cannot hide:
 *
 *   1. React's text-boundary comments (`<!-- -->`) and the whitespace between tags are removed.
 *      They are artefacts of JSX layout, not of output, and they move whenever a component is
 *      reformatted.
 *   2. Each token — a tag, or the text between tags — goes on its own line, indented by depth.
 *      A one-line 250 KB file diffs as "the whole line changed"; one element per line diffs as
 *      the element that changed. Indentation is capped at six levels: `/` nests twenty deep, and
 *      forty-two columns of leading space on five thousand lines is a third of the file spent on
 *      whitespace nobody reads.
 *
 * Text nodes are trimmed. Browsers collapse that whitespace anyway, and keeping it would make
 * every re-indent of a component a snapshot change.
 */
export function normalize(html: string): string {
  const flat = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .replace(/> </g, "><")
    .trim();

  // A tag runs to the first `>` that is not inside a quoted attribute value; anything that is
  // not a tag is text.
  const tokens = flat.match(/<(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/g) ?? [];
  const lines: string[] = [];
  let depth = 0;

  for (const token of tokens) {
    if (token.startsWith("</")) {
      depth = Math.max(0, depth - 1);
      lines.push(`${indent(depth)}${token}`);
      continue;
    }

    if (token.startsWith("<")) {
      lines.push(`${indent(depth)}${token}`);
      const name =
        token
          .slice(1)
          .split(/[\s>/]/, 1)[0]
          ?.toLowerCase() ?? "";
      const selfClosing = token.endsWith("/>") || VOID_ELEMENTS.has(name);
      if (!selfClosing) depth += 1;
      continue;
    }

    const text = token.trim();
    if (text !== "") lines.push(`${indent(depth)}${text}`);
  }

  return `${lines.join("\n")}\n`;
}
