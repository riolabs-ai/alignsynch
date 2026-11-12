import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { ThemeProvider } from "@/components/theme-provider";

/**
 * The provider must render during SSR (#880).
 *
 * next-themes applies the theme class with an inline `<script>` it emits as part of its own
 * render, and the whole point of that script is to run before the first paint. A mount gate
 * (`useState(false)` + `useEffect(() => setMounted(true))`) moves the script to the client,
 * where two things go wrong at once: nothing sets the class before paint, and React 19 logs
 * "Encountered a script tag while rendering React component. Scripts inside React components
 * are never executed when rendering on the client."
 *
 * `renderToStaticMarkup` is the server render, so this asserts on the markup that reaches the
 * browser — the case the dev console reported. It fails the moment the gate comes back, which
 * no `pnpm typecheck` or `next build` can see: the gated tree compiles, builds and serves.
 */
test("ThemeProvider emits next-themes' pre-paint script in the server markup", () => {
  const html = renderToStaticMarkup(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <span data-child></span>
    </ThemeProvider>,
  );

  // The class is set by the emitted script (`d.classList.remove(...); d.classList.add(...)`,
  // where `d` is `document.documentElement`); without it the class only lands after hydration.
  assert.match(html, /classList/, "the pre-paint theme script is missing");
  assert.match(html, /<script/, "the theme script is not in the server markup at all");
  // ...and the children are still rendered inside it.
  assert.match(html, /<span data-child/);
});
