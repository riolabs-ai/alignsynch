/**
 * client-graph — the import boundary a client component may not cross (#228).
 *
 * `next build` passes on a tree where a `"use client"` module value-imports a module that
 * reaches `pg`, and every route behind the shell then answers **500** at request time: the
 * browser graph has no `pg` build, so the client module graph fails to resolve. That is not a
 * hypothesis — issue #228 was filed against exactly that tree, and the gate was green on it.
 *
 * The rule is a graph question, not a grep: `import type { ShellAccount } from
 * "@/lib/auth/shell-account"` is erased before the bundle and is legal; `import { shellAccount }
 * from the same path` is a runtime edge into `lib/db/**` and is not. So this module parses the
 * *value* imports of every client entry, resolves them through `@/` and relative paths, walks
 * them transitively, and reports the first edge that lands on a module the browser cannot load.
 *
 * Two things make it a rule instead of a comment:
 *
 *   - it is pure. The whole tree arrives as `{ path → source }` and the findings come back as
 *     data, so `scripts/__tests__/client-graph.test.ts` drives every shape — a type-only import,
 *     a mixed import, a lazy `import()`, a re-export, a transitive hop — with no filesystem.
 *   - it names the chain. `[E34]` with `components/layout/header.tsx → lib/…` is the line a
 *     reviewer can act on, the same trace `next dev` prints when the request 500s.
 *
 * Comment stripping is load-bearing twice over: a commented-out import is not an edge, and the
 * header's own doc comment explains *why* its import is type-only — a scanner that regexed the
 * raw text would flag the explanation. Both are the same bug class as `scripts/ui-refs.ts`'s
 * "deliberately static: only literals are checked".
 */
import { posix } from "node:path";

/** The directive, as a statement, on the first non-comment line. */
const CLIENT_DIRECTIVE = /^(["'])use client\1\s*;?$/;

/**
 * Modules the browser bundle cannot resolve, by package name.
 *
 * `pg` is the one that broke production (#228). The rest are the same failure mode one import
 * away: a Node builtin has no browser build either, so a client component that reaches one 500s
 * exactly as `pg` did. `server-only` is here because importing it from a client module is the
 * deliberate opposite — a compile-time refusal, which is a finding, not a false positive.
 */
const NODE_ONLY_PACKAGES: readonly string[] = [
  "pg",
  "pg-native",
  "pg-pool",
  "pg-protocol",
  "server-only",
  "fs",
  "fs/promises",
  "child_process",
  "cluster",
  "dgram",
  "dns",
  "http",
  "http2",
  "https",
  "net",
  "os",
  "path",
  "perf_hooks",
  "readline",
  "repl",
  "stream",
  "tls",
  "tty",
  "v8",
  "vm",
  "worker_threads",
  "zlib",
];

/**
 * Repo paths a client module may not reach, even though they are our own code.
 *
 * `lib/db/**` is the database layer: `client.ts` owns the `pg` pool and `user-profiles.ts` /
 * `assessments.ts` read through it. Catching the layer rather than only `pg` is what makes the
 * diagnostic say *which* server module was crossed instead of "the bundle contains a driver".
 */
const NODE_ONLY_PREFIXES: readonly string[] = ["lib/db/"];

/** A file's imports, relative to the repo root. */
export interface ClientGraphSources {
  /** Repo-relative path → source text. `lib/db/client.ts` and friends must be present. */
  readonly sources: Readonly<Record<string, string>>;
}

/** One boundary crossing: the client entry that started the walk and the chain that reached it. */
export interface ClientBoundaryFinding {
  /** The rule code the validator prints. Declared in `scripts/rule-codes.ts`. */
  readonly rule: "E34";
  /** The `"use client"` module the chain starts at. */
  readonly entry: string;
  /** `entry → … → offending module`, in the words `next dev` prints. */
  readonly chain: readonly string[];
  /** The offending module as written: `pg` for a package, the repo path for our own code. */
  readonly offender: string;
  /** One sentence, ready to print after the code. */
  readonly message: string;
}

/**
 * The source with every comment removed, string and template literals intact.
 *
 * A hand-written scanner rather than one regex per comment shape, because `//` inside a string
 * (`https://…`, a URL in a fixture) is not a comment and `/*` inside a regex literal is rare
 * enough to be worth ignoring. Newlines survive, so a finding's line numbers stay honest.
 */
export function stripComments(source: string): string {
  let out = "";
  let index = 0;
  let state: "code" | "line" | "block" | "single" | "double" | "template" = "code";

  while (index < source.length) {
    const char = source[index] ?? "";
    const next = source[index + 1] ?? "";

    if (state === "code") {
      if (char === "/" && next === "/") {
        state = "line";
        index += 2;
        continue;
      }
      if (char === "/" && next === "*") {
        state = "block";
        index += 2;
        continue;
      }
      if (char === '"') state = "double";
      else if (char === "'") state = "single";
      else if (char === "`") state = "template";
      out += char;
      index += 1;
      continue;
    }

    if (state === "line") {
      if (char === "\n") {
        state = "code";
        out += char;
      }
      index += 1;
      continue;
    }

    if (state === "block") {
      if (char === "*" && next === "/") {
        state = "code";
        index += 2;
        continue;
      }
      if (char === "\n") out += char;
      index += 1;
      continue;
    }

    // Inside a string or a template: copy verbatim, and let a backslash escape the next char.
    out += char;
    if (char === "\\") {
      out += next;
      index += 2;
      continue;
    }
    if (
      (state === "double" && char === '"') ||
      (state === "single" && char === "'") ||
      (state === "template" && char === "`")
    ) {
      state = "code";
    }
    index += 1;
  }

  return out;
}

/**
 * Does this module open with `"use client"`?
 *
 * The directive has to be the **first statement**, so the check reads past leading comments and
 * blank lines and then compares one line. A doc comment that mentions `"use client"` — the
 * header's does — is therefore not an entry, which is the difference between a rule and a grep.
 */
export function hasClientDirective(source: string): boolean {
  const stripped = stripComments(source).replace(/^\uFEFF/, "");
  for (const line of stripped.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    return CLIENT_DIRECTIVE.test(trimmed);
  }
  return false;
}

/** `{ type A, type B }` loads nothing at runtime; `{ type A, b }` and `{ A }` load the module. */
function isTypeOnlyClause(clause: string): boolean {
  const trimmed = clause.trim();
  if (trimmed === "") return false;

  const braces = /\{([\s\S]*)\}/.exec(trimmed);
  const outside = (braces === null ? trimmed : trimmed.slice(0, braces.index))
    .replace(/,$/, "")
    .trim();
  // A default binding (`import X from`) or a namespace (`import * as X from`) is a value.
  if (outside !== "") return false;
  if (braces === null) return false;

  const entries = braces[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  if (entries.length === 0) return false;
  return entries.every((entry) => /^type\s+\S/.test(entry));
}

/** One import edge out of a module: where it points, and whether it survives to the bundle. */
export interface ModuleImport {
  /** The specifier exactly as written. */
  readonly specifier: string;
  /** False for `import type` / an all-`type` named list — erased before the graph is built. */
  readonly runtime: boolean;
}

/** `import … from "x"` — the clause is everything between the keyword and `from`. */
const STATIC_IMPORT = /\bimport\s+(type\s+)?([^;]*?)\s*from\s*["']([^"']+)["']/g;
/** `import "x"` — a side-effect import, which is a runtime edge by definition. */
const SIDE_EFFECT_IMPORT = /\bimport\s*["']([^"']+)["']/g;
/** `import("x")` — lazy is still a browser request for a module that cannot exist there. */
const DYNAMIC_IMPORT = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
/** `require("x")` — no bundler in this repo emits it, but a vendored file could. */
const REQUIRE_CALL = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
/** `export … from "x"` — a re-export loads the module exactly as an import does. */
const RE_EXPORT = /\bexport\s+(type\s+)?(\{[^}]*\}|\*[^;]*?)\s*from\s*["']([^"']+)["']/g;

/**
 * Every import edge in a module, in source order, with type-only edges marked.
 *
 * Deliberately over-inclusive on shapes it cannot parse (an unparseable clause is treated as a
 * runtime import): a false positive is one line of review, a false negative is a 500.
 */
export function moduleImports(source: string): ModuleImport[] {
  const stripped = stripComments(source);
  const found: { index: number; value: ModuleImport }[] = [];

  const push = (index: number, specifier: string, runtime: boolean) => {
    found.push({ index, value: { specifier, runtime } });
  };

  for (const match of stripped.matchAll(STATIC_IMPORT)) {
    const clause = match[2] ?? "";
    const typeOnly = match[1] !== undefined;
    push(match.index ?? 0, match[3], typeOnly ? false : !isTypeOnlyClause(clause));
  }
  for (const match of stripped.matchAll(SIDE_EFFECT_IMPORT)) {
    push(match.index ?? 0, match[1], true);
  }
  for (const match of stripped.matchAll(DYNAMIC_IMPORT)) {
    push(match.index ?? 0, match[1], true);
  }
  for (const match of stripped.matchAll(REQUIRE_CALL)) {
    push(match.index ?? 0, match[1], true);
  }
  for (const match of stripped.matchAll(RE_EXPORT)) {
    const clause = match[2] ?? "";
    const typeOnly = match[1] !== undefined;
    const allTyped = clause.startsWith("{") && isTypeOnlyClause(clause);
    push(match.index ?? 0, match[3], !(typeOnly || allTyped));
  }

  // `import … from "x"` is also matched by SIDE_EFFECT_IMPORT's looser shape in one case
  // (`import x from "y"` does not match it), but a duplicate edge is harmless: dedupe on the
  // pair so a module is walked once.
  const seen = new Set<string>();
  return found
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.value)
    .filter((entry) => {
      const key = `${entry.runtime}\u0000${entry.specifier}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * The repo path a specifier names, or `null` for a bare package.
 *
 * `@/lib/db/client` and `../db/client` both resolve through the same candidate list, which is
 * `tsconfig.json`'s `@/*` → `./*` plus the extensions this tree actually uses. Extensionless is
 * tried first, then the four file extensions and the three index forms — the same order
 * TypeScript resolves them in, so the walk sees what the compiler sees.
 */
export function resolveSpecifier(
  specifier: string,
  importer: string,
  known: ReadonlySet<string>,
): string | null {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = specifier.slice(2);
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    base = posix.normalize(posix.join(posix.dirname(importer), specifier));
  } else {
    return null;
  }

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.jsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
    `${base}/index.jsx`,
  ];
  for (const candidate of candidates) {
    if (known.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Why a specifier (or the repo path it resolves to) cannot be in a browser bundle — or `null`
 * when it can.
 *
 * A bare package is judged by name. A repo path is judged by prefix: `lib/db/client.ts` is the
 * pool, and every module under `lib/db/` is server code by construction.
 */
export function browserUnsafe(module: string): string | null {
  if (module.startsWith("node:")) return `${module} is a Node builtin`;
  if (NODE_ONLY_PACKAGES.includes(module)) return `${module} has no browser build`;
  for (const prefix of NODE_ONLY_PREFIXES) {
    if (module === prefix.slice(0, -1) || module.startsWith(prefix)) {
      return `${module} is the database layer`;
    }
  }
  return null;
}

/**
 * Every `"use client"` module whose transitive value imports reach a module the browser cannot
 * load, one finding per offending chain.
 *
 * Breadth-first with a parent map, so the reported chain is the **shortest** one — the edge the
 * author actually wrote, in the order the compiler walked it. An unresolvable specifier is not a
 * finding: it is either a bare package (judged by name above) or a file this map does not hold
 * (JSON, CSS, a generated fixture), and neither is this rule's business.
 *
 * The adjacencies are built **once** for the whole map. Parsing every entry's reachable sources
 * again for each entry was 724 ms p50 on this tree (measured, 8-core box under fleet load) — close
 * enough to the one-second budget that two more client components would have spent it. The parse
 * does not depend on which entry is asking, so it happens once and the walk is graph traversal
 * only: 265 ms p50 for the same tree (n=5: 184–342 ms), and it runs once per `data:check`.
 */
export function clientGraphFindings(input: ClientGraphSources): ClientBoundaryFinding[] {
  const sources = input.sources;
  const paths = Object.keys(sources);
  const known = new Set(paths);
  const findings: ClientBoundaryFinding[] = [];

  /** `path` → the runtime edges out of it, with the specifier resolved as far as the map allows. */
  const edges = new Map<string, { specifier: string; resolved: string | null }[]>();
  for (const path of paths) {
    const list: { specifier: string; resolved: string | null }[] = [];
    for (const edge of moduleImports(sources[path] ?? "")) {
      if (!edge.runtime) continue;
      list.push({
        specifier: edge.specifier,
        resolved: resolveSpecifier(edge.specifier, path, known),
      });
    }
    edges.set(path, list);
  }

  const entries = paths.filter((path) => hasClientDirective(sources[path] ?? "")).sort();

  for (const entry of entries) {
    const parent = new Map<string, string>();
    const seen = new Set<string>([entry]);
    const queue: string[] = [entry];
    const reported = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const edge of edges.get(current) ?? []) {
        const target = edge.resolved ?? edge.specifier;
        const unsafe = browserUnsafe(target);
        if (unsafe !== null) {
          if (reported.has(target)) continue;
          reported.add(target);
          const chain: string[] = [current];
          for (let step = parent.get(current); step !== undefined; step = parent.get(step)) {
            chain.unshift(step);
          }
          findings.push({
            rule: "E34",
            entry,
            chain: [...chain, target],
            offender: target,
            message: `${entry}: a "use client" module reaches ${target} (${unsafe}) — ${[...chain, target].join(" → ")}. A client component may not value-import server-only code; resolve the value on the server and pass it down as a prop, or move the pure derivation into a module that imports no \`lib/db/**\``,
          });
          continue;
        }

        if (edge.resolved === null || seen.has(edge.resolved)) continue;
        seen.add(edge.resolved);
        parent.set(edge.resolved, current);
        queue.push(edge.resolved);
      }
    }
  }

  return findings;
}
