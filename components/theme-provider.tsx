"use client";

// template-ancestor: components/ui/sonner.tsx   (variation: a one-line wrapper binding a library provider to the app's theme defaults — no markup of its own)

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

/**
 * The library, rendered during SSR — never behind a mount gate (#880).
 *
 * next-themes sets the theme class with an inline `<script>` it emits as part of its own render,
 * so the class is on `<html>` before the first paint. Behind a `mounted` flag that script only
 * ever mounted after hydration, client-side, where React 19 refuses to execute it: the pre-paint
 * script never ran (light-to-x flash) and every page logged "Encountered a script tag while
 * rendering React component".
 *
 * A consumer that needs the resolved theme to be known before it renders would gate **itself**.
 * The one reader in the tree, `components/ui/sonner.tsx`, does not need one: its server markup
 * carries no theme-dependent attribute, so nothing mismatches. Gating this wrapper to suit a
 * consumer is what caused the bug.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
