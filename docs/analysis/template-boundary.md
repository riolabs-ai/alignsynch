# Where the template stops and the core begins

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Reference** › Template boundary · next [Screenshot registry](../assets/screens/README.md)

<!-- docs-nav:end -->

**Question.** Where does the bot-profile template stop and the base/common begin in this tree, and which ADRs govern that boundary.

**Answer, in one line.** The boundary is **one config module deep** (`data/brand.ts`), **one gate module wide** (`lib/brand-boundary.ts`), and **it has no ADR at all** — the only ADR family in the tree governs money, not templates.

| Fact                | Value                                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| Commit indexed      | `bdb6d37034d37c560bbaff76476a83dff5480997` (`origin/main`)                          |
| Index               | `gitnexus analyze` 2026-11-16T06:47:46Z · 1,680 files · 29,716 nodes · 78,327 edges |
| Communities / flows | 1,188 / 1,340                                                                       |
| Graph surface used  | `File`/`Function`/`Const` nodes, 6,431 `IMPORTS` edges over 1,305 importer files    |

The repository is a single Next.js app, not a package monorepo: `pnpm-workspace.yaml` declares no `packages:` list, so "packages" here means the `app/`, `components/`, `lib/`, `data/`, `content/` layers, which is also how `docs/operations/repo-layers.md` classifies the tree.

## 1. Template-owned (the expression layer)

Every file the graph attributes to the template rather than the core. "Importers" is distinct `File` nodes with an `IMPORTS` edge to it.

| Module                                                       | Files | Nodes |         Importers |
| ------------------------------------------------------------ | ----: | ----: | ----------------: |
| `data/brand.ts` — `BRAND` → record, the one resolver         |     1 |     7 |               109 |
| `content/brand.ts` — `Brand` schema                          |     1 |    12 |                31 |
| `data/brands/alignsynch.ts` — the second expression's record |     1 |     2 |     1 (+26 tests) |
| `lib/brand-boundary.ts` — the seam (`require*Product`)       |     1 |     8 | 58 (48 in `app/`) |
| `lib/brand-{mark,icon,theme,og,radius}.ts` — brand rendering |     5 |    90 |                29 |
| `lib/flags.ts` — capability resolver over `templates`        |     1 |    18 |                20 |
| `data/flags.ts` — the per-template capability record         |     1 |     8 |                 9 |
| `components/quiz/**` — the quiz component domain             |    11 |   288 |                 9 |

Reading the counts: the template layer is **12 files and ~145 nodes** carrying **293 inbound references**. The quiz domain's 9 importers are 4 quiz pages, 4 quiz components and 1 test — **zero importers from `app/` outside the quiz routes, zero from `lib/`**. `data/brands/alignsynch.ts` is imported by no production file other than `data/brand.ts`; its other 26 importers are all under `tests/`, which is what pins a brand in a unit test.

## 2. Base-common (consumed by everything)

Two tiers, and the split is the finding: tier 1 is imported by both expressions, tier 2 is imported by the alignment expression **only**.

**Tier 1 — both expressions (the real base/common)**

| Module                     | Nodes | Importers | of which quiz-named |
| -------------------------- | ----: | --------: | ------------------: |
| `lib/page-copy.ts`         |    13 |       273 |                   8 |
| `content/pages.ts`         |    18 |       267 |                   8 |
| `components/ui/button.tsx` |     7 |       148 |                  25 |
| `components/ui/card.tsx`   |     7 |       126 |                   — |
| `content/core.ts`          |    55 |       119 |                  24 |
| `components/ui/badge.tsx`  |     — |        92 |                   — |
| `lib/utils.ts`             |     2 |        84 |                   1 |
| `lib/db/client.ts`         |    31 |        76 |                   — |
| `lib/auth/session.ts`      |    14 |        59 |                   — |
| `content/record.ts`        |    43 |        35 |                   1 |

**Tier 2 — alignment-base: highest in-degree in the tree, and the quiz expression imports neither**

| Module                  | Nodes | Importers | of which quiz-named |
| ----------------------- | ----: | --------: | ------------------: |
| `content/assessment.ts` |   162 |       115 |               **0** |
| `lib/flow/paths.ts`     |    62 |       119 |               **0** |

This is the sharpest single number in the analysis: the two most-consumed domain modules in the repo — the assessment model and the flow path helpers — have **zero** quiz-named importers. The alignment product's model is not leaking into the quiz expression; the separation is by vocabulary, not by a runtime check, which is exactly what `docs/guides/template-doctrine.md` §"The schema already thinks this way" claims.

## 3. Shared-but-shouldn't-be

Edges that cross the boundary in the wrong direction, i.e. base depending on the expression, or a base surface compiling template code.

| Edge                                                                                                       | Refs | Why it is flagged                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `content/people.ts` → `content/quiz.ts`                                                                    |   12 | Base content model carries `import type { Quiz } from "./quiz"`. `content/people.ts` is imported by `lib/profile.ts`, a base module — so the core's identity model has a type dependency on the template's model. Type-only, so `check` (cycles) excludes it and nothing can fail to initialise. |
| `data/promotions.ts` → `content/quiz.ts`                                                                   |    4 | Fixture layer typed against the quiz model for the home promos.                                                                                                                                                                                                                                  |
| `data/question-templates.ts` → `content/quiz.ts`                                                           |    2 | Generically named template fixture that only types the quiz model.                                                                                                                                                                                                                               |
| `app/(marketing)/page.tsx` → `components/home/{featured-quizzes,latest-quizzes,quizzes-by-difficulty}.tsx` |    3 | The only base route importing quiz components. Brand-switched at render, but the import is static, so the quiz widgets compile into both builds and `requireQuizProduct()` is not what keeps them off the alignment page — the `switch (BrandId)` is.                                            |

`components/home/**` (22 components, 1–7 importers each) is the one place both expressions meet: the marketing home imports both `alignment-home.tsx` and the quiz widgets, which is the doctrine's "one core, many expressions" working as intended — it is listed here only because it is the sole base→template import surface.

## 4. The ADRs

**Finding first: no ADR governs the template/base boundary.** The tree contains exactly one ADR document — `docs/specs/pay-to-complete/ADR.md`, 11 decisions — and every decision in it is about money. A repo-wide search for `adr*`, `ADR*` and `decisions/` returns that file and nothing else. The boundary is instead governed by:

- `docs/guides/template-doctrine.md` — normative prose, no decision numbers ("a card that adds a screen answers the three questions below before it writes a component");
- `docs/operations/brand-release.md` — how a brand version ships without breaking parity;
- enforcement in code: `lib/brand-boundary.ts`, `tests/parity/boundary.ts`, `data:check` E35, `scripts/gen-ui-registry.mjs --check`.

| #      | Title                                        | Verdict             | Graph / tree evidence                                                                                                                                                                                                                                                                                                                                   |
| ------ | -------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-1  | Charge at completion, not at creation        | agree               | `lib/flow/payment.ts` has 4 code importers (`lib/db/relationship-payment.ts`, `lib/flow/payment-jobs.ts`, `lib/member/payment.ts`, tests); no creation route imports a charge path.                                                                                                                                                                     |
| ADR-2  | One payer per relationship                   | agree               | `db/migrations/0036_relationship_payment.sql:60` — `relationship_id TEXT PRIMARY KEY`.                                                                                                                                                                                                                                                                  |
| ADR-3  | Trial delays the charge, not the obligation  | agree               | `lib/flow/payment.ts:52` — `METHOD_TRIAL_DAYS = 7`, two use sites.                                                                                                                                                                                                                                                                                      |
| ADR-4  | Acceptance and payment are separate acts     | agree (shape)       | `instanceStatusOf()` lives in `lib/flow/state.ts`; payment is read beside it in `lib/flow/payment.ts`, not folded in.                                                                                                                                                                                                                                   |
| ADR-5  | The obligation is a table                    | agree               | `db/migrations/0036_relationship_payment.sql` exists; `relationship_payment` referenced from 3 `lib/` modules, not from `relationship` columns.                                                                                                                                                                                                         |
| ADR-6  | Every deadline derived from a stored instant | agree               | `charge_due_at` at `0036:66`; origins `method_captured_at` / `first_failed_at` in `lib/db/relationship-payment.ts`.                                                                                                                                                                                                                                     |
| ADR-7  | The timers are driven by a cron              | **contradicted**    | The decision names "a daily cron at 09:00 hitting `/api/billing/payment-jobs` (`vercel.json`)". `vercel.json` holds only `$schema` and `ignoreCommand` — **no `crons` block** — and `app/api/billing/` contains `checkout` and `webhook` only, **no `payment-jobs` route**. `lib/flow/payment-jobs.ts` exists with 4 importers and no HTTP entry point. |
| ADR-8  | The counterparty never sees billing state    | not graph-checkable | Copy-level decision; no import edge contradicts it.                                                                                                                                                                                                                                                                                                     |
| ADR-9  | Pre-existing relationships "not measured"    | agree (by absence)  | No backfill migration exists; the only payment migration is 0036, which writes forward.                                                                                                                                                                                                                                                                 |
| ADR-10 | Refusals are a vocabulary                    | agree               | `not-the-payer` appears in `lib/flow/payment.ts`, `lib/member/payment.ts`, `lib/member/publish-basis.ts` — one vocabulary, three readers.                                                                                                                                                                                                               |
| ADR-11 | The live suite is release evidence           | **contradicted**    | The decision names `tests/payment-jobs-live.test.ts` as the evidence. **That file does not exist**; `tests/` holds eight other `*-live.test.ts` and none for payment jobs.                                                                                                                                                                              |

## 5. The governing doctrine, checked against the graph

| Claim (template-doctrine.md)                                          | Graph reading                                                                                                                   | Verdict                                                                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| "twenty-two routes the quiz product owns"                             | `quizOnlyRoutes` has 22 entries; **22/22** page modules import `lib/brand-boundary.ts`                                          | agree                                                                                                                                 |
| "The flag is read here and nowhere else" (`data/brand.ts`)            | `lib/flags.ts:62` reads `process.env.BRAND`, and `next.config.mjs:90` inlines it                                                | **contradicted as written** — the _brand record_ is resolved once; the _template id_ is read a second time by the capability resolver |
| "45 routes and 33 component domains (237 files under `components/`)"  | generated `docs/ui-registry.md`: **97 routes**, **43 domains**, **357 files** (350 `.tsx`)                                      | **stale** — off by 52 routes, 10 domains, 120 files                                                                                   |
| "187 components walked, 181 with an ancestor, 6 approved exceptions"  | `components/**/*.tsx` minus `components/ui`: **299** files, 299 with a `template-ancestor:` header, 6 `template-ancestor: none` | count stale (+112), the exception count exact                                                                                         |
| The record model is generic, the alignment vocabulary a layer over it | `content/record.ts` 1 quiz-named importer of 35; `content/assessment.ts` **0 of 115**                                           | agree                                                                                                                                 |

## 6. The contradictions, ranked

1. **ADR-7's cron does not exist.** A stated scheduling decision with no `crons` entry and no `/api/billing/payment-jobs` route. Either the job moved and the ADR was not amended, or timer execution has no trigger.
2. **ADR-11 cites a file that is not in the tree.** Release evidence that cannot be re-run as written.
3. **The doctrine's own census is stale by more than half** (237 → 357 files, 45 → 97 routes). The numbers a reviewer would use to answer "how big is the surface" are wrong even though the mechanism that enforces them is green.
4. **"read here and nowhere else" is false for `process.env.BRAND`.** Two production readers, not one; `lib/flags.ts` is the second and it is the module the brand gate resolves through.
5. **One base→template dependency is inverted** (`content/people.ts` type-imports `content/quiz.ts`) — cheap, type-only, and the only such edge.

## Queries

Reproduce against the index at `bdb6d370` (`gitnexus cypher <query>`):

```cypher
-- layer sizes
MATCH (f:File) RETURN CASE WHEN f.filePath STARTS WITH 'app/' THEN 'app' … END AS layer, count(*) AS files ORDER BY files DESC
-- inbound references, the base-common ranking
MATCH (a:File)-[:CodeRelation {type:'IMPORTS'}]->(b:File) RETURN b.filePath AS target, count(DISTINCT a.filePath) AS importers ORDER BY importers DESC LIMIT 30
-- the brand gate's coverage
MATCH (a:File)-[:CodeRelation {type:'IMPORTS'}]->(b:File) WHERE b.filePath = 'lib/brand-boundary.ts' AND a.filePath STARTS WITH 'app/' RETURN a.filePath ORDER BY a.filePath
-- cross-boundary edges, base depending on the expression
MATCH (a:File)-[:CodeRelation {type:'IMPORTS'}]->(b:File) WHERE a.filePath STARTS WITH 'content/' AND b.filePath CONTAINS 'quiz' RETURN a.filePath, b.filePath
-- the template-ancestor census
MATCH (f:File) WHERE f.filePath STARTS WITH 'components/' AND NOT f.filePath STARTS WITH 'components/ui/' AND f.filePath ENDS WITH '.tsx' RETURN count(*) AS tsx_files, sum(CASE WHEN f.content CONTAINS 'template-ancestor: none' THEN 1 ELSE 0 END) AS none_headers
```

## Limits of this reading

- The graph sees `import` edges, not statement order. "The gate is the first statement of every page" is asserted by 22/22 imports, not proven by the graph.
- `BRAND` is a build constant resolved at import, so no graph query can tell which record was in the bundle a given route rendered; that is what `pnpm parity` measures, not the graph.
- `db/` is not indexed as data — the migration evidence in §4 is file-level (`0036`, line numbers by inspection), not an edge in the graph.
- The analysis index lives on a worktree of `bdb6d370`; the shared checkout's index remains at `a04f575f`, which is why `list_repos` shows two entries with the same name.

_Analysis only. No product code was changed._

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Reference** › Template boundary · next [Screenshot registry](../assets/screens/README.md)

<!-- docs-nav:end -->
