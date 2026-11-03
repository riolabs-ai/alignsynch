/**
 * Vendor stylesheets, declared — the one shape TypeScript cannot resolve on its own.
 *
 * `driver.js` publishes its stylesheet as an export (`"./dist/driver.css"` in its `exports` map)
 * with no `.d.ts` beside it, so a side-effect import of it is a module TypeScript can find no
 * types for. Next resolves it at build time and the file is real; only the type checker needs the
 * sentence, which is this one. Narrow on purpose — the exact specifier, not `*.css` — so a
 * stylesheet added to a component without a resolver is still a `tsc` error rather than something
 * this file quietly blessed.
 */
declare module "driver.js/dist/driver.css";
