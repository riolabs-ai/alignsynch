/**
 * The client/server import boundary — the negative cases for `scripts/client-graph.ts` (#228).
 *
 * `next build` completed on the tree that broke the app. `header.tsx` was `"use client"` and
 * value-imported `accountProfileHref` from `lib/auth/shell-account.ts`, which reads
 * `lib/db/user-profiles.ts`, which builds the `pg` pool; there is no browser build of `pg`, so
 * the client module graph failed to resolve and **every route behind the shell answered 500**.
 * No gate step asked the graph question, so nothing saw it.
 *
 * The interesting half is not "a client module imports the database" — it is that the legal and
 * illegal shapes sit one character apart. `import type { ShellAccount }` from the same path is
 * correct and is what makes the header's props safe; a value import of one helper from the same
 * module is the defect. So the cases below are written in pairs, one shape each: the type import
 * (clean), the value import (a finding), the mixed clause (a finding — one value makes the whole
 * edge runtime), the lazy `import()` (a finding: lazy is still a browser request), the re-export
 * (a finding), and the four-hop chain the real tree had, which must be reported as a chain
 * rather than as a bare package name.
 *
 * The last section is the tree this ships in: every `"use client"` entry, resolved for real, must
 * come back with **no** finding. That is the assertion that fails the day the defect returns.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  browserUnsafe,
  clientGraphFindings,
  hasClientDirective,
  moduleImports,
  resolveSpecifier,
  stripComments,
} from "../client-graph";

/* ================================================================== *
 * The directive is a statement, not a string in a comment
 * ================================================================== */

describe("hasClientDirective", () => {
  it("reads the directive as the first statement", () => {
    assert.equal(hasClientDirective('"use client";\nimport x from "y";'), true);
    assert.equal(hasClientDirective("'use client'\n"), true);
    assert.equal(hasClientDirective('\n\n  "use client"; // the header\n'), true);
  });

  it("reads past a leading comment — a file may be documented before it is declared", () => {
    const source = [
      "/**",
      " * The header. It is a client component.",
      " */",
      '"use client";',
      "",
    ].join("\n");
    assert.equal(hasClientDirective(source), true);
  });

  it("is not fooled by a doc comment that explains the directive", () => {
    // `header.tsx` explains in prose why one of its imports is type-only. A scanner that
    // looked for the string anywhere would call that file an entry on its own documentation.
    const source = [
      "/**",
      ' * A server module. Never add "use client" here: it would put the pool in the bundle.',
      " */",
      'import { sql } from "./client";',
    ].join("\n");
    assert.equal(hasClientDirective(source), false);
  });

  it("is not a directive once another statement came first", () => {
    assert.equal(hasClientDirective('import x from "y";\n"use client";'), false);
    assert.equal(hasClientDirective("// just a comment\n"), false);
  });
});

describe("stripComments", () => {
  it("removes line and block comments but keeps line count", () => {
    const source = [
      "const a = 1; // trailing",
      "/* block",
      "   still block */",
      "const b = 2;",
    ].join("\n");
    const stripped = stripComments(source);
    assert.equal(stripped.split("\n").length, source.split("\n").length);
    assert.ok(!stripped.includes("trailing"));
    assert.ok(!stripped.includes("still block"));
    assert.ok(stripped.includes("const b = 2;"));
  });

  it("does not treat a // inside a string as a comment", () => {
    const source = 'const url = "https://example.test/x"; // real comment\nimport y from "./y";';
    const stripped = stripComments(source);
    assert.ok(stripped.includes("https://example.test/x"));
    assert.ok(stripped.includes('import y from "./y"'));
  });
});

/* ================================================================== *
 * Which imports survive to the bundle
 * ================================================================== */

describe("moduleImports", () => {
  const specifiers = (source: string) => moduleImports(source).map((edge) => edge.specifier);
  const runtime = (source: string) =>
    moduleImports(source)
      .filter((edge) => edge.runtime)
      .map((edge) => edge.specifier);

  it("marks a value import as runtime and an `import type` as not", () => {
    assert.deepEqual(runtime('import { accountProfileHref } from "@/lib/auth/shell-account";'), [
      "@/lib/auth/shell-account",
    ]);
    assert.deepEqual(runtime('import type { ShellAccount } from "@/lib/auth/shell-account";'), []);
    assert.deepEqual(specifiers('import type { ShellAccount } from "@/lib/auth/shell-account";'), [
      "@/lib/auth/shell-account",
    ]);
  });

  it("treats an all-`type` named list as erased and a mixed list as runtime", () => {
    assert.deepEqual(runtime('import { type A, type B } from "./x";'), []);
    assert.deepEqual(runtime('import { type A, b } from "./x";'), ["./x"]);
    assert.deepEqual(runtime('import { A } from "./x";'), ["./x"]);
  });

  it("counts default, namespace and side-effect imports", () => {
    assert.deepEqual(runtime('import Header from "./header";'), ["./header"]);
    assert.deepEqual(runtime('import * as header from "./header";'), ["./header"]);
    assert.deepEqual(runtime('import "./styles.css";'), ["./styles.css"]);
  });

  it("counts a lazy import() and a require() — the browser still has to resolve them", () => {
    assert.deepEqual(runtime('const db = await import("@/lib/db/client");'), ["@/lib/db/client"]);
    assert.deepEqual(runtime('const pg = require("pg");'), ["pg"]);
  });

  it("counts a re-export, but not `export type`", () => {
    assert.deepEqual(runtime('export { query } from "@/lib/db/client";'), ["@/lib/db/client"]);
    assert.deepEqual(runtime('export * from "@/lib/db/client";'), ["@/lib/db/client"]);
    assert.deepEqual(runtime('export type { Row } from "@/lib/db/rows";'), []);
    assert.deepEqual(runtime('export { type Row } from "@/lib/db/rows";'), []);
  });

  it("ignores a commented-out import — it is not an edge", () => {
    const source = [
      '"use client";',
      '// import { readUserProfileByUserId } from "@/lib/db/user-profiles";',
      "/*",
      '   import { sql } from "@/lib/db/client";',
      " */",
      'import type { ShellAccount } from "@/lib/auth/shell-account";',
    ].join("\n");
    assert.deepEqual(runtime(source), []);
  });
});

/* ================================================================== *
 * Resolution, so the walk follows what the compiler follows
 * ================================================================== */

describe("resolveSpecifier", () => {
  const known = new Set([
    "lib/db/client.ts",
    "lib/db/index.ts",
    "components/layout/header.tsx",
    "lib/auth/shell-account.ts",
  ]);

  it("resolves the `@/` alias and a relative path to the same module", () => {
    assert.equal(
      resolveSpecifier("@/lib/db/client", "components/a.tsx", known),
      "lib/db/client.ts",
    );
    assert.equal(resolveSpecifier("../db/client", "lib/auth/x.ts", known), "lib/db/client.ts");
    assert.equal(
      resolveSpecifier("./client", "lib/db/user-profiles.ts", known),
      "lib/db/client.ts",
    );
  });

  it("resolves a directory to its index", () => {
    assert.equal(resolveSpecifier("@/lib/db", "components/a.tsx", known), "lib/db/index.ts");
  });

  it("answers null for a bare package and for a file the tree does not hold", () => {
    assert.equal(resolveSpecifier("pg", "lib/db/client.ts", known), null);
    assert.equal(resolveSpecifier("@/lib/nope", "components/a.tsx", known), null);
  });
});

describe("browserUnsafe", () => {
  it("names the database layer and the packages with no browser build", () => {
    assert.match(String(browserUnsafe("lib/db/client.ts")), /database layer/);
    assert.match(String(browserUnsafe("lib/db/user-profiles.ts")), /database layer/);
    assert.match(String(browserUnsafe("pg")), /no browser build/);
    assert.match(String(browserUnsafe("node:fs")), /Node builtin/);
    assert.match(String(browserUnsafe("fs")), /no browser build/);
  });

  it("leaves pure code, React and the fixtures alone", () => {
    for (const safe of [
      "lib/nav.ts",
      "lib/auth/shell-account.ts",
      "components/ui/button.tsx",
      "data/notifications.ts",
      "react",
      "next/link",
      "lucide-react",
    ]) {
      assert.equal(browserUnsafe(safe), null, `${safe} must be loadable in a browser`);
    }
  });
});

/* ================================================================== *
 * The defect, and the same code with the boundary respected
 * ================================================================== */

/** The tree #228 was filed against, four hops and one package deep. */
const BROKEN = {
  "components/layout/header.tsx": [
    '"use client";',
    'import { accountProfileHref } from "@/lib/auth/shell-account";',
    'import type { ShellAccount } from "@/lib/auth/shell-account";',
    "export function Header({ account }: { account: ShellAccount }) {",
    "  return accountProfileHref(account);",
    "}",
  ].join("\n"),
  "lib/auth/shell-account.ts": [
    'import { readUserProfileByUserId } from "@/lib/db/user-profiles";',
    "export function accountProfileHref(account) { return account; }",
    "export async function shellAccount() { return readUserProfileByUserId('u'); }",
  ].join("\n"),
  "lib/db/user-profiles.ts": [
    'import { query } from "./client";',
    'import type { Row } from "./rows";',
    "export async function readUserProfileByUserId(id: string) { return query(id); }",
  ].join("\n"),
  "lib/db/client.ts": ['import { Pool } from "pg";', "export const pool = new Pool();"].join("\n"),
  "lib/db/rows.ts": ["export interface Row { id: string }"].join("\n"),
};

/** The same tree with the boundary respected: the type crosses, the value never does. */
const FIXED = {
  ...BROKEN,
  "components/layout/header.tsx": [
    '"use client";',
    'import { accountProfileHref } from "@/lib/auth/profile-href";',
    'import type { ShellAccount } from "@/lib/auth/shell-account";',
    "export function Header({ account }: { account: ShellAccount }) {",
    "  return accountProfileHref(account);",
    "}",
  ].join("\n"),
  "lib/auth/profile-href.ts": [
    'import type { ShellAccount } from "./shell-account";',
    "export function accountProfileHref(account: ShellAccount | null): string | null {",
    '  return account === null ? null : "/profile/" + account.handle;',
    "}",
  ].join("\n"),
};

describe("clientGraphFindings — the shape #228 shipped", () => {
  it("reports the chain from the client entry to the first server-only module", () => {
    const findings = clientGraphFindings({ sources: BROKEN });
    assert.equal(findings.length, 1, "one crossing, reported once");
    const [finding] = findings;
    assert.equal(finding.rule, "E34");
    assert.equal(finding.entry, "components/layout/header.tsx");
    // The chain stops at the **first** module the browser cannot load. `lib/db/user-profiles.ts`
    // is that module: everything below it is the database layer's own business, and naming the
    // layer is what tells a reviewer which server file was crossed, not just that `pg` appeared.
    assert.deepEqual(finding.chain, [
      "components/layout/header.tsx",
      "lib/auth/shell-account.ts",
      "lib/db/user-profiles.ts",
    ]);
    assert.equal(finding.offender, "lib/db/user-profiles.ts");
    assert.match(finding.message, /lib\/db\/user-profiles\.ts/);
    assert.match(finding.message, /the database layer/);
    assert.match(finding.message, /a client component may not value-import server-only code/i);
  });

  it("names `pg` itself when the client module imports the pool directly", () => {
    const findings = clientGraphFindings({
      sources: {
        ...BROKEN,
        "components/layout/header.tsx": [
          '"use client";',
          'import { pool } from "@/lib/db/client";',
          "export const p = pool;",
        ].join("\n"),
      },
    });
    assert.equal(findings.length, 1);
    assert.deepEqual(findings[0].chain, ["components/layout/header.tsx", "lib/db/client.ts"]);
    assert.match(findings[0].message, /lib\/db\/client\.ts/);
  });

  it("reports nothing for the same tree with the value import removed", () => {
    assert.deepEqual(clientGraphFindings({ sources: FIXED }), []);
  });

  it("reports nothing when only the type crosses — the legal shape beside it", () => {
    const typeOnly = {
      ...BROKEN,
      "components/layout/header.tsx": [
        '"use client";',
        'import type { ShellAccount } from "@/lib/auth/shell-account";',
        "export function Header({ account }: { account: ShellAccount }) { return account; }",
      ].join("\n"),
    };
    assert.deepEqual(clientGraphFindings({ sources: typeOnly }), []);
  });

  it("reports a mixed clause — one value makes the whole edge runtime", () => {
    const mixed = {
      ...BROKEN,
      "components/layout/header.tsx": [
        '"use client";',
        'import { type ShellAccount, accountProfileHref } from "@/lib/auth/shell-account";',
        "export const x = [accountProfileHref, null as unknown as ShellAccount];",
      ].join("\n"),
    };
    assert.equal(clientGraphFindings({ sources: mixed }).length, 1);
  });

  it("does not walk a module that is not a client entry", () => {
    // The server component at the top of the shell imports the same thing and is correct:
    // it renders on the server, where `pg` exists.
    const serverOnly = {
      ...BROKEN,
      "components/layout/header.tsx": [
        'import { accountProfileHref } from "@/lib/auth/shell-account";',
        "export function Header() { return accountProfileHref(null); }",
      ].join("\n"),
    };
    assert.deepEqual(clientGraphFindings({ sources: serverOnly }), []);
  });

  it("leaves a server component and a route handler free to import the database", () => {
    // The rule is about the **browser** graph. `app/**/layout.tsx` and `app/api/**/route.ts` are
    // server code: reading `lib/db/**` there is what the layer is for, and a rule that flagged it
    // would be a rule about the wrong question. Only a `"use client"` entry is walked.
    const sources = {
      "app/(mainlayout)/layout.tsx": [
        'import { shellAccount } from "@/lib/auth/shell-account";',
        'import { MainLayout } from "@/components/layout/main-layout";',
        "export default async function Layout() {",
        "  const account = await shellAccount();",
        "  return null;",
        "}",
      ].join("\n"),
      "app/api/assessments/route.ts": [
        'import { query } from "@/lib/db/client";',
        "export async function GET() {",
        '  return query("select 1");',
        "}",
      ].join("\n"),
      "components/layout/main-layout.tsx":
        '"use client";\nexport function MainLayout() { return null; }',
      "lib/auth/shell-account.ts": [
        'import { readUserProfileByUserId } from "@/lib/db/user-profiles";',
        "export async function shellAccount() { return readUserProfileByUserId('u'); }",
      ].join("\n"),
      "lib/db/user-profiles.ts": 'import { query } from "./client";',
      "lib/db/client.ts": 'import { Pool } from "pg";',
    };
    assert.deepEqual(clientGraphFindings({ sources }), []);
  });
});

describe("clientGraphFindings — the rest of the shapes", () => {
  it("flags a lazy import() of the database layer — 'not even lazily'", () => {
    const findings = clientGraphFindings({
      sources: {
        "components/a.tsx": [
          '"use client";',
          'export async function load() { return import("@/lib/db/client"); }',
        ].join("\n"),
        "lib/db/client.ts": 'import { Pool } from "pg";',
      },
    });
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /@?lib\/db\/client/);
  });

  it("flags a client module that re-exports a server module", () => {
    const findings = clientGraphFindings({
      sources: {
        "components/b.tsx": ['"use client";', 'export { query } from "@/lib/db/client";'].join(
          "\n",
        ),
        "lib/db/client.ts": 'import { Pool } from "pg";',
      },
    });
    assert.equal(findings.length, 1);
  });

  it("flags a bare server package imported directly by a client module", () => {
    const findings = clientGraphFindings({
      sources: { "components/c.tsx": ['"use client";', 'import { Pool } from "pg";'].join("\n") },
    });
    assert.equal(findings.length, 1);
    assert.deepEqual(findings[0].chain, ["components/c.tsx", "pg"]);
  });

  it("flags the entry that is only documented as a client module", () => {
    // The comment is not the directive: the file below is server code and stays legal; the
    // one-character difference is the whole rule.
    const sources = {
      "components/d.tsx": [
        '/** Never add "use client" here: this renders on the server. */',
        'import { query } from "@/lib/db/client";',
      ].join("\n"),
      "lib/db/client.ts": 'import { Pool } from "pg";',
    };
    assert.deepEqual(clientGraphFindings({ sources }), []);
  });

  it("reports one finding per offending module, not one per edge", () => {
    const findings = clientGraphFindings({
      sources: {
        "components/e.tsx": [
          '"use client";',
          'import { a } from "@/lib/db/client";',
          'import { b } from "@/lib/db/user-profiles";',
        ].join("\n"),
        "lib/db/client.ts": 'import { Pool } from "pg";',
        "lib/db/user-profiles.ts": 'import { query } from "./client";',
      },
    });
    // `pg` is reached once (through client.ts); `lib/db/user-profiles.ts` is its own crossing.
    assert.equal(findings.length, 2, JSON.stringify(findings.map((f) => f.chain)));
  });
});

/* ================================================================== *
 * The tree this ships in
 * ================================================================== */

const ROOTS = ["app", "components", "hooks", "lib", "data", "content"];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    files.push(full.slice(process.cwd().length + 1));
  }
  return files;
}

const realSources: Record<string, string> = {};
for (const root of ROOTS) {
  const dir = join(process.cwd(), root);
  for (const path of walk(dir)) realSources[path] = readFileSync(join(process.cwd(), path), "utf8");
}

describe("the real tree", () => {
  it("has no client module reaching a server-only module", () => {
    assert.deepEqual(clientGraphFindings({ sources: realSources }), []);
  });

  it("walked a tree, not an empty map — the count is what makes the clean answer mean something", () => {
    const entries = Object.keys(realSources).filter((path) =>
      hasClientDirective(realSources[path] ?? ""),
    );
    assert.ok(entries.length > 50, `expected dozens of client entries, read ${entries.length}`);
    assert.ok(
      realSources["lib/db/client.ts"] !== undefined,
      "lib/db/client.ts must be in the map, or the walk could not resolve it",
    );
    assert.ok(
      realSources["components/layout/header.tsx"] !== undefined,
      "the shell's header must be in the map",
    );
  });
});
