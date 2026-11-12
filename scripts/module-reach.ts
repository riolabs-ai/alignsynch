/**
 * module-reach — which `page.tsx` reaches a module (#863).
 *
 * `scripts/client-graph.ts` already answers the *forward* question the gate asks: which client
 * entry's value imports land on a module the browser cannot load (E34). `pnpm qa:links` asks the
 * same graph in the other direction — *given* a changed module, which pages render it — so it
 * reuses that module's parser (`moduleImports`) and resolver (`resolveSpecifier`) instead of
 * walking imports a second way. A second walker would be a second answer to "what does this file
 * import", and the two would drift the first time an import shape is added to one of them.
 *
 * **Runtime edges only.** `import type` is erased before anything is bundled, so a page that
 * type-imports a module does not *render* it: a change to a type-only dependency changes no pixel
 * and needs no QA link. That is E34's rule and the reason it is stated there rather than here.
 *
 * **Pure.** The whole tree arrives as `{ path → source }`, exactly as `clientGraphFindings` takes
 * it, so `tests/qa-links.test.ts` drives a type-only edge, a transitive hop and an unreached
 * module with no filesystem and no server.
 */
import { moduleImports, resolveSpecifier } from "./client-graph";

/** The tree, as the paths and source this walk needs. */
export interface ReachInput {
  /** Repo-relative path → source text. Only `.ts`/`.tsx`/`.js`/`.mjs` files belong here. */
  readonly sources: Readonly<Record<string, string>>;
  /** The entries to walk from — every `app/**\/page.tsx` for the QA link list. */
  readonly entries: readonly string[];
}

/**
 * Every module each entry reaches, itself included.
 *
 * Breadth-first with a seen set, one walk per entry: the adjacencies are parsed once for the
 * whole map (the same optimisation `clientGraphFindings` documents — parsing per entry cost
 * 724 ms on a tree this size), so this is graph traversal only.
 */
export function reachability(input: ReachInput): Map<string, Set<string>> {
  const paths = Object.keys(input.sources);
  const known = new Set(paths);

  /** `path` → the repo modules it value-imports, resolved as far as the map allows. */
  const edges = new Map<string, string[]>();
  for (const path of paths) {
    const targets: string[] = [];
    for (const edge of moduleImports(input.sources[path] ?? "")) {
      if (!edge.runtime) continue;
      const resolved = resolveSpecifier(edge.specifier, path, known);
      if (resolved !== null) targets.push(resolved);
    }
    edges.set(path, targets);
  }

  const reach = new Map<string, Set<string>>();
  for (const entry of input.entries) {
    const seen = new Set<string>([entry]);
    const queue: string[] = [entry];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const target of edges.get(current) ?? []) {
        if (seen.has(target)) continue;
        seen.add(target);
        queue.push(target);
      }
    }
    reach.set(entry, seen);
  }

  return reach;
}

/**
 * The entries that reach `module`, in path order.
 *
 * An entry is a `page.tsx` **or** a `layout.tsx`: the shell's sidebar is rendered by
 * `app/(mainlayout)/layout.tsx` and by no page at all, and calling that "a module no page reaches"
 * would be a lie about the most-rendered component in the tree.
 *
 * A bare package never appears in a reach set — `resolveSpecifier` answers `null` for it — so a
 * changed lockfile or a bumped dependency is not this function's business.
 */
export function entriesReaching(
  reach: ReadonlyMap<string, ReadonlySet<string>>,
  module: string,
): string[] {
  const found: string[] = [];
  for (const [entry, seen] of reach) {
    if (seen.has(module)) found.push(entry);
  }
  return found.sort();
}
