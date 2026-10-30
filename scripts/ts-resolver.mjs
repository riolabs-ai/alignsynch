/**
 * An ESM resolve hook so a node script can import this repo's TypeScript modules (#145).
 *
 * `pnpm db:verify` has to run the **same** mapping the page runs — `lib/db/rows.ts`'s
 * `safeParse` through `content/assessment.ts` — or the check would be a second implementation
 * of the rule it is checking. Node 24 runs `.ts` files by stripping their types, but it will
 * not do two things this tree relies on:
 *
 *   * the `@/` alias (`tsconfig.json` `paths`; Next and vitest resolve it, node does not), and
 *   * extensionless imports (`./record` → `./record.ts`).
 *
 * Both are resolved here, and nothing else is: everything a script imports is real source, so
 * a green `db:verify` is evidence about the code the app ships rather than about a copy of it.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = new URL("../", import.meta.url);

/** The file a specifier probably means, trying the extensions the tree uses. */
function candidatesFor(basePath) {
  const extensions = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];
  return extensions.map((suffix) => `${basePath}${suffix}`).filter((path) => existsSync(path));
}

async function resolveTo(path, context, nextResolve) {
  let firstError;
  for (const candidate of candidatesFor(path)) {
    try {
      return await nextResolve(pathToFileURL(candidate).href, context);
    } catch (error) {
      firstError ??= error;
    }
  }
  throw firstError ?? new Error(`cannot resolve ${path}`);
}

/** `@/x` is `<repo>/x`; a relative or absolute path without an extension gets one. */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return resolveTo(fileURLToPath(new URL(specifier.slice(2), repoRoot)), context, nextResolve);
  }
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return nextResolve(specifier, context);
  }
  if (specifier.startsWith(".")) {
    const target = new URL(specifier, context.parentURL);
    if (target.protocol === "file:") {
      return resolveTo(fileURLToPath(target), context, nextResolve);
    }
  }
  return nextResolve(specifier, context);
}
