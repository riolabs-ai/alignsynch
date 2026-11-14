/**
 * #858 — one left-justified column for every dashboard page, and the cases that keep it one.
 *
 * `scripts/column-refs.ts` holds `data/surface-columns.ts` against the tree. Each case below is a
 * way the rule stops being true *or stops being checked*, which is the same defect twice: a page
 * that centres itself, and a registry that has quietly agreed to it.
 *
 *   the route      a page maps to its path with the bracket segments intact; a marketing page is
 *                  not this check's business
 *   the registry   a page with no row, a row with no page, two rows for one route
 *   the exception  `wide`/`bleed` owe a reason, `bleed` owes a `back`, `column` owes neither — and
 *                  a `back` must be a route the tree actually owns
 *   the way back   a `back` nobody spells in the chrome is a sentence, not a control
 *   the column     a page or the component it renders must draw `StageColumn`, and one that draws
 *                  neither is the next page joining the wrong width
 *   the centring   `container mx-auto max-w-4xl` is the defect; the same words in a docstring are
 *                  documentation; a `wide` page's own view is the registered exception
 *   the allowance  an exact string in an exact file, and a row nothing uses is a finding
 *
 * The last case walks the real tree, because a rule nobody can violate in a fixture is a comment.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { surfaceColumns, type SurfaceColumn } from "../../data/surface-columns";
import {
  CENTRING_ALLOWANCES,
  centringHits,
  checkColumns,
  importedModules,
  reachesLiteral,
  registryProblems,
  rendersColumn,
  resolveImport,
  routeOfPageFile,
  type SourceFile,
} from "../column-refs";

/** A page under the route group, with whatever markup a case needs. */
function page(route: string, body: string): SourceFile {
  const path = route === "/" ? "app/(mainlayout)/page.tsx" : `app/(mainlayout)${route}/page.tsx`;
  return { path, source: body };
}

/** A module a page imports, spelled the way `@/` resolves it. */
function module(path: string, body: string): SourceFile {
  return { path, source: body };
}

/** A `column` page that complies, so a case can vary exactly one thing. */
function compliantPage(route: string): SourceFile {
  return page(route, `export default function P() { return <StageColumn>x</StageColumn>; }`);
}

const MESSAGES = (files: SourceFile[], rows: readonly SurfaceColumn[]) =>
  checkColumns({ files, rows }).problems.map((problem) => problem.message);

describe("routeOfPageFile", () => {
  it("maps a page to its route, keeping the bracket segments", () => {
    assert.equal(routeOfPageFile("app/(mainlayout)/dashboard/page.tsx"), "/dashboard");
    assert.equal(
      routeOfPageFile("app/(mainlayout)/assessment/instances/[instanceId]/page.tsx"),
      "/assessment/instances/[instanceId]",
    );
  });

  it("is not interested in anything that is not a page under the shell", () => {
    assert.equal(routeOfPageFile("app/(marketing)/page.tsx"), null);
    assert.equal(routeOfPageFile("app/(mainlayout)/dashboard/loading.tsx"), null);
    assert.equal(routeOfPageFile("components/dashboard/relationships-list.tsx"), null);
  });
});

describe("the registry", () => {
  it("fails a page with no row — the next page joining the wrong width", () => {
    const messages = MESSAGES([compliantPage("/dashboard")], []);
    assert.ok(messages.some((message) => message.includes("/dashboard has no row")));
  });

  it("fails a row no page owns — a decision about nothing", () => {
    const messages = MESSAGES([], [{ path: "/dashboard", mode: "column" }]);
    assert.ok(messages.some((message) => message.includes("registered but no page")));
  });

  it("fails two rows for one route", () => {
    const messages = MESSAGES(
      [compliantPage("/dashboard")],
      [
        { path: "/dashboard", mode: "column" },
        { path: "/dashboard", mode: "wide", reason: "because" },
      ],
    );
    assert.ok(messages.some((message) => message.includes("two rows for /dashboard")));
  });
});

describe("the exception", () => {
  it("fails a wide row with no reason", () => {
    const problems = registryProblems(
      [{ route: "/explore", file: "app/(mainlayout)/explore/page.tsx" }],
      [{ path: "/explore", mode: "wide", reason: "  " }],
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0]?.message ?? "", /wide with no reason/);
  });

  it("fails a bleed row with no back, and a back no page owns", () => {
    const missing = registryProblems(
      [{ route: "/chat", file: "app/(mainlayout)/chat/page.tsx" }],
      [{ path: "/chat", mode: "bleed", reason: "panes" }],
    );
    assert.match(missing[0]?.message ?? "", /bleed with no back/);

    const dangling = registryProblems(
      [{ route: "/chat", file: "app/(mainlayout)/chat/page.tsx" }],
      [{ path: "/chat", mode: "bleed", reason: "panes", back: "/nowhere" }],
    );
    assert.match(dangling[0]?.message ?? "", /backs onto \/nowhere/);
  });

  it("fails a column that excuses itself, and a wide that names a back", () => {
    const excused = registryProblems(
      [{ route: "/dashboard", file: "app/(mainlayout)/dashboard/page.tsx" }],
      [{ path: "/dashboard", mode: "column", reason: "it is fine" }],
    );
    assert.match(excused[0]?.message ?? "", /column but carries a reason/);

    const wideWithBack = registryProblems(
      [{ route: "/explore", file: "app/(mainlayout)/explore/page.tsx" }],
      [{ path: "/explore", mode: "wide", reason: "grid", back: "/dashboard" }],
    );
    assert.match(wideWithBack[0]?.message ?? "", /only bleed surfaces lose/);
  });
});

describe("the way back", () => {
  const chrome = [
    page(
      "/chat",
      `import { ChatPage } from "@/components/chat/chat-page";\nexport default () => <ChatPage />;`,
    ),
    module(
      "components/chat/chat-page.tsx",
      `import { ChatHeader } from "@/components/chat/chat-header";\nexport function ChatPage() { return <ChatHeader />; }`,
    ),
    module(
      "components/chat/chat-header.tsx",
      `export function ChatHeader() { return <a href="/dashboard/user">Back</a>; }`,
    ),
  ];

  it("passes when the chrome two hops down spells the path", () => {
    const files = new Map(chrome.map((file) => [file.path, file]));
    assert.equal(reachesLiteral("app/(mainlayout)/chat/page.tsx", "/dashboard/user", files), true);
  });

  it("fails a back the chrome never spells — the registry would be describing a control nobody built", () => {
    const messages = MESSAGES(chrome, [
      { path: "/chat", mode: "bleed", reason: "panes", back: "/dashboard" },
    ]);
    assert.ok(messages.some((message) => message.includes("no module within two imports")));
  });
});

describe("the column", () => {
  it("accepts a page that renders the column itself", () => {
    assert.deepEqual(
      MESSAGES([compliantPage("/dashboard")], [{ path: "/dashboard", mode: "column" }]),
      [],
    );
  });

  it("accepts a page whose component renders the column — the shipped shells, not a second wrapper", () => {
    const files = [
      page(
        "/dashboard",
        `import { Overview } from "@/components/console/overview";\nexport default () => <Overview />;`,
      ),
      module(
        "components/console/overview.tsx",
        `export function Overview() { return <StageColumn>x</StageColumn>; }`,
      ),
    ];
    assert.deepEqual(MESSAGES(files, [{ path: "/dashboard", mode: "column" }]), []);
  });

  it("fails a page that draws no column at all", () => {
    const files = [
      page(
        "/new-page",
        `import { Thing } from "@/components/thing";\nexport default () => <Thing />;`,
      ),
      module("components/thing.tsx", `export function Thing() { return <div>hi</div>; }`),
    ];
    const messages = MESSAGES(files, [{ path: "/new-page", mode: "column" }]);
    assert.ok(messages.some((message) => message.includes("nothing it renders draws StageColumn")));
  });
});

describe("the centring", () => {
  it("reads a container as a finding, with the line it sits on", () => {
    const hits = centringHits(
      `export const A = () => (\n  <div className="container mx-auto max-w-4xl" />\n);`,
    );
    assert.deepEqual(
      hits.map((hit) => hit.token),
      ["mx-auto"],
    );
    assert.equal(hits[0]?.line, 2);
  });

  it("reads a bare container class as a finding too — it centres itself at every breakpoint", () => {
    assert.equal(centringHits(`<div className="container py-6" />`).length, 1);
  });

  it("does not read a docstring or a JSX comment as a violation", () => {
    const source = `/**\n * A centred column (\`mx-auto max-w-*\`) moves.\n */\n{/* the scroll container draws no bar */}\n<p>x</p>`;
    assert.deepEqual(centringHits(source), []);
  });

  it("fails a column page whose view centres the body", () => {
    const files = [
      page(
        "/dashboard",
        `import { Overview } from "@/components/console/overview";\nexport default () => <StageColumn><Overview /></StageColumn>;`,
      ),
      module(
        "components/console/overview.tsx",
        `export function Overview() {\n  return <div className="container mx-auto max-w-4xl">x</div>;\n}`,
      ),
    ];
    const messages = MESSAGES(files, [{ path: "/dashboard", mode: "column" }]);
    assert.ok(messages.some((message) => message.includes("re-centres /dashboard")));
  });

  it("leaves a wide page's own view alone — that is what the row is", () => {
    const files = [
      page(
        "/explore",
        `import { Grid } from "@/components/explore/grid";\nexport default () => <Grid />;`,
      ),
      module(
        "components/explore/grid.tsx",
        `export function Grid() { return <div className="container mx-auto max-w-7xl">x</div>; }`,
      ),
    ];
    assert.deepEqual(MESSAGES(files, [{ path: "/explore", mode: "wide", reason: "grid" }]), []);
  });
});

describe("imports", () => {
  it("reads @/ and relative specifiers, and drops packages and type-only imports", () => {
    const source = [
      `import { StageColumn } from "@/components/assessment-flow/stage-column";`,
      `import { cn } from "./utils";`,
      `import type { Foo } from "@/lib/foo";`,
      `import { useState } from "react";`,
    ].join("\n");
    assert.deepEqual(importedModules(source), [
      "@/components/assessment-flow/stage-column",
      "./utils",
    ]);
  });

  it("resolves the extension and the index file the way the bundler does", () => {
    const files = new Map([
      ["components/a.tsx", { path: "components/a.tsx", source: "" }],
      ["components/b/index.tsx", { path: "components/b/index.tsx", source: "" }],
    ]);
    const exists = (path: string) => files.has(path);
    assert.equal(resolveImport("app/page.tsx", "@/components/a", exists), "components/a.tsx");
    assert.equal(resolveImport("app/page.tsx", "@/components/b", exists), "components/b/index.tsx");
    assert.equal(resolveImport("app/page.tsx", "@/components/c", exists), null);
  });
});

describe("the allowance", () => {
  it("is one exact string in one exact file, and every row names a string its file carries", () => {
    assert.ok(CENTRING_ALLOWANCES.length > 0, "the dialog is the only documented centring left");
    for (const allowance of CENTRING_ALLOWANCES) {
      const source = readFileSync(join(process.cwd(), allowance.file), "utf8");
      const hits = centringHits(source);
      assert.ok(
        hits.some((hit) => hit.text === allowance.text.trim()),
        `${allowance.file} no longer carries "${allowance.text.trim()}" — delete the allowance instead of widening it`,
      );
      assert.ok(allowance.why.trim().length > 0, "an allowance without a reason is a hole");
    }
  });

  it("reports a row nothing uses as a finding, once its file is walked", () => {
    const allowance = CENTRING_ALLOWANCES[0];
    assert.ok(allowance !== undefined, "there is at least the dialog's allowance");
    /** A page that imports the allowed file but whose source has moved on. */
    const report = checkColumns({
      files: [
        page(
          "/dashboard",
          `import { StageShell } from "@/components/assessment-flow/stage-shell";\nexport default () => <StageColumn><StageShell /></StageColumn>;`,
        ),
        module(
          "components/assessment-flow/stage-shell.tsx",
          `export function StageShell() { return null; }`,
        ),
      ],
      rows: [{ path: "/dashboard", mode: "column" }],
    });
    assert.ok(
      report.problems.some((problem) => problem.message.includes("stale allowance")),
      "a walked file that no longer carries the exact string must say so",
    );
  });
});

describe("the real tree", () => {
  /**
   * The gate's own judgement, run here so a fixture cannot pass while the tree does not: every
   * page under the shell has a row, every column page draws the column, and nothing in the
   * dashboard family re-centres the body.
   */
  it("is clean", () => {
    const root = process.cwd();
    const walk = (directory: string): SourceFile[] => {
      const out: SourceFile[] = [];
      for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) out.push(...walk(path));
        else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
          out.push({ path, source: readFileSync(join(root, path), "utf8") });
        }
      }
      return out;
    };

    const files = [...walk("app/(mainlayout)"), ...walk("components")];
    const report = checkColumns({ files, rows: surfaceColumns });
    assert.deepEqual(
      report.problems.map((problem) => `${problem.file}: ${problem.message}`),
      [],
    );
    assert.equal(
      report.census.column + report.census.wide + report.census.bleed,
      report.census.pages,
    );
  });
});

describe("rendersColumn", () => {
  it("is false for a page whose imports do not exist in the set", () => {
    assert.equal(rendersColumn(`<Thing />`, ["components/thing.tsx"], new Map()), false);
  });

  it("follows two hops — the create flow's stages hand the column to the one shell (#979 B)", () => {
    const files = new Map([
      [
        "components/create-relationship.tsx",
        { path: "components/create-relationship.tsx", source: `<RelationshipFlowShell />` },
      ],
      [
        "components/relationship-flow-shell.tsx",
        { path: "components/relationship-flow-shell.tsx", source: `<StageColumn />` },
      ],
    ]);
    const imports = ["components/create-relationship.tsx"];
    // One hop: the column is not in `create-relationship.tsx` any more.
    assert.equal(rendersColumn(`<CreateRelationship />`, imports, files, 1), false);
    // Two: the shell it renders draws it.
    assert.equal(rendersColumn(`<CreateRelationship />`, imports, files), true);
  });

  it("stops at two hops, so a page that draws no column still fails", () => {
    const files = new Map([
      ["a.tsx", { path: "a.tsx", source: `import { B } from "./b";` }],
      ["b.tsx", { path: "b.tsx", source: `import { C } from "./c";` }],
      ["c.tsx", { path: "c.tsx", source: `<StageColumn />` }],
    ]);
    assert.equal(rendersColumn(`<A />`, ["a.tsx"], files), false);
  });
});
