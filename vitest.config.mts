import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest — the unit-test runner for what `node --test` cannot reach.
 *
 * Two runners, on purpose (#8): `scripts/__tests__/**` is compiled by
 * `tsconfig.datacheck.json` into `.datacheck/` and runs under plain node inside
 * `pnpm data:check`, because it exists to prove the content model. Those tests are
 * not rewritten here. This config is for tests that import the *app* side
 * (`lib/quiz-cards.ts`, `data/searchdata.ts`) and need the `@/` alias resolved.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
