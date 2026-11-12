# recharts 3 render evidence (#571 deferred)

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › recharts 3 · prev [Templates and relationships after creation](../qa-noun-crud/README.md) · next [Relationship detail — the edit form is asked for](../qa-rel-detail-edit/README.md)

<!-- docs-nav:end -->

Three pies whose labels are built from recharts' `percent` argument — the field
recharts 3 retyped as optional, which is what turned into three `percent is
possibly 'undefined'` typecheck errors. The `?? 0` fallbacks added for that are
typing-only: every label below rendered with a defined value, read back from the
live DOM in the same run as the screenshot.

| shot                                 | route                      | pie                 | labels read back from the DOM                                                   |
| ------------------------------------ | -------------------------- | ------------------- | ------------------------------------------------------------------------------- |
| `statistics-completion-analysis.png` | `/my-quizzes/1/statistics` | Completion Analysis | `87%`, `13%` (custom `<text>` label)                                            |
| `statistics-player-demographics.png` | `/my-quizzes/1/statistics` | Age Distribution    | `13-17: 15%`, `18-24: 35%`, `25-34: 25%`, `35-44: 15%`, `45+: 10%`              |
| `daily-challenge-categories.png`     | `/daily-challenge`         | Categories          | `Science 35%`, `History 25%`, `Geography 20%`, `Entertainment 15%`, `Sports 5%` |

## Both routes are quiz-only, so there is no AlignSynch capture

The card asked for these two routes under `BRAND=alignsynch`. They cannot render
there: both pages call `requireQuizProduct()` (#300) and `tests/parity/boundary.ts`
asserts that they answer `404` on the alignment build. Measured on an
`alignsynch` production build:

```
/daily-challenge                 404
/my-quizzes/1/statistics         404
```

So the shots are from `BRAND=quizhub`, the only brand that serves them. The charts
are shared code (`components/ui/chart.tsx`), and the alignsynch gate typechecks and
builds both consumers, so the AlignSynch lane is covered by the gate rather than by
a screenshot of a route it deliberately hides.

Captured from `pnpm build` + `pnpm start` (no dev badge) at 1440 px, each clipped to
its own card so the labels are legible. recharts 3 renders pie labels only once the
entrance animation finishes (`showLabels: !isAnimating`), so the capture waits 4.5 s
after mount or tab switch — an earlier attempt read an empty label layer for exactly
that reason.

## Related

- [ui-registry.md](../ui-registry.md) — the surfaces that render the pies.
- [README.md](../qa-v1x-ui-cohort/README.md) — the UI cohort this dependency move belongs to.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › recharts 3 · prev [Templates and relationships after creation](../qa-noun-crud/README.md) · next [Relationship detail — the edit form is asked for](../qa-rel-detail-edit/README.md)

<!-- docs-nav:end -->
