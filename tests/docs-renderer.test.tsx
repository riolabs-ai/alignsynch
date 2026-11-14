/**
 * The reader renders what the pages are written in (#937, card t_00e26d09).
 *
 * `/admin/docs` renders `docs/**` through `react-markdown@10`. Without a remark plugin it parses
 * plain CommonMark only, so the two GFM constructs these pages are made of **degrade silently**:
 * 87 pages carry a table (2,000-odd rows of measurement under `docs/qa/` and `docs/operations/`)
 * and every one arrived as a paragraph of pipe characters, and a `> [!NOTE]` alert blockquote
 * arrived as a quote whose first line read, literally, `[!NOTE]`. Both were invisible to
 * `typecheck`, `lint`, `next build` and — before this card — every other check in the gate, because
 * the markdown is data, not code.
 *
 * Three claims, and the third is the one that keeps the other two honest:
 *
 *   1. the exact plugin pair the component wires renders a table, an alert, a task list, an
 *      autolink and strikethrough — the constructs the docs actually use;
 *   2. **the same source without the plugins does not**, so these assertions are a proof of the
 *      wiring rather than of `react-markdown`'s defaults;
 *   3. `components/admin/docs/doc-article.tsx` still passes **both** plugins. Packages can sit in
 *      `package.json` while a refactor drops the `remarkPlugins` prop, which is exactly the silent
 *      regression the screenshots caught once and a test catches every run.
 *
 * The alert label is asserted in its rendered case (`NOTE`): the plugin upper-cases it and draws
 * its own icon, which is the look the approved screenshots in `docs/qa/docs-pretty/` show.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { remarkAlert } from "remark-github-blockquote-alert";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** One source carrying every construct `docs/` is written in, in the shape the pages use it. */
const SOURCE = [
  "| File | Role |",
  "| --- | --- |",
  "| `scripts/verify.sh` | the gate |",
  "",
  "> [!NOTE]",
  "> **Retired (#478).** The `/v1` tree is deleted.",
  "",
  "- [x] a task list item",
  "",
  "A bare URL https://example.com/x_y_z and a ~~strike~~.",
].join("\n");

const render = (plugins: Parameters<typeof Markdown>[0]["remarkPlugins"]): string =>
  renderToStaticMarkup(createElement(Markdown, { remarkPlugins: plugins }, SOURCE));

const PLUGINS = [remarkGfm, remarkAlert];

describe("/admin/docs renders GFM tables, alerts and the rest", () => {
  it("renders the constructs the docs are written in, through the component's plugin pair", () => {
    const html = render(PLUGINS);
    expect(html).toMatch(/<table[\s>]/);
    expect(html).toMatch(/<th[\s>]/);
    expect(html).toMatch(/class="markdown-alert markdown-alert-note"/);
    expect(html).toMatch(/\bNOTE\b/);
    expect(html).not.toMatch(/\[!NOTE\]/);
    expect(html).toMatch(/type="checkbox"/);
    expect(html).toMatch(/<a href="https:\/\/example\.com\/x_y_z"/);
    expect(html).toMatch(/<del>/);
  });

  it("is a proof of the wiring, not of react-markdown's defaults", () => {
    // The page as it arrived before this card: no table, no alert, and the marker read out loud.
    const bare = render(undefined);
    expect(bare).not.toMatch(/<table[\s>]/);
    expect(bare).not.toMatch(/markdown-alert/);
    expect(bare).toMatch(/\[!NOTE\]/);
  });

  it("still wires both plugins in the component that renders a page", () => {
    const source = readFileSync(join(ROOT, "components/admin/docs/doc-article.tsx"), "utf8");
    expect(source).toMatch(/^import remarkGfm from "remark-gfm";$/m);
    expect(source).toMatch(/^import \{ remarkAlert \} from "remark-github-blockquote-alert";$/m);
    // The pair lives in a module-scope constant (react-markdown re-runs a fresh array on every
    // render) and the `<Markdown>` element consumes it — assert both halves, in either order.
    const source_plugins = source.match(/const REMARK_PLUGINS = \[([^\]]*)\]/);
    expect(source_plugins?.[1]).toContain("remarkGfm");
    expect(source_plugins?.[1]).toContain("remarkAlert");
    expect(source).toMatch(/remarkPlugins=\{REMARK_PLUGINS\}/);
  });
});
