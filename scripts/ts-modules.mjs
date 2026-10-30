/**
 * Registers `scripts/ts-resolver.mjs` for one node process.
 *
 * Used as `node --import ./scripts/ts-modules.mjs scripts/<script>.mjs` by the `db:*` scripts
 * that import TypeScript source (`lib/db/**`, `content/**`). The script itself stays a plain
 * `.mjs` so `pnpm <script>` is debuggable without the flag being hidden in a wrapper.
 */
import { register } from "node:module";

register("./ts-resolver.mjs", import.meta.url);
