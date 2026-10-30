import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest for the brand-parity render (#171) — deliberately **not** the config `pnpm test` uses.
 *
 * Two differences, both because this is the only suite here that renders pages:
 *
 * 1. **`next/headers` is aliased.** `lib/auth/server.ts` imports `@neon/auth/next/server`, whose
 *    entry imports `next/headers` — a specifier that has no plain-node entry, so Vite fails to
 *    resolve it and the suite cannot even be collected. `tests/parity/next-headers.ts` answers
 *    an anonymous request, which is the surface a snapshot pins.
 * 2. **Its own `include`.** `tests/parity/*.check.ts`, not `*.test.ts`: `pnpm test` runs one
 *    process for every unit file, and a brand is a build constant — the parity pass needs one
 *    process *per brand* (`scripts/parity.mjs`), which a single `vitest run` cannot give it.
 *
 * Keeping this out of `vitest.config.mts` is on purpose: the unit suite renders nothing, so it
 * must not inherit a stubbed request context.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL(".", import.meta.url)) },
      {
        find: "next/headers",
        replacement: fileURLToPath(new URL("./tests/parity/next-headers.ts", import.meta.url)),
      },
    ],
  },
  test: {
    include: ["tests/parity/*.check.ts"],
    environment: "node",
    // `@neon/auth` is inlined so that its `import "next/headers"` goes through Vite's resolver and
    // reaches the alias above. Left external (the default for `node_modules`), Node's ESM loader
    // resolves it instead, ignores the alias, and the suite cannot be collected at all — the CI
    // failure that put this line here.
    server: { deps: { inline: [/@neon\/auth/] } },
  },
});
