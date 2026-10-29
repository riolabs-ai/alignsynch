/**
 * E23 — the page-copy ratchet, with a negative case for every way it can be defeated.
 *
 * The rule is two-part on purpose, and each part is tested alone:
 *
 *   leaf rule  a literal longer than 24 chars is an error by itself
 *   budget     the *count* may not exceed the recorded number, so a short label
 *              added to buy headroom is caught too
 *
 * The rest of the cases are the ways a passing check could still be a lie: a budget
 * with no fixture, a fixture the page never imports (copy written and not wired), a
 * component asking for an id the fixture does not carry, and a directory whose dead
 * components are silently counted as the route's.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  zPageCopy,
  type PageCopy,
  type PageCopyBudget,
  type PageCopyTable,
} from "../../content/pages";
import {
  COPY_LITERAL_MAX,
  attributedFiles,
  copyProblems,
  importClosure,
  leafLiterals,
  measureRoute,
  resolveSpecifier,
  type SourceFile,
} from "../copy-refs";

const file = (path: string, source: string): SourceFile => ({ path, source });

/** A copy fixture that parses — the cases below only change what they test. */
const copyOf = (value: unknown): PageCopy => zPageCopy.parse(value);

const HOME = copyOf({
  heading: "Home",
  cta: { label: "Go", href: "/explore" },
  sections: [
    {
      id: "latest",
      heading: "Latest quizzes",
      items: [{ id: "play", label: "Play now" }],
    },
  ],
});

/** The smallest tree the rule can run on: a page, one band, the fixture. */
const TREE: SourceFile[] = [
  file(
    "app/(mainlayout)/page.tsx",
    `import { Band } from "@/components/home/band";
import { homePageCopy } from "@/data/pages/home";

export default function Home() {
  return <Band copy={sectionOf(homePageCopy, "latest")} />;
}
`,
  ),
  file(
    "components/home/band.tsx",
    `import { itemLabel } from "@/lib/page-copy";

export function Band({ copy }: { copy: PageCopySection }) {
  return <h2 className="x">{copy.heading}</h2>;
}
`,
  ),
  file("data/pages/home.ts", `export const homePageCopy = {};`),
];

const BUDGET: PageCopyBudget = {
  "/": {
    page: "app/(mainlayout)/page.tsx",
    dirs: ["components/home"],
    fixture: "data/pages/home",
    budget: 0,
  },
};

const check = (
  overrides: {
    sources?: SourceFile[];
    copies?: PageCopyTable;
    budget?: PageCopyBudget;
    routePatterns?: string[];
    resolves?: (href: string) => boolean;
  } = {},
) =>
  copyProblems({
    copies: overrides.copies ?? { "/": HOME },
    budget: overrides.budget ?? BUDGET,
    sources: overrides.sources ?? TREE,
    routePatterns: overrides.routePatterns ?? ["/", "/explore"],
    resolves: overrides.resolves ?? (() => true),
  });

const messages = (overrides: Parameters<typeof check>[0] = {}) =>
  check(overrides).map((problem) => problem.message);

describe("leafLiterals", () => {
  it("counts JSX text and string attributes", () => {
    const literals = leafLiterals(
      file(
        "components/home/x.tsx",
        `export const X = () => (
  <div>
    <p>Some words here</p>
    <input placeholder="Type here" />
  </div>
);
`,
      ),
    );
    assert.deepEqual(
      literals.map((literal) => literal.value),
      ["Some words here", "Type here"],
    );
    assert.equal(literals[0].line, 3);
  });

  it("ignores markup: className, href, alt, variant, aria-* and data-*", () => {
    const literals = leafLiterals(
      file(
        "components/home/x.tsx",
        `<a className="rounded bg-indigo-50" href="/explore" aria-label="see all" data-test="x">
  <Badge variant="outline" alt="A cover" />
</a>
`,
      ),
    );
    assert.deepEqual(literals, []);
  });

  it("ignores glyph-only segments — `$`, a quote mark, an emoji are not copy", () => {
    const literals = leafLiterals(file("components/home/x.tsx", `<p>$<span>{"x"}</span>💰</p>`));
    assert.deepEqual(literals, []);
  });

  it("ignores `dataKey` and `align` — a charted field and a popover edge are not copy", () => {
    const literals = leafLiterals(
      file(
        "components/home/x.tsx",
        `<Bar name="Your Score" dataKey="score" />
<PopoverContent align="end" />`,
      ),
    );
    // `name` is markup too; `align` and `dataKey` are the two this case exists for.
    assert.deepEqual(literals, []);
  });

  it("does not extract a string literal inside an expression (inventory parity)", () => {
    const literals = leafLiterals(
      file("components/home/x.tsx", `<p>{name ?? "Uncategorised"}</p>`),
    );
    assert.deepEqual(literals, []);
  });

  it("collapses whitespace the way JSX renders it", () => {
    const [literal] = leafLiterals(
      file("components/home/x.tsx", `<p>\n  two   lines\n  of text\n</p>`),
    );
    assert.equal(literal.value, "two lines of text");
  });
});

describe("resolveSpecifier / importClosure", () => {
  const known = new Set([
    "app/page.tsx",
    "components/home/band.tsx",
    "components/home/dead.tsx",
    "components/ui/card.tsx",
    "data/pages/home.ts",
  ]);

  it("resolves @/ and relative specifiers, and leaves packages alone", () => {
    assert.equal(
      resolveSpecifier("app/page.tsx", "@/components/home/band", known),
      "components/home/band.tsx",
    );
    assert.equal(
      resolveSpecifier("components/home/band.tsx", "../ui/card", known),
      "components/ui/card.tsx",
    );
    assert.equal(resolveSpecifier("app/page.tsx", "next/link", known), undefined);
    assert.equal(resolveSpecifier("app/page.tsx", "@/nope", known), undefined);
  });

  it("includes the entry and everything it imports, transitively", () => {
    const sources = [
      file("app/page.tsx", `import { Band } from "@/components/home/band";`),
      file(
        "components/home/band.tsx",
        `import { Card } from "../ui/card"; import { copy } from "@/data/pages/home";`,
      ),
      file("components/ui/card.tsx", `export const Card = 1;`),
      file("data/pages/home.ts", `export const copy = {};`),
      file("components/home/dead.tsx", `export const Dead = 1;`),
    ];
    assert.deepEqual(importClosure("app/page.tsx", sources), [
      "app/page.tsx",
      "components/home/band.tsx",
      "components/ui/card.tsx",
      "data/pages/home.ts",
    ]);
  });

  it("attributes only the files inside the route's own directories", () => {
    const sources = [
      file("app/page.tsx", `import { Band } from "@/components/home/band";`),
      file("components/home/band.tsx", `import { Card } from "../ui/card";`),
      file("components/ui/card.tsx", ``),
      file("components/home/dead.tsx", `<p>Nobody imports this sentence</p>`),
    ];
    const attributed = attributedFiles(
      { page: "app/page.tsx", dirs: ["components/home"] },
      sources,
    );
    assert.deepEqual(attributed, ["components/home/band.tsx"]);
    // In the directory, but not in the closure: attribution is reachability, not listing.
    assert.equal(
      measureRoute({ page: "app/page.tsx", dirs: ["components/home"] }, sources).literals.length,
      0,
    );
  });
});

describe("copyProblems — the passing tree", () => {
  it("reports nothing when the fixture is wired, in budget, and the ids resolve", () => {
    assert.deepEqual(check(), []);
  });

  it("accepts a literal exactly at the leaf threshold", () => {
    const sentence = "x".repeat(COPY_LITERAL_MAX);
    const sources = [
      ...TREE,
      file("components/home/band.tsx", `<h2>{copy.heading}</h2><p>{sentence}</p>`),
    ];
    // `sentence` is an expression, not a literal — a literal of that exact length is fine.
    const literals = leafLiterals(file("components/home/x.tsx", `<p>${sentence}</p>`));
    assert.equal(literals[0].value.length, COPY_LITERAL_MAX);
    assert.deepEqual(messages({ sources, budget: { "/": { ...BUDGET["/"], budget: 0 } } }), []);
  });
});

describe("copyProblems — every way it fails", () => {
  it("names file:line for a sentence left in a component", () => {
    const sources = [
      ...TREE,
      file(
        "components/home/band.tsx",
        `export function Band() {\n  return <p>Every quiz here was written by a real creator</p>;\n}`,
      ),
    ];
    const found = messages({ sources });
    assert.equal(found.length, 2, found.join("\n"));
    assert.match(found[0], /components\/home\/band\.tsx:2 still renders the literal/);
    assert.match(found[0], /data\/pages\/home\.ts/);
    assert.match(found[1], /measures 1 leaf literals, budget is 0/);
  });

  it("fails on a short label once the budget is spent — the count is the ratchet", () => {
    const sources = [
      ...TREE,
      file("components/home/band.tsx", `<h2>{copy.heading}</h2><span>Bonus</span>`),
    ];
    const found = messages({ sources });
    assert.equal(found.length, 1);
    assert.match(found[0], /"Bonus"/);
    assert.match(found[0], /the budget only goes down/);
  });

  it("fails when a route has copy and no recorded budget", () => {
    const found = messages({ budget: {} });
    assert.match(found.join("\n"), /"\/" has copy but no data\/pages\/budget\.ts entry/);
  });

  it("fails when a budget points at a route with no fixture", () => {
    const found = messages({ budget: { ...BUDGET, "/pricing": BUDGET["/"] } });
    assert.match(found.join("\n"), /"\/pricing" has a budget but no fixture/);
  });

  it("fails when the fixture is not reachable from the page — written and not wired", () => {
    const sources = [
      file("app/(mainlayout)/page.tsx", `import { Band } from "@/components/home/band";`),
      file("components/home/band.tsx", `<h2>Static</h2>`),
      file("data/pages/home.ts", `export const homePageCopy = {};`),
    ];
    const found = messages({ sources });
    assert.match(found.join("\n"), /never imports — copy written and not wired changes nothing/);
  });

  it("fails when the declared surface directory holds nothing", () => {
    const found = messages({ budget: { "/": { ...BUDGET["/"], dirs: ["components/gone"] } } });
    assert.match(found.join("\n"), /dir "components\/gone", which holds no source files/);
  });

  it("fails when a component asks for a section the fixture does not declare", () => {
    const sources = [
      ...TREE,
      file(
        "app/(mainlayout)/page.tsx",
        `import { Band } from "@/components/home/band";
import { homePageCopy } from "@/data/pages/home";

export const x = sectionOf(homePageCopy, "latest-quizes");
`,
      ),
    ];
    const found = messages({ sources });
    assert.match(found.join("\n"), /asks for section "latest-quizes"/);
  });

  it("fails when a component asks for a copy item that does not exist", () => {
    const sources = [
      ...TREE,
      file("components/home/band.tsx", `<h2>{itemLabel(copy, "play-now")}</h2>`),
    ];
    const found = messages({ sources });
    assert.match(found.join("\n"), /asks for copy item "play-now"/);
  });

  it("fails on a duplicate section id or a duplicate item id", () => {
    const duplicated = copyOf({
      heading: "Home",
      sections: [
        { id: "latest", heading: "Latest" },
        { id: "latest", heading: "Latest again" },
        {
          id: "other",
          heading: "Other",
          items: [
            { id: "a", label: "A" },
            { id: "a", label: "A again" },
          ],
        },
      ],
    });
    const found = messages({ copies: { "/": duplicated } });
    assert.match(found.join("\n"), /section id "latest" is declared twice/);
    assert.match(found.join("\n"), /section "other" declares item "a" twice/);
  });

  it("fails on a cta href no route resolves — a link that left JSX is still checked", () => {
    const found = messages({ resolves: (href) => href !== "/explore" });
    assert.match(found.join("\n"), /cta href "\/explore" resolves to no route/);
  });

  it("fails when the copy key is not a route pattern", () => {
    const found = messages({ copies: { "/": HOME, "/nope": HOME }, routePatterns: ["/"] });
    assert.match(found.join("\n"), /"\/nope" is not a route in content\/routes\.ts/);
  });

  it("fails when nothing proves the home route at all", () => {
    const found = messages({ copies: {}, budget: {} });
    assert.match(
      found.join("\n"),
      /no PageCopy fixture for "\/" — the ratchet has nothing to prove/,
    );
  });
});
