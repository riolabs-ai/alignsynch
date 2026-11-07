# Module: `content`

27 TypeScript modules that define the content model as zod schemas, plus the pure derivations over
them. **No React, no `next`, no `pg`** — `pnpm data:check` compiles this directory with
`tsconfig.datacheck.json` into `.datacheck/` and runs it under plain node, so an import of a
framework here is a gate failure, not a build failure.

## Responsibilities

- Be the single source of truth for what a record, an item, a response, a party and an instance may
  contain. Every object is `.strict()`, so an unknown key is a hard error rather than a silent extra.
- Hold the derivations that must not exist twice: the Gap, the Setting's tolerance, the opinion kinds
  a mode asks for, the item-id uniqueness rule.
- Define the route manifest and the page/route registries the checks read.

## Key files

- [`record.ts`](../../../content/record.ts) — the root type. `zRecord`
  (`id`, `slug`, `type`, `status`, `date`, `title`, `summary`, `authorUserId?`), `zItem`,
  `zResponseOption`, the response scales, `zTemplate`, and `gapOf()`.
- [`assessment.ts`](../../../content/assessment.ts) — `zAssessment` (a template with ≥1 Aspect),
  `zAssessmentInstance` (a copy with `templateId`, `name?`, `mode`, `setting`, a two-party tuple),
  `zParty`, and the opinion vocabulary (`feel`, `wish`, `think`, `guess`).
- [`quiz.ts`](../../../content/quiz.ts) — the quiz record and its stats; imports `record.ts` and never
  `assessment.ts`.
- [`gaps.ts`](../../../content/gaps.ts) — `gapMeetsSetting()`: Soft tolerates a Gap of 1, Full tolerates
  none.
- [`brand.ts`](../../../content/brand.ts) — the brand record's shape; the values live in
  [`data/brand.ts`](../../../data/brand.ts).
- [`routes.ts`](../../../content/routes.ts) + [`route-manifest.ts`](../../../content/route-manifest.ts) —
  the route table `data:check` E10 matches literals against.
- [`core.ts`](../../../content/core.ts) — `DEMO_NOW_ISO`, the fixture clock. Every relative label in
  the UI is a pure function of it.

## Public API

Consumers use `z.infer` types and the named derivations. The ones a change usually touches:

| Export                     | Contract                                                               |
| -------------------------- | ---------------------------------------------------------------------- |
| `zRecord` / `Record`       | The root content type; quizzes and assessments extend it.              |
| `zTemplateObject`          | The extension point — `z.extend(...)` then refine, never copy.         |
| `uniqueItemIds`            | The shared refinement two templates would otherwise each re-implement. |
| `gapOf(left, right)`       | A `0..4` union. Not a column, not a stored verdict.                    |
| `opinionKindsFor(mode)`    | Basic asks `feel`/`wish`; Advanced asks all four.                      |
| `instanceNameOf(instance)` | The one place the name → template-title fallback lives.                |

## Internal structure

Three layers, and imports only ever point one way:

1. **`core.ts`** — ids, slugs, instants, the fixture clock. Imports nothing.
2. **`record.ts`** — the root record. Imports `core.ts`. `quiz.ts` and `assessment.ts` import
   `record.ts` and never each other; `battle.ts`, `article.ts`, `identity.ts`, `people.ts` sit
   alongside.
3. **Derivations and registries** — `gaps.ts`, `steps.ts`, `stages.ts`, `metrics.ts`, `routes.ts`,
   `pages.ts`, `bundle.ts`.

## Dependencies

- **Used by:** [`data/`](data.md) (fixtures), [`components/`](components.md) (types), and every
  `lib/` writer that parses a row back into a model.
- **Uses:** `zod` only.

## Notable patterns / gotchas

- **A new field is a three-file change:** the schema here, the fixture in `data/`, then
  `pnpm data:check`. Skipping the third leaves an unknown key that `.strict()` rejects.
- **A clock is never read here either.** `content/core.ts` owns the clock; `data:check` fails a social
  fixture dated after it.
- **`lib/db/rows.ts` parses rows back through these schemas** — so the model is enforced on the way out
  of Postgres as well as on the way into the fixtures.
